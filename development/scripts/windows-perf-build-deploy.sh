#!/bin/bash
# ============================================================
# Windows Release Build & Perf Deploy (remote build -> tunnel -> capture)
#
# Runs ON THE MAC. Drives a Windows machine on the SAME LAN over SSH so that
# Claude / the perf tooling stays on the Mac and NO AI runs on the Windows box
# (compliance). It chains:
#
#     remote build + launch  ->  open CDP tunnel  ->  capture performance
#
# Usage:
#   ./development/scripts/windows-perf-build-deploy.sh [command]
#
# Commands:
#   build    - Remote build (yarn build:win) + launch detached on Windows
#   launch   - Relaunch the already-built exe on Windows (no rebuild)
#   tunnel   - Open the CDP SSH tunnel (localhost:$CDP_PORT -> Windows 127.0.0.1)
#   capture  - Screenshot + console errors via CDP through the tunnel
#   all      - build -> tunnel -> capture (default), leaves the tunnel running
#   stop     - Close the tunnel and stop the remote app
#   doctor   - Check SSH reachability + remote repo + tooling
#
# Config (env vars, or a local development/scripts/.windows-perf.env file):
#   WIN_HOST   Windows LAN IP or hostname            (required)
#   WIN_USER   Windows SSH username                  (default: current user)
#   WIN_REPO   repo path on Windows (Windows-style)  (default: C:\app-monorepo)
#   CDP_PORT   remote debugging port                 (default: 9222)
#   OUT_DIR    where captures are written            (default: .tmp/win-perf)
#
# Prerequisites (one-time, on Windows): run
#   apps\desktop\scripts\setup-perf-remote-win.ps1   (Admin)
# and ensure the repo there has had `yarn install` (native modules are Windows
# binaries; node_modules can't be shared from the Mac).
# ============================================================

set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPT_START_TIME=$(date +%s)

# --- Load optional local config (not committed) ---
CONFIG_FILE="$REPO_ROOT/development/scripts/.windows-perf.env"
if [ -f "$CONFIG_FILE" ]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

WIN_USER="${WIN_USER:-$(whoami)}"
WIN_REPO="${WIN_REPO:-C:\\app-monorepo}"
CDP_PORT="${CDP_PORT:-9222}"
OUT_DIR="${OUT_DIR:-$REPO_ROOT/.tmp/win-perf}"
TUNNEL_PID_FILE="$REPO_ROOT/.tmp/win-perf/.tunnel.pid"

# Build-launch script path on Windows (Windows-style, under the remote repo).
WIN_BUILD_SCRIPT="$WIN_REPO\\apps\\desktop\\scripts\\build-launch-perf-win.ps1"
CDP_SHOT="$REPO_ROOT/.claude/skills/1k-ui-verify/scripts/cdp-shot.mjs"

timestamp() {
  echo "⏱  [$(date '+%H:%M:%S')]"
}

require_host() {
  if [ -z "$WIN_HOST" ]; then
    echo "❌ WIN_HOST is not set. Export it or put it in $CONFIG_FILE :"
    echo "     WIN_HOST=192.168.1.50"
    echo "     WIN_USER=youruser"
    echo "     WIN_REPO=C:\\\\Users\\\\youruser\\\\app-monorepo"
    exit 1
  fi
}

# Run a PowerShell command on Windows over SSH.
win_ps() {
  ssh "$WIN_USER@$WIN_HOST" "powershell -ExecutionPolicy Bypass -Command \"$1\""
}

# --- doctor: verify the remote target is reachable + set up ---
cmd_doctor() {
  require_host
  echo "$(timestamp) 🩺 Checking $WIN_USER@$WIN_HOST ..."

  echo -n "   SSH reachable: "
  if ssh -o ConnectTimeout=5 -o BatchMode=yes "$WIN_USER@$WIN_HOST" "echo ok" 2>/dev/null | grep -q ok; then
    echo "✅"
  else
    echo "❌ cannot SSH (key auth?). Run setup-perf-remote-win.ps1 on Windows and add your key."
    exit 1
  fi

  echo -n "   Remote repo ($WIN_REPO): "
  if win_ps "Test-Path '$WIN_REPO\\package.json'" | grep -qi true; then
    echo "✅"
  else
    echo "❌ not found. Set WIN_REPO."
  fi

  echo -n "   Build script present: "
  if win_ps "Test-Path '$WIN_BUILD_SCRIPT'" | grep -qi true; then
    echo "✅"
  else
    echo "❌ $WIN_BUILD_SCRIPT missing (pull latest on Windows)."
  fi

  echo -n "   node_modules installed: "
  if win_ps "Test-Path '$WIN_REPO\\apps\\desktop\\node_modules'" | grep -qi true; then
    echo "✅"
  else
    echo "⚠️  run 'yarn' on Windows first (native modules must be Windows binaries)."
  fi

  echo -n "   cdp-shot.mjs present on Mac: "
  if [ -f "$CDP_SHOT" ]; then echo "✅"; else echo "❌ $CDP_SHOT missing"; fi
}

# --- build: remote build + launch detached ---
cmd_build() {
  require_host
  echo "$(timestamp) 📦 Remote build (yarn build:win) on $WIN_HOST — this takes a while..."
  win_ps "& '$WIN_BUILD_SCRIPT' -Port $CDP_PORT -Detach"
  echo "$(timestamp) ✅ Built + launched detached on Windows (debug port $CDP_PORT on its 127.0.0.1)"
}

# --- launch: relaunch existing build (no rebuild) ---
cmd_launch() {
  require_host
  echo "$(timestamp) 🚀 Relaunching existing build on $WIN_HOST (no rebuild)..."
  win_ps "& '$WIN_BUILD_SCRIPT' -Port $CDP_PORT -NoBuild -Detach"
  echo "$(timestamp) ✅ Relaunched"
}

# --- tunnel: open CDP SSH tunnel in background ---
cmd_tunnel() {
  require_host
  mkdir -p "$(dirname "$TUNNEL_PID_FILE")"

  # Reuse an existing live tunnel if the port already answers.
  if curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$CDP_PORT/json/version"; then
    echo "$(timestamp) 🔌 Tunnel already up (localhost:$CDP_PORT responds)"
    return
  fi

  echo "$(timestamp) 🔌 Opening CDP tunnel localhost:$CDP_PORT -> $WIN_HOST 127.0.0.1:$CDP_PORT ..."
  ssh -N -L "$CDP_PORT:127.0.0.1:$CDP_PORT" "$WIN_USER@$WIN_HOST" &
  echo $! > "$TUNNEL_PID_FILE"

  # Wait for the endpoint to come up (the app may still be booting).
  for i in $(seq 1 30); do
    if curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$CDP_PORT/json/version"; then
      echo "$(timestamp) ✅ Tunnel live — CDP at http://127.0.0.1:$CDP_PORT"
      return
    fi
    sleep 1
  done
  echo "❌ Tunnel opened but CDP did not respond within 30s. Is the app running on Windows?"
  exit 1
}

# --- capture: screenshot + console errors over CDP ---
cmd_capture() {
  mkdir -p "$OUT_DIR"
  local STAMP
  STAMP=$(date '+%Y%m%d-%H%M%S')
  local OUT="$OUT_DIR/win-$STAMP.png"

  if [ ! -f "$CDP_SHOT" ]; then
    echo "❌ $CDP_SHOT not found."
    exit 1
  fi

  echo "$(timestamp) 📸 Capturing via CDP (localhost:$CDP_PORT) -> $OUT"
  # cdp-shot.mjs connects to the main window, screenshots, and prints console errors.
  # It reads the endpoint from CDP_URL (default :9222), so pass it through.
  CDP_URL="http://127.0.0.1:$CDP_PORT" node "$CDP_SHOT" --out "$OUT"
  echo "$(timestamp) ✅ Saved $OUT"
  echo "   For deep profiling: tunnel is open — attach DevTools at http://127.0.0.1:$CDP_PORT"
  echo "   (Performance record / Heap snapshot), or point any CDP perf script at that port."
}

# --- stop: tear down tunnel + remote app ---
cmd_stop() {
  if [ -f "$TUNNEL_PID_FILE" ]; then
    local PID
    PID=$(cat "$TUNNEL_PID_FILE")
    if kill "$PID" 2>/dev/null; then
      echo "$(timestamp) 🔌 Closed tunnel (pid $PID)"
    fi
    rm -f "$TUNNEL_PID_FILE"
  else
    echo "   No tunnel pid file; nothing to close."
  fi

  if [ -n "$WIN_HOST" ]; then
    echo "$(timestamp) 🛑 Stopping remote OneKey on $WIN_HOST ..."
    win_ps "Get-Process -Name 'OneKey' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue" || true
  fi
}

# --- Main ---
COMMAND="${1:-all}"

case "$COMMAND" in
  build)   cmd_build ;;
  launch)  cmd_launch ;;
  tunnel)  cmd_tunnel ;;
  capture) cmd_capture ;;
  stop)    cmd_stop ;;
  doctor)  cmd_doctor ;;
  all)
    cmd_build
    cmd_tunnel
    cmd_capture
    echo ""
    echo "$(timestamp) 🎯 Ready: tunnel stays open at http://127.0.0.1:$CDP_PORT"
    echo "   Attach DevTools or re-run '$0 capture' for more shots."
    echo "   When done: '$0 stop'"
    ;;
  *)
    echo "Usage: $0 [build|launch|tunnel|capture|all|stop|doctor]"
    exit 1
    ;;
esac

TOTAL_TIME=$(( $(date +%s) - SCRIPT_START_TIME ))
echo ""
echo "$(timestamp) Total time: $((TOTAL_TIME / 60))m $((TOTAL_TIME % 60))s"
