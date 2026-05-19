#!/usr/bin/env bash
# Inject frida-gadget into a Debug-signed .app so Frida can attach on a
# non-jailbroken iOS device. The output is a new .app at the same path with
# the dylib embedded into Frameworks/, the main binary patched to load it,
# and ad-hoc re-signed.
#
# Requirements:
#   - macOS with Xcode CLT (codesign, otool, install_name_tool, lipo)
#   - One of: insert_dylib (https://github.com/Tyilo/insert_dylib) OR optool
#   - Internet access (first run downloads FridaGadget.dylib)
#
# Usage:
#   ./inject-gadget-ios.sh /path/to/OneKey.app
#   ./inject-gadget-ios.sh /path/to/OneKey.app --arch arm64
#   ./inject-gadget-ios.sh /path/to/OneKey.app --version 16.7.19

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="${SCRIPT_DIR}/lib"

APP_PATH=""
ARCH=""
GADGET_VERSION="16.7.19"

usage() {
  cat <<EOF
Inject frida-gadget into an iOS .app.

Usage:
  $(basename "$0") <App.app> [--arch arm64|arm64e|x86_64] [--version 16.x.y]

  --arch     architecture of the embedded dylib (default: matches main binary)
  --version  frida-gadget release to fetch (default: ${GADGET_VERSION})
  -h, --help show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --arch) ARCH="$2"; shift 2 ;;
    --version) GADGET_VERSION="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *)
      if [[ -z "$APP_PATH" ]]; then APP_PATH="$1"; shift
      else echo "unexpected arg: $1" >&2; usage; exit 1
      fi ;;
  esac
done

if [[ -z "$APP_PATH" ]]; then
  usage >&2; exit 1
fi
if [[ ! -d "$APP_PATH" || "$APP_PATH" != *.app ]]; then
  echo "not a .app bundle: $APP_PATH" >&2; exit 1
fi

# Resolve main binary
APP_NAME="$(basename "$APP_PATH" .app)"
MAIN_BIN="$APP_PATH/$APP_NAME"
if [[ ! -x "$MAIN_BIN" ]]; then
  # fall back to CFBundleExecutable from Info.plist
  PLB="$APP_PATH/Info.plist"
  if [[ -f "$PLB" ]]; then
    EXEC_NAME="$(plutil -extract CFBundleExecutable raw -o - "$PLB" 2>/dev/null || true)"
    if [[ -n "$EXEC_NAME" && -x "$APP_PATH/$EXEC_NAME" ]]; then
      MAIN_BIN="$APP_PATH/$EXEC_NAME"
    fi
  fi
fi
if [[ ! -x "$MAIN_BIN" ]]; then
  echo "could not locate main binary inside $APP_PATH" >&2; exit 1
fi

# Detect arch if not specified
if [[ -z "$ARCH" ]]; then
  # Pick the first arch lipo reports; if main is fat, prefer arm64
  ARCHES="$(lipo -archs "$MAIN_BIN" 2>/dev/null || true)"
  if [[ " $ARCHES " == *" arm64 "* ]]; then ARCH="arm64"
  elif [[ " $ARCHES " == *" arm64e "* ]]; then ARCH="arm64e"
  else ARCH="$(echo "$ARCHES" | awk '{print $1}')"
  fi
  if [[ -z "$ARCH" ]]; then
    echo "could not detect architecture for $MAIN_BIN" >&2; exit 1
  fi
fi

echo "==> app:      $APP_PATH"
echo "==> binary:   $MAIN_BIN"
echo "==> arch:     $ARCH"
echo "==> gadget:   FridaGadget-$GADGET_VERSION ($ARCH)"

# Download gadget if not cached
CACHE_DIR="${HOME}/.onekey-debug/cache/frida-gadget/${GADGET_VERSION}"
GADGET_FILE="${CACHE_DIR}/FridaGadget-${ARCH}.dylib"
mkdir -p "$CACHE_DIR"

if [[ ! -f "$GADGET_FILE" ]]; then
  bash "${LIB_DIR}/download-gadget.sh" "$GADGET_VERSION" "$ARCH" "$GADGET_FILE"
fi

# Embed dylib in Frameworks/
FRAMEWORKS="$APP_PATH/Frameworks"
mkdir -p "$FRAMEWORKS"
DYLIB_NAME="FridaGadget.dylib"
DEST="$FRAMEWORKS/$DYLIB_NAME"
cp -f "$GADGET_FILE" "$DEST"

# Patch main binary load command (prefer insert_dylib, fallback to optool)
LOAD_CMD="@executable_path/Frameworks/$DYLIB_NAME"
if command -v insert_dylib >/dev/null 2>&1; then
  echo "==> using insert_dylib"
  # --inplace, no codesign yet — we re-sign at the end
  insert_dylib --inplace --all-yes "$LOAD_CMD" "$MAIN_BIN" >/dev/null
elif command -v optool >/dev/null 2>&1; then
  echo "==> using optool"
  optool install -c load -p "$LOAD_CMD" -t "$MAIN_BIN" >/dev/null
else
  echo "neither insert_dylib nor optool found; install one and retry:" >&2
  echo "  brew install --HEAD insert-dylib" >&2
  echo "  brew install --HEAD optool" >&2
  exit 1
fi

# Sanity check: confirm the load command is present
if ! otool -L "$MAIN_BIN" | grep -q "$DYLIB_NAME"; then
  echo "load command not present after patch — aborting" >&2
  exit 1
fi

# Re-sign: ad-hoc signature for the dylib + the whole .app
echo "==> codesign Frameworks/$DYLIB_NAME"
codesign --force --sign - "$DEST"

# If the app already has an entitlements blob, preserve it during re-sign
ENTITLEMENTS_TMP="$(mktemp)"
if codesign -d --entitlements :- "$APP_PATH" > "$ENTITLEMENTS_TMP" 2>/dev/null; then
  if [[ -s "$ENTITLEMENTS_TMP" ]]; then
    echo "==> codesign --force --sign - (preserving entitlements)"
    codesign --force --sign - --entitlements "$ENTITLEMENTS_TMP" "$APP_PATH"
  else
    echo "==> codesign --force --sign - (no entitlements)"
    codesign --force --sign - "$APP_PATH"
  fi
else
  codesign --force --sign - "$APP_PATH"
fi
rm -f "$ENTITLEMENTS_TMP"

# Verify
codesign --verify --deep --strict --verbose=1 "$APP_PATH"

echo ""
echo "OK  Frida gadget injected into $APP_PATH"
echo ""
echo "Next steps:"
echo "  xcrun devicectl device install app --device <UDID> $APP_PATH"
echo "  # then on the device, launch OneKey"
echo "  frida -U -n OneKey   # should attach successfully"
