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
CLI_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
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

# System prompt: load skill files as context
SYSTEM_PROMPT="You are testing the OneKey CLI. You have access to the onekey CLI at: $CLI_DIR/bin/onekey

IMPORTANT RULES:
- Read the skill files FIRST before running any command.
- Skill files are at: $CLI_DIR/skills/
- Read skills/SKILL.md first, then the relevant sub-skill.
- Do NOT use --help to discover commands. The skill files have everything you need.
- Run the actual CLI commands to answer the user's question.
- After running commands, present the results to the user.

CRITICAL: You MUST read the skill files before running any onekey command. Do not guess parameters."

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
  # --cwd points to cli dir so CLAUDE.md is auto-loaded
  set +e
  claude -p "$prompt" \
    --output-format json \
    --max-turns 15 \
    --cwd "$CLI_DIR" \
    $MODEL_FLAG \
    > "$RESULT_FILE" 2>"$RESULTS_DIR/$case_id.stderr"
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
echo "  claude -p \"Read all JSON files in $RESULTS_DIR/ and the test case definitions in $CASES_FILE. For each test case, check: (1) Did the agent read skill files before running commands? (2) Did it run the expected commands from the 'expect' field? (3) Did it avoid forbidden patterns? Output a markdown table with columns: case_id, status (PASS/FAIL), expected_command, actual_commands, issues.\""
