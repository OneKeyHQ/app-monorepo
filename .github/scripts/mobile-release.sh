#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PLATFORM="${1:?Expected ios or android}"
case "$PLATFORM" in ios|android) ;; *) echo 'Expected ios or android' >&2; exit 1 ;; esac
cd "$ROOT/apps/mobile"
EAS_CLI="$ROOT/.github/tools/eas-cli/node_modules/eas-cli/bin/run"
[[ -f "$EAS_CLI" ]] || { echo 'Install the locked CI EAS CLI first' >&2; exit 1; }
: "${EXPO_TOKEN:?EXPO_TOKEN is required}"
umask 077

cleanup() {
  if [[ "$PLATFORM" == ios ]]; then
    rm -f AscApiKey.p8 credentials.json ios/certs/dist.p12 \
      ios/certs/profile.mobileprovision ios/certs/serviceextension-profile.mobileprovision \
      ios/certs/appclip-profile.mobileprovision
  fi
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

decode_secret() {
  local name="$1" destination="$2"
  [[ -n "${!name:-}" ]] || { echo "Missing $name" >&2; exit 1; }
  printf '%s' "${!name}" | base64 -d > "$destination"
}

INTERNAL_PROFILE=production
STORE_PROFILE=production-store
if [[ "${ONEKEY_ALLOW_SKIP_GPG_VERIFICATION:-false}" == true ]]; then
  INTERNAL_PROFILE=qa-internal
  STORE_PROFILE=qa-internal-store
fi
PROFILE="$INTERNAL_PROFILE"
if [[ "${IS_WORKFLOW_RUN:-false}" == true ]]; then
  if [[ -n "${WORKFLOW_BUILD_NUMBER:-}" && "$WORKFLOW_BUILD_NUMBER" == 1000* ]]; then
    PROFILE="$INTERNAL_PROFILE"
  else
    PROFILE="$STORE_PROFILE"
  fi
elif [[ "${ENABLE_STARTUP_PROFILE:-false}" == true ]]; then
  PROFILE=qa-internal-startup-profile
fi

if [[ "$PLATFORM" == ios ]]; then
  mkdir -p ios/certs
  decode_secret ASC_API_KEY AscApiKey.p8
  decode_secret CREDENTIALS_JSON credentials.json
  decode_secret DIST_CERT_P12 ios/certs/dist.p12
  if [[ "$PROFILE" == "$STORE_PROFILE" ]]; then
    decode_secret APPSTORE_PROFILE ios/certs/profile.mobileprovision
    decode_secret APPSTORE_SERVICE_EXTENSION_PROFILE ios/certs/serviceextension-profile.mobileprovision
    decode_secret APPSTORE_APP_CLIP_PROFILE ios/certs/appclip-profile.mobileprovision
  else
    decode_secret ADHOC_PROFILE ios/certs/profile.mobileprovision
    decode_secret ADHOC_SERVICE_EXTENSION_PROFILE ios/certs/serviceextension-profile.mobileprovision
    decode_secret ADHOC_APP_CLIP_PROFILE ios/certs/appclip-profile.mobileprovision
  fi
  python3 <<'PY'
import json

path = 'credentials.json'
with open(path, encoding='utf-8') as file:
    credentials = json.load(file)
ios = credentials.get('ios')
wallet = ios.get('OneKeyWallet') if isinstance(ios, dict) else None
certificate = wallet.get('distributionCertificate') if isinstance(wallet, dict) else None
if not isinstance(certificate, dict):
    raise RuntimeError('Missing OneKeyWallet distribution certificate')
ios['OneKeyAppClip'] = {
    'distributionCertificate': certificate,
    'provisioningProfilePath': 'ios/certs/appclip-profile.mobileprovision',
}
with open(path, 'w', encoding='utf-8') as file:
    json.dump(credentials, file)
PY
fi

# Do not pass the base64 signing inputs to EAS or its subprocesses.
unset ASC_API_KEY CREDENTIALS_JSON DIST_CERT_P12 ADHOC_PROFILE \
  ADHOC_SERVICE_EXTENSION_PROFILE ADHOC_APP_CLIP_PROFILE APPSTORE_PROFILE \
  APPSTORE_SERVICE_EXTENSION_PROFILE APPSTORE_APP_CLIP_PROFILE

ARGS=(build --platform "$PLATFORM" --non-interactive --no-wait)
if [[ "$PLATFORM" == android ]]; then
  ARGS+=(--resource-class large)
  if [[ "$PROFILE" == "$STORE_PROFILE" ]]; then
    node "$EAS_CLI" "${ARGS[@]}" --profile="$INTERNAL_PROFILE"
  fi
fi
if [[ "$PROFILE" == "$STORE_PROFILE" ]]; then
  ARGS+=(--auto-submit)
fi
node "$EAS_CLI" "${ARGS[@]}" --profile="$PROFILE"
