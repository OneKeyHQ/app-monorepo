#!/bin/bash

# Build MacApiBridge - Unified macOS Native API Tool
# This script compiles the unified Swift bridge for CloudKit and Keychain access
#
# Usage:
#   Local Development:
#     bash build.sh
#     - Automatically detects and uses installed Apple Development certificate
#
#   CI/Production Build:
#     CSC_LINK=./sign.p12 CSC_KEY_PASSWORD=xxx bash build.sh
#     - Uses certificate from sign.p12 file
#     - Creates temporary keychain for signing
#     - Cleans up keychain after build
#
# Environment Variables:
#   CSC_LINK          - Path to .p12 certificate file (relative to apps/desktop)
#   CSC_KEY_PASSWORD  - Password for the .p12 certificate

set -e

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
OUTPUT_NAME="onekey-desktop-mac-api-bridge"
OUTPUT_PATH="$SCRIPT_DIR/bin/$OUTPUT_NAME"

echo "Building MacApiBridge..."
echo ""

# Check if we're on macOS
if [[ "$(uname)" != "Darwin" ]]; then
    echo "❌ Error: MacApiBridge can only be built on macOS"
    exit 1
fi

# Check if Swift compiler is available
if ! command -v swiftc &> /dev/null; then
    echo "❌ Error: Swift compiler not found. Please install Xcode Command Line Tools."
    exit 1
fi

# Compile architecture-specific binaries (x86_64 + arm64)
echo "Compiling Swift sources for architecture-specific binaries..."
echo "  - MacApiBridge.swift (main entry point)"
echo "  - CloudKitModuleCore.swift (from Mobile)"
echo "  - KeychainModuleCore.swift (from Mobile)"
echo ""

# Paths to Mobile Core files
MOBILE_IOS_DIR="$SCRIPT_DIR/../../../mobile/ios/OneKeyWallet"
CLOUDKIT_CORE="$MOBILE_IOS_DIR/CloudKitModuleCore.swift"
KEYCHAIN_CORE="$MOBILE_IOS_DIR/KeychainModuleCore.swift"

# Verify Mobile Core files exist
if [[ ! -f "$CLOUDKIT_CORE" ]]; then
    echo "❌ Error: CloudKitModuleCore.swift not found at $CLOUDKIT_CORE"
    exit 1
fi

if [[ ! -f "$KEYCHAIN_CORE" ]]; then
    echo "❌ Error: KeychainModuleCore.swift not found at $KEYCHAIN_CORE"
    exit 1
fi

# Paths for architecture-specific binaries
X64_PATH="$SCRIPT_DIR/bin/${OUTPUT_NAME}-x64"
ARM64_PATH="$SCRIPT_DIR/bin/${OUTPUT_NAME}-arm64"

# Compile for x64 (Intel)
echo "📦 Compiling for x64 (Intel)..."
swiftc -target x86_64-apple-macos12 \
    -o "$X64_PATH" \
    "$SCRIPT_DIR/MacApiBridge.swift" \
    "$CLOUDKIT_CORE" \
    "$KEYCHAIN_CORE"

# Compile for arm64 (Apple Silicon)
echo "📦 Compiling for arm64 (Apple Silicon)..."
swiftc -target arm64-apple-macos12 \
    -o "$ARM64_PATH" \
    "$SCRIPT_DIR/MacApiBridge.swift" \
    "$CLOUDKIT_CORE" \
    "$KEYCHAIN_CORE"

# Code sign binaries with entitlements
ENTITLEMENTS_PATH="$SCRIPT_DIR/../../entitlements.mac.plist"
echo "🔐 Signing binaries with entitlements..."
echo "  Entitlements: $ENTITLEMENTS_PATH"
echo ""

# Determine signing identity based on environment
SIGN_IDENTITY=""
P12_FILE="$SCRIPT_DIR/../../sign.p12"

# Check if CSC_LINK and CSC_KEY_PASSWORD are set (CI environment)
if [[ -n "$CSC_LINK" ]] && [[ -n "$CSC_KEY_PASSWORD" ]]; then
    echo "  📦 CI Mode: Using certificate from CSC_LINK"
    P12_PATH="$SCRIPT_DIR/../../$CSC_LINK"

    if [[ ! -f "$P12_PATH" ]]; then
        echo "  ❌ Error: Certificate file not found at $P12_PATH"
        exit 1
    fi

    # Create a temporary keychain for CI
    TEMP_KEYCHAIN="build-macapi-bridge.keychain"
    TEMP_KEYCHAIN_PASSWORD="temp-$(date +%s)"

    echo "  Creating temporary keychain..."
    security create-keychain -p "$TEMP_KEYCHAIN_PASSWORD" "$TEMP_KEYCHAIN"
    security set-keychain-settings -lut 21600 "$TEMP_KEYCHAIN"
    security unlock-keychain -p "$TEMP_KEYCHAIN_PASSWORD" "$TEMP_KEYCHAIN"

    echo "  Importing certificate..."
    security import "$P12_PATH" -k "$TEMP_KEYCHAIN" -P "$CSC_KEY_PASSWORD" -T /usr/bin/codesign -T /usr/bin/security

    # Set partition list to allow codesigning without prompting
    security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$TEMP_KEYCHAIN_PASSWORD" "$TEMP_KEYCHAIN"

    # Add to search list
    security list-keychains -d user -s "$TEMP_KEYCHAIN" $(security list-keychains -d user | sed s/\"//g)

    # Find the identity from the imported certificate
    SIGN_IDENTITY=$(security find-identity -v -p codesigning "$TEMP_KEYCHAIN" | grep "Developer ID Application" | head -n 1 | awk -F'"' '{print $2}')

    if [[ -z "$SIGN_IDENTITY" ]]; then
        # Try Apple Development if Developer ID not found
        SIGN_IDENTITY=$(security find-identity -v -p codesigning "$TEMP_KEYCHAIN" | grep "Apple Development" | head -n 1 | awk -F'"' '{print $2}')
    fi

    if [[ -n "$SIGN_IDENTITY" ]]; then
        echo "  ✅ Using certificate: $SIGN_IDENTITY"
    else
        echo "  ❌ Error: Could not find signing identity in certificate"
        security delete-keychain "$TEMP_KEYCHAIN"
        exit 1
    fi

# Check if sign.p12 exists (alternative CI setup or manual build)
elif [[ -f "$P12_FILE" ]] && [[ -n "$CSC_KEY_PASSWORD" ]]; then
    echo "  📦 Using certificate from apps/desktop/sign.p12"

    # Create a temporary keychain
    TEMP_KEYCHAIN="build-macapi-bridge.keychain"
    TEMP_KEYCHAIN_PASSWORD="temp-$(date +%s)"

    echo "  Creating temporary keychain..."
    security create-keychain -p "$TEMP_KEYCHAIN_PASSWORD" "$TEMP_KEYCHAIN"
    security set-keychain-settings -lut 21600 "$TEMP_KEYCHAIN"
    security unlock-keychain -p "$TEMP_KEYCHAIN_PASSWORD" "$TEMP_KEYCHAIN"

    echo "  Importing certificate..."
    security import "$P12_FILE" -k "$TEMP_KEYCHAIN" -P "$CSC_KEY_PASSWORD" -T /usr/bin/codesign -T /usr/bin/security

    security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$TEMP_KEYCHAIN_PASSWORD" "$TEMP_KEYCHAIN"
    security list-keychains -d user -s "$TEMP_KEYCHAIN" $(security list-keychains -d user | sed s/\"//g)

    SIGN_IDENTITY=$(security find-identity -v -p codesigning "$TEMP_KEYCHAIN" | grep "Developer ID Application" | head -n 1 | awk -F'"' '{print $2}')

    if [[ -z "$SIGN_IDENTITY" ]]; then
        SIGN_IDENTITY=$(security find-identity -v -p codesigning "$TEMP_KEYCHAIN" | grep "Apple Development" | head -n 1 | awk -F'"' '{print $2}')
    fi

    if [[ -n "$SIGN_IDENTITY" ]]; then
        echo "  ✅ Using certificate: $SIGN_IDENTITY"
    else
        echo "  ❌ Error: Could not find signing identity in certificate"
        security delete-keychain "$TEMP_KEYCHAIN"
        exit 1
    fi

# Local development mode: Try to find an Apple Development certificate
else
    echo "  🔧 Local Development Mode: Looking for installed certificates..."

    # Try Apple Development certificate first
    DEV_CERT=$(security find-identity -v -p codesigning | grep "Apple Development" | head -n 1 | awk -F'"' '{print $2}')

    if [[ -n "$DEV_CERT" ]]; then
        echo "  ✅ Using certificate: $DEV_CERT"
        SIGN_IDENTITY="$DEV_CERT"
    else
        # Try Developer ID Application as fallback
        DEV_ID_CERT=$(security find-identity -v -p codesigning | grep "Developer ID Application" | head -n 1 | awk -F'"' '{print $2}')

        if [[ -n "$DEV_ID_CERT" ]]; then
            echo "  ✅ Using certificate: $DEV_ID_CERT"
            SIGN_IDENTITY="$DEV_ID_CERT"
        else
            echo "  ⚠️  No Apple Development or Developer ID certificate found"
            echo "  ⚠️  Using ad-hoc signing (CloudKit may not work)"
            SIGN_IDENTITY="-"
        fi
    fi
fi

echo ""

# Sign x64 binary
codesign --force --sign "$SIGN_IDENTITY" --entitlements "$ENTITLEMENTS_PATH" "$X64_PATH"
echo "  ✅ Signed x64 binary"

# Sign arm64 binary
codesign --force --sign "$SIGN_IDENTITY" --entitlements "$ENTITLEMENTS_PATH" "$ARM64_PATH"
echo "  ✅ Signed arm64 binary"
echo ""

# Verify code signatures
echo "🔍 Verifying code signatures..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "x64 Binary Signature:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
codesign -dvvv "$X64_PATH" 2>&1 | grep -E "Authority|Identifier|TeamIdentifier|Format|Signature size"
echo ""
echo "x64 Entitlements:"
codesign -d --entitlements :- --xml "$X64_PATH" 2>/dev/null | grep -E "com.apple.developer.icloud-services|com.apple.developer.ubiquity-container-identifiers|iCloud.so.onekey.wallet|keychain-access-groups" | sed 's/^/  /'
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "arm64 Binary Signature:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
codesign -dvvv "$ARM64_PATH" 2>&1 | grep -E "Authority|Identifier|TeamIdentifier|Format|Signature size"
echo ""
echo "arm64 Entitlements:"
codesign -d --entitlements :- --xml "$ARM64_PATH" 2>/dev/null | grep -E "com.apple.developer.icloud-services|com.apple.developer.ubiquity-container-identifiers|iCloud.so.onekey.wallet|keychain-access-groups" | sed 's/^/  /'
echo ""

# Verify architectures
echo "✅ Verifying architectures..."
echo "  x64: $(lipo -info "$X64_PATH")"
echo "  arm64:  $(lipo -info "$ARM64_PATH")"

# Make them executable
chmod +x "$X64_PATH"
chmod +x "$ARM64_PATH"

# Verify the build
if [[ ! -f "$X64_PATH" ]] || [[ ! -f "$ARM64_PATH" ]]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ MacApiBridge built successfully:"
echo "  x64: $X64_PATH"
echo "  arm64:  $ARM64_PATH"
echo ""

# Determine which binary to test based on current architecture
CURRENT_ARCH=$(uname -m)
if [[ "$CURRENT_ARCH" == "x86_64" ]]; then
    # TEST_BINARY="$X64_PATH"
    TEST_BINARY=""

    TEST_ARCH_NAME="x64 (Intel)"
elif [[ "$CURRENT_ARCH" == "arm64" ]]; then
    # TEST_BINARY="$ARM64_PATH"
    TEST_BINARY=""
    
    TEST_ARCH_NAME="arm64 (Apple Silicon)"
else
    echo "⚠️  Unknown architecture: $CURRENT_ARCH, skipping tests"
    TEST_BINARY=""
fi

if [[ -n "$TEST_BINARY" ]]; then
    echo "Testing $TEST_ARCH_NAME binary..."
    echo ""

    # Test CloudKit functionality
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Testing CloudKit functionality..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    CLOUDKIT_RESULT=$("$TEST_BINARY" cloudkit.isAvailable 2>&1)
    if [[ $? -eq 0 ]]; then
        echo "✅ CloudKit test passed"
        echo "   Result: $CLOUDKIT_RESULT"
    else
        echo "⚠️  CloudKit test failed (this is expected if not signed in to iCloud)"
        echo "   Result: $CLOUDKIT_RESULT"
    fi
    echo ""

    # Test Keychain functionality
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Testing Keychain functionality..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Test iCloud sync check
    echo "1. Testing iCloud Keychain sync status..."
    SYNC_RESULT=$("$TEST_BINARY" keychain.isICloudSyncEnabled 2>&1)
    if [[ $? -eq 0 ]]; then
        echo "   ✅ iCloud sync check passed"
        echo "   Result: $SYNC_RESULT"
    else
        echo "   ⚠️  iCloud sync check failed (may be expected if not signed in)"
        echo "   Result: $SYNC_RESULT"
    fi
    echo ""

    # Test set/get/remove
    echo "2. Testing set/get/remove operations..."

    # Set test item
    SET_RESULT=$("$TEST_BINARY" keychain.setItem '{"key":"__test__","value":"test_value","enableSync":false}' 2>&1)
    if [[ $? -eq 0 ]] && echo "$SET_RESULT" | grep -q '"success"'; then
        echo "   ✅ Set test item succeeded"

        # Get test item
        GET_RESULT=$("$TEST_BINARY" keychain.getItem '{"key":"__test__"}' 2>&1)
        if [[ $? -eq 0 ]] && echo "$GET_RESULT" | grep -q '"value"'; then
            echo "   ✅ Get test item succeeded"

            # Remove test item
            REMOVE_RESULT=$("$TEST_BINARY" keychain.removeItem '{"key":"__test__"}' 2>&1)
            if [[ $? -eq 0 ]] && echo "$REMOVE_RESULT" | grep -q '"success"'; then
                echo "   ✅ Remove test item succeeded"
            else
                echo "   ❌ Remove test item failed"
            fi
        else
            echo "   ❌ Get test item failed"
        fi
    else
        echo "   ❌ Set test item failed"
    fi
    echo ""
fi

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Build Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ MacApiBridge architecture-specific binaries are ready:"
echo "  x64: $X64_PATH"
echo "  arm64:  $ARM64_PATH"
echo ""
echo "Architecture:"
echo "  • MacApiBridge uses Core implementation from Mobile"
echo "  • CloudKitModuleCore.swift - Shared CloudKit logic"
echo "  • KeychainModuleCore.swift - Shared Keychain logic"
echo "  • Single source of truth for both Desktop and Mobile"
echo ""
echo "Supported Commands:"
echo ""
echo "  CloudKit:"
echo "    • cloudkit.isAvailable"
echo "    • cloudkit.saveRecord <json>"
echo "    • cloudkit.fetchRecord <json>"
echo "    • cloudkit.deleteRecord <json>"
echo "    • cloudkit.recordExists <json>"
echo "    • cloudkit.queryRecords <json>"
echo ""
echo "  Keychain:"
echo "    • keychain.setItem <json>"
echo "    • keychain.getItem <json>"
echo "    • keychain.removeItem <json>"
echo "    • keychain.hasItem <json>"
echo "    • keychain.isICloudSyncEnabled"
echo ""
echo "Integration:"
echo ""
echo "1. Desktop API classes already configured:"
echo "   - packages/kit-bg/src/desktopApis/DesktopApiCloudKit.ts"
echo "   - packages/kit-bg/src/desktopApis/DesktopApiKeychain.ts"
echo ""
echo "2. Production builds:"
echo "   - Architecture-specific binaries bundled via electron-builder config"
echo "   - Code signing handled by entitlements"
echo "   - Runtime detects and uses correct architecture binary"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Cleanup temporary keychain if it was created
if [[ -n "$TEMP_KEYCHAIN" ]]; then
    echo "🧹 Cleaning up temporary keychain..."
    security delete-keychain "$TEMP_KEYCHAIN" 2>/dev/null || true
    echo "✅ Temporary keychain cleaned up"
    echo ""
fi
