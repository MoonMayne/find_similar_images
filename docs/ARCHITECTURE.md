# Architecture: Find Similar Images

Purpose: accept one or more directories, find similar/duplicate images, let the user review groups quickly, then move unwanted files to trash (never hard-delete).

## High-Level Flow
- Discover: pick 1+ directories (file picker), filter to image extensions.
- Hash: compute perceptual hashes (via `duplicate_images`) with optional parallel workers; reuse hash cache for rescans.
- Group: cluster by similarity threshold; groups can have 2+ items.
- Review: user navigates groups, inspects suggestions, marks keep/delete; apply decisions in one finalize step.
- Act: move marked files to trash via `send2trash` or `TRASH_DIR`; no `os.remove`.

## Project Structure
- `backend/`: FastAPI app (`app.py`) that serves a Jinja2-templated frontend.
  - `templates/`: HTML templates.
  - `static/`: CSS and JavaScript files.
  - `core/`: Hashing and file management logic.
  - `api/`: Backend API routes.
- `data/`: `app.db` (jobs/groups), `hash_cache.json` (optional hash cache), `thumbnails/` (cached previews).
- `docs/`: this file.

## Running the Application
The application is a self-contained Python program. The backend serves the frontend.

To run the application:
1.  Install the required Python packages: `pip install -r backend/requirements.txt`
2.  Start the server: `python -m backend.app`

The application will then be available at `http://localhost:8000`.

## Frontend Plan (Jinja2 Templates)
The frontend is a server-side rendered application using FastAPI and Jinja2 templates.
- **Styling:** Tailwind CSS loaded from a CDN.
- **Interactivity:** Vanilla JavaScript for API communication and DOM manipulation.

## Backend API
- `POST /api/scan`: `{directories: [...], primary_dir?, threshold, workers?, hash_db?, exclude?}` → job id.
- `GET /api/scan/{job_id}`: progress/status.
- `GET /api/groups`: `{job_id, page, limit}` → groups with suggested/stats.
- `POST /api/actions/trash`: `{job_id, trash: [paths], destination?, recreate_paths?}`.
- `POST /api/actions/trash-non-primary`: `{job_id, primary_dir}`.
- Admin: `POST /api/admin/rebuild-db` to recreate tables.

## Library Integration (`duplicate_images`)
- Use `duplicate_images.duplicate.get_matches(...)`.
- The `--group` parameter is always used to ensure groups of 2+ images can be compared.
- The `--max-distance` parameter is not used due to its performance implications and incompatibility with `--group`.

## Safety & Configuration
- All file operations are logged.
- Only move to trash (`send2trash` or a custom `TRASH_DIR`), never `os.remove`.

## Future Improvements
- **Real-time Progress Updates:** Provide more granular progress updates from the backend during a scan.
- **"Dry Run" Mode:** A feature to preview which files *would* be deleted without actually deleting them.
- **Save/Load Scan Settings:** The ability to save the current scan configuration to a file and load it later.
