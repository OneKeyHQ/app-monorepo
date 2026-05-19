#!/bin/bash
# ============================================================
# Android emulator boot smoke
#
# Installs a freshly-built APK on the attached emulator, launches it,
# then:
#   - fails if logcat contains a JS crash signature within the timeout
#   - fails if the OneKey native-logger file cannot be pulled or is empty
#   - fails if the native-logger file contains no JS-side markers (proof
#     the JS bundle actually executed past the prologue)
#   - otherwise prints the pulled log location and exits 0.
#
# The OneKey native logger (@onekeyfe/react-native-native-logger) writes
# to context.cacheDir/logs/app-latest.log → on emulator that is
# /data/user/0/so.onekey.app.wallet/cache/logs/app-latest.log.
# Because release APKs are not debuggable, the script uses `adb root`
# first (works on emulators) and falls back to `run-as` then /sdcard.
#
# Usage:
#   ./development/scripts/android-emulator-boot-smoke.sh [apk-path]
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MOBILE_DIR="$REPO_ROOT/apps/mobile"
PACKAGE_NAME="so.onekey.app.wallet"
APK="${1:-$MOBILE_DIR/android/app/build/outputs/apk/prod/release/app-prod-release.apk}"
STARTUP_TIMEOUT_S="${STARTUP_TIMEOUT_S:-45}"
OUT_DIR="${OUT_DIR:-$MOBILE_DIR/out-dir-smoke-$(date +%Y%m%d-%H%M%S)}"
NATIVE_LOG_REMOTE_DIR="/data/user/0/$PACKAGE_NAME/cache/logs"
NATIVE_LOG_LIVE_FILE="$NATIVE_LOG_REMOTE_DIR/app-latest.log"
LOGCAT_FILE="$OUT_DIR/logcat.txt"
NATIVE_LOG_LOCAL_DIR="$OUT_DIR/native-logs"

mkdir -p "$OUT_DIR" "$NATIVE_LOG_LOCAL_DIR"

DEVICE_ID=$(adb devices -l | grep -v "List of devices" | grep "device " | head -1 | awk '{print $1}')
if [ -z "$DEVICE_ID" ]; then
  echo "❌ No emulator/device attached."
  exit 1
fi
echo "device: $DEVICE_ID"
echo "apk:    $APK"
echo "out:    $OUT_DIR"

if [ ! -f "$APK" ]; then
  echo "❌ APK not found at $APK"
  exit 1
fi

# Try to become root on the emulator up-front so we can read the app's
# private cache dir later. On physical devices this silently fails; that's
# fine — we'll fall back to run-as / /sdcard.
adb -s "$DEVICE_ID" root >/dev/null 2>&1 || true
adb -s "$DEVICE_ID" wait-for-device >/dev/null 2>&1 || true

adb -s "$DEVICE_ID" uninstall "$PACKAGE_NAME" >/dev/null 2>&1 || true
adb -s "$DEVICE_ID" install -r "$APK"

adb -s "$DEVICE_ID" logcat -c || true

# Launch via monkey so we don't need to hard-code the MainActivity class.
adb -s "$DEVICE_ID" shell monkey -p "$PACKAGE_NAME" -c android.intent.category.LAUNCHER 1 >/dev/null

# Stream logcat to file in the background for the timeout window.
adb -s "$DEVICE_ID" logcat -v time > "$LOGCAT_FILE" &
LOGCAT_PID=$!

# Ensure logcat gets killed no matter how we exit.
trap 'kill "$LOGCAT_PID" 2>/dev/null || true' EXIT

SECONDS_ELAPSED=0
DISPLAYED=0
while [ "$SECONDS_ELAPSED" -lt "$STARTUP_TIMEOUT_S" ]; do
  sleep 3
  SECONDS_ELAPSED=$((SECONDS_ELAPSED + 3))

  if grep -qE "Requiring unknown module|SegmentLoadError|JavascriptException|AndroidRuntime.*FATAL EXCEPTION" "$LOGCAT_FILE"; then
    echo "❌ JS / native crash detected in logcat at +${SECONDS_ELAPSED}s"
    grep -E "Requiring unknown module|SegmentLoadError|JavascriptException|AndroidRuntime.*FATAL EXCEPTION" "$LOGCAT_FILE" | head -5
    exit 2
  fi

  if grep -q "Displayed $PACKAGE_NAME" "$LOGCAT_FILE"; then
    DISPLAYED=1
    break
  fi
done

if [ "$DISPLAYED" -ne 1 ]; then
  echo "⚠️  App did not reach 'Displayed' within ${STARTUP_TIMEOUT_S}s — continuing to pull log anyway"
fi

# Give JS a little more time to flush the native logger buffer (the JS side
# schedules NativeLogger.flushPendingRepeat() asynchronously).
sleep 3

# Pull the native-logger file using whichever method works.
LOCAL_LIVE="$NATIVE_LOG_LOCAL_DIR/app-latest.log"
PULL_METHOD=""

# Method 1: adb root + direct cat (emulators with userdebug)
if [ -z "$PULL_METHOD" ]; then
  if adb -s "$DEVICE_ID" shell "id -u" 2>/dev/null | grep -q "^0$"; then
    if adb -s "$DEVICE_ID" exec-out "cat $NATIVE_LOG_LIVE_FILE" > "$LOCAL_LIVE" 2>/dev/null; then
      if [ -s "$LOCAL_LIVE" ]; then
        PULL_METHOD="root+cat"
      fi
    fi
  fi
fi

# Method 2: run-as (only works on debuggable APKs — unlikely for release)
if [ -z "$PULL_METHOD" ]; then
  if adb -s "$DEVICE_ID" shell "run-as $PACKAGE_NAME id" >/dev/null 2>&1; then
    if adb -s "$DEVICE_ID" exec-out "run-as $PACKAGE_NAME cat cache/logs/app-latest.log" > "$LOCAL_LIVE" 2>/dev/null; then
      if [ -s "$LOCAL_LIVE" ]; then
        PULL_METHOD="run-as+cat"
      fi
    fi
  fi
fi

# Method 3: /sdcard fallback (unlikely, but keep as last resort)
if [ -z "$PULL_METHOD" ]; then
  if adb -s "$DEVICE_ID" pull "/sdcard/Android/data/$PACKAGE_NAME/files/logs/app-latest.log" "$LOCAL_LIVE" 2>/dev/null; then
    if [ -s "$LOCAL_LIVE" ]; then
      PULL_METHOD="sdcard"
    fi
  fi
fi

if [ -z "$PULL_METHOD" ] || [ ! -s "$LOCAL_LIVE" ]; then
  echo "❌ Could not pull non-empty native-logger file via any of {root+cat, run-as, /sdcard}"
  echo "   logcat: $LOGCAT_FILE"
  echo "   Remote tried: $NATIVE_LOG_LIVE_FILE"
  exit 3
fi

echo "native-log pulled via $PULL_METHOD → $LOCAL_LIVE"
echo "native-log size: $(wc -c < "$LOCAL_LIVE") bytes"

# Concrete proof the JS side ran.
if ! grep -qE "SplashProvider|StartupTiming|GlobalJotaiReady|StartupProfile\." "$LOCAL_LIVE"; then
  echo "❌ native-logger file has no JS-side markers — JS did not reach normal startup."
  echo "   first 20 lines:"
  head -20 "$LOCAL_LIVE" | sed 's/^/     /'
  echo "   logcat saved to: $LOGCAT_FILE"
  exit 4
fi

echo "✅ APK booted past JS prologue"
echo "   logcat:     $LOGCAT_FILE"
echo "   native-log: $LOCAL_LIVE"
exit 0
