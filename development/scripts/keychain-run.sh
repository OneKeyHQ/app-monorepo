#!/bin/bash
set -e

# Example: add i18n secrets into Keychain (interactive, safer for shell history)
# SERVICE="ENV-BIG-FE-APP-MONOREPO-DEV"
#
# read -rsp "LOKALISE_PROJECT_ID: " V1 && echo
# security add-generic-password -U -a "LOKALISE_PROJECT_ID" -s "$SERVICE" -w "$V1"
#
# read -rsp "LOKALISE_PROJECT_ID_PORTAL: " V2 && echo
# security add-generic-password -U -a "LOKALISE_PROJECT_ID_PORTAL" -s "$SERVICE" -w "$V2"
#
# read -rsp "LOKALISE_TOKEN: " V3 && echo
# security add-generic-password -U -a "LOKALISE_TOKEN" -s "$SERVICE" -w "$V3"
#
# unset V1 V2 V3
#
KEYCHAIN_SERVICE="${KEYCHAIN_SERVICE:-ENV-BIG-FE-APP-MONOREPO-DEV}"
KEYCHAIN_ENV_KEYS="${KEYCHAIN_ENV_KEYS:-}"

if ! command -v security >/dev/null 2>&1; then
  echo "Error: macOS security command not found."
  echo "keychain mode requires macOS Keychain."
  exit 1
fi

discover_env_keys() {
  # Discover all generic-password account names under one service.
  # These account names are used as env variable names.
  security dump-keychain 2>/dev/null | awk -v service="$KEYCHAIN_SERVICE" '
    BEGIN { RS = "keychain: "; FS = "\n" }
    NR > 1 {
      acct = ""
      matched_service = 0
      for (i = 1; i <= NF; i++) {
        if ($i ~ /"acct"<blob>="/) {
          if (match($i, /"acct"<blob>="[^"]+"/)) {
            acct = substr($i, RSTART + 14, RLENGTH - 15)
          }
        }
        if (index($i, "\"svce\"<blob>=\"" service "\"")) {
          matched_service = 1
        }
      }
      if (matched_service && acct != "") {
        print acct
      }
    }
  ' | sort -u
}

if [ -n "$KEYCHAIN_ENV_KEYS" ]; then
  IFS=',' read -r -a ENV_KEYS <<< "$KEYCHAIN_ENV_KEYS"
else
  ENV_KEYS=()
  while IFS= read -r env_key; do
    ENV_KEYS+=("$env_key")
  done < <(discover_env_keys)
  if [ "${#ENV_KEYS[@]}" -eq 0 ]; then
    echo "Error: no Keychain keys found under service '$KEYCHAIN_SERVICE'."
    echo "You can add one with:"
    echo "  security add-generic-password -U -a \"<ENV_KEY>\" -s \"$KEYCHAIN_SERVICE\" -w \"<secret>\""
    echo "Or manually specify keys via KEYCHAIN_ENV_KEYS=KEY1,KEY2"
    exit 1
  fi
fi

for raw_key in "${ENV_KEYS[@]}"; do
  key=$(printf '%s' "$raw_key" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
  [ -z "$key" ] && continue

  # Read secret from Keychain by account (env name) and service
  value=$(security find-generic-password -a "$key" -s "$KEYCHAIN_SERVICE" -w 2>/dev/null || true)

  if [ -z "$value" ]; then
    echo "Error: missing Keychain item for account '$key' in service '$KEYCHAIN_SERVICE'."
    echo "Add it with: security add-generic-password -U -a \"$key\" -s \"$KEYCHAIN_SERVICE\" -w \"<secret>\""
    exit 1
  fi

  export "$key=$value"
  echo "Loaded from Keychain: $key"
done

echo "Environment variables loaded from Keychain. Starting command..."
echo ""

exec "$@"
