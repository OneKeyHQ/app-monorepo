#!/usr/bin/env bash
# Download FridaGadget.dylib for a given version + arch into the target path.
# Tries the official frida-server release first, then frida's gadget release.
#
# Usage:
#   download-gadget.sh <version> <arch> <out-path>
#
# Args:
#   version  e.g. 16.7.19
#   arch     arm64 | arm64e | x86_64
#   out-path destination .dylib path

set -euo pipefail

VERSION="$1"
ARCH="$2"
OUT="$3"

# Frida-gadget naming convention:
#   frida-gadget-<version>-ios-<arch>.dylib.xz  (frida-server releases ship the gadget separately)
# Mirrors:
#   https://github.com/frida/frida/releases/download/<version>/frida-gadget-<version>-ios-<arch>.dylib.xz

URL="https://github.com/frida/frida/releases/download/${VERSION}/frida-gadget-${VERSION}-ios-${ARCH}.dylib.xz"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "==> downloading $(basename "$URL")"
if ! curl --fail --location --silent --show-error --output "${TMP_DIR}/gadget.dylib.xz" "$URL"; then
  echo "download failed: $URL" >&2
  echo "tip: verify the version exists at https://github.com/frida/frida/releases" >&2
  exit 1
fi

xz -d "${TMP_DIR}/gadget.dylib.xz"
mkdir -p "$(dirname "$OUT")"
mv "${TMP_DIR}/gadget.dylib" "$OUT"

echo "==> cached $OUT"
