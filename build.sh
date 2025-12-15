#!/bin/bash

# Build script for macOS .app bundle

echo "Building Find Similar Images for macOS..."

# Clean previous builds
echo "Cleaning previous builds..."
rm -rf build dist

# Run PyInstaller
echo "Running PyInstaller..."
pyinstaller FindSimilarImages.spec

# Check if build succeeded
if [ -d "dist/FindSimilarImages.app" ]; then
    echo "✓ Build successful!"
    echo "App bundle location: dist/FindSimilarImages.app"
    echo ""
    echo "To test the app:"
    echo "  open dist/FindSimilarImages.app"
    echo ""
    echo "To create a DMG for distribution, run:"
    echo "  ./create_dmg.sh"
else
    echo "✗ Build failed!"
    exit 1
fi
