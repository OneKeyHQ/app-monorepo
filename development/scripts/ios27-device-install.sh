#!/bin/bash
# ============================================================
# Install a local Debug build on an iOS 27 device
#
# Xcode 27 links OneKeyWallet against the iOS 27 SDK. On iOS 27, UIKit then
# refuses to launch an app that has not adopted the UIScene lifecycle: the
# process stops with EXC_BREAKPOINT in
# _UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption, and
# dev-shell reports "ios physical-device app exited during startup".
#
# Until the app adopts UIScene, this script takes the built .app and copies
# it. It rewrites the SDK version in the main executable's LC_BUILD_VERSION
# (26.0 by default), so UIKit treats the build as linked against an older
# SDK and skips that check. It then re-signs the copy with the original
# identity and entitlements, installs it and launches it against Metro. The
# original build output is not modified.
#
# Development builds only. Do not use it for release or TestFlight builds.
#
# Usage:
#   ./development/scripts/ios27-device-install.sh --device <UDID> [options]
#
# Options:
#   --device <UDID>      Target device, see `xcrun devicectl list devices` (required)
#   --app <path>         Built .app (default: newest DerivedData
#                        OneKeyWallet-*/Build/Products/Debug-iphoneos/OneKeyWallet.app)
#   --sdk <version>      SDK version to record (default: 26.0)
#   --metro-port <port>  RCT_METRO_PORT passed to the app (default: 8081)
#   --no-launch          Install without launching
#
# Typical flow:
#   1. Build for the device once. On iOS 27 it installs, then exits at startup:
#        yarn workspace @onekeyhq/mobile dev-shell --platform ios --device <UDID>
#   2. Start Metro on the port the app will use:
#        ONEKEY_DEV_BG_HMR=true ONEKEY_DEV_VENDOR=true \
#          yarn workspace @onekeyhq/mobile native-bundle --port 8081 --host 0.0.0.0
#      If Metro exits with "[devVendor] Build configuration changed for ios",
#      run `yarn workspace @onekeyhq/mobile dev-vendor:build --platform ios` first.
#   3. Patch, install and launch:
#        ./development/scripts/ios27-device-install.sh --device <UDID>
#
# Prerequisites:
#   - Xcode command line tools (vtool, codesign, devicectl)
#   - The signing identity of the original build in the login keychain
#   - The device paired, unlocked and on the same network as Metro
# ============================================================

set -euo pipefail

DEVICE=""
SOURCE_APP=""
TARGET_SDK="26.0"
METRO_PORT="8081"
LAUNCH=true

timestamp() {
  echo "⏱  [$(date '+%H:%M:%S')]"
}

fail() {
  echo "❌ $*" >&2
  exit 1
}

usage() {
  sed -n '/^# Usage:/,/^# Typical flow:/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'
}

require_value() {
  [ "$2" -ge 2 ] || { usage >&2; fail "$1 needs a value"; }
}

# Runs a command quietly and prints its output only when it fails.
run_quiet() {
  local output
  if ! output=$("$@" 2>&1); then
    echo "$output" >&2
    fail "Command failed: $1"
  fi
}

while [ $# -gt 0 ]; do
  case "$1" in
    --device)
      require_value "$1" $#
      DEVICE="$2"
      shift 2
      ;;
    --app)
      require_value "$1" $#
      SOURCE_APP="$2"
      shift 2
      ;;
    --sdk)
      require_value "$1" $#
      TARGET_SDK="$2"
      shift 2
      ;;
    --metro-port)
      require_value "$1" $#
      METRO_PORT="$2"
      shift 2
      ;;
    --no-launch)
      LAUNCH=false
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      fail "Unknown argument: $1"
      ;;
  esac
done

[ -n "$DEVICE" ] || { usage >&2; fail "--device is required"; }
[[ "$TARGET_SDK" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ ]] || fail "Invalid --sdk: $TARGET_SDK"
[[ "$METRO_PORT" =~ ^[0-9]+$ ]] || fail "Invalid --metro-port: $METRO_PORT"

if [ -z "$SOURCE_APP" ]; then
  # Newest device Debug build from any OneKeyWallet DerivedData folder.
  for CANDIDATE in "$HOME"/Library/Developer/Xcode/DerivedData/OneKeyWallet-*/Build/Products/Debug-iphoneos/OneKeyWallet.app; do
    [ -d "$CANDIDATE" ] || continue
    if [ -z "$SOURCE_APP" ] || [ "$CANDIDATE" -nt "$SOURCE_APP" ]; then
      SOURCE_APP="$CANDIDATE"
    fi
  done
fi
[ -n "$SOURCE_APP" ] && [ -d "$SOURCE_APP" ] || fail "No device Debug build found. Build for the device first, or pass --app."
SOURCE_APP="${SOURCE_APP%/}"

WORK_DIR=$(mktemp -d "${TMPDIR:-/tmp}/onekey-ios27-install.XXXXXX")
trap 'rm -rf "$WORK_DIR"' EXIT
APP="$WORK_DIR/$(basename "$SOURCE_APP")"

echo "$(timestamp) 📦 Copying $SOURCE_APP"
ditto "$SOURCE_APP" "$APP"

EXECUTABLE_NAME=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleExecutable' "$APP/Info.plist")
BUNDLE_ID=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Info.plist")
EXECUTABLE="$APP/$EXECUTABLE_NAME"

BUILD_INFO=$(xcrun vtool -show-build "$EXECUTABLE")
PLATFORM=$(awk '$1 == "platform" { print $2; exit }' <<<"$BUILD_INFO")
MINOS=$(awk '$1 == "minos" { print $2; exit }' <<<"$BUILD_INFO")
CURRENT_SDK=$(awk '$1 == "sdk" { print $2; exit }' <<<"$BUILD_INFO")
[ "$PLATFORM" = "IOS" ] || fail "Expected an iOS device build, got platform '$PLATFORM'."
[ -n "$MINOS" ] && [ -n "$CURRENT_SDK" ] || fail "Could not read LC_BUILD_VERSION from $EXECUTABLE"
echo "   $BUNDLE_ID: minos $MINOS, sdk $CURRENT_SDK"

if [ "${CURRENT_SDK%%.*}" -lt 27 ]; then
  echo "$(timestamp) ✅ SDK $CURRENT_SDK is older than 27; installing the build unchanged."
else
  # Keep the recorded tool versions; vtool drops them unless they are passed again.
  TOOL_ARGS=()
  while read -r TOOL VERSION; do
    [ -n "$TOOL" ] && TOOL_ARGS+=(-tool "$TOOL" "$VERSION")
  done < <(awk '$1 == "tool" { tool = tolower($2) } $1 == "version" && tool != "" { print tool, $2; tool = "" }' <<<"$BUILD_INFO")

  echo "$(timestamp) 🩹 Setting LC_BUILD_VERSION sdk $CURRENT_SDK -> $TARGET_SDK"
  # vtool warns that the signature is now invalid; the app is re-signed below.
  run_quiet xcrun vtool -set-build-version ios "$MINOS" "$TARGET_SDK" ${TOOL_ARGS[@]+"${TOOL_ARGS[@]}"} \
    -replace -output "$WORK_DIR/executable" "$EXECUTABLE"
  mv "$WORK_DIR/executable" "$EXECUTABLE"
  chmod +x "$EXECUTABLE"

  # Capture before parsing: awk exits on the first match, and under pipefail
  # a writer that gets SIGPIPE would abort the script.
  SIGNATURE_INFO=$(codesign -dvv "$SOURCE_APP" 2>&1 || true)
  AUTHORITY=$(awk -F= '$1 == "Authority" { print $2; exit }' <<<"$SIGNATURE_INFO")
  [ -n "$AUTHORITY" ] || fail "$SOURCE_APP is not signed with a certificate."
  IDENTITIES=$(security find-identity -v -p codesigning)
  IDENTITY=$(awk -v name="\"$AUTHORITY\"" 'index($0, name) { print $2; exit }' <<<"$IDENTITIES")
  [ -n "$IDENTITY" ] || fail "Signing identity \"$AUTHORITY\" is not in the keychain."

  codesign -d --entitlements - --xml "$SOURCE_APP" >"$WORK_DIR/entitlements.plist" 2>/dev/null
  plutil -lint -s "$WORK_DIR/entitlements.plist" || fail "Could not read the entitlements of $SOURCE_APP"

  echo "$(timestamp) 🔏 Re-signing with \"$AUTHORITY\""
  run_quiet codesign --force --sign "$IDENTITY" --entitlements "$WORK_DIR/entitlements.plist" \
    --generate-entitlement-der "$APP"
  run_quiet codesign --verify --deep --strict "$APP"
fi

echo "$(timestamp) 📲 Installing on $DEVICE"
xcrun devicectl device install app --device "$DEVICE" "$APP" >/dev/null

if [ "$LAUNCH" = false ]; then
  echo "$(timestamp) ✅ Installed $BUNDLE_ID"
  exit 0
fi

METRO_STATUS=$(curl -s -m 3 "http://127.0.0.1:$METRO_PORT/status" || true)
if [[ "$METRO_STATUS" != *"packager-status:running"* ]]; then
  echo "⚠️  Metro is not running on port $METRO_PORT; the app will not load its JS bundle until it is."
fi

echo "$(timestamp) 🚀 Launching $BUNDLE_ID (RCT_METRO_PORT=$METRO_PORT)"
xcrun devicectl device process launch --device "$DEVICE" --terminate-existing \
  --environment-variables "{\"RCT_METRO_PORT\":\"$METRO_PORT\"}" "$BUNDLE_ID" >/dev/null ||
  fail "Launch failed. Unlock the device and try again, or open the app from the home screen."
echo "$(timestamp) ✅ Done"
