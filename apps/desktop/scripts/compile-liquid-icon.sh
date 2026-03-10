#!/usr/bin/env bash

set -e

echo "================================"
echo "Starting: Compile macOS Liquid Glass Icon"
echo "================================"

OUTPUT_PATH="./resources/icons"
PLIST_PATH="$OUTPUT_PATH/assetcatalog_generated_info.plist"
DEVELOPMENT_REGION="en"

BUILD_VARIANT=$(echo "${ONEKEY_BUILD_VARIANT:-}" | tr '[:upper:]' '[:lower:]')
ALLOW_SKIP_GPG=$(echo "${ONEKEY_ALLOW_SKIP_GPG_VERIFICATION:-}" | tr '[:upper:]' '[:lower:]')

ICON_NAME="OneKeyLogo"
ICON_PATH="../mobile/ios/OneKeyLogo.icon"
if [[ "$BUILD_VARIANT" == "skip_gpg" || "$ALLOW_SKIP_GPG" == "true" ]]; then
    ICON_NAME="OneKeyLogoSkipGpg"
    ICON_PATH="../mobile/ios/OneKeyLogoSkipGpg.icon"
fi

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_PATH"

# Check if actool is available
if ! command -v actool &> /dev/null; then
    echo "Warning: actool not found. Skipping Liquid Glass icon compilation."
    echo "This tool requires Xcode. macOS 26+ SDK is needed for Liquid Glass icon compilation."
    echo "Creating empty Assets.car placeholder to prevent build failure."
    # Create empty Assets.car placeholder to prevent build failure.
    touch "$OUTPUT_PATH/Assets.car"
    exit 0
fi

# Check if icon source exists
if [ ! -d "$ICON_PATH" ]; then
    if [ "$ICON_NAME" = "OneKeyLogoSkipGpg" ]; then
        echo "Warning: Skip-gpg icon source not found at $ICON_PATH"
        echo "Falling back to standard icon source."
        ICON_NAME="OneKeyLogo"
        ICON_PATH="../mobile/ios/OneKeyLogo.icon"
    fi

    if [ ! -d "$ICON_PATH" ]; then
        echo "Warning: Icon source not found at $ICON_PATH"
        echo "Skipping Liquid Glass icon compilation."
        echo "Creating empty Assets.car placeholder to prevent build failure."
        # Create empty Assets.car placeholder to prevent build failure.
        touch "$OUTPUT_PATH/Assets.car"
        exit 0
    fi
fi

# Compile the icon
echo "Running actool to compile icon: name=$ICON_NAME path=$ICON_PATH"
actool "$ICON_PATH" --compile "$OUTPUT_PATH" \
  --output-format human-readable-text --notices --warnings --errors \
  --output-partial-info-plist "$PLIST_PATH" \
  --app-icon "$ICON_NAME" --include-all-app-icons \
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
