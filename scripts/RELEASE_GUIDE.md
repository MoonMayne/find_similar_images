# Release Guide for Find Similar Images

Complete guide for creating and publishing releases to GitHub.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Release Workflow](#quick-release-workflow)
- [Detailed Step-by-Step Guide](#detailed-step-by-step-guide)
- [Versioning Strategy](#versioning-strategy)
- [Troubleshooting](#troubleshooting)
- [Advanced Topics](#advanced-topics)

---

## Prerequisites

Before creating a release, ensure you have:

- macOS with Python 3.14+ installed
- PyInstaller and all dependencies installed (`pip install -r backend/requirements.txt`)
- Git repository with all changes committed
- GitHub account with push access to the repository
- Homebrew (for python-tk if not already installed)

### One-Time Setup

Install required Python packages:

```bash
# Activate virtual environment
source venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
```

---

## Quick Release Workflow

For experienced users who want the fastest path to creating a release:

```bash
# 1. Prepare release (updates version and builds everything)
./scripts/prepare_release.sh 1.0.1

# 2. Test the app
open releases/v1.0.1/FindSimilarImages.app

# 3. Edit release notes
nano releases/v1.0.1/RELEASE_NOTES.md

# 4. Create and push git tag
git tag -a v1.0.1 -m "Release version 1.0.1"
git push origin v1.0.1

# 5. Create GitHub release
# Go to: https://github.com/sanhak994/find_similar_images/releases/new
# Upload: DMG, ZIP, checksums.txt from releases/v1.0.1/
```

---

## Detailed Step-by-Step Guide

### Step 1: Prepare Release Locally

You have three options for preparing a release:

**Option A: Automatic Version Bump (Recommended)**

```bash
# Updates version and builds everything in one command
./scripts/prepare_release.sh 1.0.1
```

This will:
- Prompt you to update the version
- Update VERSION file, create_dmg.sh, and FindSimilarImages.spec
- Build the app bundle
- Create DMG and ZIP distributions
- Generate checksums
- Create release notes template

**Option B: Manual Version Control**

```bash
# Update version separately
./scripts/update_version.sh 1.0.1

# Then prepare release with current version
./scripts/prepare_release.sh --current
```

**Option C: Interactive Mode**

```bash
# Will prompt for version during execution
./scripts/prepare_release.sh
```

### Step 2: Review Build Artifacts

Navigate to the release directory and verify all files are present:

```bash
cd releases/v1.0.1
ls -lh
```

Expected files:
- `FindSimilarImages.app/` - macOS application bundle (~190MB)
- `FindSimilarImages-1.0.1.dmg` - DMG installer (~80MB)
- `FindSimilarImages-1.0.1.zip` - ZIP archive (~190MB)
- `checksums.txt` - SHA256 hashes for verification
- `RELEASE_NOTES.md` - Template for release description

### Step 3: Test the Build

Before publishing, thoroughly test the build:

**Test App Bundle:**
```bash
open releases/v1.0.1/FindSimilarImages.app
```

**Test DMG Installer:**
```bash
open releases/v1.0.1/FindSimilarImages-1.0.1.dmg
```

**Test ZIP Archive:**
```bash
unzip -q releases/v1.0.1/FindSimilarImages-1.0.1.zip -d /tmp/test
open /tmp/test/FindSimilarImages.app
```

**Verification Checklist:**
- [ ] App launches successfully
- [ ] Control panel window appears with dock icon
- [ ] Browser auto-opens to localhost:8000
- [ ] "Open in Browser" button works
- [ ] Can scan directories
- [ ] Can review groups
- [ ] Can trash files
- [ ] "Quit" button stops server and exits cleanly
- [ ] No console errors in logs (`tail ~/FindSimilarImages_error.log`)

### Step 4: Edit Release Notes

Open the release notes template:

```bash
nano releases/v1.0.1/RELEASE_NOTES.md
```

**What to update:**

1. Replace `[Describe new features, improvements, and bug fixes here]` with actual content
2. Fill in the "Changes" section with specific updates
3. Review and adjust installation instructions if needed
4. Verify checksums are included correctly

**Getting changelog from git:**

```bash
# See commits since last version tag
git log v1.0.0..HEAD --oneline

# Or get more detailed commit messages
git log v1.0.0..HEAD --pretty=format:"- %s (%h)"
```

**Example Release Notes:**

```markdown
## What's New

Version 1.0.1 is a maintenance release with bug fixes and performance improvements.

## Changes

- Fix: Resolved issue with thumbnail cache cleanup not working on fresh installations
- Fix: Corrected button text visibility in dark mode on macOS
- Improvement: Added better error logging for debugging
- Improvement: Updated documentation with build instructions
```

### Step 5: Create Git Tag

Tags mark specific points in your repository's history as releases.

**Create annotated tag:**

```bash
git tag -a v1.0.1 -m "Release version 1.0.1"
```

**View the tag:**

```bash
git show v1.0.1
```

**Push tag to GitHub:**

```bash
git push origin v1.0.1
```

**Note:** You can also create the tag directly from GitHub's release interface, but creating it locally first gives you more control.

### Step 6: Create GitHub Release

1. **Navigate to releases page:**
   - Go to: https://github.com/sanhak994/find_similar_images/releases
   - Click "Draft a new release"

2. **Fill in release form:**

   **Tag version:**
   - Click "Choose a tag"
   - Select `v1.0.1` from the dropdown
   - Or type `v1.0.1` to create a new tag

   **Release title:**
   ```
   Find Similar Images v1.0.1
   ```

   **Description:**
   - Copy and paste content from `releases/v1.0.1/RELEASE_NOTES.md`
   - GitHub will render the Markdown

3. **Upload binaries:**
   - Drag and drop files to the "Attach binaries" section:
     - `FindSimilarImages-1.0.1.dmg`
     - `FindSimilarImages-1.0.1.zip`
     - `checksums.txt`

4. **Select release type:**
   - For stable releases: Uncheck "Set as a pre-release"
   - For beta/RC versions: Check "Set as a pre-release"
   - Check "Set as the latest release" if this is the newest stable version

5. **Publish:**
   - Click "Publish release"

### Step 7: Verify Release

After publishing, verify everything is correct:

1. **Visit release page:**
   - https://github.com/sanhak994/find_similar_images/releases/latest

2. **Check downloads:**
   - Click each file link to ensure they download correctly
   - Verify file sizes match expectations

3. **Verify checksums:**
   ```bash
   # Download files from GitHub
   curl -LO https://github.com/sanhak994/find_similar_images/releases/download/v1.0.1/FindSimilarImages-1.0.1.dmg
   curl -LO https://github.com/sanhak994/find_similar_images/releases/download/v1.0.1/checksums.txt

   # Verify checksum matches
   shasum -a 256 -c checksums.txt
   ```

4. **Test installation on clean system (if possible):**
   - Download DMG from release page
   - Install on a test Mac
   - Verify app works as expected

---

## Versioning Strategy

This project follows [Semantic Versioning 2.0.0](https://semver.org/):

```
MAJOR.MINOR.PATCH
```

### When to Increment Each Number

**MAJOR version (X.0.0)** - Incompatible API changes or major breaking changes
- Example: Complete UI redesign, backend rewrite
- `1.0.0` → `2.0.0`

**MINOR version (x.Y.0)** - New features, backward compatible
- Example: New hash algorithm, export feature
- `1.0.0` → `1.1.0`

**PATCH version (x.x.Z)** - Bug fixes, backward compatible
- Example: Fix crash, improve performance
- `1.0.0` → `1.0.1`

### Version Examples

| Scenario | Current | New | Type |
|----------|---------|-----|------|
| Fix thumbnail cache bug | 1.0.0 | 1.0.1 | PATCH |
| Add new similarity algorithm | 1.0.1 | 1.1.0 | MINOR |
| Redesign entire UI | 1.1.0 | 2.0.0 | MAJOR |
| Multiple bug fixes | 1.2.3 | 1.2.4 | PATCH |
| Add CLI support | 1.2.4 | 1.3.0 | MINOR |

---

## Troubleshooting

### Build Fails

**Symptom:** `./build.sh` fails or `dist/FindSimilarImages.app` is not created

**Solutions:**
```bash
# Ensure virtual environment is activated
source venv/bin/activate

# Verify PyInstaller is installed
pip install pyinstaller

# Clean build directory and retry
rm -rf build dist
./build.sh
```

### DMG Creation Fails

**Symptom:** `create_dmg.sh` fails or DMG file is not created

**Solutions:**
```bash
# Verify app bundle exists
ls -la dist/FindSimilarImages.app

# Check disk space
df -h

# Verify hdiutil is available
which hdiutil
```

### Version Update Doesn't Work

**Symptom:** `update_version.sh` fails or version isn't updated

**Solutions:**
```bash
# Ensure you're in the project root
pwd
ls -la VERSION

# Check file permissions
chmod +x scripts/update_version.sh

# Manually verify files exist
ls -la create_dmg.sh FindSimilarImages.spec
```

### GitHub Upload Fails

**Symptom:** Can't upload files to GitHub release

**Solutions:**
- Check file size (GitHub has 2GB limit per file)
- Verify you have write access to the repository
- Try using GitHub CLI for large files:
  ```bash
  brew install gh
  gh auth login
  gh release upload v1.0.1 releases/v1.0.1/*.dmg
  ```

### Gatekeeper Blocks App

**Symptom:** macOS blocks the app from opening ("unidentified developer")

**Solutions:**
- Document workaround in release notes:
  ```
  Right-click the app → Select "Open" → Click "Open" in dialog
  ```
- Future enhancement: Sign the app with Apple Developer ID
- Future enhancement: Notarize the app with Apple

---

## Advanced Topics

### Code Signing (Future Enhancement)

To avoid Gatekeeper warnings, sign the app with an Apple Developer ID:

**Prerequisites:**
- Apple Developer account ($99/year)
- Developer ID Application certificate

**Signing process:**
```bash
# Sign the app
codesign --deep --force --verify --verbose \
  --sign "Developer ID Application: Your Name (TEAM_ID)" \
  dist/FindSimilarImages.app

# Verify signature
codesign --verify --verbose dist/FindSimilarImages.app
```

**Update `build.sh` to include signing:**
```bash
# After PyInstaller build
if [ -n "$CODESIGN_IDENTITY" ]; then
  codesign --deep --force --sign "$CODESIGN_IDENTITY" dist/FindSimilarImages.app
fi
```

### Notarization (Future Enhancement)

For distribution outside the Mac App Store, notarize the app:

```bash
# Create app archive
ditto -c -k --keepParent dist/FindSimilarImages.app FindSimilarImages.zip

# Submit for notarization
xcrun notarytool submit FindSimilarImages.zip \
  --apple-id "your@email.com" \
  --team-id "TEAM_ID" \
  --password "app-specific-password" \
  --wait

# Staple notarization ticket
xcrun stapler staple dist/FindSimilarImages.app
```

### Using GitHub CLI

For faster release creation, use the GitHub CLI:

**Install:**
```bash
brew install gh
gh auth login
```

**Create release in one command:**
```bash
gh release create v1.0.1 \
  releases/v1.0.1/FindSimilarImages-1.0.1.dmg \
  releases/v1.0.1/FindSimilarImages-1.0.1.zip \
  releases/v1.0.1/checksums.txt \
  --title "Find Similar Images v1.0.1" \
  --notes-file releases/v1.0.1/RELEASE_NOTES.md
```

**List releases:**
```bash
gh release list
```

**Delete a release (if needed):**
```bash
gh release delete v1.0.1
```

### Automated Changelog

For better release notes, maintain a CHANGELOG.md file:

**CHANGELOG.md format:**
```markdown
# Changelog

## [1.0.1] - 2025-01-15

### Fixed
- Thumbnail cache cleanup now works on fresh installations
- Button text visibility in dark mode on macOS

### Improved
- Better error logging for debugging
- Documentation updates

## [1.0.0] - 2025-01-01

### Added
- Initial release
- Perceptual image hashing
- Side-by-side comparison
- Safe file deletion
```

**Use conventional commits for easier changelog generation:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `chore:` - Maintenance
- `refactor:` - Code refactoring

---

## Release Checklist

Use this checklist for every release:

**Pre-Release:**
- [ ] All changes committed to main branch
- [ ] Virtual environment activated
- [ ] Dependencies up to date (`pip install -r backend/requirements.txt`)
- [ ] Tests passing (if applicable)
- [ ] Version number decided

**Build:**
- [ ] Run `./scripts/prepare_release.sh <version>`
- [ ] Verify files in `releases/v<version>/`
- [ ] Check file sizes are reasonable

**Testing:**
- [ ] App bundle launches successfully
- [ ] DMG installs correctly
- [ ] ZIP extracts and works
- [ ] All core features tested
- [ ] No console errors in logs

**Documentation:**
- [ ] Release notes written
- [ ] Changelog updated (if applicable)
- [ ] Installation instructions verified

**Git:**
- [ ] Git tag created
- [ ] Tag pushed to GitHub
- [ ] Version update committed (if using `--commit`)

**GitHub Release:**
- [ ] Release created on GitHub
- [ ] DMG uploaded
- [ ] ZIP uploaded
- [ ] Checksums uploaded
- [ ] Release notes copied
- [ ] Release published

**Verification:**
- [ ] Release page displays correctly
- [ ] Files are downloadable
- [ ] Checksums match
- [ ] Tagged as latest release (if applicable)

**Announcement (Optional):**
- [ ] Update README badges if needed
- [ ] Announce on social media
- [ ] Update project website

---

## Quick Reference

### File Locations

```
releases/v1.0.1/
├── FindSimilarImages.app       # App bundle
├── FindSimilarImages-1.0.1.dmg # Installer
├── FindSimilarImages-1.0.1.zip # Archive
├── checksums.txt               # SHA256 hashes
└── RELEASE_NOTES.md            # Release description
```

### Commands Cheat Sheet

```bash
# Update version
./scripts/update_version.sh 1.0.1 --commit

# Prepare release
./scripts/prepare_release.sh 1.0.1

# Test builds
open releases/v1.0.1/FindSimilarImages.app
open releases/v1.0.1/FindSimilarImages-1.0.1.dmg

# Create git tag
git tag -a v1.0.1 -m "Release 1.0.1"
git push origin v1.0.1

# Verify checksums
cd releases/v1.0.1
shasum -a 256 -c checksums.txt
```

### GitHub URLs

- Releases: `https://github.com/sanhak994/find_similar_images/releases`
- New release: `https://github.com/sanhak994/find_similar_images/releases/new`
- Latest release: `https://github.com/sanhak994/find_similar_images/releases/latest`

---

## Getting Help

- **Project issues:** https://github.com/sanhak994/find_similar_images/issues
- **GitHub Docs:** https://docs.github.com/en/repositories/releasing-projects-on-github
- **Semantic Versioning:** https://semver.org/

---

**Last Updated:** January 2025
