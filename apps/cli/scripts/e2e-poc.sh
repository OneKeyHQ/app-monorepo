#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CLI_DIR="$ROOT_DIR/apps/cli"
SERVICE_DIR="$ROOT_DIR/development/bot-wallet-key-service"
CLI_BIN="$CLI_DIR/bin/onekey"
SERVICE_DATA_FILE="$SERVICE_DIR/data/keys.json"
SERVICE_LOG="${ONEKEY_E2E_SERVICE_LOG:-/tmp/onekey-bot-wallet-key-service.log}"

SERVICE_PID=""

die() {
  printf 'e2e-poc: %s\n' "$*" >&2
  exit 1
}

run_step() {
  printf '\n[e2e] %s\n' "$*" >&2
}

cleanup() {
  if [[ -n "$SERVICE_PID" ]]; then
    kill "$SERVICE_PID" >/dev/null 2>&1 || true
    wait "$SERVICE_PID" >/dev/null 2>&1 || true
  fi
}

wait_for_service() {
  node <<'NODE'
const net = require('node:net');

const deadline = Date.now() + 10_000;

function tryConnect() {
  const socket = net.connect(8787, '127.0.0.1');
  socket.once('connect', () => {
    socket.destroy();
    process.exit(0);
  });
  socket.once('error', () => {
    socket.destroy();
    if (Date.now() > deadline) {
      process.stderr.write('service did not listen on 127.0.0.1:8787 in time\n');
      process.exit(1);
    }
    setTimeout(tryConnect, 100);
  });
}

tryConnect();
NODE
}

assert_service_revoked() {
  local key_id="$1"
  SERVICE_DATA_FILE="$SERVICE_DATA_FILE" KEY_ID="$key_id" node <<'NODE'
const fs = require('node:fs');

const file = process.env.SERVICE_DATA_FILE;
const keyId = process.env.KEY_ID;
if (!fs.existsSync(file)) {
  throw new Error(`service persistence file missing: ${file}`);
}

const records = JSON.parse(fs.readFileSync(file, 'utf8'));
const record = records[keyId];
if (!record || typeof record !== 'object') {
  throw new Error(`service persistence file is missing current keyId: ${keyId}`);
}
if (typeof record.revokedAt !== 'number') {
  throw new Error(`expected current service record to include revokedAt: ${keyId}`);
}
NODE
}

assert_fetch_count() {
  local expected="$1"
  local actual
  actual="$(grep -c '^audit: fetch$' "$SERVICE_LOG" 2>/dev/null || true)"
  if [[ "$actual" != "$expected" ]]; then
    die "expected service fetch count $expected, got $actual (log: $SERVICE_LOG)"
  fi
}

require_sign_inputs() {
  : "${ONEKEY_E2E_SIGN_TX:?set ONEKEY_E2E_SIGN_TX}"
  : "${ONEKEY_E2E_SIGN_ADDRESS:?set ONEKEY_E2E_SIGN_ADDRESS}"
  : "${ONEKEY_E2E_SIGN_PATH:?set ONEKEY_E2E_SIGN_PATH}"
  : "${ONEKEY_E2E_SIGN_PUB:?set ONEKEY_E2E_SIGN_PUB}"
}

if [[ "${ONEKEY_E2E_ALLOW_REAL_KEYCHAIN:-}" != "1" ]]; then
  cat >&2 <<'EOF'
This PoC script uses the real CLI entrypoint and the real OS keychain account:
  bot-wallet/master-key

It will run `onekey auth login --payload ...` and `onekey auth logout`.
Use only on a disposable dev profile or after backing up any active CLI session.
It also requires ONEKEY_E2E_SIGN_* values so the mandatory sign/cache checks
exercise the real signer path.

Re-run with:
  ONEKEY_E2E_ALLOW_REAL_KEYCHAIN=1 bash apps/cli/scripts/e2e-poc.sh
EOF
  exit 2
fi

require_sign_inputs
trap cleanup EXIT

run_step "build CLI"
yarn workspace @onekeyfe/cli build >/dev/null

run_step "start local key service"
mkdir -p "$(dirname "$SERVICE_LOG")"
(
  cd "$SERVICE_DIR"
  BOT_WALLET_KEY_SERVICE_AUDIT_REQUESTS=1 yarn start >"$SERVICE_LOG" 2>&1
) &
SERVICE_PID="$!"
wait_for_service

run_step "simulate App export payload"
PAYLOAD="$(
  node -r esbuild-register "$CLI_DIR/scripts/_simulate-export.ts"
)"
KEY_ID="$(node -e 'process.stdout.write(JSON.parse(process.argv[1]).payload.keyId)' "$PAYLOAD")"

run_step "auth login --payload"
"$CLI_BIN" --json auth login --payload "$PAYLOAD"

run_step "auth status"
"$CLI_BIN" --json auth status

run_step "get-address"
"$CLI_BIN" get-address --format=text

BASE_NOW_MS="${ONEKEY_E2E_FAKE_NOW_MS:-1774630800000}"
for index in 1 2 3 4 5; do
  run_step "sign #$index"
  ONEKEY_CLI_TEST_NOW_MS="$BASE_NOW_MS" "$CLI_BIN" --json sign \
    --chain "${ONEKEY_E2E_SIGN_CHAIN:-eth}" \
    --address "$ONEKEY_E2E_SIGN_ADDRESS" \
    --path "$ONEKEY_E2E_SIGN_PATH" \
    --pub "$ONEKEY_E2E_SIGN_PUB" \
    --tx "$ONEKEY_E2E_SIGN_TX"
done

run_step "verify sign loop used one service fetch"
assert_fetch_count 1

run_step "TTL refresh sign"
REFRESH_NOW_MS="$((BASE_NOW_MS + 3600001))"
ONEKEY_CLI_TEST_NOW_MS="$REFRESH_NOW_MS" "$CLI_BIN" --json sign \
  --chain "${ONEKEY_E2E_SIGN_CHAIN:-eth}" \
  --address "$ONEKEY_E2E_SIGN_ADDRESS" \
  --path "$ONEKEY_E2E_SIGN_PATH" \
  --pub "$ONEKEY_E2E_SIGN_PUB" \
  --tx "$ONEKEY_E2E_SIGN_TX"

run_step "verify TTL refresh fetched service key again"
assert_fetch_count 2

run_step "auth logout"
"$CLI_BIN" --json auth logout

run_step "verify service revoke"
assert_service_revoked "$KEY_ID"

run_step "verify vault file removed"
if [[ -f "$HOME/.onekey-cli/bot-wallet/vault.enc" ]]; then
  die "vault.enc still exists after logout"
fi

run_step "audit persistence fields"
bash "$CLI_DIR/scripts/audit-persistence-fields.sh"

run_step "done"
