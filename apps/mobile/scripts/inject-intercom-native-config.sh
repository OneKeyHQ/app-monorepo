#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPOSITORY_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../../.." && pwd)
OUTPUT_PATH="$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH/OneKeyIntercomConfiguration.plist"

# Read only the iOS SDK key. Never source .env or print its contents.
read_env_value() {
  if [ ! -f "$1" ]; then
    return
  fi
  /usr/bin/awk '
    /^[[:space:]]*(export[[:space:]]+)?INTERCOM_IOS_API_KEY[[:space:]]*=/ {
      sub(/^[^=]*=[[:space:]]*/, "")
      sub(/\r$/, "")
      if (($0 ~ /^".*"$/) || ($0 ~ /^\047.*\047$/)) {
        $0 = substr($0, 2, length($0) - 2)
      }
      print
      exit
    }
  ' "$1"
}

INTERCOM_KEY_VALUE=${INTERCOM_IOS_API_KEY:-}
if [ -z "$INTERCOM_KEY_VALUE" ]; then
  for env_file in "$REPOSITORY_ROOT/.env" "$REPOSITORY_ROOT/.env.expo"; do
    env_value=$(read_env_value "$env_file")
    if [ -n "$env_value" ]; then
      INTERCOM_KEY_VALUE=$env_value
    fi
  done
fi

# Clear any value from an earlier incremental build, including missing-key builds.
/bin/mkdir -p "$(dirname "$OUTPUT_PATH")"
/bin/rm -f "$OUTPUT_PATH"
/usr/bin/plutil -create xml1 "$OUTPUT_PATH"
/usr/bin/plutil -insert iosApiKey -string "$INTERCOM_KEY_VALUE" "$OUTPUT_PATH"
