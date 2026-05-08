#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CLI_DIR="$ROOT_DIR/apps/cli"
CLI_BIN="$CLI_DIR/bin/onekey"
ONEKEY_E2E_ENV="${ONEKEY_E2E_ENV:-test}"

die() {
  printf 'e2e-bot-wallet-key-api: %s\n' "$*" >&2
  exit 1
}

run_step() {
  printf '\n[e2e] %s\n' "$*" >&2
}

require_sign_inputs() {
  : "${ONEKEY_E2E_SIGN_TX:?set ONEKEY_E2E_SIGN_TX}"
  : "${ONEKEY_E2E_SIGN_ADDRESS:?set ONEKEY_E2E_SIGN_ADDRESS}"
  : "${ONEKEY_E2E_SIGN_PATH:?set ONEKEY_E2E_SIGN_PATH}"
  : "${ONEKEY_E2E_SIGN_PUB:?set ONEKEY_E2E_SIGN_PUB}"
}

configure_key_api_base_url() {
  case "$ONEKEY_E2E_ENV" in
    test)
      : "${BOT_WALLET_KEY_API_BASE_URL:=https://prime.onekeytest.com}"
      ;;
    prod)
      : "${BOT_WALLET_KEY_API_BASE_URL:=https://prime.onekeycn.com}"
      ;;
    *)
      die "ONEKEY_E2E_ENV must be test or prod"
      ;;
  esac
  export ONEKEY_E2E_ENV
  export BOT_WALLET_KEY_API_BASE_URL
}

if [[ "${ONEKEY_E2E_ALLOW_REAL_KEYCHAIN:-}" != "1" ]]; then
  cat >&2 <<'EOF'
This E2E script uses the real CLI entrypoint and the real OS keychain account:
  bot-wallet/master-key

It will run `onekey auth login --payload ...` and `onekey auth logout`.
Use only on a disposable dev profile or after backing up any active CLI session.
It also requires ONEKEY_E2E_SIGN_* values so the mandatory sign/cache checks
exercise the real signer path.
By default it uses the online Prime test API; set ONEKEY_E2E_ENV=prod only when
you intentionally want to exercise production.

Re-run with:
  ONEKEY_E2E_ALLOW_REAL_KEYCHAIN=1 bash apps/cli/scripts/e2e-bot-wallet-key-api.sh
EOF
  exit 2
fi

require_sign_inputs
configure_key_api_base_url

run_step "build CLI"
yarn workspace @onekeyfe/cli build >/dev/null

run_step "simulate App export payload"
PAYLOAD="$(
  node -r esbuild-register "$CLI_DIR/scripts/_simulate-export.ts"
)"

run_step "auth login --payload"
"$CLI_BIN" --env "$ONEKEY_E2E_ENV" --json auth login --payload "$PAYLOAD"

run_step "auth status"
"$CLI_BIN" --env "$ONEKEY_E2E_ENV" --json auth status

run_step "get-address"
"$CLI_BIN" --env "$ONEKEY_E2E_ENV" get-address --format=text

BASE_NOW_MS="${ONEKEY_E2E_FAKE_NOW_MS:-1774630800000}"
for index in 1 2 3 4 5; do
  run_step "sign #$index"
  ONEKEY_CLI_TEST_NOW_MS="$BASE_NOW_MS" \
    "$CLI_BIN" --env "$ONEKEY_E2E_ENV" --json sign \
    --chain "${ONEKEY_E2E_SIGN_CHAIN:-eth}" \
    --address "$ONEKEY_E2E_SIGN_ADDRESS" \
    --path "$ONEKEY_E2E_SIGN_PATH" \
    --pub "$ONEKEY_E2E_SIGN_PUB" \
    --tx "$ONEKEY_E2E_SIGN_TX"
done

run_step "TTL refresh sign"
REFRESH_NOW_MS="$((BASE_NOW_MS + 3600001))"
ONEKEY_CLI_TEST_NOW_MS="$REFRESH_NOW_MS" \
  "$CLI_BIN" --env "$ONEKEY_E2E_ENV" --json sign \
  --chain "${ONEKEY_E2E_SIGN_CHAIN:-eth}" \
  --address "$ONEKEY_E2E_SIGN_ADDRESS" \
  --path "$ONEKEY_E2E_SIGN_PATH" \
  --pub "$ONEKEY_E2E_SIGN_PUB" \
  --tx "$ONEKEY_E2E_SIGN_TX"

run_step "auth logout"
"$CLI_BIN" --env "$ONEKEY_E2E_ENV" --json auth logout

run_step "verify vault file removed"
if [[ -f "$HOME/.onekey-cli/bot-wallet/vault.enc" ]]; then
  die "vault.enc still exists after logout"
fi

run_step "audit persistence fields"
bash "$CLI_DIR/scripts/audit-persistence-fields.sh"

run_step "done"
