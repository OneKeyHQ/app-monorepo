#!/bin/bash
# ============================================================
# iOS Release Build & Deploy (Split Bundle + HBC + Simulator)
#
# Usage:
#   ./development/scripts/ios-release-build-deploy.sh [command]
#
# Commands:
#   build    - Build HBC bundles only (union build + hermesc)
#   deploy   - Deploy built bundles to running simulator
#   all      - Build + Deploy (default)
#   xcode    - Build native .app with xcodebuild (run once or after native changes)
#
# Prerequisites:
#   - A booted iOS simulator
#   - For 'deploy' and 'all': existing .app from previous xcodebuild
#   - For 'xcode': Xcode and CocoaPods configured
# ============================================================

set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MOBILE_DIR="$REPO_ROOT/apps/mobile"
SCRIPT_START_TIME=$(date +%s)

timestamp() {
  echo "⏱  [$(date '+%H:%M:%S')]"
}

# --- Detect booted simulator ---
detect_simulator() {
  local SIM_ID
  SIM_ID=$(xcrun simctl list devices booted -j 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
for runtime, devices in data.get('devices', {}).items():
    for d in devices:
        if d.get('state') == 'Booted':
            print(d['udid'])
            sys.exit(0)
sys.exit(1)
" 2>/dev/null) || true

  if [ -z "$SIM_ID" ]; then
    echo "❌ No booted iOS simulator found. Please start one first."
    exit 1
  fi

  echo "$SIM_ID"
}

# --- Build HBC bundles ---
cmd_build() {
  echo "$(timestamp) 📦 Building HBC bundles (union build + hermesc)..."
  cd "$MOBILE_DIR"
  rm -rf out-dir-bundle out-dir-bundle-zip

  SENTRY_DISABLE_AUTO_UPLOAD=true \
  ENABLE_NATIVE_BACKGROUND_THREAD=true \
  UNION_BUILD=true \
  SPLIT_BUNDLE=1 \
  SPLIT_BUNDLE_SEGMENTS=true \
  node --max-old-space-size=8192 build-bundle.js --platform ios

  echo ""
  echo "$(timestamp) ✅ Build complete:"
  ls -lh out-dir-bundle/ios/dist/common.bundle \
         out-dir-bundle/ios/dist/main.jsbundle.hbc \
         out-dir-bundle/ios/dist/background.bundle 2>/dev/null
  echo ""
  ls out-dir-bundle/ios/dist/segments/*.seg.hbc 2>/dev/null | wc -l | xargs -I{} echo "   segments: {} files"
  ls out-dir-bundle/ios/dist/segments-background/*.seg.hbc 2>/dev/null | wc -l | xargs -I{} echo "   segments-background: {} files"
}

# --- Deploy to simulator ---
cmd_deploy() {
  local SIM_ID
  SIM_ID=$(detect_simulator)
  echo "$(timestamp) 📱 Deploying to simulator: $SIM_ID"

  cd "$MOBILE_DIR"
  local APP="ios/build/Build/Products/Release-iphonesimulator/OneKeyWallet.app"

  if [ ! -d "$APP" ]; then
    echo "❌ No .app found at $APP"
    echo "   Run '$0 xcode' first to build the native app."
    exit 1
  fi

  if [ ! -f "out-dir-bundle/ios/dist/common.bundle" ]; then
    echo "❌ No HBC bundles found. Run '$0 build' first."
    exit 1
  fi

  echo "   Copying bundles..."
  cp out-dir-bundle/ios/dist/common.bundle "$APP/common.bundle"
  cp out-dir-bundle/ios/dist/main.jsbundle.hbc "$APP/main.jsbundle"
  cp out-dir-bundle/ios/dist/background.bundle "$APP/background.bundle"
  rsync -a --delete out-dir-bundle/ios/dist/segments/ "$APP/segments/"
  rsync -a --delete out-dir-bundle/ios/dist/segments-background/ "$APP/segments-background/"
  rsync -a out-dir-bundle/ios/dist/assets/ "$APP/"
  if [ -f out-dir-bundle/ios/dist/module-id-map.json ]; then
    cp out-dir-bundle/ios/dist/module-id-map.json "$APP/module-id-map.json"
  fi

  echo "   Re-signing..."
  codesign --force --sign - --timestamp=none \
    --preserve-metadata=identifier,entitlements \
    "$APP/Frameworks/GPChannelSDKCore.framework" 2>/dev/null || true
  codesign --force --sign - --timestamp=none \
    --preserve-metadata=identifier,entitlements \
    "$APP"

  echo "   Installing (preserving app data)..."
  xcrun simctl terminate "$SIM_ID" so.onekey.wallet 2>/dev/null || true
  sleep 1
  xcrun simctl install "$SIM_ID" "$APP"
  xcrun simctl launch "$SIM_ID" so.onekey.wallet

  echo ""
  echo "$(timestamp) ✅ Deployed and launched on $SIM_ID"
}

# --- Build native .app with xcodebuild ---
cmd_xcode() {
  local SIM_ID
  SIM_ID=$(detect_simulator)
  echo "$(timestamp) 🔨 Building native .app for simulator: $SIM_ID"

  cd "$MOBILE_DIR"

  SENTRY_DISABLE_AUTO_UPLOAD=true \
  ENABLE_NATIVE_BACKGROUND_THREAD=true \
  UNION_BUILD=true \
  SPLIT_BUNDLE=1 \
  SPLIT_BUNDLE_SEGMENTS=true \
  COMPILER_INDEX_STORE_ENABLE=NO \
  xcodebuild \
    -workspace ios/OneKeyWallet.xcworkspace \
    -scheme OneKeyWallet \
    -configuration Release \
    -destination "id=$SIM_ID" \
    -derivedDataPath ios/build \
    ONLY_ACTIVE_ARCH=YES \
    ARCHS=arm64 \
    build

  echo ""
  echo "$(timestamp) ✅ Native build complete"
}

# --- Read logs ---
cmd_logs() {
  local SIM_ID
  SIM_ID=$(detect_simulator)

  local APP_DATA
  APP_DATA=$(xcrun simctl get_app_container "$SIM_ID" so.onekey.wallet data 2>/dev/null)
  if [ -z "$APP_DATA" ]; then
    echo "❌ App not installed"
    exit 1
  fi

  local LOG="$APP_DATA/Library/Caches/logs/app-latest.log"
  if [ ! -f "$LOG" ]; then
    echo "❌ No log file found"
    exit 1
  fi

  local FILTER="${1:-StartupTiming|SplashProvider|GlobalJotaiReady|balance|LayoutDiag|JSError|ColdStartCache}"
  local LAST_START
  LAST_START=$(grep 'hostDidStart fired' "$LOG" | tail -1 | cut -d'|' -f1 | xargs)

  echo "=== Session: $LAST_START ==="
  grep -A999 "$LAST_START.*hostDidStart fired" "$LOG" | grep -E "$FILTER" | head -30
}

# --- Chart diagnostic logs (DEBUG instrumentation) ---
# Dumps the full chart lifecycle chain (native ChartWV + JS market => chart => *)
# from the simulator's app-latest.log. Pass `tail` to follow live, or a number to
# limit lines (default 200).
cmd_chart_logs() {
  local SIM_ID
  SIM_ID=$(detect_simulator)
  local APP_DATA
  APP_DATA=$(xcrun simctl get_app_container "$SIM_ID" so.onekey.wallet data 2>/dev/null)
  [ -z "$APP_DATA" ] && { echo "❌ App not installed"; exit 1; }
  local LOG="$APP_DATA/Library/Caches/logs/app-latest.log"
  [ ! -f "$LOG" ] && { echo "❌ No log file found at $LOG"; exit 1; }

  # ChartWV          = native (ChartWebview.swift)
  # chartSource/...  = JS (market => chart => *)
  local CHART_RE='ChartWV|market => chart =>|chartSource|chartLoadEnd|chartError|chartPrewarm|chartHost|chartKline'
  echo "📈 $LOG"
  if [ "$1" = "tail" ]; then
    echo "=== following chart events (Ctrl-C to stop) ==="
    tail -f "$LOG" | grep --line-buffered -E "$CHART_RE"
  else
    local N="${1:-200}"
    grep -E "$CHART_RE" "$LOG" | tail -"$N"
  fi
}

# --- Sync instrumented native module from app-modules into node_modules ---
# The native chart-webview lives in the app-modules repo but the iOS build
# compiles it from node_modules/@onekeyfe/react-native-chart-webview (see
# Podfile.lock: `from ../../../node_modules/...`). After editing the Swift there,
# run this to mirror it in, then `pods` (only if the podspec dep list changed)
# and `xcode`.
cmd_sync_native() {
  local SRC="$REPO_ROOT/../app-modules/native-views/react-native-chart-webview"
  local DST="$REPO_ROOT/node_modules/@onekeyfe/react-native-chart-webview"
  [ ! -d "$SRC" ] && { echo "❌ app-modules source not found at $SRC"; exit 1; }
  [ ! -d "$DST" ] && { echo "❌ node_modules target not found at $DST"; exit 1; }
  echo "$(timestamp) 🔄 Syncing native chart-webview: app-modules -> node_modules"
  rsync -a "$SRC/ios/" "$DST/ios/"
  rsync -a "$SRC/android/" "$DST/android/"
  cp "$SRC/ChartWebview.podspec" "$DST/ChartWebview.podspec"
  echo "   synced ios/ + android/ + ChartWebview.podspec"
  echo "   ⚠️  if the podspec dependency list changed, run '$0 pods' next"
}

# --- Build the TradingView chart library locally and stage its dist into the
# --- app's tradingview-assets (offline chart bundle). Needed after editing the
# --- tradingview-charting-library repo. Run 'xcode' afterwards so the Podfile
# --- Run Script copies the staged assets into the .app.
cmd_stage_tv() {
  local TV_DIR="$REPO_ROOT/../tradingview-charting-library"
  local DEST="$MOBILE_DIR/tradingview-assets"
  [ ! -d "$TV_DIR" ] && { echo "❌ tradingview-charting-library not found at $TV_DIR"; exit 1; }
  echo "$(timestamp) 🏗  Building chart library (build:local)..."
  ( cd "$TV_DIR" && yarn build:local )
  [ ! -d "$TV_DIR/dist" ] && { echo "❌ no dist/ produced by build:local"; exit 1; }
  echo "   staging dist -> $DEST"
  rm -rf "$DEST"; mkdir -p "$DEST"
  cp -R "$TV_DIR/dist/." "$DEST/"
  echo "   ✅ staged ($(ls "$DEST" | tr '\n' ' '))"
  echo "   ⚠️  run '$0 xcode' next so the Podfile copies it into the .app"
}

# --- Reinstall pods (needed once after a podspec dependency change) ---
cmd_pods() {
  cd "$MOBILE_DIR/ios"
  echo "$(timestamp) 📦 pod install..."
  bundle exec pod install 2>/dev/null || pod install
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
    cmd_build
    cmd_deploy
    ;;
  xcode)
    cmd_xcode
    ;;
  logs)
    shift
    cmd_logs "$@"
    ;;
  chart-logs)
    shift
    cmd_chart_logs "$@"
    ;;
  sync-native)
    cmd_sync_native
    ;;
  stage-tv)
    cmd_stage_tv
    ;;
  pods)
    cmd_pods
    ;;
  *)
    echo "Usage: $0 [build|deploy|all|xcode|logs|chart-logs|sync-native|stage-tv|pods]"
    echo ""
    echo "  Native change loop:  sync-native -> pods (only if dep changed) -> xcode -> deploy"
    echo "  JS change loop:      build -> deploy   (fast, no xcode)"
    echo "  Inspect:             chart-logs [N|tail]"
    exit 1
    ;;
esac

if [ "$COMMAND" != "logs" ] && [ "$COMMAND" != "chart-logs" ]; then
  TOTAL_TIME=$(( $(date +%s) - SCRIPT_START_TIME ))
  echo ""
  echo "$(timestamp) Total time: $((TOTAL_TIME / 60))m $((TOTAL_TIME % 60))s"
fi
