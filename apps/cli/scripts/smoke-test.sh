#!/usr/bin/env bash
#
# Smoke test for OneKey CLI — run after every build.
# Exit code 0 = all checks passed, non-zero = failure.
#
# Usage:
#   ./scripts/smoke-test.sh            # uses .env.test for mnemonic
#   ./scripts/smoke-test.sh --section token  # run only token section
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
skip=0

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

skip() {
  local name="$1"
  echo -e "  ${YELLOW}⊘${NC} ${name} (skip)"
  skip=$((skip + 1))
}

# ---------------------------------------------------------------------------
# --section parameter
# ---------------------------------------------------------------------------
SECTION="${1:-all}"
case "$SECTION" in
  --section)
    SECTION="${2:-all}"
    ;;
esac
case "$SECTION" in
  basic|wallet|transfer|token|market|swap|security|history|cleanup|all) ;;
  *) echo -e "${RED}ERROR: Unknown section: $SECTION${NC}"; exit 1 ;;
esac

should_run() {
  [ "$SECTION" = "all" ] || [ "$SECTION" = "$1" ]
}

# ---------------------------------------------------------------------------
# Load mnemonic (only needed for wallet/transfer/cleanup/all)
# ---------------------------------------------------------------------------
if should_run wallet || should_run transfer || should_run cleanup; then
  if [ -z "${TEST_MNEMONIC:-}" ]; then
    if [ -f "$ENV_FILE" ]; then
      TEST_MNEMONIC=$(grep '^TEST_MNEMONIC=' "$ENV_FILE" | cut -d'=' -f2-)
    fi
  fi

  if [ -z "${TEST_MNEMONIC:-}" ]; then
    echo -e "${RED}ERROR: TEST_MNEMONIC not set and .env.test not found${NC}"
    exit 1
  fi
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
# Section 1: Basic commands
# ---------------------------------------------------------------------------
section_basic() {
  echo "--- Basic commands ---"
  check "version" "$BIN" version
  check "version --json" "$BIN" --json version
  check "version --quiet" "$BIN" --quiet version
  check "help" "$BIN" --help
  check "status" "$BIN" --json --env test status
}
should_run basic && section_basic

# ---------------------------------------------------------------------------
# Section 2: Wallet lifecycle
# ---------------------------------------------------------------------------
section_wallet() {
  echo ""
  echo "--- Wallet lifecycle ---"

  # Clean state
  "$BIN" --json --env test logout > /dev/null 2>&1 || true

  # Import and capture wallet address for self-transfer
  # Use here-string so mnemonic is passed via stdin and never appears in any process argv
  IMPORT_OUTPUT=$("${BIN}" --json --env test import --mnemonic --force <<< "${TEST_MNEMONIC}" 2>/dev/null)
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
}
should_run wallet && section_wallet

# ---------------------------------------------------------------------------
# Section 3: Transfer validation — self-transfer, tiny amount
# ---------------------------------------------------------------------------
section_transfer() {
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
}
should_run transfer && section_transfer

# ---------------------------------------------------------------------------
# Section 5: Token commands (all skip — enabled as Epic 1 progresses)
# ---------------------------------------------------------------------------
section_token() {
  echo ""
  echo "--- Token commands ---"
  check_json "token search --query USDC" "success" \
    "$BIN" --json --env test token search --query USDC
  check_json "token info --chain eth --token USDC" "success" \
    "$BIN" --json --env test token info --chain eth \
    --token 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
  check_json "token price --chain eth --token USDC" "success" \
    "$BIN" --json --env test token price --chain eth \
    --token 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
  check_json "token trending" "success" \
    "$BIN" --json --env test token trending
  check_json "token trades --chain eth --token USDC" "success" \
    "$BIN" --json --env test token trades --chain eth \
    --token 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
  check_json "token liquidity --chain eth --token WBTC" "success" \
    "$BIN" --json --env test token liquidity --chain eth \
    --token 0x2260fac5e5542a773aa44fbcfedf7c193bc2c599
}
should_run token && section_token

# ---------------------------------------------------------------------------
# Section 6: Market commands (all skip)
# ---------------------------------------------------------------------------
section_market() {
  echo ""
  echo "--- Market commands ---"
  check_json "market price --chain eth --token USDC" "success" \
    "$BIN" --json --env test market price --chain eth \
    --token 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48
  check_json "market prices (batch)" "success" \
    "$BIN" --json --env test market prices \
    --tokens "eth:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48,base:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"
  check_json "market kline --chain eth --token USDC" "success" \
    "$BIN" --json --env test market kline --chain eth \
    --token 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 --interval 1H --limit 6
}
should_run market && section_market

# ---------------------------------------------------------------------------
# Section 7: Swap commands (all skip)
# ---------------------------------------------------------------------------
section_swap() {
  echo ""
  echo "--- Swap commands ---"

  # Swap quote depends on external swap API which may return 500.
  # Accept either success or a structured API error as "working".
  local sq_output
  sq_output=$("$BIN" --json --env test swap quote --chain eth \
    --from 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 \
    --to 0xdac17f958d2ee523a2206206994597c13d831ec7 \
    --amount 10 2>/dev/null) || true
  local sq_status
  sq_status=$(echo "$sq_output" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ "$sq_status" = "success" ] || [ "$sq_status" = "error" ]; then
    echo -e "  ${GREEN}✓${NC} swap quote USDC→USDT on eth (status=${sq_status})"
    pass=$((pass + 1))
  else
    echo -e "  ${RED}✗${NC} swap quote USDC→USDT on eth (expected valid JSON, got=${sq_status:-empty})"
    echo -e "     output: ${sq_output:0:200}"
    fail=$((fail + 1))
  fi

  # Swap build depends on external swap API + wallet being imported.
  # Accept either success or a structured API error as "working".
  local sb_output
  sb_output=$("$BIN" --json --env test swap build --chain eth \
    --from 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 \
    --to 0xdac17f958d2ee523a2206206994597c13d831ec7 \
    --amount 1 --provider "Swap1inch" --force 2>/dev/null) || true
  local sb_status
  sb_status=$(echo "$sb_output" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ "$sb_status" = "success" ] || [ "$sb_status" = "error" ]; then
    echo -e "  ${GREEN}✓${NC} swap build USDC→USDT on eth (status=${sb_status})"
    pass=$((pass + 1))
  else
    echo -e "  ${RED}✗${NC} swap build USDC→USDT on eth (expected valid JSON, got=${sb_status:-empty})"
    echo -e "     output: ${sb_output:0:200}"
    fail=$((fail + 1))
  fi
  # Swap execute: conditional on build success (needs wallet + funds)
  if [ "$sb_status" = "success" ]; then
    local sb_orderId
    sb_orderId=$(echo "$sb_output" | grep -o '"orderId":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ -n "$sb_orderId" ]; then
      local se_output
      se_output=$("$BIN" --json --env test --yes swap execute --chain eth \
        --order "$sb_orderId" 2>/dev/null) || true
      local se_status
      se_status=$(echo "$se_output" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
      if [ "$se_status" = "success" ] || [ "$se_status" = "error" ]; then
        echo -e "  ${GREEN}✓${NC} swap execute on eth (status=${se_status})"
        pass=$((pass + 1))
      else
        echo -e "  ${RED}✗${NC} swap execute on eth (expected valid JSON, got=${se_status:-empty})"
        echo -e "     output: ${se_output:0:200}"
        fail=$((fail + 1))
      fi
    else
      skip "swap execute (no orderId in build output)"
    fi
  else
    skip "swap execute (build failed)"
  fi
  # Swap status: conditional on execute success (needs txHash)
  if [ "${se_status:-}" = "success" ] && [ -n "${sb_orderId:-}" ]; then
    local ss_output
    ss_output=$("$BIN" --json --env test swap status --chain eth \
      --order "$sb_orderId" 2>/dev/null) || true
    local ss_status
    ss_status=$(echo "$ss_output" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
    if [ "$ss_status" = "success" ] || [ "$ss_status" = "error" ]; then
      echo -e "  ${GREEN}✓${NC} swap status on eth (status=${ss_status})"
      pass=$((pass + 1))
    else
      echo -e "  ${RED}✗${NC} swap status on eth (expected valid JSON, got=${ss_status:-empty})"
      echo -e "     output: ${ss_output:0:200}"
      fail=$((fail + 1))
    fi
  else
    skip "swap status (execute failed or skipped)"
  fi
}
should_run swap && section_swap

# ---------------------------------------------------------------------------
# Section 8: Security commands (all skip)
# ---------------------------------------------------------------------------
section_security() {
  echo ""
  echo "--- Security commands ---"
  check_json "security audit --chain eth --token USDT" "success" \
    "$BIN" --json --env test security audit --chain eth \
    --token 0xdac17f958d2ee523a2206206994597c13d831ec7
  check_json "security simulate" "success" \
    "$BIN" --json --env test security simulate --chain eth \
    --to 0xdac17f958d2ee523a2206206994597c13d831ec7 \
    --data 0xa9059cbb0000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000a
}
should_run security && section_security

# ---------------------------------------------------------------------------
# Section 9: History command
# ---------------------------------------------------------------------------
section_history() {
  echo ""
  echo "--- History command ---"
  check_json "history" "success" \
    "$BIN" --json --env test history
  check_json "history --limit 5" "success" \
    "$BIN" --json --env test history --limit 5
}
should_run history && section_history

# ---------------------------------------------------------------------------
# Section 4: Cleanup
# ---------------------------------------------------------------------------
section_cleanup() {
  echo ""
  echo "--- Cleanup ---"
  check_json "logout" "success" "$BIN" --json --env test logout
}
should_run cleanup && section_cleanup

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
total=$((pass + fail))
echo "=== Results: ${pass}/${total} passed, ${skip} skipped ==="

if [ "$fail" -gt 0 ]; then
  echo -e "${RED}${fail} test(s) failed!${NC}"
  exit 1
else
  echo -e "${GREEN}All smoke tests passed!${NC}"
  exit 0
fi
