#!/bin/bash

# Update version across all project files

VERSION=$1
COMMIT_FLAG=$2

# Validate arguments
if [ -z "$VERSION" ]; then
    echo "Usage: $0 <version> [--commit]"
    echo ""
    echo "Examples:"
    echo "  $0 1.0.1              # Update version to 1.0.1"
    echo "  $0 1.0.1 --commit     # Update and create git commit"
    exit 1
fi

# Validate semantic version format (X.Y.Z)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Error: Version must be in semantic versioning format X.Y.Z"
    echo "Examples: 1.0.0, 1.2.3, 2.0.0"
    exit 1
fi

# Get current version
CURRENT_VERSION=$(cat VERSION 2>/dev/null || echo "unknown")
echo "Current version: $CURRENT_VERSION"
echo "New version: $VERSION"
echo ""

# Ask for confirmation
read -p "Update version to $VERSION? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "Updating version files..."
echo ""

# Update VERSION file
echo "$VERSION" > VERSION
echo "✓ Updated VERSION file"

# Update create_dmg.sh
if [ -f "create_dmg.sh" ]; then
    sed -i '' "s/VERSION=\".*\"/VERSION=\"$VERSION\"/" create_dmg.sh
    echo "✓ Updated create_dmg.sh"
else
    echo "⚠ Warning: create_dmg.sh not found"
fi

# Update FindSimilarImages.spec (both CFBundleVersion locations)
if [ -f "FindSimilarImages.spec" ]; then
    sed -i '' "s/'CFBundleVersion': '.*'/'CFBundleVersion': '$VERSION'/" FindSimilarImages.spec
    sed -i '' "s/'CFBundleShortVersionString': '.*'/'CFBundleShortVersionString': '$VERSION'/" FindSimilarImages.spec
    echo "✓ Updated FindSimilarImages.spec"
else
    echo "⚠ Warning: FindSimilarImages.spec not found"
fi

echo ""
echo "Changes made:"
echo "─────────────"

# Show git diff if in a git repository
if git rev-parse --git-dir > /dev/null 2>&1; then
    git diff VERSION create_dmg.sh FindSimilarImages.spec
else
    echo "Not in a git repository - skipping diff"
fi

# Create commit if requested
if [ "$COMMIT_FLAG" = "--commit" ]; then
    if git rev-parse --git-dir > /dev/null 2>&1; then
        git add VERSION create_dmg.sh FindSimilarImages.spec
        git commit -m "Bump version to $VERSION"
        echo ""
        echo "✓ Created git commit"
        echo ""
        echo "Next steps:"
        echo "  1. Review the commit: git show"
        echo "  2. Push changes: git push origin main"
    else
        echo "⚠ Warning: Not in a git repository - cannot create commit"
    fi
fi

echo ""
echo "Version update complete!"
echo ""
echo "To prepare a release with this version:"
echo "  ./scripts/prepare_release.sh --current"
