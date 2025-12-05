"""
Lightweight helpers to extract metadata for keeper suggestions.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, Optional

from PIL import Image


def image_stats(path: Path) -> Dict:
    """
    Return width, height, pixel count, EXIF count, and mtime for a file.
    Fallback to zeros on failure.
    """
    try:
        with Image.open(path) as img:
            width, height = img.size
            exif = img.getexif() or {}
            return {
                "width": width,
                "height": height,
                "pixels": width * height,
                "exif_count": len(exif),
                "mtime": path.stat().st_mtime,
            }
    except Exception as err:  # noqa: BLE001
        logging.warning("Failed to read metadata for %s: %s", path, err)
        try:
            return {
                "width": 0,
                "height": 0,
                "pixels": 0,
                "exif_count": 0,
                "mtime": path.stat().st_mtime,
            }
        except FileNotFoundError:
            return {"width": 0, "height": 0, "pixels": 0, "exif_count": 0, "mtime": 0.0}


def suggest_keeper(paths: list[Path], primary_dir: Optional[Path] = None) -> Path:
    """
    Choose a keeper using simple heuristics:
    - prefer within primary_dir (if provided)
    - then higher resolution (pixels)
    - then higher EXIF count
    - then newer mtime
    - then shorter path for stability
    """
    stats_cache = {p: image_stats(p) for p in paths}

    def score(p: Path) -> tuple:
        meta = stats_cache[p]
        in_primary = 1 if primary_dir and primary_dir in p.parents else 0
        return (
            in_primary,
            meta["pixels"],
            meta["exif_count"],
            meta["mtime"],
            -len(str(p)),
        )

    return max(paths, key=score)
