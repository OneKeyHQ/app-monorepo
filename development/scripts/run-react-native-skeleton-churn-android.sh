#!/usr/bin/env bash

set -euo pipefail

readonly MAIN_PACKAGE="so.onekey.app.wallet"
readonly TARGET_PACKAGE="so.onekey.test.skeletonchurn"
readonly TEST_PACKAGE="so.onekey.test.skeletonchurn.test"
readonly INSTRUMENTATION_RUNNER="androidx.test.runner.AndroidJUnitRunner"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
readonly REPO_ROOT
readonly ANDROID_ROOT="$REPO_ROOT/apps/mobile/android"
readonly HARNESS_ROOT="$REPO_ROOT/development/android/react-native-skeleton-churn"
readonly DEVICE_SERIAL="${ANDROID_SERIAL:-${1:-}}"

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

[[ -n "$DEVICE_SERIAL" ]] || fail "Set ANDROID_SERIAL or pass an emulator serial."

ADB="$(command -v adb || true)"
readonly ADB
[[ -n "$ADB" ]] || fail "adb is not available."

readonly SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$(cd "$(dirname "$ADB")/.." && pwd)}}"
readonly APKANALYZER="${APKANALYZER:-$SDK_ROOT/cmdline-tools/latest/bin/apkanalyzer}"
readonly APKSIGNER="${APKSIGNER:-$(find "$SDK_ROOT/build-tools" -type f -name apksigner -perm -111 | sort -V | tail -n 1)}"

[[ -x "$APKANALYZER" ]] || fail "apkanalyzer is not available."
[[ -x "$APKSIGNER" ]] || fail "apksigner is not available."
[[ "$TARGET_PACKAGE" != "$MAIN_PACKAGE" ]] || fail "Harness target must not use the main package ID."
[[ "$TEST_PACKAGE" != "$MAIN_PACKAGE" ]] || fail "Harness test must not use the main package ID."

adb_device() {
  "$ADB" -s "$DEVICE_SERIAL" "$@"
}

package_path() {
  adb_device shell pm path "$1" | tr -d '\r'
}

package_exists() {
  [[ "$(package_path "$1")" == package:* ]]
}

[[ "$(adb_device get-state)" == "device" ]] || fail "Device is not online: $DEVICE_SERIAL"
[[ "$(adb_device shell getprop ro.kernel.qemu | tr -d '\r')" == "1" ]] ||
  fail "The churn harness is restricted to Android emulators."
DEVICE_ABI="$(adb_device shell getprop ro.product.cpu.abi | tr -d '\r')"
readonly DEVICE_ABI
case "$DEVICE_ABI" in
  x86_64 | arm64-v8a) ;;
  *) fail "Unsupported emulator ABI: $DEVICE_ABI" ;;
esac
package_exists "$MAIN_PACKAGE" || fail "The main app must already be installed for before/after snapshots."

if package_exists "$TARGET_PACKAGE" || package_exists "$TEST_PACKAGE"; then
  fail "A Skeleton churn package already exists. Refusing to replace it."
fi

JDK_HOME=""
if [[ -n "${JAVA_HOME:-}" ]]; then
  JDK_HOME="$JAVA_HOME"
elif [[ "$(uname -s)" == "Darwin" ]]; then
  JDK_HOME="$(/usr/libexec/java_home -v 17)"
else
  fail "Set JAVA_HOME to JDK 17."
fi
readonly JDK_HOME

JAVA_HOME="$JDK_HOME" "$ANDROID_ROOT/gradlew" \
  -p "$ANDROID_ROOT" \
  -PincludeSkeletonChurnHarness=true \
  -PreactNativeArchitectures="$DEVICE_ABI" \
  :skeleton-churn-harness:assembleDebug \
  :skeleton-churn-harness:assembleDebugAndroidTest \
  --console=plain

readonly TARGET_APK="$HARNESS_ROOT/build/outputs/apk/debug/skeleton-churn-harness-debug.apk"
readonly TEST_APK="$HARNESS_ROOT/build/outputs/apk/androidTest/debug/skeleton-churn-harness-debug-androidTest.apk"
[[ -f "$TARGET_APK" ]] || fail "Target APK not found: $TARGET_APK"
[[ -f "$TEST_APK" ]] || fail "Instrumentation APK not found: $TEST_APK"

TARGET_APK_PACKAGE="$("$APKANALYZER" manifest application-id "$TARGET_APK")"
TEST_APK_PACKAGE="$("$APKANALYZER" manifest application-id "$TEST_APK")"
readonly TARGET_APK_PACKAGE
readonly TEST_APK_PACKAGE
[[ "$TARGET_APK_PACKAGE" == "$TARGET_PACKAGE" ]] || fail "Unexpected target APK package: $TARGET_APK_PACKAGE"
[[ "$TEST_APK_PACKAGE" == "$TEST_PACKAGE" ]] || fail "Unexpected test APK package: $TEST_APK_PACKAGE"
[[ "$("$APKANALYZER" manifest print "$TEST_APK")" == *"android:targetPackage=\"$TARGET_PACKAGE\""* ]] ||
  fail "Instrumentation APK does not target the isolated harness."

package_exists "$TARGET_PACKAGE" && fail "Harness target appeared before installation."
package_exists "$TEST_PACKAGE" && fail "Harness test appeared before installation."

RUN_DATE="$(date +%Y%m%d)"
RUN_TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
readonly RUN_DATE
readonly RUN_TIMESTAMP
readonly OUTPUT_ROOT="$REPO_ROOT/.tmp/ui/android-native-home-$RUN_DATE/skeleton-churn-$RUN_TIMESTAMP"
mkdir -p "$OUTPUT_ROOT"

snapshot_main_app() {
  local label="$1"
  local path_output
  local base_apk
  local data_size

  path_output="$(package_path "$MAIN_PACKAGE")"
  base_apk="$(printf '%s\n' "$path_output" | sed -n 's/^package://p' | head -n 1)"
  [[ -n "$base_apk" ]] || fail "Unable to locate the main APK for $label snapshot."

  if data_size="$(adb_device shell run-as "$MAIN_PACKAGE" du -sk . 2>&1 | tr -d '\r')"; then
    printf '%s\n' "$data_size" >"$OUTPUT_ROOT/main-data-size-$label.txt"
  else
    printf 'UNAVAILABLE: %s\n' "$data_size" >"$OUTPUT_ROOT/main-data-size-$label.txt"
  fi

  adb_device pull "$base_apk" "$OUTPUT_ROOT/main-$label.apk" >/dev/null
  "$APKSIGNER" verify --print-certs "$OUTPUT_ROOT/main-$label.apk" \
    >"$OUTPUT_ROOT/main-signature-$label.txt"
  shasum -a 256 "$OUTPUT_ROOT/main-$label.apk" | awk '{print $1}' \
    >"$OUTPUT_ROOT/main-apk-sha256-$label.txt"
}

snapshot_main_app before

target_install_status=1
test_install_status=1
instrumentation_status=1
set +e
adb_device install --no-streaming "$TARGET_APK"
target_install_status=$?
if [[ "$target_install_status" -eq 0 ]]; then
  adb_device install --no-streaming -t "$TEST_APK"
  test_install_status=$?
fi
if [[ "$target_install_status" -eq 0 && "$test_install_status" -eq 0 ]]; then
  adb_device shell am instrument -w -r \
    "$TEST_PACKAGE/$INSTRUMENTATION_RUNNER" | tee "$OUTPUT_ROOT/instrumentation.txt"
  instrumentation_status=${PIPESTATUS[0]}
fi
set -e

snapshot_main_app after

cmp -s "$OUTPUT_ROOT/main-signature-before.txt" "$OUTPUT_ROOT/main-signature-after.txt" ||
  fail "The main app signing certificate changed."
cmp -s "$OUTPUT_ROOT/main-apk-sha256-before.txt" "$OUTPUT_ROOT/main-apk-sha256-after.txt" ||
  fail "The main APK changed."

printf 'Main data size before: %s\n' "$(cat "$OUTPUT_ROOT/main-data-size-before.txt")"
printf 'Main data size after:  %s\n' "$(cat "$OUTPUT_ROOT/main-data-size-after.txt")"
printf 'Evidence: %s\n' "$OUTPUT_ROOT"

[[ "$target_install_status" -eq 0 ]] || fail "Harness target installation failed."
[[ "$test_install_status" -eq 0 ]] || fail "Harness instrumentation installation failed."
[[ "$instrumentation_status" -eq 0 ]] || fail "Skeleton churn instrumentation failed."
