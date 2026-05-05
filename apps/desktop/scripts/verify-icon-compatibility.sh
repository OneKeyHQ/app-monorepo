#!/usr/bin/env bash

echo "================================"
echo "Starting: Verify Liquid Glass Icon"
echo "================================"

ASSETS_CAR="./resources/icons/Assets.car"

if [ -f "$ASSETS_CAR" ]; then
    # Get file size (compatible with both macOS and Linux)
    SIZE=$(stat -f%z "$ASSETS_CAR" 2>/dev/null || stat -c%s "$ASSETS_CAR" 2>/dev/null || echo "0")

    if [ "$SIZE" -gt 1000 ]; then
        echo "✓ Assets.car generated successfully ($(ls -lh "$ASSETS_CAR" | awk '{print $5}'))"
        echo ""
        echo "================================"
        echo "✓ Completed: Liquid Glass Icon Verification"
        echo "================================"
        exit 0
    else
        echo "⚠ Warning: Assets.car exists but appears to be a placeholder (${SIZE} bytes)."
        echo "  macOS 26+ Liquid Glass icons will not be available."
        echo "  This is expected on non-macOS build environments."
        echo ""
        echo "================================"
        echo "⚠ Completed: Placeholder Icon Detected"
        echo "================================"
        exit 0
    fi
else
    echo "✗ Error: Assets.car was not generated."
    echo "  Please run scripts/compile-liquid-icon.sh first."
    echo ""
    echo "================================"
    echo "✗ Failed: Icon Verification"
    echo "================================"
    exit 1
fi
