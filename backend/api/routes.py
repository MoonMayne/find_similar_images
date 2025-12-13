from __future__ import annotations

import logging
import threading
import time
from pathlib import Path
from typing import Dict, List, Optional

from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field, validator


from backend.config import DEFAULT_WORKERS, HASH_DB, TRASH_DIR, THUMBNAIL_MAX_SIZE
from backend.core.hash_engine import scan_and_group
from backend.core.file_manager import TrashConfig, move_to_trash
from backend.state import JOB_STORE, GroupResult, ScanJob
from backend.storage import SQLiteStore
from backend.utils.thumbnails import thumbnail_bytes
from backend.utils.image_utils import image_stats, suggest_keeper

router = APIRouter()
STORE = SQLiteStore()
# Load persisted jobs on startup
JOB_STORE.reset(STORE.load_jobs())


class ScanRequest(BaseModel):
    directories: List[Path] = Field(..., description="List of directories to scan")
    primary_dir: Optional[Path] = Field(None, description="Primary directory to keep")
    hash_size: Optional[int] = Field(None, ge=2, le=64, description="Hash size (tunes similarity)")
    workers: Optional[int] = Field(DEFAULT_WORKERS, ge=1, description="Thread count for hashing")
    algorithm: str = Field("phash", description="duplicate_images algorithm")
    hash_db: Optional[Path] = Field(HASH_DB, description="Path to hash cache (JSON)")
    exclude_regexes: Optional[List[str]] = Field(None, description="Regex to exclude paths")
    enable_sharpness_check: Optional[bool] = Field(False, description="Enable sharpness check for suggested image")

    @validator("directories", each_item=True)
    def _must_exist(cls, value: Path) -> Path:
        if not value.exists() or not value.is_dir():
            raise ValueError(f"DirectoryNotFound:{value}")
        return value.resolve()

    @validator("primary_dir")
    def _primary_must_exist(cls, value: Optional[Path]) -> Optional[Path]:
        if value and (not value.exists() or not value.is_dir()):
            raise ValueError(f"Primary directory not found: {value}")
        return value.resolve() if value else value

    @validator("hash_db")
    def _ensure_parent(cls, value: Optional[Path]) -> Optional[Path]:
        if value:
            value.parent.mkdir(parents=True, exist_ok=True)
        return value


class ScanResponse(BaseModel):
    job_id: str
    status: str


class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    message: str
    groups: int


class GroupOut(BaseModel):
    id: int
    files: List[str]
    suggested: Optional[str]
    stats: Dict[str, Dict]


class GroupsResponse(BaseModel):
    job_id: str
    total_groups: int
    groups: List[GroupOut]
    directories: List[str]


class LatestJobResponse(BaseModel):
    job_id: Optional[str]
    status: str
    groups: int


class TrashRequest(BaseModel):
    job_id: str
    paths: List[Path]
    destination: Optional[Path] = TRASH_DIR
    recreate_paths: bool = False

    @validator("destination")
    def _ensure_dest_parent(cls, value: Optional[Path]) -> Optional[Path]:
        if value:
            value.mkdir(parents=True, exist_ok=True)
        return value


class TrashNonPrimaryRequest(BaseModel):
    job_id: str
    primary_dir: Path
    destination: Optional[Path] = TRASH_DIR
    recreate_paths: bool = False

    @validator("primary_dir")
    def _primary_exists(cls, value: Path) -> Path:
        if not value.exists() or not value.is_dir():
            raise ValueError(f"Primary directory not found: {value}")
        return value.resolve()

    @validator("destination")
    def _ensure_dest_parent(cls, value: Optional[Path]) -> Optional[Path]:
        if value:
            value.mkdir(parents=True, exist_ok=True)
        return value


def _process_group_for_suggestion(
    group: List[Path],
    group_id: int,
    primary_dir: Optional[Path],
    enable_sharpness_check: bool,
) -> GroupResult:
    """Helper function to process a single group for suggestions."""
    stats = {str(path): image_stats(path) for path in group}
    suggested = suggest_keeper(list(group), primary_dir, enable_sharpness_check)
    return GroupResult(
        id=group_id,
        files=[str(p) for p in group],
        suggested=str(suggested),
        stats=stats,
    )


def _run_scan(job: ScanJob, payload: ScanRequest) -> None:
    job.status = "running"
    JOB_STORE.update(job)
    STORE.save_job(job)

    # Helper function to perform the actual scan_and_group logic
    def perform_scan_attempt():
        # Check if cancelled before starting scan
        current_job = JOB_STORE.get(job.id)
        if current_job and current_job.cancel_requested:
            return None  # Signal cancellation

        return scan_and_group(
            directories=[p for p in payload.directories],
            hash_size=payload.hash_size,
            workers=payload.workers,
            algorithm=payload.algorithm,
            hash_db=payload.hash_db,
            exclude_regexes=payload.exclude_regexes,
        )

    groups = None # Initialize groups to None
    try:
        try:
            groups = perform_scan_attempt()

            # Check if cancelled after scan completes
            current_job = JOB_STORE.get(job.id)
            if groups is None or (current_job and current_job.cancel_requested):
                job.status = "cancelled"
                job.message = "Scan cancelled by user"
                return

        except ValueError as err:
            # Check for Metadata mismatch error from duplicate_images library
            if "Metadata mismatch" in str(err) and payload.hash_db and payload.hash_db.exists():
                logging.warning(f"Metadata mismatch detected in hash_db: {payload.hash_db}. Attempting to clear and retry.")
                try:
                    payload.hash_db.unlink()  # Delete the conflicting hash_db file
                    logging.info(f"Cleared hash_db: {payload.hash_db}. Retrying scan.")
                    groups = perform_scan_attempt() # Retry scan

                    # Check cancellation after retry
                    current_job = JOB_STORE.get(job.id)
                    if groups is None or (current_job and current_job.cancel_requested):
                        job.status = "cancelled"
                        job.message = "Scan cancelled by user"
                        return

                except Exception as retry_err:
                    logging.exception(f"Scan failed after clearing hash_db and retrying: {retry_err}")
                    job.status = "failed"
                    job.message = f"Scan failed after hash_db reset: {retry_err}"
                    groups = None # Ensure groups is None if retry fails
            else:
                # Not a metadata mismatch ValueError, treat as regular failure
                logging.exception("Scan failed with unexpected ValueError")
                job.status = "failed"
                job.message = str(err)
                groups = None
        except Exception as err:  # Catch any other general exceptions during scan attempt
            logging.exception("Scan failed")
            job.status = "failed"
            job.message = str(err)
            groups = None

        # Check cancellation before processing groups
        current_job = JOB_STORE.get(job.id)
        if current_job and current_job.cancel_requested:
            job.status = "cancelled"
            job.message = "Scan cancelled by user"
            return

        # Only proceed to process groups if a valid 'groups' list was obtained and job status is not already failed
        if groups is not None and job.status != "failed":
            group_results: List[GroupResult] = []
            primary_dir = payload.primary_dir

            with ThreadPoolExecutor(max_workers=payload.workers) as executor:
                # Submit each group for parallel processing
                futures = [
                    executor.submit(
                        _process_group_for_suggestion,
                        group,
                        idx + 1,  # group_id
                        primary_dir,
                        payload.enable_sharpness_check,
                    )
                    for idx, group in enumerate(groups)
                ]

                # Collect results as they complete
                for future in futures:
                    # Check cancellation between processing each group
                    current_job = JOB_STORE.get(job.id)
                    if current_job and current_job.cancel_requested:
                        job.status = "cancelled"
                        job.message = "Scan cancelled by user"
                        return

                    group_results.append(future.result())

            job.groups = group_results
            job.status = "succeeded"
            STORE.save_groups(job.id, group_results)
        elif groups is None and job.status != "failed":
            # This path is hit if perform_scan_attempt() resulted in groups being None
            # but job.status wasn't explicitly set to "failed" yet.
            # This can happen if perform_scan_attempt() itself returns None without raising.
            # Which it should not do usually, but as a safeguard.
            job.status = "failed"
            job.message = job.message or "Scan did not produce groups unexpectedly."

    except Exception as err: # Catch any exceptions during group processing itself (after scan attempt)
        logging.exception("Failed to process scan results into groups after successful scan attempt")
        job.status = "failed"
        job.message = f"Failed to process results: {err}"
    finally:
        job.finished_at = time.time()
        JOB_STORE.update(job)
        STORE.save_job(job)


@router.post("/scan", response_model=ScanResponse)
def start_scan(payload: ScanRequest) -> ScanResponse:
    job = JOB_STORE.create(
        directories=[str(p) for p in payload.directories],
        primary_dir=str(payload.primary_dir) if payload.primary_dir else None,
        threshold=0,  # Unused - kept for database compatibility
        algorithm=payload.algorithm,
        workers=payload.workers,
        hash_db=str(payload.hash_db) if payload.hash_db else None,
        hash_size=payload.hash_size,
    )
    STORE.save_job(job)
    thread = threading.Thread(target=_run_scan, args=(job, payload), daemon=True)
    thread.start()
    return ScanResponse(job_id=job.id, status=job.status)


@router.get("/scan/{job_id}", response_model=JobStatusResponse)
def get_job_status(job_id: str) -> JobStatusResponse:
    job = JOB_STORE.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatusResponse(job_id=job.id, status=job.status, message=job.message, groups=len(job.groups))


@router.post("/scan/{job_id}/stop")
def stop_scan(job_id: str) -> Dict[str, str]:
    """Request cancellation of a running scan."""
    job = JOB_STORE.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status not in ["pending", "running"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot stop job with status: {job.status}"
        )

    # Set cancellation flag
    job.cancel_requested = True
    JOB_STORE.update(job)
    STORE.save_job(job)

    return {"status": "ok", "message": "Cancellation requested"}


@router.get("/groups", response_model=GroupsResponse)
def list_groups(job_id: str, limit: int = 50, offset: int = 0) -> GroupsResponse:
    job = JOB_STORE.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    filtered_groups: List[GroupResult] = []
    for group_result in job.groups:
        existing_files: List[str] = []
        for file_path in group_result.files:
            if Path(file_path).exists():
                existing_files.append(file_path)

        if existing_files:
            updated_suggested: Optional[str] = group_result.suggested
            if updated_suggested and not Path(updated_suggested).exists():
                updated_suggested = existing_files[0] if existing_files else None

            # If suggested becomes None but there are existing files, pick the first one
            if not updated_suggested and existing_files:
                updated_suggested = existing_files[0]

            filtered_groups.append(
                GroupResult(
                    id=group_result.id,
                    files=existing_files,
                    suggested=updated_suggested,
                    stats=group_result.stats, # Keep original stats, they might contain info for deleted files
                )
            )
    
    # Sort groups by ID after filtering
    filtered_groups.sort(key=lambda g: g.id)

    selected = filtered_groups[offset : offset + limit]
    group_out = [GroupOut(**gr.__dict__) for gr in selected]
    return GroupsResponse(job_id=job.id, total_groups=len(filtered_groups), groups=group_out, directories=job.directories)


@router.post("/actions/trash")
def trash_files(payload: TrashRequest):
    job = JOB_STORE.get(payload.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    cfg = TrashConfig(trash_dir=payload.destination, recreate_paths=payload.recreate_paths)
    move_to_trash(payload.paths, cfg)
    return {"status": "ok", "trashed": [str(p) for p in payload.paths]}


@router.post("/actions/trash-non-primary")
def trash_non_primary(payload: TrashNonPrimaryRequest):
    job = JOB_STORE.get(payload.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # 🚨 CRITICAL VALIDATION: Prevent data loss
    # This endpoint should only work when:
    # 1. Multiple directories were scanned (len(job.directories) > 1)
    # 2. Primary directory is set and valid
    if len(job.directories) <= 1:
        raise HTTPException(
            status_code=400,
            detail="Cannot use 'Keep Primary Directory' - only one directory was scanned. This operation requires multiple directories."
        )

    if not payload.primary_dir:
        raise HTTPException(
            status_code=400,
            detail="Cannot use 'Keep Primary Directory' - no primary directory specified"
        )

    # Additional safety: Check that primary_dir is actually one of the scanned directories
    job_dir_paths = [Path(d).resolve() for d in job.directories]
    if payload.primary_dir.resolve() not in job_dir_paths:
        raise HTTPException(
            status_code=400,
            detail=f"Primary directory {payload.primary_dir} was not part of the scan"
        )

    victims: List[Path] = []
    for group in job.groups:
        primary_files = [Path(f) for f in group.files if payload.primary_dir in Path(f).parents]
        if primary_files:
            victims.extend([Path(f) for f in group.files if f not in {str(p) for p in primary_files}])
    cfg = TrashConfig(trash_dir=payload.destination, recreate_paths=payload.recreate_paths)
    move_to_trash(victims, cfg)
    return {"status": "ok", "trashed": [str(p) for p in victims]}


@router.post("/admin/rebuild-db")
def rebuild_db():
    STORE.rebuild()
    JOB_STORE.reset([])
    return {"status": "ok", "message": "Database rebuilt (tables recreated and cleared)"}


@router.get("/latest-job", response_model=LatestJobResponse)
def get_latest_job() -> LatestJobResponse:
    jobs = JOB_STORE.all()
    active_jobs = [job for job in jobs if job.status in ["succeeded", "running", "pending"]]
    if not active_jobs:
        return LatestJobResponse(job_id=None, status="none", groups=0)

    # Sort by created_at descending
    sorted_jobs = sorted(active_jobs, key=lambda job: job.created_at, reverse=True)

    # Find most recent job with groups > 0 (reviewable job)
    reviewable_job = None
    for job in sorted_jobs:
        if job.status == "succeeded" and len(job.groups) > 0:
            reviewable_job = job
            break

    # If we found a reviewable job, return it
    if reviewable_job:
        return LatestJobResponse(
            job_id=reviewable_job.id,
            status=reviewable_job.status,
            groups=len(reviewable_job.groups)
        )

    # Otherwise, return the most recent job (for status messaging)
    # For running scans, return job_id so polling continues
    # For succeeded scans with 0 groups, return job_id=None
    latest_job = sorted_jobs[0]
    return LatestJobResponse(
        job_id=latest_job.id if latest_job.status == "running" else None,
        status=latest_job.status,
        groups=len(latest_job.groups)
    )


@router.get("/thumbnail")
def get_thumbnail(job_id: str, path: str, max_size: int = THUMBNAIL_MAX_SIZE):
    job = JOB_STORE.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    candidate = Path(path).resolve()
    roots = [Path(d).resolve() for d in job.directories]
    def is_within(p: Path, root: Path) -> bool:
        try:
            return p.is_relative_to(root)
        except AttributeError:
            return str(p).startswith(str(root))
    allowed = any(is_within(candidate, root) for root in roots)
    if not allowed:
        raise HTTPException(status_code=400, detail="Path not in job directories")
    if not candidate.exists():
        raise HTTPException(status_code=404, detail="File not found")
    try:
        data = thumbnail_bytes(candidate, max_size)
    except Exception as err:  # noqa: BLE001
        logging.error("Thumbnail failed for %s: %s", candidate, err)
        raise HTTPException(status_code=500, detail="Thumbnail generation failed")
    return Response(content=data, media_type="image/jpeg")
