#!/bin/bash

# Prepare a complete release for GitHub

set -e  # Exit on error

# Parse arguments
VERSION_ARG=$1

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

# Ensure we're in the project root
if [ ! -f "VERSION" ]; then
    echo "Error: VERSION file not found. Are you in the project root directory?"
    exit 1
fi

# Determine version
if [ "$VERSION_ARG" = "--current" ]; then
    VERSION=$(cat VERSION)
    echo "Using current version: $VERSION"
elif [ -n "$VERSION_ARG" ]; then
    # Update version
    echo "Preparing to update version to $VERSION_ARG"
    read -p "Update version to $VERSION_ARG? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -f "scripts/update_version.sh" ]; then
            echo "y" | ./scripts/update_version.sh "$VERSION_ARG"
        else
            echo "Error: scripts/update_version.sh not found!"
            exit 1
        fi
    fi
    VERSION=$VERSION_ARG
else
    # Interactive mode
    CURRENT_VERSION=$(cat VERSION 2>/dev/null || echo "1.0.0")
    echo "Current version: $CURRENT_VERSION"
    echo ""
    read -p "Enter new version (or press Enter to use current): " NEW_VERSION

    if [ -n "$NEW_VERSION" ]; then
        if [ -f "scripts/update_version.sh" ]; then
            ./scripts/update_version.sh "$NEW_VERSION"
        else
            echo "Error: scripts/update_version.sh not found!"
            exit 1
        fi
        VERSION=$NEW_VERSION
    else
        VERSION=$CURRENT_VERSION
    fi
fi

RELEASE_DIR="releases/v${VERSION}"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  Preparing Release v${VERSION}               ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Create release directory
print_step "Creating release directory"
mkdir -p "$RELEASE_DIR"
print_success "Created $RELEASE_DIR"

# Clean previous builds
print_step "Cleaning previous builds"
rm -rf build dist
print_success "Cleaned build artifacts"

# Build app bundle
print_step "Building app bundle"
if [ ! -f "build.sh" ]; then
    echo "Error: build.sh not found!"
    exit 1
fi

# Source virtual environment if it exists
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
fi

./build.sh
if [ ! -d "dist/FindSimilarImages.app" ]; then
    echo "Error: Build failed! dist/FindSimilarImages.app not found"
    exit 1
fi
APP_SIZE=$(du -sh dist/FindSimilarImages.app | cut -f1)
print_success "App bundle built ($APP_SIZE)"

# Copy app to release directory
print_step "Copying app to release directory"
cp -R "dist/FindSimilarImages.app" "$RELEASE_DIR/"
print_success "App copied to release directory"

# Create DMG
print_step "Creating DMG installer"
if [ ! -f "create_dmg.sh" ]; then
    echo "Error: create_dmg.sh not found!"
    exit 1
fi

./create_dmg.sh
DMG_FILE="FindSimilarImages-${VERSION}.dmg"
if [ ! -f "$DMG_FILE" ]; then
    echo "Error: DMG creation failed! $DMG_FILE not found"
    exit 1
fi
mv "$DMG_FILE" "$RELEASE_DIR/"
DMG_SIZE=$(du -sh "$RELEASE_DIR/$DMG_FILE" | cut -f1)
print_success "DMG created ($DMG_SIZE)"

# Create ZIP archive
print_step "Creating ZIP archive"
cd "$RELEASE_DIR"
ZIP_FILE="FindSimilarImages-${VERSION}.zip"
zip -r -q "$ZIP_FILE" "FindSimilarImages.app"
cd - > /dev/null
ZIP_SIZE=$(du -sh "$RELEASE_DIR/$ZIP_FILE" | cut -f1)
print_success "ZIP created ($ZIP_SIZE)"

# Generate checksums
print_step "Generating SHA256 checksums"
cd "$RELEASE_DIR"
shasum -a 256 "$DMG_FILE" "$ZIP_FILE" > checksums.txt
cd - > /dev/null
print_success "Checksums generated"

# Generate release notes template
print_step "Generating release notes template"
cat > "$RELEASE_DIR/RELEASE_NOTES.md" << EOF
# Find Similar Images v${VERSION}

## What's New

[Describe new features, improvements, and bug fixes here]

## Installation

### macOS Users

**Option 1: DMG Installer (Recommended)**
1. Download \`FindSimilarImages-${VERSION}.dmg\`
2. Open the DMG file
3. Drag FindSimilarImages.app to Applications
4. Launch from Applications folder

**Option 2: ZIP Archive**
1. Download \`FindSimilarImages-${VERSION}.zip\`
2. Extract the archive
3. Move FindSimilarImages.app to Applications
4. Launch from Applications folder

**First Launch:** You may need to right-click and select "Open" to bypass Gatekeeper.

## Checksums (SHA256)

\`\`\`
$(cat "$RELEASE_DIR/checksums.txt")
\`\`\`

## System Requirements

- macOS 10.13 or later
- 512MB RAM minimum
- Modern web browser (Chrome, Firefox, Safari, Edge)

## Changes

<!-- Replace with actual changelog from commits -->
- Feature: [Description]
- Fix: [Description]
- Improvement: [Description]

---

Full documentation: https://github.com/sanhak994/find_similar_images

Report issues: https://github.com/sanhak994/find_similar_images/issues
EOF
print_success "Release notes template created"

# Summary
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  Release v${VERSION} Ready!                  ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "📦 Release directory: $RELEASE_DIR"
echo ""
echo "📁 Files ready for upload:"
echo "   • $DMG_FILE ($DMG_SIZE) - DMG installer"
echo "   • $ZIP_FILE ($ZIP_SIZE) - ZIP archive"
echo "   • checksums.txt - SHA256 verification"
echo ""
echo "📋 Next steps:"
echo ""
echo "1️⃣  Test the app:"
echo "   open $RELEASE_DIR/FindSimilarImages.app"
echo ""
echo "2️⃣  Edit release notes:"
echo "   $RELEASE_DIR/RELEASE_NOTES.md"
echo ""
echo "3️⃣  Create git tag:"
echo "   git tag -a v${VERSION} -m \"Release version ${VERSION}\""
echo "   git push origin v${VERSION}"
echo ""
echo "4️⃣  Create GitHub release:"
echo "   • Go to: https://github.com/sanhak994/find_similar_images/releases/new"
echo "   • Select tag: v${VERSION}"
echo "   • Upload: $DMG_FILE, $ZIP_FILE, checksums.txt"
echo "   • Copy content from: $RELEASE_DIR/RELEASE_NOTES.md"
echo ""
echo "📖 See scripts/RELEASE_GUIDE.md for detailed instructions"
echo ""
