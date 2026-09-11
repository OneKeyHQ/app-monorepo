#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPOSITORY_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../../.." && pwd)
OUTPUT_PATH="$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH/sentry.options.json"

read_env_value() {
  file_path="$1"
  if [ ! -f "$file_path" ]; then
    return
  fi
  /usr/bin/awk '
    /^[[:space:]]*(export[[:space:]]+)?SENTRY_DSN_REACT_NATIVE[[:space:]]*=/ {
      sub(/^[^=]*=[[:space:]]*/, "")
      sub(/\r$/, "")
      if (($0 ~ /^".*"$/) || ($0 ~ /^\047.*\047$/)) {
        $0 = substr($0, 2, length($0) - 2)
      }
      print
      exit
    }
  ' "$file_path"
}

SENTRY_DSN_VALUE=${SENTRY_DSN_REACT_NATIVE:-}
for env_file in "$REPOSITORY_ROOT/.env" "$REPOSITORY_ROOT/.env.expo"; do
  env_value=$(read_env_value "$env_file")
  if [ -n "$env_value" ]; then
    SENTRY_DSN_VALUE=$env_value
  fi
done

/bin/rm -f "$OUTPUT_PATH"
/bin/mkdir -p "$(dirname "$OUTPUT_PATH")"
if [ -z "$SENTRY_DSN_VALUE" ]; then
  case "${CONFIGURATION:-}" in
    *Release*)
      echo "error: SENTRY_DSN_REACT_NATIVE is required for release builds" >&2
      exit 1
      ;;
  esac
  exit 0
fi

/usr/bin/plutil -create xml1 "$OUTPUT_PATH"
/usr/bin/plutil -insert dsn -string "$SENTRY_DSN_VALUE" "$OUTPUT_PATH"
/usr/bin/plutil -convert json "$OUTPUT_PATH"
