from __future__ import annotations

import os
from pathlib import Path


def env_path(name: str, default: str | None = None) -> Path | None:
    val = os.environ.get(name, default)
    return Path(val).expanduser() if val else None


TRASH_DIR = env_path("TRASH_DIR")
HASH_DB = env_path("HASH_DB", "data/hash_cache.json")
DEFAULT_THRESHOLD = int(os.environ.get("SIMILARITY_THRESHOLD", "0"))
DEFAULT_WORKERS = int(os.environ.get("WORKERS", "0")) or None
DATA_DIR = Path("data")
DATA_DIR.mkdir(exist_ok=True)
DB_PATH = env_path("DB_PATH", str(DATA_DIR / "app.db"))
THUMBNAIL_CACHE_DIR = DATA_DIR / "thumbnails"
THUMBNAIL_CACHE_DIR.mkdir(exist_ok=True)
THUMBNAIL_MAX_SIZE = int(os.environ.get("THUMBNAIL_MAX_SIZE", "640"))
