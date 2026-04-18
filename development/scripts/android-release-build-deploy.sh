#!/bin/bash
# ============================================================
# Android Release Build & Deploy (Split Bundle + HBC + Emulator)
#
# Usage:
#   ./development/scripts/android-release-build-deploy.sh [command]
#
# Commands:
#   build    - Build HBC bundles only (union build + hermesc)
#   deploy   - Deploy built bundles to running emulator/device
#   all      - Build + Deploy (default)
#   gradle   - Build native APK with Gradle (run once or after native changes)
#
# Prerequisites:
#   - A running Android emulator or connected device
#   - For 'deploy' and 'all': existing APK from previous Gradle build
#   - For 'gradle': Android SDK and Gradle configured
# ============================================================

set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MOBILE_DIR="$REPO_ROOT/apps/mobile"
PACKAGE_NAME="so.onekey.app.wallet"
SCRIPT_START_TIME=$(date +%s)

timestamp() {
  echo "⏱  [$(date '+%H:%M:%S')]"
}

# --- Detect connected device/emulator ---
detect_device() {
  local DEVICE_ID
  DEVICE_ID=$(adb devices -l | grep -v "List of devices" | grep "device " | head -1 | awk '{print $1}')

  if [ -z "$DEVICE_ID" ]; then
    echo "❌ No connected Android device or emulator found. Please start one first."
    exit 1
  fi

  echo "$DEVICE_ID"
}

# --- Build HBC bundles ---
cmd_build() {
  echo "$(timestamp) 📦 Building HBC bundles (union build + hermesc)..."
  cd "$MOBILE_DIR"

  # Clear stale outputs so the integrity check can't inspect inconsistent
  # data from a previous interrupted build.
  rm -rf out-dir-bundle out-dir-bundle-zip \
         dist/segments dist/segments-background \
         dist/segment-manifest.json dist/segment-manifest-background.json \
         dist/module-id-map.json \
         dist/module-id-map-main.json dist/module-id-map-background.json

  # Guards must be ON by default. Setting either of these to 1 in CI is a BUG.
  unset ONEKEY_SKIP_SPLIT_INTEGRITY_CHECK
  unset ONEKEY_ALLOW_INCOMPLETE_BUNDLE

  SENTRY_DISABLE_AUTO_UPLOAD=true \
  ENABLE_NATIVE_BACKGROUND_THREAD=true \
  UNION_BUILD=true \
  SPLIT_BUNDLE=1 \
  SPLIT_BUNDLE_SEGMENTS=true \
  node --max-old-space-size=8192 build-bundle.js --platform android

  echo ""
  echo "$(timestamp) ✅ Build complete:"
  ls -lh out-dir-bundle/android/dist/common.jsbundle.hbc \
         out-dir-bundle/android/dist/main.jsbundle.hbc \
         out-dir-bundle/android/dist/background.bundle 2>/dev/null
  echo ""
  ls out-dir-bundle/android/dist/segments/*.seg.hbc 2>/dev/null | wc -l | xargs -I{} echo "   segments: {} files"
  ls out-dir-bundle/android/dist/segments-background/*.seg.hbc 2>/dev/null | wc -l | xargs -I{} echo "   segments-background: {} files"
}

# --- Deploy to device/emulator ---
cmd_deploy() {
  local DEVICE_ID
  DEVICE_ID=$(detect_device)
  echo "$(timestamp) 📱 Deploying to device: $DEVICE_ID"

  cd "$MOBILE_DIR"
  local APK="android/app/build/outputs/apk/prod/release/app-prod-release.apk"

  if [ ! -f "$APK" ]; then
    echo "❌ No APK found at $APK"
    echo "   Run '$0 gradle' first to build the native app."
    exit 1
  fi

  if [ ! -f "out-dir-bundle/android/dist/common.jsbundle.hbc" ]; then
    echo "❌ No HBC bundles found. Run '$0 build' first."
    exit 1
  fi

  # Check if app is installed
  local APP_INSTALLED
  APP_INSTALLED=$(adb -s "$DEVICE_ID" shell pm list packages | grep "$PACKAGE_NAME" || true)

  if [ -z "$APP_INSTALLED" ]; then
    echo "   App not installed, installing APK..."
    adb -s "$DEVICE_ID" install -r "$APK"
  else
    echo "   App is installed, trying to push bundles to app data..."
    
    # Test if run-as works (debuggable app)
    if ! adb -s "$DEVICE_ID" shell "run-as $PACKAGE_NAME pwd" > /dev/null 2>&1; then
      echo "   ⚠️  App is not debuggable (release build), re-installing APK..."
      echo "      (Bundles will be loaded from APK assets)"
      adb -s "$DEVICE_ID" install -r "$APK"
    else
      # Get app data path
      local APP_DATA_PATH="/data/data/$PACKAGE_NAME/files/bundle"
      
      # Create bundle directory if not exists
      adb -s "$DEVICE_ID" shell "run-as $PACKAGE_NAME mkdir -p $APP_DATA_PATH/segments"
      adb -s "$DEVICE_ID" shell "run-as $PACKAGE_NAME mkdir -p $APP_DATA_PATH/segments-background"
      
      # Push bundles to app data
      echo "   Copying bundles to app data..."
      adb -s "$DEVICE_ID" push out-dir-bundle/android/dist/common.jsbundle.hbc "/data/local/tmp/common.jsbundle"
      adb -s "$DEVICE_ID" push out-dir-bundle/android/dist/main.jsbundle.hbc "/data/local/tmp/main.jsbundle"
      adb -s "$DEVICE_ID" push out-dir-bundle/android/dist/background.bundle "/data/local/tmp/background.bundle"
      
      # Move files to app directory using run-as
      adb -s "$DEVICE_ID" shell "run-as $PACKAGE_NAME cp /data/local/tmp/common.jsbundle files/bundle/common.jsbundle"
      adb -s "$DEVICE_ID" shell "run-as $PACKAGE_NAME cp /data/local/tmp/main.jsbundle files/bundle/main.jsbundle"
      adb -s "$DEVICE_ID" shell "run-as $PACKAGE_NAME cp /data/local/tmp/background.bundle files/bundle/background.bundle"
      
      # Clean up temp files
      adb -s "$DEVICE_ID" shell "rm -f /data/local/tmp/common.jsbundle /data/local/tmp/main.jsbundle /data/local/tmp/background.bundle"
      
      # Push segments
      echo "   Copying segments..."
      for seg in out-dir-bundle/android/dist/segments/*.seg.hbc; do
        if [ -f "$seg" ]; then
          local seg_name=$(basename "$seg")
          adb -s "$DEVICE_ID" push "$seg" "/data/local/tmp/$seg_name"
          adb -s "$DEVICE_ID" shell "run-as $PACKAGE_NAME cp /data/local/tmp/$seg_name files/bundle/segments/$seg_name"
          adb -s "$DEVICE_ID" shell "rm -f /data/local/tmp/$seg_name"
        fi
      done
      
      # Push background segments
      for seg in out-dir-bundle/android/dist/segments-background/*.seg.hbc; do
        if [ -f "$seg" ]; then
          local seg_name=$(basename "$seg")
          adb -s "$DEVICE_ID" push "$seg" "/data/local/tmp/$seg_name"
          adb -s "$DEVICE_ID" shell "run-as $PACKAGE_NAME cp /data/local/tmp/$seg_name files/bundle/segments-background/$seg_name"
          adb -s "$DEVICE_ID" shell "rm -f /data/local/tmp/$seg_name"
        fi
      done
      
      # Push assets
      echo "   Copying assets..."
      adb -s "$DEVICE_ID" push out-dir-bundle/android/dist/assets/ "/data/local/tmp/bundle_assets/"
      adb -s "$DEVICE_ID" shell "run-as $PACKAGE_NAME cp -r /data/local/tmp/bundle_assets/* files/bundle/"
      adb -s "$DEVICE_ID" shell "rm -rf /data/local/tmp/bundle_assets"

      # Push module-id-map.json (post-mortem helper)
      if [ -f out-dir-bundle/android/dist/module-id-map.json ]; then
        adb -s "$DEVICE_ID" push out-dir-bundle/android/dist/module-id-map.json "/data/local/tmp/module-id-map.json"
        adb -s "$DEVICE_ID" shell "run-as $PACKAGE_NAME cp /data/local/tmp/module-id-map.json files/bundle/module-id-map.json"
        adb -s "$DEVICE_ID" shell "rm -f /data/local/tmp/module-id-map.json"
      fi
    fi
  fi

  echo "   Stopping app if running..."
  adb -s "$DEVICE_ID" shell am force-stop "$PACKAGE_NAME" 2>/dev/null || true
  sleep 1

  echo "   Launching app..."
  adb -s "$DEVICE_ID" shell monkey -p "$PACKAGE_NAME" -c android.intent.category.LAUNCHER 1

  echo ""
  echo "$(timestamp) ✅ Deployed and launched on $DEVICE_ID"
}

# --- Build native APK with Gradle ---
cmd_gradle() {
  local DEVICE_ID
  DEVICE_ID=$(detect_device)
  echo "$(timestamp) 🔨 Building native APK for device: $DEVICE_ID"

  # Clean stale JS bundle outputs to avoid "Duplicate resources" asset merge errors
  # caused by previous interrupted builds leaving background.bundle in multiple
  # registered asset source directories.
  echo "$(timestamp) 🧹 Cleaning stale bundle outputs before build..."
  rm -rf \
    "$MOBILE_DIR/android/app/build/generated/assets/createBundleProdReleaseJsAndAssets" \
    "$MOBILE_DIR/android/app/build/generated/assets/createBundleProdReleaseJsAndAssets_SentryCollectModules_so.onekey.app.wallet@1.0.0+1_1" \
    "$MOBILE_DIR/android/app/build/generated/sourcemaps" \
    "$MOBILE_DIR/android/app/build/intermediates/assets" \
    "$MOBILE_DIR/android/app/build/intermediates/merged_assets" \
    "$MOBILE_DIR/android/app/src/main/assets/modules.json" \
    2>/dev/null || true

  cd "$MOBILE_DIR/android"

  SENTRY_DISABLE_AUTO_UPLOAD=true \
  ENABLE_NATIVE_BACKGROUND_THREAD=true \
  UNION_BUILD=true \
  SPLIT_BUNDLE=1 \
  SPLIT_BUNDLE_SEGMENTS=true \
  ./gradlew :app:assembleProdRelease \
    --no-daemon \
    -PmemoryMax=8192m

  echo ""
  echo "$(timestamp) ✅ Native build complete"
  ls -lh app/build/outputs/apk/prod/release/app-prod-release.apk
}

# --- Read logs ---
cmd_logs() {
  local DEVICE_ID
  DEVICE_ID=$(detect_device)

  local FILTER="${1:-StartupTiming|SplashProvider|GlobalJotaiReady|balance|LayoutDiag|JSError|ColdStartCache|ReactNativeJS}"

  echo "=== Showing logs (filter: $FILTER) ==="
  echo "Press Ctrl+C to stop"
  adb -s "$DEVICE_ID" logcat -v tag -s "ReactNativeJS:D" "System.err:E" | grep -E "$FILTER" || true
}

# --- Main ---
COMMAND="${1:-all}"

case "$COMMAND" in
  build)
    cmd_build
    ;;
  deploy)
    cmd_deploy
    ;;
  all)
    cmd_gradle
    cmd_build
    cmd_deploy
    ;;
  gradle)
    cmd_gradle
    ;;
  logs)
    shift
    cmd_logs "$@"
    ;;
  *)
    echo "Usage: $0 [build|deploy|all|gradle|logs]"
    exit 1
    ;;
esac

if [ "$COMMAND" != "logs" ]; then
  TOTAL_TIME=$(( $(date +%s) - SCRIPT_START_TIME ))
  echo ""
  echo "$(timestamp) Total time: $((TOTAL_TIME / 60))m $((TOTAL_TIME % 60))s"
fi
