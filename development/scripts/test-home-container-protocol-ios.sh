#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

xcrun swiftc \
  "$REPO_ROOT/packages/native-components/ios/HomeContainerModels.swift" \
  "$REPO_ROOT/packages/native-components/tests/ios/HomeContainerStateContract.swift" \
  -o "$TEMP_DIR/home-container-state"

STATE_JSON="$(<"$REPO_ROOT/packages/native-components/tests/fixtures/home-container.state.json")"

"$TEMP_DIR/home-container-state" "$STATE_JSON"
