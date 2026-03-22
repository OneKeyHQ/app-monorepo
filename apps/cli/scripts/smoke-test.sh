#!/usr/bin/env bash
#
# Smoke test for OneKey CLI — run after every build.
# Exit code 0 = all checks passed, non-zero = failure.
#
# Usage:
#   ./scripts/smoke-test.sh            # uses .env.test for mnemonic
#   TEST_MNEMONIC="..." ./scripts/smoke-test.sh  # override mnemonic
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI_DIR="$(dirname "$SCRIPT_DIR")"
BIN="${CLI_DIR}/bin/onekey"
ENV_FILE="${CLI_DIR}/.env.test"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

pass=0
fail=0

check() {
  local name="$1"
  shift
  if "$@" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} ${name}"
    pass=$((pass + 1))
  else
    echo -e "  ${RED}✗${NC} ${name}"
    fail=$((fail + 1))
  fi
}

check_json() {
  local name="$1"
  local expected_status="$2"
  shift 2
  local output
  output=$("$@" 2>/dev/null) || true
  local status
  status=$(echo "$output" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ "$status" = "$expected_status" ]; then
    echo -e "  ${GREEN}✓${NC} ${name}"
    pass=$((pass + 1))
  else
    echo -e "  ${RED}✗${NC} ${name} (expected status=${expected_status}, got=${status:-empty})"
    echo -e "     output: ${output:0:200}"
    fail=$((fail + 1))
  fi
}

# ---------------------------------------------------------------------------
# Load mnemonic
# ---------------------------------------------------------------------------
if [ -z "${TEST_MNEMONIC:-}" ]; then
  if [ -f "$ENV_FILE" ]; then
    TEST_MNEMONIC=$(grep '^TEST_MNEMONIC=' "$ENV_FILE" | cut -d'=' -f2-)
  fi
fi

if [ -z "${TEST_MNEMONIC:-}" ]; then
  echo -e "${RED}ERROR: TEST_MNEMONIC not set and .env.test not found${NC}"
  exit 1
fi

# ---------------------------------------------------------------------------
# Build check
# ---------------------------------------------------------------------------
echo ""
echo "=== Smoke Test: OneKey CLI ==="
echo ""

if [ ! -f "${CLI_DIR}/dist/cli.js" ]; then
  echo -e "${YELLOW}Building CLI...${NC}"
  (cd "$CLI_DIR" && npx tsup 2>/dev/null)
fi

# ---------------------------------------------------------------------------
# 1. Basic commands
# ---------------------------------------------------------------------------
echo "--- Basic commands ---"
check "version" "$BIN" version
check "version --json" "$BIN" --json version
check "version --quiet" "$BIN" --quiet version
check "help" "$BIN" --help
check "status" "$BIN" --json --env test status

# ---------------------------------------------------------------------------
# 2. Wallet lifecycle
# ---------------------------------------------------------------------------
echo ""
echo "--- Wallet lifecycle ---"

# Clean state
"$BIN" --json --env test logout > /dev/null 2>&1 || true

# Import and capture wallet address for self-transfer
IMPORT_OUTPUT=$(sh -c "echo '${TEST_MNEMONIC}' | ${BIN} --json --env test import --mnemonic --force" 2>/dev/null)
IMPORT_STATUS=$(echo "$IMPORT_OUTPUT" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
WALLET_ADDR=$(echo "$IMPORT_OUTPUT" | grep -o '"address":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ "$IMPORT_STATUS" = "success" ] && [ -n "$WALLET_ADDR" ]; then
  echo -e "  ${GREEN}✓${NC} import --mnemonic (${WALLET_ADDR})"
  pass=$((pass + 1))
else
  echo -e "  ${RED}✗${NC} import --mnemonic"
  fail=$((fail + 1))
fi

# Balance (Sepolia)
check_json "balance --chain sepolia" "success" \
  "$BIN" --json --env test balance --chain sepolia

# Balance (ETH mainnet)
check_json "balance --chain eth" "success" \
  "$BIN" --json --env test balance --chain eth

# ---------------------------------------------------------------------------
# 3. Transfer validation — self-transfer, tiny amount
# ---------------------------------------------------------------------------
echo ""
echo "--- Transfer validation ---"

# Dry-run self-transfer (may fail with "not enough funds" on unfunded wallet)
DRY_RUN_OUTPUT=$("$BIN" --json --env test transfer \
  --to "$WALLET_ADDR" \
  --amount 0.0001 \
  --chain sepolia \
  --dry-run 2>/dev/null) || true

DRY_RUN_STATUS=$(echo "$DRY_RUN_OUTPUT" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ "$DRY_RUN_STATUS" = "success" ] || echo "$DRY_RUN_OUTPUT" | grep -qi "funds"; then
  echo -e "  ${GREEN}✓${NC} transfer --dry-run self-transfer (status=${DRY_RUN_STATUS})"
  pass=$((pass + 1))
else
  echo -e "  ${RED}✗${NC} transfer --dry-run (unexpected: ${DRY_RUN_OUTPUT:0:200})"
  fail=$((fail + 1))
fi

# Invalid address rejected
check_json "transfer rejects invalid address" "error" \
  "$BIN" --json --env test transfer \
  --to 0xinvalid --amount 0.0001 --chain sepolia --dry-run

# Missing --yes in JSON mode
check_json "transfer requires --yes in JSON mode" "error" \
  "$BIN" --json --env test transfer \
  --to "$WALLET_ADDR" \
  --amount 0.0001 --chain sepolia

# Unsupported chain
check_json "transfer rejects bad chain" "error" \
  "$BIN" --json --env test transfer \
  --to "$WALLET_ADDR" \
  --amount 0.0001 --chain nosuchchain --dry-run

# ---------------------------------------------------------------------------
# 4. Cleanup
# ---------------------------------------------------------------------------
echo ""
echo "--- Cleanup ---"
check_json "logout" "success" "$BIN" --json --env test logout

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
total=$((pass + fail))
echo "=== Results: ${pass}/${total} passed ==="

if [ "$fail" -gt 0 ]; then
  echo -e "${RED}${fail} test(s) failed!${NC}"
  exit 1
else
  echo -e "${GREEN}All smoke tests passed!${NC}"
  exit 0
fi
