from __future__ import annotations

import hashlib
import io
from pathlib import Path

from PIL import Image, ImageOps

from backend.config import THUMBNAIL_CACHE_DIR, THUMBNAIL_MAX_SIZE


def _cache_path(source: Path, max_size: int) -> Path:
    h = hashlib.sha1(f"{source.resolve()}:{source.stat().st_mtime}:{max_size}".encode()).hexdigest()
    return THUMBNAIL_CACHE_DIR / f"{h}.jpg"


def thumbnail_bytes(source: Path, max_size: int = THUMBNAIL_MAX_SIZE) -> bytes:
    cache_file = _cache_path(source, max_size)
    if cache_file.exists():
        return cache_file.read_bytes()
    with Image.open(source) as img:
        img = ImageOps.exif_transpose(img)
        img.thumbnail((max_size, max_size))
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85, optimize=True)
        data = buf.getvalue()
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        cache_file.write_bytes(data)
        return data
