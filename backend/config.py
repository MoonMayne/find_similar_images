from __future__ import annotations

import os
from pathlib import Path


def env_path(name: str, default: str | None = None) -> Path | None:
    val = os.environ.get(name, default)
    return Path(val).expanduser() if val else None


TRASH_DIR = env_path("TRASH_DIR")
DEFAULT_WORKERS = int(os.environ.get("WORKERS", "0")) or None

# Use DATA_DIR from environment, fallback to "data"
DATA_DIR = env_path("DATA_DIR") or Path("data")
DATA_DIR.mkdir(exist_ok=True, parents=True)

# Set defaults after DATA_DIR is determined
HASH_DB = env_path("HASH_DB") or (DATA_DIR / "hash_cache.json")
DB_PATH = env_path("DB_PATH") or (DATA_DIR / "app.db")
THUMBNAIL_CACHE_DIR = DATA_DIR / "thumbnails"
THUMBNAIL_CACHE_DIR.mkdir(exist_ok=True, parents=True)
THUMBNAIL_MAX_SIZE = int(os.environ.get("THUMBNAIL_MAX_SIZE", "640"))
