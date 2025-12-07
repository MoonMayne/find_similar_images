# Project: Find Similar Images

## Project Overview

"Find Similar Images" is a web-based application designed to help users identify and manage duplicate or very similar images across specified directories. It provides a user-friendly interface to scan image collections, group similar images, review them side-by-side, and safely move unwanted duplicates to the trash (never hard-deleting).

**Key Features:**
*   **Directory Scanning:** Scan one or more directories for images.
*   **Perceptual Hashing:** Uses various hashing algorithms (e.g., `phash`, `ahash`, `dhash`) to find visual similarities.
*   **Group Review:** Presents groups of similar images, allowing users to make informed decisions about which images to keep or delete.
*   **Keeper Suggestion:** Intelligently suggests which image to keep based on heuristics like resolution, EXIF data, and primary directory preference.
*   **Safe Deletion:** Moves unwanted images to the system trash or a user-defined trash directory, preventing accidental permanent deletion.
*   **Web-based UI:** A responsive and interactive frontend for easy management.

**Technologies Used:**
*   **Backend:** Python 3.x, FastAPI, Uvicorn, `duplicate-images` library, `send2trash`, Jinja2 (for templating), SQLite (for job and group persistence).
*   **Frontend:** HTML5, CSS3 (Tailwind CSS via CDN, custom styles), JavaScript (Vanilla JS for interactivity).

**Architecture:**
The application follows a client-server architecture:
*   A FastAPI backend handles API requests, image processing, hashing, file management, and serves the static frontend assets and templated HTML.
*   A JavaScript frontend communicates with the backend via RESTful APIs to display scan progress, image groups, and user actions.
*   Image hashing is performed using the `duplicate_images` library, and file movements are handled safely via `send2trash`.

## Building and Running

The application is a self-contained Python program where the backend serves the frontend.

**Prerequisites:**
*   Python 3.8+ (recommended, though `project_purpose.md` mentions Python 3.14 as a target)

**Steps to Run:**

1.  **Install Dependencies:**
    Navigate to the project root and install the required Python packages:
    ```bash
    pip install -r backend/requirements.txt
    ```

2.  **Start the Application:**
    From the project root, run the FastAPI application using Uvicorn:
    ```bash
    python -m backend.app
    ```

3.  **Access the Application:**
    Open your web browser and navigate to `http://localhost:8000`.

## Development Conventions

*   **Language:** Python for backend, JavaScript for frontend interactivity.
*   **Backend Framework:** FastAPI.
*   **Frontend Styling:** Tailwind CSS (from CDN) and custom CSS (`static/style.css`).
*   **Frontend Interactivity:** Vanilla JavaScript.
*   **File Operations:** Emphasizes safe file handling; files are moved to trash, never permanently deleted (`os.remove` is avoided).
*   **Hashing Library:** `duplicate-images` is used for perceptual hashing and grouping.
*   **Job Management:** Scan jobs and group results are persisted in an SQLite database.
*   **API Design:** RESTful API endpoints for scan initiation, status, group retrieval, and file actions.
*   **Code Structure:**
    *   `backend/api/`: API route definitions.
    *   `backend/core/`: Core logic for file management and hashing.
    *   `backend/static/`: Frontend static assets (JS, CSS).
    *   `backend/templates/`: Jinja2 HTML templates.
    *   `backend/utils/`: Utility functions (e.g., image stats, thumbnail generation).
    *   `docs/`: Project documentation.