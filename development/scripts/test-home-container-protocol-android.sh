#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$REPO_ROOT/apps/mobile/android"
./gradlew \
  :onekeyhq_native-components:testDebugUnitTest \
  --tests com.margelo.nitro.onekeynativecomponents.HomeContainerProtocolV3Test
