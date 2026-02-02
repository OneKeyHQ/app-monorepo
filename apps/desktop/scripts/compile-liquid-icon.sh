#!/usr/bin/env bash

set -e

echo "================================"
echo "Starting: Compile macOS Liquid Glass Icon"
echo "================================"

ICON_PATH="../mobile/ios/OneKeyLogo.icon"
OUTPUT_PATH="./resources/icons"
PLIST_PATH="$OUTPUT_PATH/assetcatalog_generated_info.plist"
DEVELOPMENT_REGION="en"

# Check if actool is available
if ! command -v actool &> /dev/null; then
    echo "Warning: actool not found. Skipping Liquid Glass icon compilation."
    echo "This tool requires Xcode and is only available on macOS 26+."
    exit 0
fi

# Check if icon source exists
if [ ! -d "$ICON_PATH" ]; then
    echo "Warning: Icon source not found at $ICON_PATH"
    echo "Skipping Liquid Glass icon compilation."
    exit 0
fi

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_PATH"

# Compile the icon
echo "Running actool to compile icon..."
actool "$ICON_PATH" --compile "$OUTPUT_PATH" \
  --output-format human-readable-text --notices --warnings --errors \
  --output-partial-info-plist "$PLIST_PATH" \
  --app-icon OneKeyLogo --include-all-app-icons \
  --enable-on-demand-resources NO \
  --development-region "$DEVELOPMENT_REGION" \
  --target-device mac \
  --minimum-deployment-target 26.0 \
  --platform macosx

# Clean up temporary plist file
if [ -f "$PLIST_PATH" ]; then
    rm "$PLIST_PATH"
fi

echo ""
echo "Generated files:"
ls -lh "$OUTPUT_PATH/"
echo ""
echo "================================"
echo "✓ Completed: Liquid Glass Icon Compilation"
echo "================================"
