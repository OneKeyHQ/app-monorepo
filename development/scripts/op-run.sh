#!/bin/bash
set -e

VAULT_NAME="ENV-BIG-FE-APP-MONOREPO-DEV"

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

# Find a valid OneKey account by checking email domain (@onekey.so)
# Using email is more reliable than account URL which can be modified locally
ACCOUNT_JSON=$(op account list --format=json | jq -r '.[] | select(.email | test("@onekey\\.so$"))')

if [ -z "$ACCOUNT_JSON" ]; then
    echo "Error: No 1Password account found with @onekey.so email."
    echo "Please sign in with your OneKey 1Password account first:"
    echo "  op signin"
    exit 1
fi

# Extract account details (use account_uuid as stable identifier)
ACCOUNT=$(echo "$ACCOUNT_JSON" | jq -r '.account_uuid')
ACCOUNT_EMAIL=$(echo "$ACCOUNT_JSON" | jq -r '.email')
ACCOUNT_URL=$(echo "$ACCOUNT_JSON" | jq -r '.url')

echo "Using 1Password account: $ACCOUNT_EMAIL ($ACCOUNT_URL)"

# Check if vault exists in the specified account
if ! op vault get "$VAULT_NAME" --account="$ACCOUNT" &> /dev/null; then
    echo "Error: Vault '$VAULT_NAME' not found in account '$ACCOUNT_EMAIL'."
    echo "Please create the vault in 1Password first."
    exit 1
fi

echo "Loading environment variables from 1Password vault: $VAULT_NAME"

# Get all item titles from the vault (null-delimited for safe parsing)
while IFS= read -r -d '' item; do
    # Sanitize title: replace spaces/hyphens with underscores, remove invalid chars
    sanitized=$(echo "$item" | tr ' -' '__' | tr -cd 'A-Za-z0-9_')

    # Skip if sanitized name is empty
    [ -z "$sanitized" ] && continue

    # Get the password field value
    value=$(op item get "$item" --vault="$VAULT_NAME" --account="$ACCOUNT" --fields=password --reveal 2>/dev/null) || continue

    # Skip if value is empty
    [ -z "$value" ] && continue

    export "$sanitized=$value"
    if [ "$sanitized" != "$item" ]; then
        echo "  Loaded: $item -> $sanitized"
    else
        echo "  Loaded: $sanitized"
    fi
done < <(op item list --vault="$VAULT_NAME" --account="$ACCOUNT" --format=json | jq -j '.[].title + "\u0000"')

echo "Environment variables loaded. Starting command..."
echo ""

# Execute the provided command
exec "$@"
