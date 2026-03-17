#!/usr/bin/env bash
# ------------------------------------------------------------------
# check-native-changes.sh
#
# Detect whether a branch/PR contains changes that CANNOT be shipped
# via bundle update and require a full App Shell release.
#
# Usage:
#   ./development/scripts/check-native-changes.sh [base_ref]
#
#   base_ref  The base branch or commit to compare against.
#             Defaults to "origin/x".
#
# Exit codes:
#   0  No native changes detected — safe for bundle update
#   1  Native changes detected — requires App Shell release
#
# Examples:
#   # Check current branch against origin/x
#   ./development/scripts/check-native-changes.sh
#
#   # Check against a specific release tag
#   ./development/scripts/check-native-changes.sh v6.1.0
#
#   # Check a specific PR branch
#   git checkout feat/my-feature
#   ./development/scripts/check-native-changes.sh origin/x
# ------------------------------------------------------------------

set -euo pipefail

BASE_REF="${1:-origin/x}"
HAS_NATIVE_CHANGES=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Get changed files
CHANGED_FILES=$(git diff --name-only "$BASE_REF"...HEAD 2>/dev/null || git diff --name-only "$BASE_REF" HEAD)

if [ -z "$CHANGED_FILES" ]; then
  echo -e "${GREEN}No changes detected.${NC}"
  exit 0
fi

echo -e "${BOLD}============================================${NC}"
echo -e "${BOLD} Bundle Update Compatibility Check${NC}"
echo -e "${BOLD}============================================${NC}"
echo -e "Base: ${CYAN}${BASE_REF}${NC}"
echo -e "Head: ${CYAN}$(git rev-parse --short HEAD)${NC} ($(git branch --show-current 2>/dev/null || echo 'detached'))"
echo ""

# ------------------------------------------------------------------
# Category 1: iOS Native Code
# ------------------------------------------------------------------
IOS_NATIVE=$(echo "$CHANGED_FILES" | grep -E '^apps/mobile/ios/' | grep -vE '\.(ts|tsx|js|jsx|json|md)$' || true)
if [ -n "$IOS_NATIVE" ]; then
  HAS_NATIVE_CHANGES=1
  echo -e "${RED}[BLOCKED] iOS Native Code Changes${NC}"
  echo "$IOS_NATIVE" | sed 's/^/  - /'
  echo ""
fi

# ------------------------------------------------------------------
# Category 2: Android Native Code
# ------------------------------------------------------------------
ANDROID_NATIVE=$(echo "$CHANGED_FILES" | grep -E '^apps/mobile/android/' | grep -vE '\.(ts|tsx|js|jsx|json|md)$' || true)
if [ -n "$ANDROID_NATIVE" ]; then
  HAS_NATIVE_CHANGES=1
  echo -e "${RED}[BLOCKED] Android Native Code Changes${NC}"
  echo "$ANDROID_NATIVE" | sed 's/^/  - /'
  echo ""
fi

# ------------------------------------------------------------------
# Category 3: Electron Main Process Code
# ------------------------------------------------------------------
ELECTRON_MAIN=$(echo "$CHANGED_FILES" | grep -E '^apps/desktop/app/' || true)
if [ -n "$ELECTRON_MAIN" ]; then
  HAS_NATIVE_CHANGES=1
  echo -e "${RED}[BLOCKED] Electron Main Process Changes${NC}"
  echo "$ELECTRON_MAIN" | sed 's/^/  - /'
  echo ""
fi

# ------------------------------------------------------------------
# Category 4: Browser Extension Manifest
# ------------------------------------------------------------------
EXT_MANIFEST=$(echo "$CHANGED_FILES" | grep -E '^apps/ext/.*manifest' || true)
if [ -n "$EXT_MANIFEST" ]; then
  HAS_NATIVE_CHANGES=1
  echo -e "${RED}[BLOCKED] Extension Manifest Changes${NC}"
  echo "$EXT_MANIFEST" | sed 's/^/  - /'
  echo ""
fi

# ------------------------------------------------------------------
# Category 5: Native Dependency Changes (Podfile, build.gradle, etc.)
# ------------------------------------------------------------------
NATIVE_DEPS=$(echo "$CHANGED_FILES" | grep -iE '(Podfile|Podfile\.lock|\.podspec|build\.gradle|settings\.gradle|gradle\.properties|\.pbxproj|Info\.plist|AndroidManifest\.xml|Entitlements)' || true)
if [ -n "$NATIVE_DEPS" ]; then
  HAS_NATIVE_CHANGES=1
  echo -e "${RED}[BLOCKED] Native Dependency / Config Changes${NC}"
  echo "$NATIVE_DEPS" | sed 's/^/  - /'
  echo ""
fi

# ------------------------------------------------------------------
# Category 6: Native RN Module Packages (packages with native code)
# ------------------------------------------------------------------
# Detect changes in packages that contain native bindings
NATIVE_PACKAGES=$(echo "$CHANGED_FILES" | grep -E '\.(java|kt|swift|m|mm|h|c|cpp)$' || true)
if [ -n "$NATIVE_PACKAGES" ]; then
  HAS_NATIVE_CHANGES=1
  echo -e "${RED}[BLOCKED] Native Source Files (.java/.kt/.swift/.m/.h/.cpp)${NC}"
  echo "$NATIVE_PACKAGES" | sed 's/^/  - /'
  echo ""
fi

# ------------------------------------------------------------------
# Category 7: Patch files for native dependencies
# ------------------------------------------------------------------
NATIVE_PATCHES=$(echo "$CHANGED_FILES" | grep -E '^patches/' || true)
if [ -n "$NATIVE_PATCHES" ]; then
  # Check if patch targets a package with native code
  NATIVE_PATCH_HITS=""
  while IFS= read -r patch_file; do
    # Extract package name from patch filename
    # patch-package uses + as separator: @scope+pkg+1.2.3.patch → @scope/pkg
    # unscoped: pkg+1.2.3.patch → pkg
    raw_name=$(echo "$patch_file" | sed 's|^patches/||' | sed 's|\.patch$||')
    if echo "$raw_name" | grep -q '^@'; then
      # Scoped: @scope+pkg+version → replace first + with / then drop +version
      pkg_name=$(echo "$raw_name" | sed 's|+|/|' | sed 's|+.*||')
    else
      # Unscoped: pkg+version → drop +version
      pkg_name=$(echo "$raw_name" | sed 's|+.*||')
    fi
    # Check if this package has native code
    pkg_dir="node_modules/$pkg_name"
    is_native=false
    if [ -d "$pkg_dir" ]; then
      # Check installed package for native code markers
      if [ -d "$pkg_dir/ios" ] || [ -d "$pkg_dir/android" ] || ls "$pkg_dir"/*.podspec 1>/dev/null 2>&1; then
        is_native=true
      fi
    else
      # Fallback: match known native package name patterns when node_modules is absent
      if echo "$pkg_name" | grep -qiE '(react-native|expo[-+]|^expo$|@expo/|@react-native|@onekeyfe.*react-native|hermes|^realm$|^burnt$)'; then
        is_native=true
      fi
    fi
    if [ "$is_native" = true ]; then
      NATIVE_PATCH_HITS="${NATIVE_PATCH_HITS}${patch_file}\n"
    fi
  done <<< "$NATIVE_PATCHES"

  if [ -n "$NATIVE_PATCH_HITS" ]; then
    HAS_NATIVE_CHANGES=1
    echo -e "${RED}[BLOCKED] Patches Targeting Native Packages${NC}"
    echo -e "$NATIVE_PATCH_HITS" | grep -v '^$' | sed 's/^/  - /'
    echo ""
  else
    echo -e "${YELLOW}[WARNING] Patch file changes (verify no native impact)${NC}"
    echo "$NATIVE_PATCHES" | sed 's/^/  - /'
    echo ""
  fi
fi

# ------------------------------------------------------------------
# Category 8: App version changes (package.json version field)
# ------------------------------------------------------------------
VERSION_FILES=$(echo "$CHANGED_FILES" | grep -E '^apps/(mobile|desktop|ext|web)/package\.json$' || true)
if [ -n "$VERSION_FILES" ]; then
  VERSION_CHANGED=0
  while IFS= read -r vfile; do
    OLD_VER=$(git show "$BASE_REF":"$vfile" 2>/dev/null | grep '"version"' | head -1 | sed 's/.*"version".*"\(.*\)".*/\1/' || echo "")
    NEW_VER=$(git show HEAD:"$vfile" 2>/dev/null | grep '"version"' | head -1 | sed 's/.*"version".*"\(.*\)".*/\1/' || echo "")
    if [ -n "$OLD_VER" ] && [ -n "$NEW_VER" ] && [ "$OLD_VER" != "$NEW_VER" ]; then
      VERSION_CHANGED=1
      echo -e "${RED}[BLOCKED] App Version Changed: ${vfile}${NC}"
      echo "  - $OLD_VER → $NEW_VER"
      echo ""
    fi
  done <<< "$VERSION_FILES"
  if [ "$VERSION_CHANGED" -eq 1 ]; then
    HAS_NATIVE_CHANGES=1
  fi
fi

# ------------------------------------------------------------------
# Category 9: yarn.lock changes involving native packages
# ------------------------------------------------------------------
YARN_LOCK_CHANGED=$(echo "$CHANGED_FILES" | grep -E '^yarn\.lock$' || true)
if [ -n "$YARN_LOCK_CHANGED" ]; then
  # Get the diff of yarn.lock and look for known native packages
  NATIVE_PKG_PATTERNS='react-native[-@]|@react-native/|@react-native-|@react-native-community/|@onekeyfe/react-native-|@sentry/react-native|@[^/]+/react-native[-@]|[a-z]+-react-native[-@]|expo[-@]|@react-navigation/|lottie-react-native|hermes-engine|realm[-@]|burnt[-@]'
  # Match both key lines ("pkg@...":) and resolution lines (resolution: "pkg@...")
  LOCK_NATIVE_HITS=$(git diff "$BASE_REF"...HEAD -- yarn.lock 2>/dev/null | grep -E "^[+-].*(\"($NATIVE_PKG_PATTERNS))" | head -20 || true)
  if [ -n "$LOCK_NATIVE_HITS" ]; then
    HAS_NATIVE_CHANGES=1
    echo -e "${RED}[BLOCKED] yarn.lock: Native Package Version Changes${NC}"
    echo "$LOCK_NATIVE_HITS" | sed 's/^/  /' | head -10
    if [ "$(echo "$LOCK_NATIVE_HITS" | wc -l)" -gt 10 ]; then
      echo "  ... and more"
    fi
    echo ""
  fi
fi

# ------------------------------------------------------------------
# Category 10: Electron builder / packaging config
# ------------------------------------------------------------------
ELECTRON_BUILD=$(echo "$CHANGED_FILES" | grep -E '^apps/desktop/(electron-builder|forge\.config|package\.json)' || true)
if [ -n "$ELECTRON_BUILD" ]; then
  # package.json version change already covered above, check other config
  ELECTRON_CONFIG=$(echo "$ELECTRON_BUILD" | grep -v 'package\.json' || true)
  if [ -n "$ELECTRON_CONFIG" ]; then
    HAS_NATIVE_CHANGES=1
    echo -e "${RED}[BLOCKED] Electron Build Config Changes${NC}"
    echo "$ELECTRON_CONFIG" | sed 's/^/  - /'
    echo ""
  fi
fi

# ------------------------------------------------------------------
# Category 11: Database Schema / Version Changes
# ------------------------------------------------------------------
# DB version or schema changes are JS-level but have the same impact
# as native changes: bundle rollback after a DB migration can corrupt
# user data, and old bundles can't read new DB schemas.
DB_SCHEMA_FILES=$(echo "$CHANGED_FILES" | grep -E '^packages/kit-bg/src/dbs/local/(consts\.ts|localDBStoreNames\.ts|types\.ts)$' || true)
DB_REALM_SCHEMAS=$(echo "$CHANGED_FILES" | grep -E '^packages/kit-bg/src/dbs/local/realm/schemas/' || true)
DB_MIGRATION_FILES=$(echo "$CHANGED_FILES" | grep -E '^packages/kit-bg/src/migrations/' || true)
DB_INDEXED_BASE=$(echo "$CHANGED_FILES" | grep -E '^packages/kit-bg/src/dbs/local/indexed/(LocalDbIndexedBase|indexedDBUtils)\.ts$' || true)

DB_ALL_HITS=""
if [ -n "$DB_SCHEMA_FILES" ]; then DB_ALL_HITS="${DB_ALL_HITS}${DB_SCHEMA_FILES}\n"; fi
if [ -n "$DB_REALM_SCHEMAS" ]; then DB_ALL_HITS="${DB_ALL_HITS}${DB_REALM_SCHEMAS}\n"; fi
if [ -n "$DB_MIGRATION_FILES" ]; then DB_ALL_HITS="${DB_ALL_HITS}${DB_MIGRATION_FILES}\n"; fi
if [ -n "$DB_INDEXED_BASE" ]; then DB_ALL_HITS="${DB_ALL_HITS}${DB_INDEXED_BASE}\n"; fi

if [ -n "$DB_ALL_HITS" ]; then
  # Extra check: did LOCAL_DB_VERSION actually change?
  DB_VERSION_CHANGED=0
  DB_CONSTS_FILE="packages/kit-bg/src/dbs/local/consts.ts"
  if echo "$CHANGED_FILES" | grep -q "$DB_CONSTS_FILE"; then
    OLD_DB_VER=$(git show "$BASE_REF":"$DB_CONSTS_FILE" 2>/dev/null | grep -oE 'LOCAL_DB_VERSION\s*=\s*[0-9]+' | grep -oE '[0-9]+' || echo "")
    NEW_DB_VER=$(git show HEAD:"$DB_CONSTS_FILE" 2>/dev/null | grep -oE 'LOCAL_DB_VERSION\s*=\s*[0-9]+' | grep -oE '[0-9]+' || echo "")
    if [ -n "$OLD_DB_VER" ] && [ -n "$NEW_DB_VER" ] && [ "$OLD_DB_VER" != "$NEW_DB_VER" ]; then
      DB_VERSION_CHANGED=1
    fi
  fi

  HAS_NATIVE_CHANGES=1
  if [ "$DB_VERSION_CHANGED" -eq 1 ]; then
    echo -e "${RED}[BLOCKED] Database Version Changed (${OLD_DB_VER} → ${NEW_DB_VER})${NC}"
  else
    echo -e "${RED}[BLOCKED] Database Schema / Migration Changes${NC}"
  fi
  echo -e "$DB_ALL_HITS" | grep -v '^$' | sed 's/^/  - /'
  echo -e "  ${YELLOW}⚠ DB changes prevent bundle rollback — old bundles cannot read new schemas${NC}"
  echo ""
fi

# ------------------------------------------------------------------
# Summary: JS-only changes (safe for bundle update)
# ------------------------------------------------------------------
JS_ONLY=$(echo "$CHANGED_FILES" | grep -E '\.(ts|tsx|js|jsx|json|css|svg|png|jpg|gif|md)$' | grep -vE '^(apps/mobile/(ios|android)/|apps/desktop/app/)' || true)
JS_COUNT=$(echo "$JS_ONLY" | grep -c '.' 2>/dev/null) || JS_COUNT=0
TOTAL_COUNT=$(echo "$CHANGED_FILES" | grep -c '.' 2>/dev/null) || TOTAL_COUNT=0

echo -e "${BOLD}============================================${NC}"
echo -e "${BOLD} Summary${NC}"
echo -e "${BOLD}============================================${NC}"
echo -e "Total files changed: ${TOTAL_COUNT}"
echo -e "JS/TS files (bundle-safe): ${JS_COUNT}"
echo ""

if [ "$HAS_NATIVE_CHANGES" -eq 1 ]; then
  echo -e "${RED}${BOLD}RESULT: NATIVE CHANGES DETECTED${NC}"
  echo -e "${RED}This branch requires a full App Shell release.${NC}"
  echo -e "${RED}Cannot be shipped via bundle update only.${NC}"
  echo ""
  echo -e "${YELLOW}Recommended action:${NC}"
  echo -e "  - Add the ${BOLD}no-release${NC} label to this PR"
  echo -e "  - Plan for App Shell release (iOS/Android/Desktop/Extension build)"
  exit 1
else
  echo -e "${GREEN}${BOLD}RESULT: NO NATIVE CHANGES${NC}"
  echo -e "${GREEN}This branch is safe for bundle update.${NC}"
  echo ""
  echo -e "Recommended action:"
  echo -e "  - Add the ${BOLD}bundle-testing${NC} label for QA verification"
  echo -e "  - After QA passes, change to ${BOLD}release-ready${NC} label"
  exit 0
fi
