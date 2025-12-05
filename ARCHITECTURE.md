# Project Architecture: Find Similar Images

## Overview
A Python-based system for detecting and managing duplicate/similar images with an intuitive web UI for reviewing and managing duplicates.

---

## System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Web UI (Frontend)                        │
│  (React/Vue - Similar images gallery, selection UI)         │
└────────────────────────┬────────────────────────────────────┘
                         │
                    REST API
                         │
┌────────────────────────▼────────────────────────────────────┐
│              Backend API Server (Flask/FastAPI)             │
│  (Route handlers, database queries, file operations)        │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
┌───────▼────────┐  ┌────▼────────┐  ┌──▼──────────────┐
│  Hash Engine   │  │ SQLite DB   │  │ File Manager   │
│ (duplicate_    │  │ (image      │  │ (move/delete   │
│  images lib)   │  │  metadata)  │  │  operations)   │
└────────────────┘  └─────────────┘  └────────────────┘
```

---

## Project Structure

```
find_similar_images/
├── backend/
│   ├── app.py                 # Main Flask/FastAPI application
│   ├── config.py              # Configuration settings
│   ├── requirements.txt        # Python dependencies
│   ├── core/
│   │   ├── __init__.py
│   │   ├── hash_engine.py     # Image hashing & similarity logic
│   │   └── file_manager.py    # File operations (move, delete, etc.)
│   ├── api/
│   │   ├── __init__.py
│   │   ├── routes.py          # API endpoints
│   │   └── schemas.py         # Request/response models
│   ├── database/
│   │   ├── __init__.py
│   │   ├── db.py              # Database connection & setup
│   │   └── models.py          # SQLite ORM models
│   └── utils/
│       ├── __init__.py
│       ├── logger.py          # Logging utilities
│       └── validators.py      # Input validation
├── frontend/
│   ├── package.json           # Node.js dependencies
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── App.jsx            # Main component
│       ├── components/
│       │   ├── ImageGallery.jsx
│       │   ├── ImageComparison.jsx
│       │   ├── DuplicateList.jsx
│       │   └── ActionBar.jsx
│       ├── pages/
│       │   ├── ScanPage.jsx
│       │   ├── ReviewPage.jsx
│       │   └── SettingsPage.jsx
│       └── services/
│           └── api.js         # API client
├── scripts/
│   └── create_hash_db.py      # CLI script for building hash database
├── tests/
│   ├── test_hash_engine.py
│   ├── test_api.py
│   └── test_file_manager.py
├── ARCHITECTURE.md            # This file
├── LICENSE
├── project_purpose.md
└── README.md
```

---

## Component Details

### 1. **Backend - Core Services**

#### `hash_engine.py`
- **Responsibilities:**
  - Load `duplicate_images` library and initialize hashing
  - Scan directories for image files (filter out videos, audio, etc.)
  - Generate perceptual hashes for images (e.g., pHash, dHash)
  - Compare hashes and identify similar images with configurable threshold
  - Support parallel processing using multiprocessing/ThreadPoolExecutor

- **Key Classes:**
  - `ImageHasher`: Handles hashing of individual images
  - `SimilarityDetector`: Finds similar image clusters
  - `ParallelProcessor`: Manages concurrent hash computation

#### `file_manager.py`
- **Responsibilities:**
  - Move files to specified directories
  - Permanently delete files
  - Generate file metadata (resolution, size, creation date)
  - Retrieve image EXIF data for quality assessment

- **Key Classes:**
  - `FileOperations`: File manipulation (move, delete)
  - `ImageAnalyzer`: Extract metadata and quality metrics

#### `database/models.py`
- Store image metadata:
  - File path, hash value, file size, resolution
  - Creation/modification date
  - Similarity clusters (groups of similar images)
  - User selections/decisions

### 2. **Backend - API Server**

#### `app.py`
- Initialize Flask/FastAPI application
- Set up CORS for frontend communication
- Register routes and error handlers

#### `api/routes.py`
- **Endpoints:**
  - `POST /api/scan` - Start hash database creation
    - Input: List of directory paths, parallel workers
    - Returns: Job ID, progress tracker
  - `GET /api/scan/{job_id}` - Get scan progress
  - `GET /api/duplicates` - Retrieve similar image groups
    - Query params: directory filter, similarity threshold
  - `POST /api/action/move` - Move images to directory
  - `POST /api/action/delete` - Delete images
  - `POST /api/action/keep` - Mark image as keeper (delete others)
  - `GET /api/image/{image_id}/metadata` - Get image details

#### `database/db.py`
- SQLite connection management
- Database initialization
- Query helpers for common operations

### 3. **Frontend - Web UI**

**Tech Stack:** React (or Vue.js)

#### Key Pages:
1. **ScanPage** - Configure and run image scan
   - Input multiple directories
   - Set parallel worker count
   - Display progress bar

2. **ReviewPage** - Main duplicate management interface
   - Gallery view: Display similar image clusters side-by-side
   - Metadata display: Resolution, file size, quality score
   - Action buttons: Keep/Move/Delete
   - Intelligent suggestion: Highlight recommended keeper (best quality)
   - Filtering: By directory, similarity score

3. **SettingsPage** - Application configuration
   - Similarity threshold adjustment
   - Default move/delete paths
   - Auto-delete confirmation settings

#### Key Components:
- `ImageGallery`: Grid/carousel display of similar images
- `ImageComparison`: Detailed side-by-side comparison
- `DuplicateList`: Sortable list of duplicate groups
- `ActionBar`: Selection and bulk action buttons

### 4. **CLI Script** (`scripts/create_hash_db.py`)

- Standalone utility for command-line hash database creation
- Useful for automated/scheduled scanning
- Usage: `python create_hash_db.py --directories /path1 /path2 --workers 4`

---

## Database Schema

### `images` table
```sql
CREATE TABLE images (
    id INTEGER PRIMARY KEY,
    file_path TEXT UNIQUE NOT NULL,
    file_size INTEGER,
    resolution TEXT,
    hash_value TEXT NOT NULL,
    quality_score FLOAT,
    created_at TIMESTAMP,
    modified_at TIMESTAMP
);
```

### `duplicate_groups` table
```sql
CREATE TABLE duplicate_groups (
    id INTEGER PRIMARY KEY,
    similarity_score FLOAT,
    created_at TIMESTAMP
);
```

### `group_members` table
```sql
CREATE TABLE group_members (
    id INTEGER PRIMARY KEY,
    group_id INTEGER FOREIGN KEY,
    image_id INTEGER FOREIGN KEY,
    is_keeper BOOLEAN DEFAULT FALSE
);
```

---

## Data Flow

### Image Scanning & Hashing
1. User selects directories via frontend
2. Backend scans directories, filters valid image files
3. Parallel hash computation using worker threads/processes
4. Store hashes and metadata in database
5. Frontend shows progress updates via polling or WebSocket

### Duplicate Review
1. Backend clusters similar images (threshold-based)
2. Calculate quality scores for intelligent recommendations
3. Frontend displays clusters with suggested keeper
4. User reviews and selects actions (keep, move, delete)
5. Backend executes file operations based on selections

### File Operations
1. User confirms action (with safety confirmation for delete)
2. Backend executes move/delete operations
3. Update database to reflect state changes
4. Frontend refreshes UI

---

## Technology Stack

### Backend
- **Framework:** Flask or FastAPI
- **Database:** SQLite (with SQLAlchemy ORM)
- **Image Processing:** `duplicate_images`, PIL/Pillow, OpenCV (optional for quality analysis)
- **Concurrency:** multiprocessing / concurrent.futures
- **EXIF:** Pillow, piexif

### Frontend
- **Framework:** React 18+ or Vue 3
- **Build Tool:** Vite
- **HTTP Client:** Axios or Fetch API
- **Styling:** Tailwind CSS or styled-components
- **State Management:** React Context API or Pinia

### DevOps
- **Python Version:** 3.14 (as specified)
- **Package Manager:** pip with venv
- **Testing:** pytest (backend), Jest/Vitest (frontend)

---

## Development Phases

### Phase 1: Backend Core (MVP)
- [ ] Set up Flask/FastAPI project structure
- [ ] Implement hash engine with `duplicate_images`
- [ ] Build SQLite database and models
- [ ] Create basic API endpoints for scanning and retrieval
- [ ] Implement file manager operations

### Phase 2: Frontend MVP
- [ ] React project setup
- [ ] Review page with image gallery
- [ ] Basic action buttons (move, delete)
- [ ] API integration

### Phase 3: Advanced Features
- [ ] Intelligent quality scoring (resolution, focus detection)
- [ ] Advanced filtering and sorting
- [ ] Settings page with configuration
- [ ] Batch operations

### Phase 4: Polish & Optimization
- [ ] Error handling and validation
- [ ] Performance optimization
- [ ] Unit and integration tests
- [ ] Documentation and deployment guide

---

## Key Features Implementation Notes

### Parallel Processing
- Use `concurrent.futures.ThreadPoolExecutor` or `multiprocessing.Pool`
- Track progress in database and expose via API

### Intelligent Suggestion
- **Quality Score Calculation:**
  - Resolution (higher = better)
  - Focus quality (detect blur using edge detection)
  - File size (larger = potentially higher quality)
  - EXIF data (camera model, settings)

### File Filtering
- Valid image extensions: `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.bmp`, `.tiff`
- Skip: video files, audio, documents, system files

---

## Error Handling & Validation

- Validate directory paths before scanning
- Handle permission errors gracefully
- Prevent accidental deletion with confirmation dialogs
- Log all operations for debugging
- Graceful handling of corrupted image files

---

## Performance Considerations

- Cache hash computations in database to avoid re-hashing
- Lazy load images in frontend (pagination/virtualization)
- Use WebSocket or SSE for real-time progress updates
- Optimize database queries with proper indexing

---

## Security Considerations

- Validate all user input (paths, file operations)
- Run file operations with user's permissions
- Prevent directory traversal attacks
- Confirm destructive operations (delete)
- Sanitize API responses

---
