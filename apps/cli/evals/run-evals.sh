#!/bin/bash
#
# OneKey CLI Skill Eval Runner
#
# Usage:
#   ./run-evals.sh                     # Run all cases with default model
#   ./run-evals.sh --model haiku       # Run with specific model
#   ./run-evals.sh --case trending     # Run cases matching pattern
#   ./run-evals.sh --model sonnet --case swap  # Combine filters
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CLI_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CASES_FILE="$SCRIPT_DIR/cases.json"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
MODEL=""
CASE_FILTER=""

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    --model) MODEL="$2"; shift 2 ;;
    --case)  CASE_FILTER="$2"; shift 2 ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

MODEL_LABEL="${MODEL:-default}"
RESULTS_DIR="$SCRIPT_DIR/results/${TIMESTAMP}-${MODEL_LABEL}"
mkdir -p "$RESULTS_DIR"

# Build model flag
MODEL_FLAG=""
if [[ -n "$MODEL" ]]; then
  MODEL_FLAG="--model $MODEL"
fi

# Count cases
if [[ -n "$CASE_FILTER" ]]; then
  TOTAL=$(jq "[.[] | select(.id | contains(\"$CASE_FILTER\"))] | length" "$CASES_FILE")
else
  TOTAL=$(jq 'length' "$CASES_FILE")
fi

echo "=== OneKey CLI Skill Eval ==="
echo "Model:   $MODEL_LABEL"
echo "Cases:   $TOTAL"
echo "Results: $RESULTS_DIR"
echo ""

# System prompt: point agents to the external skill repo plus schema discovery
SYSTEM_PROMPT="You are testing the OneKey CLI. You have access to the onekey CLI at: $CLI_DIR/bin/onekey

IMPORTANT RULES:
- Read the CLI skill guidance FIRST before running any command.
- CLI skills live in the external repo: https://github.com/OneKeyHQ/onekey-wallet-skills
- Install commands for Claude are: /plugin marketplace add OneKeyHQ/onekey-wallet-skills and /plugin install onekey-wallet-skills
- Use 'onekey schema <cmd>' or 'onekey schema --list' to discover exact command signatures.
- Do NOT use --help to discover commands.
- Run the actual CLI commands to answer the user's question.
- After running commands, present the results to the user.

EVAL MODE — CRITICAL RULES:
- The CLI is already installed and up-to-date. SKIP all pre-flight checks (onekey version, npm view, version comparison). Go straight to the actual command.
- NEVER ask clarifying questions. You are in non-interactive eval mode with no user to respond.
- When information is missing (e.g. no chain specified), follow the installed skill guidance. If the skill says to search first, run a search command (e.g. onekey token search) to resolve the chain before proceeding. Only default to 'eth' for native ETH operations (balance, transfer) where chain is unambiguous.
- Token symbols should be UPPERCASE (ETH, USDC, PEPE, CAKE), not lowercase.
- For batch price queries (onekey market prices), if you only have token symbols, first use 'onekey token search' to resolve contract addresses, then build the --tokens parameter in 'chain:address' format.
- Execute ALL commands needed for the task. Do not stop after one command if the task requires multiple steps (e.g. due diligence requires info + price + trades + liquidity).
- If a command fails, continue with the remaining commands rather than stopping.
- For swap flows: user confirmation is AUTO-GRANTED in eval mode. Do NOT pause to ask the user to confirm. Proceed through the entire flow (balance → security audit → quote → build → execute → status) without stopping.
- If a CLI command fails with an API error, do NOT retry more than once. Report the error and continue to the next step or finish.

CRITICAL: You MUST read the skill guidance before running any onekey command. Do not guess parameters."

RUN_INDEX=0
PASS=0
FAIL=0

# Iterate cases
jq -c '.[]' "$CASES_FILE" | while IFS= read -r case_json; do
  case_id=$(echo "$case_json" | jq -r '.id')

  # Apply filter
  if [[ -n "$CASE_FILTER" ]] && [[ "$case_id" != *"$CASE_FILTER"* ]]; then
    continue
  fi

  RUN_INDEX=$((RUN_INDEX + 1))
  prompt=$(echo "$case_json" | jq -r '.prompt')

  echo "[$RUN_INDEX/$TOTAL] $case_id"
  echo "  Prompt: $prompt"

  RESULT_FILE="$RESULTS_DIR/$case_id.json"

  # Run claude in headless mode
  # --output-format json gives us structured output with all tool calls
  # --max-turns limits to prevent infinite loops
  # cd to cli dir so CLAUDE.md is auto-loaded
  set +e
  (cd "$CLI_DIR" && claude -p "$prompt" \
    --output-format json \
    --max-turns 25 \
    --permission-mode bypassPermissions \
    --system-prompt "$SYSTEM_PROMPT" \
    $MODEL_FLAG \
    < /dev/null \
    > "$RESULT_FILE" 2>"$RESULTS_DIR/$case_id.stderr")
  EXIT_CODE=$?
  set -e

  if [[ $EXIT_CODE -ne 0 ]]; then
    echo "  Status: ERROR (exit $EXIT_CODE)"
    # Save error info
    jq -n \
      --arg id "$case_id" \
      --arg prompt "$prompt" \
      --arg error "$(cat "$RESULTS_DIR/$case_id.stderr")" \
      --argjson exit_code "$EXIT_CODE" \
      '{id: $id, prompt: $prompt, status: "error", exit_code: $exit_code, error: $error}' \
      > "$RESULT_FILE"
  else
    echo "  Status: COMPLETED"
  fi

  echo ""
done

# Generate summary
echo "=== Results saved to $RESULTS_DIR ==="
echo ""
echo "To analyze results, run:"
echo "  claude -p \"Read all JSON files in $RESULTS_DIR/ and the test case definitions in $CASES_FILE. For each test case, check: (1) Did the agent read the CLI skill guidance before running commands? (2) Did it run the expected commands from the 'expect' field? (3) Did it avoid forbidden patterns? Output a markdown table with columns: case_id, status (PASS/FAIL), expected_command, actual_commands, issues.\""
