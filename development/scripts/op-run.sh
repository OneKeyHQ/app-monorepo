#!/bin/bash
set -e

VAULT_NAME="ENV-BIG-FE-APP-MONOREPO-DEV"
ACCOUNT="onekey-safe.1password.com"  # 1Password account URL (run `op account list` to verify)

# Check if 1Password CLI is installed
if ! command -v op &> /dev/null; then
    echo "Error: 1Password CLI is not installed."
    echo "Install with: brew install 1password-cli"
    echo "Then enable CLI integration in 1Password > Settings > Developer"
    exit 1
fi

# Check if jq is installed (required for JSON parsing)
if ! command -v jq &> /dev/null; then
    echo "Error: jq is not installed."
    echo "Install with: brew install jq"
    exit 1
fi

# Check if 1Password desktop app is unlocked
if ! op account list &> /dev/null; then
    echo "Error: Cannot access 1Password."
    echo "Please unlock your 1Password desktop app and try again."
    exit 1
fi

# Check if vault exists in the specified account
if ! op vault get "$VAULT_NAME" --account="$ACCOUNT" &> /dev/null; then
    echo "Error: Vault '$VAULT_NAME' not found in account '$ACCOUNT'."
    echo "Please create the vault in 1Password first."
    exit 1
fi

echo "Loading environment variables from 1Password vault: $VAULT_NAME (account: $ACCOUNT)"

# Get all item titles from the vault
items=$(op item list --vault="$VAULT_NAME" --account="$ACCOUNT" --format=json | jq -r '.[].title')

# Export each item's password as an environment variable
for item in $items; do
    value=$(op item get "$item" --vault="$VAULT_NAME" --account="$ACCOUNT" --fields=password --reveal 2>/dev/null) || continue
    export "$item=$value"
    echo "  Loaded: $item"
done

echo "Environment variables loaded. Starting command..."
echo ""

# Execute the provided command
exec "$@"
