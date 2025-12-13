from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path
from typing import List

from backend.config import DB_PATH
from backend.state import GroupResult, ScanJob

SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    directories TEXT NOT NULL,
    primary_dir TEXT,
    threshold INTEGER,
    algorithm TEXT,
    workers INTEGER,
    hash_db TEXT,
    hash_size INTEGER,
    status TEXT,
    message TEXT,
    created_at REAL,
    finished_at REAL,
    cancel_requested INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    group_index INTEGER NOT NULL,
    files TEXT NOT NULL,
    suggested TEXT,
    stats TEXT,
    FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
);
"""


class SQLiteStore:
    def __init__(self, path: Path = DB_PATH) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._init_db()

    def _connect(self):
        return sqlite3.connect(self.path, check_same_thread=False)

    def _init_db(self) -> None:
        with self._lock, self._connect() as conn:
            conn.executescript(SCHEMA)
            conn.commit()

    def rebuild(self) -> None:
        with self._lock, self._connect() as conn:
            conn.executescript("DROP TABLE IF EXISTS groups; DROP TABLE IF EXISTS jobs;")
            conn.executescript(SCHEMA)
            conn.commit()

    def save_job(self, job: ScanJob) -> None:
        with self._lock, self._connect() as conn:
            conn.execute(
                """
                INSERT INTO jobs (id, directories, primary_dir, threshold, algorithm, workers, hash_db, hash_size, status, message, created_at, finished_at, cancel_requested)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    directories=excluded.directories,
                    primary_dir=excluded.primary_dir,
                    threshold=excluded.threshold,
                    algorithm=excluded.algorithm,
                    workers=excluded.workers,
                    hash_db=excluded.hash_db,
                    hash_size=excluded.hash_size,
                    status=excluded.status,
                    message=excluded.message,
                    created_at=excluded.created_at,
                    finished_at=excluded.finished_at,
                    cancel_requested=excluded.cancel_requested
                """,
                (
                    job.id,
                    json.dumps(job.directories),
                    job.primary_dir,
                    job.threshold,
                    job.algorithm,
                    job.workers,
                    job.hash_db,
                    job.hash_size,
                    job.status,
                    job.message,
                    job.created_at,
                    job.finished_at,
                    1 if job.cancel_requested else 0,
                ),
            )
            conn.commit()

    def save_groups(self, job_id: str, groups: List[GroupResult]) -> None:
        with self._lock, self._connect() as conn:
            conn.execute("DELETE FROM groups WHERE job_id = ?", (job_id,))
            conn.executemany(
                """
                INSERT INTO groups (job_id, group_index, files, suggested, stats)
                VALUES (?, ?, ?, ?, ?)
                """,
                [
                    (
                        job_id,
                        gr.id,
                        json.dumps(gr.files),
                        gr.suggested,
                        json.dumps(gr.stats),
                    )
                    for gr in groups
                ],
            )
            conn.commit()

    def load_jobs(self) -> List[ScanJob]:
        with self._lock, self._connect() as conn:
            # Check if cancel_requested column exists, if not add it
            cursor = conn.execute("PRAGMA table_info(jobs)")
            columns = [col[1] for col in cursor.fetchall()]
            if "cancel_requested" not in columns:
                conn.execute("ALTER TABLE jobs ADD COLUMN cancel_requested INTEGER DEFAULT 0")
                conn.commit()

            jobs: List[ScanJob] = []
            job_rows = conn.execute("SELECT * FROM jobs").fetchall()
            group_rows = conn.execute("SELECT job_id, group_index, files, suggested, stats FROM groups").fetchall()
        group_map = {}
        for job_id, group_index, files, suggested, stats in group_rows:
            group_map.setdefault(job_id, []).append(
                GroupResult(
                    id=group_index,
                    files=json.loads(files),
                    suggested=suggested,
                    stats=json.loads(stats) if stats else {},
                )
            )
        for row in job_rows:
            (
                job_id,
                directories,
                primary_dir,
                threshold,
                algorithm,
                workers,
                hash_db,
                hash_size,
                status,
                message,
                created_at,
                finished_at,
                cancel_requested,
            ) = row
            jobs.append(
                ScanJob(
                    id=job_id,
                    directories=json.loads(directories),
                    primary_dir=primary_dir,
                    threshold=threshold,
                    algorithm=algorithm,
                    workers=workers,
                    hash_db=hash_db,
                    hash_size=hash_size,
                    status=status,
                    message=message or "",
                    created_at=created_at,
                    finished_at=finished_at,
                    groups=sorted(group_map.get(job_id, []), key=lambda g: g.id),
                    cancel_requested=bool(cancel_requested),
                )
            )
        return jobs
