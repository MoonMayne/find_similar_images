"""
File movement utilities. We never hard-delete; we move to system trash or a configured directory.
"""

from __future__ import annotations

import logging
import shutil
import uuid
from pathlib import Path
from typing import Iterable, Optional

from send2trash import send2trash


class TrashConfig:
    def __init__(self, trash_dir: Optional[Path] = None, recreate_paths: bool = False) -> None:
        self.trash_dir = trash_dir
        self.recreate_paths = recreate_paths


def _unique_destination(dest: Path) -> Path:
    """If dest exists, append a short UUID suffix to avoid collisions."""
    if not dest.exists():
        return dest
    stem = dest.stem
    suffix = dest.suffix
    parent = dest.parent
    return parent / f"{stem}-{uuid.uuid4().hex[:6]}{suffix}"


def move_to_trash(paths: Iterable[Path], config: TrashConfig) -> None:
    """
    Move files to system trash (default) or to a provided trash directory.
    """
    for src in paths:
        try:
            if config.trash_dir:
                config.trash_dir.mkdir(parents=True, exist_ok=True)
                target = config.trash_dir / (src.relative_to(src.anchor) if config.recreate_paths else src.name)
                target = _unique_destination(target)
                target.parent.mkdir(parents=True, exist_ok=True)
                logging.info("Moving %s -> %s", src, target)
                shutil.move(str(src), str(target))
            else:
                logging.info("Sending to system trash: %s", src)
                send2trash(str(src))
        except FileNotFoundError:
            logging.warning("File not found, skipping: %s", src)
        except Exception as err:  # noqa: BLE001
            logging.error("Failed to move %s: %s", src, err)
