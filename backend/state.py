from __future__ import annotations

import threading
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional


@dataclass
class GroupResult:
    id: int
    files: List[str]
    suggested: Optional[str]
    stats: Dict[str, Dict]


@dataclass
class ScanJob:
    id: str
    directories: List[str]
    primary_dir: Optional[str]
    threshold: int  # Unused - max_distance is always 0 (required for --group mode)
    algorithm: str
    workers: Optional[int]
    hash_db: Optional[str]
    hash_size: Optional[int]
    status: str = "pending"
    message: str = ""
    created_at: float = field(default_factory=time.time)
    finished_at: Optional[float] = None
    groups: List[GroupResult] = field(default_factory=list)
    cancel_requested: bool = False  # Flag for user-requested cancellation


class JobStore:
    def __init__(self, initial: Optional[List[ScanJob]] = None) -> None:
        self._jobs: Dict[str, ScanJob] = {job.id: job for job in initial or []}
        self._lock = threading.Lock()

    def create(self, **kwargs) -> ScanJob:
        job = ScanJob(id=str(uuid.uuid4()), **kwargs)
        with self._lock:
            self._jobs[job.id] = job
        return job

    def get(self, job_id: str) -> Optional[ScanJob]:
        with self._lock:
            return self._jobs.get(job_id)

    def update(self, job: ScanJob) -> None:
        with self._lock:
            self._jobs[job.id] = job

    def reset(self, initial: Optional[List[ScanJob]] = None) -> None:
        with self._lock:
            self._jobs = {job.id: job for job in initial or []}

    def all(self) -> List[ScanJob]:
        with self._lock:
            return list(self._jobs.values())


JOB_STORE = JobStore()
