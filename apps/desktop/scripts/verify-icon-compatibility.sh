#!/usr/bin/env bash

# 图标兼容性验证脚本
# 用于检查构建后的 app bundle 是否正确包含两种图标格式

set -e

APP_PATH="${1:-./build-electron/mac-universal/OneKey.app}"

echo "================================"
echo "Icon Compatibility Verification"
echo "================================"
echo ""

if [ ! -d "$APP_PATH" ]; then
    echo "Error: App bundle not found at: $APP_PATH"
    echo "Usage: $0 <path-to-app>"
    exit 1
fi

echo "Checking: $APP_PATH"
echo ""

# 1. 检查 Info.plist 配置
echo "1. Info.plist Configuration:"
echo "----------------------------"
PLIST="$APP_PATH/Contents/Info.plist"

if /usr/libexec/PlistBuddy -c "Print :CFBundleIconName" "$PLIST" 2>/dev/null; then
    ICON_NAME=$(/usr/libexec/PlistBuddy -c "Print :CFBundleIconName" "$PLIST")
    echo "   ✓ CFBundleIconName: $ICON_NAME (macOS 26+ Liquid Glass)"
else
    echo "   ✗ CFBundleIconName: Not found"
fi

if /usr/libexec/PlistBuddy -c "Print :CFBundleIconFile" "$PLIST" 2>/dev/null; then
    ICON_FILE=$(/usr/libexec/PlistBuddy -c "Print :CFBundleIconFile" "$PLIST")
    echo "   ✓ CFBundleIconFile: $ICON_FILE (Legacy compatibility)"
else
    echo "   ✗ CFBundleIconFile: Not found"
fi

echo ""

# 2. 检查 Assets.car 文件
echo "2. Liquid Glass Icon (macOS 26+):"
echo "----------------------------------"
ASSETS_CAR="$APP_PATH/Contents/Resources/Assets.car"
if [ -f "$ASSETS_CAR" ]; then
    SIZE=$(du -h "$ASSETS_CAR" | awk '{print $1}')
    echo "   ✓ Assets.car: Found ($SIZE)"

    # 尝试使用 assetutil 验证内容
    if command -v assetutil &> /dev/null; then
        echo "   → Validating Assets.car contents..."
        if assetutil --info "$ASSETS_CAR" 2>/dev/null | grep -q "OneKeyLogo"; then
            echo "   ✓ Contains 'OneKeyLogo' icon"
        else
            echo "   ⚠ Warning: 'OneKeyLogo' not found in Assets.car"
        fi
    fi
else
    echo "   ✗ Assets.car: Not found"
    echo "   ⚠ macOS 26+ users will not get Liquid Glass effects"
fi

echo ""

# 3. 检查传统 .icns 文件
echo "3. Legacy Icon (macOS 25 and earlier):"
echo "---------------------------------------"
ICNS_FILE="$APP_PATH/Contents/Resources/icon.icns"
if [ -f "$ICNS_FILE" ]; then
    SIZE=$(du -h "$ICNS_FILE" | awk '{print $1}')
    echo "   ✓ icon.icns: Found ($SIZE)"

    # 检查 icns 文件的图标尺寸
    if command -v iconutil &> /dev/null; then
        echo "   → Checking icon sizes..."
        TEMP_DIR=$(mktemp -d)
        iconutil -c iconset "$ICNS_FILE" -o "$TEMP_DIR/icon.iconset" 2>/dev/null || true
        if [ -d "$TEMP_DIR/icon.iconset" ]; then
            COUNT=$(ls "$TEMP_DIR/icon.iconset" | wc -l)
            echo "   ✓ Contains $COUNT size variants"
        fi
        rm -rf "$TEMP_DIR"
    fi
else
    echo "   ✗ icon.icns: Not found"
    echo "   ⚠ Legacy macOS users may not see app icon"
fi

echo ""

# 4. 兼容性总结
echo "4. Compatibility Summary:"
echo "-------------------------"

HAS_ASSETS_CAR=0
HAS_ICNS=0
HAS_ICON_NAME=0

[ -f "$ASSETS_CAR" ] && HAS_ASSETS_CAR=1
[ -f "$ICNS_FILE" ] && HAS_ICNS=1
/usr/libexec/PlistBuddy -c "Print :CFBundleIconName" "$PLIST" &>/dev/null && HAS_ICON_NAME=1

if [ $HAS_ASSETS_CAR -eq 1 ] && [ $HAS_ICON_NAME -eq 1 ]; then
    echo "   ✓ macOS 26+ (Liquid Glass): ENABLED"
else
    echo "   ✗ macOS 26+ (Liquid Glass): DISABLED"
fi

if [ $HAS_ICNS -eq 1 ]; then
    echo "   ✓ macOS 25 and earlier: COMPATIBLE"
else
    echo "   ✗ macOS 25 and earlier: NOT COMPATIBLE"
fi

echo ""

if [ $HAS_ASSETS_CAR -eq 1 ] && [ $HAS_ICNS -eq 1 ] && [ $HAS_ICON_NAME -eq 1 ]; then
    echo "================================"
    echo "✓ Full Compatibility Achieved!"
    echo "================================"
    exit 0
else
    echo "================================"
    echo "⚠ Compatibility Issues Detected"
    echo "================================"
    exit 1
fi
