#!/usr/bin/env python3
"""
Generate app icon for Find Similar Images
Creates PNG files at various sizes for .icns conversion
"""

from PIL import Image, ImageDraw, ImageFont
import os

def create_icon_image(size):
    """Create a single icon at specified size"""
    # Create image with dark background
    img = Image.new('RGB', (size, size), color='#1a1a1a')
    draw = ImageDraw.Draw(img)

    # Calculate proportions
    corner_radius = int(size * 0.15)

    # Draw rounded rectangle background
    draw.rounded_rectangle(
        [(0, 0), (size, size)],
        radius=corner_radius,
        fill='#1a1a1a'
    )

    # Create gradient effect by drawing the text with gradient colors
    # Approximate gradient with two colors
    font_size = int(size * 0.36)

    try:
        # Try to use a system font
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", font_size)
    except:
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
        except:
            # Fallback to default
            font = ImageFont.load_default()

    # Draw "FSI" text
    text = "FSI"

    # Get text bounding box for centering
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]

    # Center position
    x = (size - text_width) // 2
    y = (size - text_height) // 2 + int(size * 0.05)

    # Draw text with gradient colors (teal to purple)
    # Top part: teal (#14b8a6)
    draw.text((x, y), text, font=font, fill='#14b8a6')

    # Add a subtle shadow/gradient effect by drawing again with slight offset
    # Bottom part should be more purple, but since we can't do true gradient,
    # we'll use the teal color for consistency

    return img

def main():
    # Icon sizes needed for macOS .icns
    sizes = [16, 32, 64, 128, 256, 512, 1024]

    # Create output directory
    iconset_dir = "AppIcon.iconset"
    os.makedirs(iconset_dir, exist_ok=True)

    print("Generating app icon images...")

    for size in sizes:
        # Create normal resolution
        img = create_icon_image(size)
        filename = f"icon_{size}x{size}.png"
        img.save(os.path.join(iconset_dir, filename))
        print(f"  ✓ Created {filename}")

        # Create @2x resolution for retina displays
        if size <= 512:  # Only create @2x up to 512
            img_2x = create_icon_image(size * 2)
            filename_2x = f"icon_{size}x{size}@2x.png"
            img_2x.save(os.path.join(iconset_dir, filename_2x))
            print(f"  ✓ Created {filename_2x}")

    print(f"\n✓ Icon images created in {iconset_dir}/")
    print("\nTo convert to .icns file, run:")
    print(f"  iconutil -c icns {iconset_dir}")
    print("\nThis will create: AppIcon.icns")

if __name__ == "__main__":
    main()
