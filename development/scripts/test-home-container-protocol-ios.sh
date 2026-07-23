#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TEMP_DIR"' EXIT

xcrun swiftc \
  "$REPO_ROOT/packages/native-components/ios/HomeContainerModels.swift" \
  "$REPO_ROOT/packages/native-components/ios/HomeContainerProtocolV3.swift" \
  "$REPO_ROOT/packages/native-components/tests/ios/HomeContainerProtocolV3Contract.swift" \
  -o "$TEMP_DIR/home-container-protocol-v3"

SNAPSHOT_JSON="$(<"$REPO_ROOT/packages/native-components/tests/fixtures/home-container-v3.snapshot.json")"
PATCH_JSON="$(<"$REPO_ROOT/packages/native-components/tests/fixtures/home-container-v3.patch.json")"

"$TEMP_DIR/home-container-protocol-v3" "$SNAPSHOT_JSON" "$PATCH_JSON"
