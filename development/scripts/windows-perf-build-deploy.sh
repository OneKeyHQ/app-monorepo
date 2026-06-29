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
# SCOPE / SECURITY MODEL — READ BEFORE FILING INJECTION REPORTS:
#   * Local developer perf tooling ONLY. It is NOT referenced by any
#     package.json script or GitHub Actions workflow, so it never runs in CI
#     and never ships in any product bundle. The OneKey desktop app does not
#     contain or execute this file.
#   * Trusted-operator tool: the developer running it owns both the Mac and the
#     LAN-local Windows box, and authors the gitignored `.windows-perf.env`.
#     Inputs (the env file, the Windows box's stdout) are trusted by design, so
#     `source`-ing the env file and interpolating remote output into `win_ps`
#     are intentional, not an exposed attack surface. A "malicious
#     .windows-perf.env" or "compromised Windows box" precondition already
#     implies full control of an endpoint and crosses no new boundary (the
#     interpolated remote output is only ever sent back to that same Windows
#     box, never executed on the Mac). Do not feed this script untrusted input.
#
# Usage:
#   ./development/scripts/windows-perf-build-deploy.sh [command]
#
# Commands:
#   build    - Remote build (yarn build:win) + launch detached on Windows
#   launch   - Relaunch the already-built exe on Windows (no rebuild)
#   tunnel   - Open the CDP SSH tunnel (localhost:$CDP_PORT -> Windows 127.0.0.1)
#   capture  - Screenshot + console errors via CDP through the tunnel
#   trace    - Launch with a t=0 Chromium startup trace, pull it back via scp
#              ('trace build' rebuilds first; else reuses the current build)
#   cdp ...  - Pass through to win-perf-cdp.mjs (targets|profile|heapstats|heap|console)
#   all      - build -> tunnel -> capture (default), leaves the tunnel running
#   stop     - Close the tunnel and stop the remote app
#   doctor   - Check SSH reachability + remote repo + tooling
#
# Config extras:
#   TRACE_DURATION  startup trace length in seconds        (default: 30)
#   TRACE_FORMAT    proto (Perfetto) or json (chrome://tracing)  (default: proto)
#
# Config (env vars, or a local development/scripts/.windows-perf.env file):
#   WIN_HOST     Windows LAN IP or hostname            (required)
#   WIN_USER     Windows SSH username                  (default: current user)
#   WIN_SSH_PORT SSH port on Windows                   (default: 22)
#   WIN_REPO     repo path on Windows (Windows-style)  (default: C:\app-monorepo)
#   CDP_PORT     remote debugging port                 (default: 9222)
#   OUT_DIR      where captures are written            (default: .tmp/win-perf)
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
# `source` (vs key=value parse) is intentional: this gitignored file is authored
# by the operator running the tool. See the SCOPE / SECURITY MODEL header — this
# is local dev tooling, never CI/product, and inputs are trusted by design.
CONFIG_FILE="$REPO_ROOT/development/scripts/.windows-perf.env"
if [ -f "$CONFIG_FILE" ]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

WIN_USER="${WIN_USER:-$(whoami)}"
WIN_SSH_PORT="${WIN_SSH_PORT:-22}"
WIN_REPO="${WIN_REPO:-C:\\app-monorepo}"
CDP_PORT="${CDP_PORT:-9222}"
OUT_DIR="${OUT_DIR:-$REPO_ROOT/.tmp/win-perf}"
TUNNEL_PID_FILE="$REPO_ROOT/.tmp/win-perf/.tunnel.pid"
TRACE_DURATION="${TRACE_DURATION:-30}"
TRACE_FORMAT="${TRACE_FORMAT:-proto}"
CDP_PERF="$REPO_ROOT/development/scripts/win-perf-cdp.mjs"

# Build-launch script path on Windows (Windows-style, under the remote repo).
WIN_BUILD_SCRIPT="$WIN_REPO\\apps\\desktop\\scripts\\build-launch-perf-win.ps1"
# Prefer the repo-tracked helper path. `.skillshare/...` is committed and present
# after a fresh clone; `.claude/skills/...` is only a local alias/symlink and is
# NOT guaranteed to exist on other machines. Fall back to it only if present.
CDP_SHOT="$REPO_ROOT/.skillshare/skills/1k-ui-verify/scripts/cdp-shot.mjs"
if [ ! -f "$CDP_SHOT" ] && [ -f "$REPO_ROOT/.claude/skills/1k-ui-verify/scripts/cdp-shot.mjs" ]; then
  CDP_SHOT="$REPO_ROOT/.claude/skills/1k-ui-verify/scripts/cdp-shot.mjs"
fi

timestamp() {
  echo "⏱  [$(date '+%H:%M:%S')]"
}

require_host() {
  if [ -z "$WIN_HOST" ]; then
    echo "❌ WIN_HOST is not set. Export it or put it in $CONFIG_FILE :"
    echo "     WIN_HOST=192.168.1.50"
    echo "     WIN_USER=youruser"
    echo "     WIN_SSH_PORT=2222"
    echo "     WIN_REPO='C:\\Users\\youruser\\app-monorepo'   # single-quote: keep backslashes"
    exit 1
  fi
}

# Run a PowerShell command on Windows over SSH.
# String interpolation into -Command is by design: args come from operator-owned
# config / this script's own constants, and the command runs on the same trusted
# LAN-local Windows box. See the SCOPE / SECURITY MODEL header (dev-only tool).
win_ps() {
  ssh -p "$WIN_SSH_PORT" "$WIN_USER@$WIN_HOST" "powershell -ExecutionPolicy Bypass -Command \"$1\""
}

# --- doctor: verify the remote target is reachable + set up ---
cmd_doctor() {
  require_host
  echo "$(timestamp) 🩺 Checking $WIN_USER@$WIN_HOST ..."

  echo -n "   SSH reachable: "
  if ssh -p "$WIN_SSH_PORT" -o ConnectTimeout=5 -o BatchMode=yes "$WIN_USER@$WIN_HOST" "echo ok" 2>/dev/null | grep -q ok; then
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
# Does localhost:$CDP_PORT answer at all?
port_answers() {
  curl -s -o /dev/null --max-time 2 "http://127.0.0.1:$CDP_PORT/json/version"
}

read_tunnel_pid() {
  [ -f "$TUNNEL_PID_FILE" ] || return 1
  local tpid
  tpid="$(tr -d '[:space:]' < "$TUNNEL_PID_FILE" 2>/dev/null)" || return 1
  [[ "$tpid" =~ ^[0-9]+$ ]] || return 1
  echo "$tpid"
}

# Validate that a pid still points at the exact SSH tunnel shape this script
# opens. This intentionally does not require CDP to answer: `stop` must be able
# to close the tunnel even if the remote app/debug endpoint is already down.
is_our_tunnel_pid() {
  local tpid="$1"
  [ -n "$tpid" ] || return 1
  kill -0 "$tpid" 2>/dev/null || return 1

  local cmd
  cmd="$(ps -p "$tpid" -o command= 2>/dev/null || true)"
  [ -n "$cmd" ] || return 1
  echo "$cmd" | grep -Eq '(^|/)ssh([[:space:]]|$)' || return 1
  echo "$cmd" | grep -Eq '(^|[[:space:]])-N([[:space:]]|$)' || return 1
  echo "$cmd" | grep -Fq -- "-L $CDP_PORT:127.0.0.1:$CDP_PORT" || return 1
}

close_tunnel_from_pid_file() {
  local tpid
  if ! tpid="$(read_tunnel_pid)"; then
    echo "   Removing stale tunnel pid file (missing/invalid pid)."
    rm -f "$TUNNEL_PID_FILE"
    return
  fi

  if is_our_tunnel_pid "$tpid"; then
    if kill "$tpid" 2>/dev/null; then
      echo "$(timestamp) 🔌 Closed tunnel (pid $tpid)"
    else
      echo "   Tunnel pid $tpid matched, but it was already gone."
    fi
  else
    echo "   Removing stale tunnel pid file (pid $tpid is not this SSH tunnel)."
  fi
  rm -f "$TUNNEL_PID_FILE"
}

# True (0) only if the port answers AND it is the SSH tunnel THIS script opened —
# a live pid in $TUNNEL_PID_FILE whose command line forwards our exact port. A bare
# "port answers" is NOT enough: a local desktop dev / Chrome / other CDP service on
# the same port satisfies it too, and capture/cdp/trace would then silently profile
# that LOCAL target as if it were the Windows release.
is_our_tunnel() {
  local tpid
  tpid="$(read_tunnel_pid)" || return 1
  is_our_tunnel_pid "$tpid" || return 1
  port_answers || return 1
}

# Guard for commands that consume the tunnel (capture/cdp): refuse to attach to
# anything that is not our verified Windows tunnel.
require_our_tunnel() {
  is_our_tunnel && return 0
  if port_answers; then
    echo "❌ localhost:$CDP_PORT answers, but NOT via a tunnel this script opened"
    echo "   (no live ssh pid forwarding $CDP_PORT in $TUNNEL_PID_FILE). It is most likely"
    echo "   a local CDP service (desktop dev / Chrome / another tool). Attaching would"
    echo "   profile that LOCAL target as if it were the Windows release."
    echo "   Fix: free port $CDP_PORT (or set CDP_PORT to a different value), then re-run 'tunnel'."
  else
    echo "❌ No CDP tunnel on localhost:$CDP_PORT. Run '$0 tunnel' (or 'all') first."
  fi
  exit 1
}

cmd_tunnel() {
  require_host
  mkdir -p "$(dirname "$TUNNEL_PID_FILE")"

  if is_our_tunnel; then
    echo "$(timestamp) 🔌 Reusing our tunnel (localhost:$CDP_PORT responds)"
    return
  fi
  if port_answers; then
    echo "❌ localhost:$CDP_PORT already answers, but NOT via a tunnel this script opened"
    echo "   (no live ssh pid forwarding $CDP_PORT in $TUNNEL_PID_FILE). It is most likely"
    echo "   a local CDP service (desktop dev / Chrome / another tool). Attaching would"
    echo "   profile that LOCAL target as if it were the Windows release."
    echo "   Fix: free port $CDP_PORT (or set CDP_PORT to a different value), then retry."
    exit 1
  fi
  if [ -f "$TUNNEL_PID_FILE" ]; then
    close_tunnel_from_pid_file
  fi

  echo "$(timestamp) 🔌 Opening CDP tunnel localhost:$CDP_PORT -> $WIN_HOST 127.0.0.1:$CDP_PORT ..."
  ssh -p "$WIN_SSH_PORT" -N -L "$CDP_PORT:127.0.0.1:$CDP_PORT" "$WIN_USER@$WIN_HOST" &
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
  close_tunnel_from_pid_file
  exit 1
}

# --- capture: screenshot + console errors over CDP ---
cmd_capture() {
  # Only capture through OUR verified Windows tunnel — never a stray local CDP.
  require_our_tunnel
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

# --- trace: build/launch with a t=0 startup trace, then pull it back ---
# Captures the earliest ~1-3s of boot that a CDP "attach-then-record" misses.
# Usage: trace [build]   ('build' rebuilds first; default reuses current build)
cmd_trace() {
  require_host
  mkdir -p "$OUT_DIR"

  local NOBUILD="-NoBuild"
  if [ "${2:-}" = "build" ]; then
    NOBUILD=""
    echo "$(timestamp) 📦 Remote build + traced launch on $WIN_HOST (full build, slow)..."
  else
    echo "$(timestamp) 🚀 Traced relaunch on $WIN_HOST (no rebuild)..."
  fi

  # Launch with --trace-startup; PS1 prints TRACE_STARTUP_FILE=<win path>.
  local PS_OUT
  PS_OUT=$(win_ps "& '$WIN_BUILD_SCRIPT' -Port $CDP_PORT -Detach -EnableLogging -TraceStartup -TraceDuration $TRACE_DURATION -TraceFormat $TRACE_FORMAT $NOBUILD")
  echo "$PS_OUT"

  # WIN_TRACE is parsed from the Windows box's own stdout and only ever sent
  # BACK to that same box (win_ps Test-Path / scp). It never executes on the
  # Mac, so a tampered value crosses no trust boundary. Dev-only tool; see header.
  local WIN_TRACE
  WIN_TRACE=$(echo "$PS_OUT" | grep -o 'TRACE_STARTUP_FILE=.*' | head -1 | sed 's/^TRACE_STARTUP_FILE=//' | tr -d '\r')
  if [ -z "$WIN_TRACE" ]; then
    echo "❌ Could not find TRACE_STARTUP_FILE in launch output. Did the PS1 update land on Windows?"
    exit 1
  fi
  echo "$(timestamp) 🎬 Recording startup trace for ${TRACE_DURATION}s -> $WIN_TRACE"

  # The trace file is finalized only after -TraceDuration elapses; wait + buffer.
  sleep $((TRACE_DURATION + 8))

  # Verify the file exists on Windows before scp (fallback signal if
  # --trace-startup is a no-op in this Electron build).
  if ! win_ps "Test-Path '$WIN_TRACE'" | grep -qi true; then
    echo "❌ Trace file was NOT written on Windows ($WIN_TRACE)."
    echo "   => --trace-startup may be unsupported by this Electron. Fallback: use 'cdp' + Tracing/Profiler instead."
    exit 1
  fi

  # Windows path -> scp-friendly forward-slash path.
  local SCP_PATH
  SCP_PATH=$(echo "$WIN_TRACE" | tr '\\' '/')
  local LOCAL_TRACE="$OUT_DIR/$(basename "$SCP_PATH")"
  echo "$(timestamp) ⬇️  Pulling trace via scp -> $LOCAL_TRACE"
  scp -P "$WIN_SSH_PORT" "$WIN_USER@$WIN_HOST:\"$SCP_PATH\"" "$LOCAL_TRACE"

  # Best-effort: pull the Chromium disk log (t=0 console; e.g. render-storm text).
  local WIN_LOG
  WIN_LOG=$(win_ps "(Get-ChildItem -Path \$env:APPDATA -Filter chrome_debug.log -Recurse -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName" | tr -d '\r')
  if [ -n "$WIN_LOG" ]; then
    local SCP_LOG
    SCP_LOG=$(echo "$WIN_LOG" | tr '\\' '/')
    scp -P "$WIN_SSH_PORT" "$WIN_USER@$WIN_HOST:\"$SCP_LOG\"" "$OUT_DIR/chrome_debug.log" 2>/dev/null \
      && echo "$(timestamp) ⬇️  Pulled Chromium log -> $OUT_DIR/chrome_debug.log" \
      || echo "   (Chromium disk log not pulled; use 'cdp console' instead)"
  fi

  echo ""
  echo "$(timestamp) ✅ Startup trace: $LOCAL_TRACE"
  if [ "$TRACE_FORMAT" = "proto" ]; then
    echo "   Load in https://ui.perfetto.dev  (drag the .pftrace in)"
  else
    echo "   Load in chrome://tracing  (Load -> pick the .json)"
  fi
  echo "   App is still running + debug port open. Tunnel then run 'cdp' for CPU/heap."
}

# --- cdp: pass through to the Mac-side CDP perf script over the tunnel ---
cmd_cdp() {
  if [ ! -f "$CDP_PERF" ]; then
    echo "❌ $CDP_PERF not found."
    exit 1
  fi
  # Only run CDP perf against OUR verified Windows tunnel — never a stray local CDP.
  require_our_tunnel
  shift || true # drop the 'cdp' arg
  CDP_URL="http://127.0.0.1:$CDP_PORT" node "$CDP_PERF" "$@"
}

# --- stop: tear down tunnel + remote app ---
cmd_stop() {
  if [ -f "$TUNNEL_PID_FILE" ]; then
    close_tunnel_from_pid_file
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
  trace)   cmd_trace "$@" ;;
  cdp)     cmd_cdp "$@" ;;
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
    echo "Usage: $0 [build|launch|tunnel|capture|trace|cdp|all|stop|doctor]"
    echo "  trace [build]   record a t=0 startup trace (proto/json), pull it back"
    echo "  cdp <targets|profile|heapstats|heap|console> [--target ..] [--duration ..] [--out ..]"
    exit 1
    ;;
esac

TOTAL_TIME=$(( $(date +%s) - SCRIPT_START_TIME ))
echo ""
echo "$(timestamp) Total time: $((TOTAL_TIME / 60))m $((TOTAL_TIME % 60))s"
