"""
Lightweight helpers to extract metadata for keeper suggestions.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, Optional

import cv2
import numpy as np
from PIL import Image


def _calculate_sharpness(path: Path) -> float:
    """
    Calculate a sharpness score for an image using the variance of the Laplacian.
    Returns 0.0 on failure.
    """
    try:
        # Open image with PIL first, then convert to numpy array for OpenCV
        with Image.open(path) as img:
            # Convert to grayscale numpy array
            img_np = np.array(img.convert("L"))
            # Apply Laplacian filter and calculate variance
            return cv2.Laplacian(img_np, cv2.CV_64F).var()
    except Exception as err:
        logging.warning("Failed to calculate sharpness for %s: %s", path, err)
        return 0.0


def image_stats(path: Path) -> Dict:
    """
    Return width, height, pixel count, EXIF count, and mtime for a file.
    Fallback to zeros on failure.
    """
    try:
        with Image.open(path) as img:
            width, height = img.size
            exif = img.getexif() or {}
            sharpness = _calculate_sharpness(path) # Calculate sharpness
            return {
                "width": width,
                "height": height,
                "pixels": width * height,
                "exif_count": len(exif),
                "mtime": path.stat().st_mtime,
                "sharpness": sharpness, # Add sharpness to the stats
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
                "sharpness": 0.0, # Default sharpness on error
            }
        except FileNotFoundError:
            return {"width": 0, "height": 0, "pixels": 0, "exif_count": 0, "mtime": 0.0}


def suggest_keeper(paths: list[Path], primary_dir: Optional[Path] = None, enable_sharpness_check: bool = False) -> Path:
    """
    Choose a keeper using simple heuristics:
    - prefer within primary_dir (if provided)
    - then higher sharpness (if enabled)
    - then higher resolution (pixels)
    - then higher EXIF count
    - then newer mtime
    - then shorter path for stability
    """
    stats_cache = {p: image_stats(p) for p in paths}

    def score(p: Path) -> tuple:
        meta = stats_cache[p]
        in_primary = 1 if primary_dir and primary_dir in p.parents else 0

        # Build the scoring tuple dynamically
        score_tuple = [in_primary]
        if enable_sharpness_check:
            score_tuple.append(meta["sharpness"])
        score_tuple.extend([
            meta["pixels"],
            meta["exif_count"],
            meta["mtime"],
            -len(str(p)),
        ])
        return tuple(score_tuple)

    return max(paths, key=score)
