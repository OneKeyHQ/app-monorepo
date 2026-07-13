#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LOG_DIR="${PERF_LOG_DIR:-$HOME/perf-logs}"
PID_DIR="${PERF_PID_DIR:-$HOME/perf-pids}"
SESSIONS_DIR="${PERF_SESSIONS_DIR:-$HOME/perf-sessions}"
INTERVAL_MINUTES="${PERF_INTERVAL_MINUTES:-240}"
WEB_MODE="${PERF_WEB_MODE:-headed}"
ANDROID_MODE="${PERF_ANDROID_MODE:-headless}"
PID_NAMESPACE="$(printf '%s' "$ROOT_DIR" | cksum | awk '{print $1}')"
if [[ -n "${PERF_DAEMON_STOP_TIMEOUT_SECONDS:-}" ]]; then
  STOP_TIMEOUT_SECONDS="$PERF_DAEMON_STOP_TIMEOUT_SECONDS"
elif [[ "${PERF_DAEMON_STOP_TIMEOUT_MS:-}" =~ ^[0-9]+$ ]]; then
  STOP_TIMEOUT_SECONDS=$(((PERF_DAEMON_STOP_TIMEOUT_MS + 999) / 1000 + 5))
else
  STOP_TIMEOUT_SECONDS=35
fi

detect_node_bin() {
  local yarn_bin yarn_dir node_candidate

  yarn_bin="$(command -v yarn || true)"
  if [[ -n "${yarn_bin:-}" ]]; then
    yarn_dir="$(cd "$(dirname "$yarn_bin")" && pwd)"
    node_candidate="$yarn_dir/node"
    if [[ -x "$node_candidate" ]]; then
      echo "$node_candidate"
      return 0
    fi
  fi

  command -v node
}

NODE_BIN="${PERF_NODE_BIN:-$(detect_node_bin)}"
NODE_DIR="$(cd "$(dirname "$NODE_BIN")" && pwd)"
export PATH="$NODE_DIR:$PATH"

LABELS=(
  "perf-server"
  "perf-ios-release-daemon"
  "perf-android-release-daemon"
  "perf-web-release-daemon"
  "perf-desktop-release-daemon"
  "perf-ext-release-daemon"
)

usage() {
  cat <<'EOF'
Usage:
  bash development/perf-ci/node-only-daemons.sh start
  bash development/perf-ci/node-only-daemons.sh stop
  bash development/perf-ci/node-only-daemons.sh restart
  bash development/perf-ci/node-only-daemons.sh status
  bash development/perf-ci/node-only-daemons.sh logs [name]

Names:
  perf-server
  perf-ios-release-daemon
  perf-android-release-daemon
  perf-web-release-daemon
  perf-desktop-release-daemon
  perf-ext-release-daemon

Environment overrides:
  PERF_INTERVAL_MINUTES  default: 240
  PERF_WEB_MODE          default: headed
  PERF_ANDROID_MODE      default: headless
  PERF_LOG_DIR           default: $HOME/perf-logs
  PERF_PID_DIR           default: $HOME/perf-pids
  PERF_SESSIONS_DIR      default: $HOME/perf-sessions
  PERF_NODE_BIN          default: inferred from `yarn` sibling `node`, then fallback to `command -v node`
  PERF_DAEMON_STOP_TIMEOUT_SECONDS
                         default: 35, or PERF_DAEMON_STOP_TIMEOUT_MS + 5s when set
EOF
}

ensure_dirs() {
  mkdir -p "$LOG_DIR" "$PID_DIR" "$SESSIONS_DIR"
}

pid_file() {
  echo "$PID_DIR/$1.$PID_NAMESPACE.pid"
}

log_file() {
  echo "$LOG_DIR/$1.log"
}

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

command_pattern() {
  case "$1" in
    perf-server)
      echo 'development/performance-server/server.js'
      ;;
    perf-ios-release-daemon)
      echo 'development/perf-ci/run-ios-perf-detox-release-daemon.js'
      ;;
    perf-android-release-daemon)
      echo 'development/perf-ci/run-android-perf-detox-release-daemon.js'
      ;;
    perf-web-release-daemon)
      echo 'development/perf-ci/run-web-perf-release-daemon.js'
      ;;
    perf-desktop-release-daemon)
      echo 'development/perf-ci/run-desktop-perf-release-daemon.js'
      ;;
    perf-ext-release-daemon)
      echo 'development/perf-ci/run-ext-perf-release-daemon.js'
      ;;
    *)
      return 1
      ;;
  esac
}

find_running_pid() {
  local pattern pid

  pattern="$(command_pattern "$1")" || return 1
  while IFS= read -r pid; do
    if process_belongs_to_root "$pid" "$1"; then
      echo "$pid"
      return 0
    fi
  done < <(pgrep -f "$pattern" || true)

  return 1
}

process_cwd() {
  local pid="$1"

  if [[ -L "/proc/$pid/cwd" ]]; then
    readlink "/proc/$pid/cwd" 2>/dev/null || true
    return 0
  fi

  lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -n 1
}

process_belongs_to_root() {
  local pid="$1"
  local name="$2"
  local pattern cwd command

  [[ -n "${pid:-}" ]] || return 1
  kill -0 "$pid" 2>/dev/null || return 1

  pattern="$(command_pattern "$name")" || return 1
  command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
  cwd="$(process_cwd "$pid")"
  if [[ "$cwd" == "$ROOT_DIR" && "$command" == *"$pattern"* ]]; then
    return 0
  fi

  if [[ "$command" == *"$ROOT_DIR/$pattern"* ]]; then
    return 0
  fi

  return 1
}

write_pid_owner() {
  local name="$1"
  local pid="$2"
  local root_json

  root_json="$(json_escape "$ROOT_DIR")"
  printf '{"pid":%s,"rootDir":"%s"}\n' "$pid" "$root_json" >"$(pid_file "$name")"
}

read_pid() {
  local file value
  file="$(pid_file "$1")"
  [[ -f "$file" ]] || return 0

  value="$(tr -d '[:space:]' <"$file")"
  if [[ "$value" == \{* ]]; then
    printf '%s' "$value" | sed -n 's/.*"pid":[[:space:]]*\([0-9][0-9]*\).*/\1/p'
    return 0
  fi

  printf '%s' "$value" | sed -n 's/^\([0-9][0-9]*\)$/\1/p'
}

read_pid_root() {
  local file
  file="$(pid_file "$1")"
  [[ -f "$file" ]] || return 0

  tr -d '\n' <"$file" | sed -n 's/.*"rootDir":"\([^"]*\)".*/\1/p'
}

pid_file_belongs_to_root() {
  local name="$1"
  local pid="$2"
  local owner_root

  owner_root="$(read_pid_root "$name")"
  if [[ -n "${owner_root:-}" ]]; then
    [[ "$owner_root" == "$ROOT_DIR" ]] || return 1
    process_belongs_to_root "$pid" "$name"
    return $?
  fi

  process_belongs_to_root "$pid" "$name"
}

is_running() {
  local name="$1"
  local pid
  pid="$(read_pid "$name")"
  if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null && pid_file_belongs_to_root "$name" "$pid"; then
    return 0
  fi

  pid="$(find_running_pid "$name" || true)"
  if [[ -n "${pid:-}" ]]; then
    write_pid_owner "$name" "$pid"
    return 0
  fi

  return 1
}

start_one() {
  local name="$1"
  shift
  local pid_path log_path pid current_dir

  pid_path="$(pid_file "$name")"
  log_path="$(log_file "$name")"

  if is_running "$name"; then
    pid="$(read_pid "$name")"
    echo "$name already running (pid $pid)"
    return 0
  fi

  rm -f "$pid_path"

  current_dir="$PWD"
  cd "$ROOT_DIR"
  env \
    PATH="$PATH" \
    PERF_SESSIONS_DIR="$SESSIONS_DIR" \
    perl -MPOSIX=setsid -e '
      $SIG{HUP} = "IGNORE";
      setsid() or die "setsid failed: $!";
      exec @ARGV or die "exec failed: $!";
    ' "$@" >"$log_path" 2>&1 </dev/null &
  pid="$!"
  disown "$pid" 2>/dev/null || true
  cd "$current_dir"
  write_pid_owner "$name" "$pid"

  sleep 1
  if ! is_running "$name"; then
    rm -f "$pid_path"
    echo "failed to start $name (log=$log_path)" >&2
    tail -n 40 "$log_path" 2>/dev/null >&2 || true
    return 1
  fi

  pid="$(read_pid "$name")"
  echo "started $name (pid $pid)"
}

stop_one() {
  local name="$1"
  local pid_path pid wait_count

  pid_path="$(pid_file "$name")"

  if ! is_running "$name"; then
    rm -f "$pid_path"
    echo "$name not running"
    return 0
  fi

  pid="$(read_pid "$name")"
  kill "$pid" 2>/dev/null || true

  wait_count=0
  while kill -0 "$pid" 2>/dev/null; do
    wait_count=$((wait_count + 1))
    if [[ "$wait_count" -ge "$STOP_TIMEOUT_SECONDS" ]]; then
      kill -9 "$pid" 2>/dev/null || true
      break
    fi
    sleep 1
  done

  rm -f "$pid_path"
  echo "stopped $name"
}

status_one() {
  local name="$1"
  local pid_path pid

  pid_path="$(pid_file "$name")"

  if is_running "$name"; then
    pid="$(read_pid "$name")"
    echo "$name running (pid $pid) log=$(log_file "$name")"
    return 0
  fi

  if [[ -f "$pid_path" ]]; then
    echo "$name stale pid file ($(read_pid "$name")) log=$(log_file "$name")"
    return 1
  fi

  echo "$name stopped"
  return 1
}

start_all() {
  local failures=()

  case "$WEB_MODE" in
    headed|headless)
      ;;
    *)
      echo "PERF_WEB_MODE must be headed or headless, got: $WEB_MODE" >&2
      exit 1
      ;;
  esac

  case "$ANDROID_MODE" in
    headed|headless)
      ;;
    *)
      echo "PERF_ANDROID_MODE must be headed or headless, got: $ANDROID_MODE" >&2
      exit 1
      ;;
  esac

  ensure_dirs
  if ! start_one "perf-server" "$NODE_BIN" development/performance-server/server.js; then
    failures+=("perf-server")
  fi
  if ! start_one \
    "perf-ios-release-daemon" \
    "$NODE_BIN" development/perf-ci/run-ios-perf-detox-release-daemon.js \
    --interval-minutes "$INTERVAL_MINUTES" \
    --headless; then
    failures+=("perf-ios-release-daemon")
  fi
  if ! start_one \
    "perf-android-release-daemon" \
    "$NODE_BIN" development/perf-ci/run-android-perf-detox-release-daemon.js \
    --interval-minutes "$INTERVAL_MINUTES" \
    "--$ANDROID_MODE"; then
    failures+=("perf-android-release-daemon")
  fi
  if ! start_one \
    "perf-web-release-daemon" \
    "$NODE_BIN" development/perf-ci/run-web-perf-release-daemon.js \
    --interval-minutes "$INTERVAL_MINUTES" \
    "--$WEB_MODE"; then
    failures+=("perf-web-release-daemon")
  fi
  if ! start_one \
    "perf-desktop-release-daemon" \
    "$NODE_BIN" development/perf-ci/run-desktop-perf-release-daemon.js \
    --interval-minutes "$INTERVAL_MINUTES"; then
    failures+=("perf-desktop-release-daemon")
  fi
  if ! start_one \
    "perf-ext-release-daemon" \
    "$NODE_BIN" development/perf-ci/run-ext-perf-release-daemon.js \
    --interval-minutes "$INTERVAL_MINUTES"; then
    failures+=("perf-ext-release-daemon")
  fi

  if [[ "${#failures[@]}" -gt 0 ]]; then
    echo "failed to start ${#failures[@]} daemon(s): ${failures[*]}" >&2
    echo "run: yarn perf:release:daemon:logs <name>" >&2
    return 1
  fi
}

stop_all() {
  stop_one "perf-ext-release-daemon"
  stop_one "perf-desktop-release-daemon"
  stop_one "perf-web-release-daemon"
  stop_one "perf-android-release-daemon"
  stop_one "perf-ios-release-daemon"
  stop_one "perf-server"
}

status_all() {
  for name in "${LABELS[@]}"; do
    status_one "$name" || true
  done
}

logs_cmd() {
  local name="${1:-}"

  if [[ -n "$name" ]]; then
    tail -f "$(log_file "$name")"
    return 0
  fi

  echo "available logs:"
  for label in "${LABELS[@]}"; do
    echo "  $label -> $(log_file "$label")"
  done
}

main() {
  local cmd="${1:-}"

  case "$cmd" in
    start)
      start_all
      ;;
    stop)
      stop_all
      ;;
    restart)
      stop_all
      start_all
      ;;
    status)
      status_all
      ;;
    logs)
      logs_cmd "${2:-}"
      ;;
    *)
      usage
      exit 1
      ;;
  esac
}

main "$@"
