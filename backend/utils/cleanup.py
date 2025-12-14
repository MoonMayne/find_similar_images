from pathlib import Path
import hashlib
from typing import Dict
from backend.config import THUMBNAIL_CACHE_DIR, THUMBNAIL_MAX_SIZE, DATA_DIR
import logging


def _compute_thumbnail_path(source_path: Path, max_size: int = THUMBNAIL_MAX_SIZE) -> Path:
    """Calculate thumbnail cache path (same logic as thumbnails.py)"""
    if not source_path.exists():
        return None

    hash_input = f"{source_path.resolve()}:{source_path.stat().st_mtime}:{max_size}"
    hash_key = hashlib.sha1(hash_input.encode()).hexdigest()
    return THUMBNAIL_CACHE_DIR / f"{hash_key}.jpg"


def cleanup_orphaned_thumbnails() -> Dict[str, int]:
    """Delete thumbnails for images that no longer exist"""
    from backend.state import JOB_STORE

    deleted = 0
    errors = 0

    # Get all image paths from database
    for job in JOB_STORE.all():
        for group in job.groups:
            for file_path in group.files:
                source = Path(file_path)
                if not source.exists():
                    # Image deleted/moved - remove thumbnail
                    try:
                        thumbnail = _compute_thumbnail_path(source, THUMBNAIL_MAX_SIZE)
                        if thumbnail and thumbnail.exists():
                            thumbnail.unlink()
                            deleted += 1
                    except Exception as e:
                        logging.warning(f"Failed to delete thumbnail for {file_path}: {e}")
                        errors += 1

    return {"deleted": deleted, "errors": errors}


def reset_all_app_data() -> Dict[str, bool]:
    """Nuclear reset: Delete ALL app data"""
    from fastapi import HTTPException
    from backend.state import JOB_STORE
    from backend.api.routes import STORE

    # Safety check: Don't reset during active scan
    active_jobs = [j for j in JOB_STORE.all() if j.status in ["pending", "running"]]
    if active_jobs:
        raise HTTPException(400, "Cannot reset - scan in progress")

    results = {}

    # 1. Delete all thumbnails
    try:
        for thumbnail in THUMBNAIL_CACHE_DIR.glob("*.jpg"):
            thumbnail.unlink()
        results["thumbnails"] = True
    except Exception as e:
        logging.error(f"Failed to delete thumbnails: {e}")
        results["thumbnails"] = False

    # 2. Delete hash cache
    try:
        hash_cache = DATA_DIR / "hash_cache.json"
        if hash_cache.exists():
            hash_cache.unlink()
        results["hash_cache"] = True
    except Exception as e:
        logging.error(f"Failed to delete hash cache: {e}")
        results["hash_cache"] = False

    # 3. Rebuild database (wipe all tables)
    try:
        STORE.rebuild()
        JOB_STORE.reset([])
        results["database"] = True
    except Exception as e:
        logging.error(f"Failed to rebuild database: {e}")
        results["database"] = False

    return results
