"""
Hashing and grouping wrapper around the `duplicate_images` library.
Uses pairs from duplicate_images and merges them into clusters we can act on.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple

from duplicate_images.duplicate import get_matches
from duplicate_images.pair_finder_options import PairFinderOptions

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".gif"}


def _normalize_files(paths: Iterable[Path]) -> List[Path]:
    """Filter to supported files and return sorted unique paths."""
    seen: Set[Path] = set()
    filtered: List[Path] = []
    for p in paths:
        if p.suffix.lower() not in SUPPORTED_EXTENSIONS:
            continue
        rp = p.resolve()
        if rp in seen:
            continue
        seen.add(rp)
        filtered.append(rp)
    filtered.sort()
    return filtered


def _pairs_to_groups(pairs: Sequence[Tuple[Path, Path]]) -> List[Tuple[Path, ...]]:
    """Merge duplicate pairs into connected components (groups)."""
    parent: Dict[Path, Path] = {}
    size: Dict[Path, int] = {}

    def find(x: Path) -> Path:
        parent.setdefault(x, x)
        if parent[x] != x:
            parent[x] = find(parent[x])
        return parent[x]

    def union(a: Path, b: Path) -> None:
        ra, rb = find(a), find(b)
        if ra == rb:
            return
        sa, sb = size.get(ra, 1), size.get(rb, 1)
        if sa < sb:
            ra, rb = rb, ra
            sa, sb = sb, sa
        parent[rb] = ra
        size[ra] = sa + sb

    for a, b in pairs:
        union(a, b)

    groups: Dict[Path, List[Path]] = defaultdict(list)
    for node in parent:
        groups[find(node)].append(node)
    # ensure deterministic ordering
    return [tuple(sorted(files)) for files in groups.values() if len(files) > 1]


def scan_and_group(
    directories: List[Path],
    hash_size: Optional[int] = None,
    workers: Optional[int] = None,
    algorithm: str = "phash",
    hash_db: Optional[Path] = None,
    exclude_regexes: Optional[List[str]] = None,
) -> List[Tuple[Path, ...]]:
    """
    Run duplicate_images against the provided directories and return grouped tuples of similar files.
    Groups only (no max_distance) for performance and better review UX.
    workers: number of threads for hashing (None = library default).
    """
    if not directories:
        return []
    options = PairFinderOptions(
        max_distance=0,
        hash_size=hash_size,
        show_progress_bars=False,
        parallel=workers,
        slow=False,
        group=True,
    )
    logging.info("Starting scan for %d directories (hash_size=%s)", len(directories), hash_size)
    matches = get_matches(
        root_directories=[Path(d) for d in directories],
        algorithm=algorithm,
        options=options,
        hash_store_path=hash_db,
        exclude_regexes=exclude_regexes,
    )
    # matches is already grouped when group=True
    grouped = [tuple(sorted(m)) for m in matches if len(m) > 1]
    logging.info("Found %d groups", len(grouped))
    return grouped
