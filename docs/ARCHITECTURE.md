# Architecture: Find Similar Images

This document reflects the simplified approach in `docs/project_purpose.md`: find and review duplicate/similar images from one or more directories, then move unwanted copies to trash (never delete in place).

## High-Level Flow
- Discover: accept one or more input directories; filter to supported image types (`jpg`, `jpeg`, `png`, `webp`, `bmp`, `tiff`, `gif`).
- Hash: compute perceptual hashes (e.g., pHash/dHash via `duplicate_images`) with optional parallel workers.
- Group: cluster images by similarity threshold; persist results for quick re-queries.
- Review: present clusters for side-by-side comparison and selection of keep/trash actions (including bulk operations).
- Act: move selected files to system trash via `send2trash` by default; allow overriding `TRASH_DIR`. Never call `os.remove`.

## Project Structure (planned)
- `backend/`
  - `app.py`: FastAPI/Flask entrypoint exposing scan, progress, and action endpoints.
  - `core/hash_engine.py`: hashing, thresholding, clustering (use `duplicate_images` where possible).
  - `core/file_manager.py`: move-to-trash operations; path validation; default `send2trash`, optional `TRASH_DIR`.
  - `api/routes.py`, `api/schemas.py`: HTTP routes and request/response models.
  - `utils/logger.py`, `utils/validators.py`: structured logging and input validation.
- `scripts/create_hash_db.py`: CLI to build/update the similarity store.
- `frontend/`: `src/` components/pages/services for review UI (bulk trash, primary directory support).
- `tests/`: hashing, grouping, and action safety.
- `docs/`: this file and purpose doc; keep aligned.

## Data & Storage
- Storage: SQLite (`data/app.db` by default) for jobs and groups; hash cache remains JSON if configured.
  - `jobs`: scan parameters, status, timestamps.
  - `groups`: file lists, suggested keeper, stats blob.
- Hash cache: `data/hash_cache.json` (configurable via `HASH_DB`) to speed rescans without re-hashing.

## Key Behaviors
- Scanning: parallel workers configurable (`WORKERS` env/flag); skip unreadable files; log and continue.
- Similarity: threshold configurable (`SIMILARITY_THRESHOLD`); default tuned for conservative matches. Favor `duplicate_images` for hashing/clustering.
- Review UI: cluster gallery with side-by-side comparison, quick “keep” vs “trash” toggles, “trash all duplicates,” and “trash all from non-primary directories” when a primary directory is set. Show a suggested keeper per cluster.
- Actions: move files to system trash (`send2trash` default) or to `TRASH_DIR`; record moves for undo; never use `os.remove`.
- Rebuild: `/api/admin/rebuild-db` recreates persistence tables if corruption occurs.

## Safety & Configuration
- Required config: `SIMILARITY_THRESHOLD`; optional `WORKERS`; optional `TRASH_DIR` (falls back to `send2trash`).
- Validate and normalize all input directories; block traversal and root-level destructive operations.
- Log file operations source → destination; include dry-run mode for CI/tests.

## Keeper Suggestion Heuristics
- Prefer higher resolution.
- Prefer more metadata (EXIF keys present).
- Prefer sharper/in-focus images (edge/variance score if available).
- Tie-break by shallower path depth within primary directory, then newer mtime.

## Library Integration (`duplicate_images`)
- Hash and group via `duplicate_images.duplicate.get_matches(root_dirs, algorithm, options, hash_store_path, exclude_regexes)`. Use `PairFinderOptions(max_distance=threshold, parallel=workers, group=True, hash_size=<int>)` to return grouped tuples.
- Algorithms available: `ahash`, `phash` (default pick), `dhash`, `whash`, `colorhash`, `crop_resistant`, etc. Defaults come from `duplicate_images.methods.IMAGE_HASH_ALGORITHM`.
- Cache hashes with `FileHashStore` (JSON) by passing `hash_store_path` (e.g., `data/hash_cache.json`) to avoid re-hashing.
- Avoid `duplicate_images.methods.ACTIONS_ON_EQUALITY` (they call `unlink`). Use only scan/group pieces and route actions through our trash mover using `send2trash` or `TRASH_DIR`.

## Minimal Backend API (proposal)
- `POST /api/scan`: body `{directories: [...], primary_dir?: string, threshold: int, workers?: int, hash_db?: string, exclude?: [regex]}` → returns job id.
- `GET /api/scan/{job_id}`: returns progress, counts, and errors.
- `GET /api/groups`: params `{job_id, page, limit, primary_dir?}` → returns clustered paths with suggested keeper + metadata scores.
- `POST /api/actions/trash`: body `{job_id, group_id, trash: [paths], destination?: string, recreate_paths?: bool}` → moves via `send2trash` or `TRASH_DIR`.
- `POST /api/actions/trash-non-primary`: body `{job_id, primary_dir}` → trash all non-primary files per cluster.

## Frontend (lightweight)
- Cluster list with lazy-loaded thumbnails (JPEG, max ~640px, cached under `data/thumbnails`), metadata badges, suggested keeper tag, and actions: `Trash others`, `Trash all`, `Trash non-primary`.
- Controls: primary directory picker (optional), similarity threshold, bulk “trash all duplicates,” destination override (system trash vs configured directory).
- Progress display for scans; auto-loads groups on completion.
