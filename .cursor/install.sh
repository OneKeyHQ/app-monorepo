#!/usr/bin/env bash
set -euo pipefail

# Idempotent Cloud Agent bootstrap for the OneKey app-monorepo.
# Runs after the repository is checked out. Safe to run repeatedly.

export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# rsync is required by apps/web-embed/postbuild.sh, which the yarn postinstall
# hook invokes to sync the web-embed build into the mobile asset folders.
# The default base image does not ship rsync, so install it once.
if ! command -v rsync >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq --no-install-recommends rsync
fi

# Activate the repository-pinned Yarn (yarnPath in .yarnrc.yml) without prompts.
corepack enable >/dev/null 2>&1 || true

# Install workspace dependencies and run the repo postinstall (patches +
# injected-code generation + web-embed build).
yarn install
