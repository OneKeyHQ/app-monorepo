#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE="$SCRIPT_DIR/_shared/common.md"
SKILLS=(swap wallet market security)

for skill in "${SKILLS[@]}"; do
  target_dir="$SCRIPT_DIR/$skill/references"
  mkdir -p "$target_dir"
  cp "$SOURCE" "$target_dir/common.md"
done
