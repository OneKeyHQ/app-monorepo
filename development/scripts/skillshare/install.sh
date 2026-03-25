#!/bin/sh
# ============================================================================
# Skillshare Installer & Upgrader for macOS / Linux
#
# Usage:
#   ./install-skillshare.sh            # Install or upgrade to latest
#   ./install-skillshare.sh v0.17.0    # Install or upgrade to specific version
#
# This script:
#   1. Detects OS and architecture
#   2. Checks if skillshare is already installed
#   3. Installs or upgrades to the requested (or latest) version
#   4. Verifies the installation
# ============================================================================
set -e

REPO="runkids/skillshare"
BINARY_NAME="skillshare"
INSTALL_DIR="/usr/local/bin"
REQUESTED_VERSION="${1:-}"

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { printf "${GREEN}%s${NC}\n" "$1"; }
warn()  { printf "${YELLOW}%s${NC}\n" "$1"; }
error() { printf "${RED}%s${NC}\n" "$1" >&2; exit 1; }
step()  { printf "${CYAN}=> %s${NC}\n" "$1"; }

# ---------------------------------------------------------------------------
# Detect OS
# ---------------------------------------------------------------------------
detect_os() {
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  case "$OS" in
    darwin) OS="darwin" ;;
    linux)  OS="linux" ;;
    mingw*|msys*|cygwin*)
      error "Windows detected. Please run install-skillshare.ps1 instead." ;;
    *)
      error "Unsupported OS: $OS" ;;
  esac
}

# ---------------------------------------------------------------------------
# Detect architecture
# ---------------------------------------------------------------------------
detect_arch() {
  ARCH=$(uname -m)
  case "$ARCH" in
    x86_64|amd64)   ARCH="amd64" ;;
    arm64|aarch64)   ARCH="arm64" ;;
    *)               error "Unsupported architecture: $ARCH" ;;
  esac
}

# ---------------------------------------------------------------------------
# Get latest version tag from GitHub (avoids API rate limits)
# ---------------------------------------------------------------------------
get_latest_version() {
  LATEST=$(curl -sI "https://github.com/${REPO}/releases/latest" \
    | grep -i "^location:" \
    | sed 's/.*tag\/\([^[:space:]]*\).*/\1/' \
    | tr -d '\r')

  if [ -z "$LATEST" ]; then
    LATEST=$(curl -sL "https://api.github.com/repos/${REPO}/releases/latest" \
      | grep '"tag_name"' | cut -d'"' -f4)
  fi

  if [ -z "$LATEST" ]; then
    error "Failed to get latest version. Check your internet connection."
  fi
}

# ---------------------------------------------------------------------------
# Resolve the target version (user-specified or latest)
# ---------------------------------------------------------------------------
resolve_version() {
  if [ -n "$REQUESTED_VERSION" ]; then
    # Ensure the version starts with 'v'
    case "$REQUESTED_VERSION" in
      v*) LATEST="$REQUESTED_VERSION" ;;
      *)  LATEST="v${REQUESTED_VERSION}" ;;
    esac
    step "Target version: $LATEST (user-specified)"
  else
    step "Fetching latest version..."
    get_latest_version
    step "Target version: $LATEST"
  fi
  VERSION=${LATEST#v}
}

# ---------------------------------------------------------------------------
# Check current installation
# ---------------------------------------------------------------------------
check_current() {
  if command -v "$BINARY_NAME" >/dev/null 2>&1; then
    CURRENT_VERSION=$("$BINARY_NAME" version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || echo "")
    if [ -n "$CURRENT_VERSION" ]; then
      info "Current installed version: v${CURRENT_VERSION}"
      if [ "$CURRENT_VERSION" = "$VERSION" ]; then
        info "skillshare is already at version v${VERSION}. Nothing to do."
        exit 0
      fi
      step "Upgrading from v${CURRENT_VERSION} to v${VERSION}..."
      IS_UPGRADE=true
    else
      IS_UPGRADE=false
    fi
  else
    IS_UPGRADE=false
    step "No existing installation found. Installing fresh..."
  fi
}

# ---------------------------------------------------------------------------
# Download and install
# ---------------------------------------------------------------------------
install() {
  URL="https://github.com/${REPO}/releases/download/${LATEST}/${BINARY_NAME}_${VERSION}_${OS}_${ARCH}.tar.gz"
  step "Downloading ${BINARY_NAME} v${VERSION} for ${OS}/${ARCH}..."

  TMP_DIR=$(mktemp -d)
  trap "rm -rf '$TMP_DIR'" EXIT

  HTTP_CODE=$(curl -sL -w "%{http_code}" -o "$TMP_DIR/archive.tar.gz" "$URL")

  if [ "$HTTP_CODE" != "200" ]; then
    error "Download failed (HTTP $HTTP_CODE). URL: $URL"
  fi

  tar xzf "$TMP_DIR/archive.tar.gz" -C "$TMP_DIR" 2>/dev/null \
    || error "Failed to extract archive."

  if [ ! -f "$TMP_DIR/$BINARY_NAME" ]; then
    error "Binary not found in archive."
  fi

  if [ -w "$INSTALL_DIR" ]; then
    mv "$TMP_DIR/$BINARY_NAME" "$INSTALL_DIR/"
  else
    warn "Need sudo to install to $INSTALL_DIR"
    sudo mv "$TMP_DIR/$BINARY_NAME" "$INSTALL_DIR/"
  fi

  chmod +x "$INSTALL_DIR/$BINARY_NAME"
}

# ---------------------------------------------------------------------------
# Verify
# ---------------------------------------------------------------------------
verify() {
  echo ""
  if command -v "$BINARY_NAME" >/dev/null 2>&1; then
    if [ "$IS_UPGRADE" = true ]; then
      info "Successfully upgraded skillshare to v${VERSION}!"
    else
      info "Successfully installed skillshare v${VERSION}!"
    fi
    echo ""
    "$BINARY_NAME" version
    echo ""
    info "Get started:"
    info "  skillshare init"
    info "  skillshare --help"
  else
    warn "Installed to $INSTALL_DIR/$BINARY_NAME, but it is not in PATH."
    warn "Add $INSTALL_DIR to your PATH, then run: skillshare init"
  fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  echo ""
  info "=== Skillshare Installer / Upgrader ==="
  echo ""

  detect_os
  detect_arch
  resolve_version
  check_current
  install
  verify
}

main
