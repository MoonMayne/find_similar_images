# Find Similar Images

> Intelligent duplicate image detection and management tool using perceptual hashing

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/)

## Quick Start

### One-Command Installation

```bash
# Clone, setup, install, and run (all in one)
git clone https://github.com/YOUR_USERNAME/find_similar_images.git && \
cd find_similar_images && \
python3 -m venv venv && \
source venv/bin/activate && \
pip install -r backend/requirements.txt && \
python -m backend.app
```

Then open your browser to: **http://localhost:8000**

### After Installation (Subsequent Runs)

```bash
# Navigate to project directory
cd find_similar_images

# Activate virtual environment
source venv/bin/activate

# Start the application
python -m backend.app
```

---

## Screenshots

### Scan Setup Screen
![Scan Setup](./screenshots/setup_screen.png)

### Review Interface
![Review Interface](./screenshots/review_screen/.png)

---

## Features

- **8 Hash Algorithms** - phash, ahash, dhash, dhash_vertical, phash_simple, whash, colorhash, crop_resistant
- **Multi-Directory Scanning** - Scan multiple folders with configurable recursion
- **Side-by-Side Comparison** - Review similar images with toggleable comparison mode
- **Safe Deletion** - Files moved to system trash, never permanently deleted
- **Smart Suggestions** - Intelligent keeper suggestions based on sharpness, resolution, and metadata
- **Parallel Processing** - Multi-threaded hashing for faster scans
- **Persistent Cache** - Reuse hashes across scans for speed
- **Modern UI** - Dark theme with intuitive keyboard shortcuts
- **Image Metadata** - View resolution, file size, EXIF data, and sharpness scores

---

## System Requirements

- Python 3.8 or higher
- macOS, Linux, or Windows
- 512MB RAM minimum
- Modern web browser (Chrome, Firefox, Safari, Edge)

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TRASH_DIR` | System trash | Custom trash directory path |
| `HASH_DB` | `data/hash_cache.json` | Hash cache file location |
| `DB_PATH` | `data/app.db` | SQLite database path |
| `SIMILARITY_THRESHOLD` | `0` | Hamming distance threshold (0 = exact match) |
| `WORKERS` | CPU cores | Number of parallel hashing threads |
| `THUMBNAIL_MAX_SIZE` | `640` | Maximum thumbnail dimension in pixels |

### Example Usage

```bash
export TRASH_DIR=/path/to/custom/trash
export WORKERS=4
python -m backend.app
```

---

## Hash Algorithms Guide

| Algorithm | Speed | Accuracy | Best For |
|-----------|-------|----------|----------|
| `phash` (default) | Medium | High | General purpose |
| `ahash` | Fast | Medium | Quick scans, less precision |
| `dhash` | Fast | Medium | Detecting horizontal changes |
| `dhash_vertical` | Fast | Medium | Detecting vertical changes |
| `whash` | Medium | High | Wavelet-based, robust |
| `colorhash` | Fast | Medium | Color distribution matching |
| `crop_resistant` | Slow | Very High | Cropped or resized images |
| `phash_simple` | Fast | Medium | Simplified perceptual hash |

### Hash Size Parameter

- **Range:** 2-64
- **Default:** 8
- **Higher values** = more sensitive (finds subtle differences)
- **Lower values** = more lenient (groups more images together)

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `K` | Toggle Keep/Delete for selected image |
| `D` | Mark all images in group for deletion |
| `O` | Keep suggested image, trash others |
| `P` | Keep only selected image, trash others |
| `↑` / `↓` | Navigate between groups |
| `←` / `→` | Select previous/next image in group |
| `Z` (hold) | Magnify current image |

---

## Project Structure

```
find_similar_images/
├── backend/
│   ├── app.py              # FastAPI application entry
│   ├── config.py           # Configuration management
│   ├── requirements.txt    # Python dependencies
│   ├── api/
│   │   └── routes.py       # API endpoints
│   ├── core/
│   │   ├── hash_engine.py  # Image hashing and grouping
│   │   └── file_manager.py # File operations
│   ├── utils/
│   │   ├── image_utils.py  # Metadata extraction
│   │   └── thumbnails.py   # Thumbnail generation
│   ├── static/
│   │   ├── script.js       # Frontend logic
│   │   └── style.css       # Custom styling
│   └── templates/
│       └── index.html      # Server-rendered template
├── data/
│   ├── app.db              # SQLite database
│   ├── hash_cache.json     # Persistent hash cache
│   └── thumbnails/         # Cached thumbnails
├── docs/
│   ├── ARCHITECTURE.md     # Detailed architecture docs
│   └── project_purpose.md  # Project overview
└── README.md               # This file
```

---

## API Endpoints

For advanced users and developers:

```
POST   /api/scan                    - Start background scan
GET    /api/scan/{job_id}          - Poll scan status
GET    /api/groups                 - Get paginated groups
POST   /api/actions/trash          - Move files to trash
GET    /api/thumbnail              - Get cached thumbnail
```

---

## Troubleshooting

### Scan gets stuck at 0%
- Check that directories are readable
- Verify images are in supported formats (Only tested with .jpg, .jpeg, but others might work)
- Check console for error messages

### Images not grouping together
- Try adjusting hash size (e.g., 16 or 32)
    - lower hash will increase diversity of groups (less similar images) while higher hash will decrease group diversity (more similar images)
- Use `crop_resistant` algorithm for cropped images
- Adjust similarity threshold (higher = more lenient)

### Slow scanning
- Reduce number of workers if CPU usage is too high
- Use faster algorithms like `ahash` or `dhash`

### Virtual environment issues
- Make sure you activated the venv: `source venv/bin/activate`
- Verify Python version: `python --version` (3.8+)
    - Tested on 3.14
- Reinstall dependencies: `pip install -r backend/requirements.txt`

---

## Development

### Architecture

- **Backend:** FastAPI + SQLite
- **Frontend:** Vanilla JavaScript + Tailwind CSS
- **Hashing:** duplicate-images library
- **Image Processing:** OpenCV, whatever `duplicate-images` uses

### Running Tests

```bash
# Currently no test suite configured
# See tests/ directory for future implementation
```

### Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

See [ARCHITECTURE.md](docs/ARCHITECTURE.md) for technical details.

---

## Dependencies

```
fastapi           # Web framework
uvicorn           # ASGI server
python-multipart  # File upload support
send2trash        # Safe file deletion
duplicate-images  # Perceptual hashing engine
jinja2            # Template rendering
opencv-python     # Image processing and sharpness detection
```

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

## Acknowledgments

Built with:
- [duplicate-images](https://github.com/lene/DuplicateImages) - Finds similar images on backend
- [FastAPI](https://fastapi.tiangolo.com/) - Modern web framework
- [duplicate-images](https://github.com/elisemercury/Duplicate-Images) - Perceptual hashing engine
- [OpenCV](https://opencv.org/) - Image processing
- [Tailwind CSS](https://tailwindcss.com/) - Styling
