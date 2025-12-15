#!/bin/bash

# Create DMG installer for distribution

APP_NAME="FindSimilarImages"
VERSION=$(cat VERSION 2>/dev/null || echo "1.0.0")
DMG_NAME="${APP_NAME}-${VERSION}.dmg"

echo "Creating DMG installer..."

# Create temporary directory
TMP_DIR=$(mktemp -d)
cp -R "dist/${APP_NAME}.app" "$TMP_DIR/"

# Create DMG
hdiutil create -volname "$APP_NAME" \
    -srcfolder "$TMP_DIR" \
    -ov -format UDZO \
    "$DMG_NAME"

# Cleanup
rm -rf "$TMP_DIR"

if [ -f "$DMG_NAME" ]; then
    echo "✓ DMG created successfully: $DMG_NAME"
    echo "File size: $(du -h "$DMG_NAME" | cut -f1)"
else
    echo "✗ DMG creation failed!"
    exit 1
fi
