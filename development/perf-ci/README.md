# Perf Regression Guard (Detox)

This folder provides a repeatable perf baseline runner for:

- iOS Simulator (Debug / Release)
- Android Emulator (Debug / Release)

High-level flow:

1) App connects to `development/performance-server/` and writes a new perf `sessionId` under `PERF_SESSIONS_DIR`.
2) Detox runs a single Jest file that loops 3 times:
   - launch app (fresh instance)
   - detect the new `sessionId` folder
   - wait for mark `Home:refresh:done:tokens`
3) The job runner derives metrics (`derive-session.js`), aggregates (median by default), checks thresholds, and optionally notifies Slack.

## Outputs

Perf sessions (raw):

- default: `$HOME/perf-sessions/<sessionId>/...`
- configured by perf-server env `PERF_OUTPUT_DIR` (defaults to `$HOME/perf-sessions`)

Perf sessions overview index (one JSON per finished session; written by perf-server on WS close):

- `$HOME/perf-sessions/sessions.overview.jsonl`

Job artifacts (runs + derived + report):

- default: `development/perf-ci/output/<jobId>/`
- override via `PERF_JOB_OUTPUT_ROOT`

## Prerequisites

Common:

- Node.js 22+ (repo requirement; runners use built-in `fetch`)
- Repo dependencies installed (`yarn install` at repo root)

iOS:

- macOS + Xcode + iOS Simulator
- CocoaPods (`pod`)
- `applesimutils` (Detox iOS dependency):

```bash
brew tap wix/brew
brew install applesimutils
```

Android:

- Android Studio installed
- Android SDK Platform-Tools (`adb`) and Emulator (`emulator`) available
- At least one AVD created (Android Studio -> Device Manager)

Android Detox dependency note:

- Do NOT use a dynamic Gradle version like `com.wix:detox:+` (non-reproducible, supply-chain risk).
- Keep `apps/mobile/android/app/build.gradle` pinned to an exact Detox AAR version, and keep it aligned with the JS `detox` version in `apps/mobile/package.json`.

Note: no need to `npm install detox-cli --global` (we use the repo dependency).

## One-time setup (per perf machine)

1) Create a sessions directory:

```bash
mkdir -p "$HOME/perf-sessions"
```

2) Start performance-server (recommended as a dedicated service):

```bash
yarn perf:server
```

The job runners can auto-start perf-server if it's missing (one-shot mode), but a dedicated server is usually more stable.

3) Prepare a stable app state so app launch reaches Home and emits:

- `Home:refresh:done:tokens`

This state is NOT created by the scripts. You need to prepare it once (login/import wallet/etc).

Recommended:

- iOS: pin to the same simulator UDID (so the prepared state stays intact)
- Android: pin to a specific AVD (so the prepared state stays intact)

iOS note:

- The iOS runner may auto-run `yarn workspace @onekeyhq/mobile ios:pod-install` if it detects Pods are out of sync.

## Run (recommended commands)

From repo root:

iOS:

```bash
yarn perf:ios:debug
yarn perf:ios:release
yarn perf:ios:release:daemon --interval-minutes 300
```

Android:

```bash
yarn perf:android:debug
yarn perf:android:release
yarn perf:android:release:daemon --interval-minutes 300
```

Web:

```bash
# one-time: prepare a stable logged-in + wallet state (stored under ~/perf-profiles/web by default)
yarn perf:web:prepare --headed

# run release perf job (3 runs; median aggregation + thresholds)
yarn perf:web:release --headed

# optional: skip build when repeating
PERF_SKIP_BUILD=1 yarn perf:web:release --headed
```

Desktop:

```bash
yarn perf:desktop:release
```

Extension (MV3):

```bash
yarn perf:ext:release
```

You can also run scripts directly:

```bash
node development/perf-ci/run-ios-perf-detox-debug.js
node development/perf-ci/run-ios-perf-detox-release.js
node development/perf-ci/run-ios-perf-detox-release-daemon.js --interval-minutes 300

node development/perf-ci/run-android-perf-detox-debug.js
node development/perf-ci/run-android-perf-detox-release.js
node development/perf-ci/run-android-perf-detox-release-daemon.js --interval-minutes 300
```

Notes:

- Release runs do NOT start Metro (embedded bundle).
- Debug runs start Metro and do a one-time bundle warmup before the first run to avoid “Could not connect to development server”.
- By default the runners use `detox test --reuse --cleanup`. You can pass through:
  - `--no-reuse` (don’t reuse device state)
  - `--no-cleanup` (don’t cleanup after test)
  - `--headless` (recommended for scheduled runs; Android also uses this to start the emulator with `-no-window`)

Heads-up:

- Debug runners will try to free Metro port `8081` (kill the current listener) to make startup deterministic.

## Device selection

iOS:

- Recommended: pin simulator UDID

```bash
DETOX_DEVICE_UDID="218B05AF-8053-44EE-9D6C-7F4F48630591" \
yarn perf:ios:release
```

Android:

- Recommended: pin AVD name (especially if you have multiple)

```bash
DETOX_ANDROID_AVD_NAME="Pixel_7_Pro_API_34" \
yarn perf:android:release
```

If no emulator device is currently online (`adb devices` is empty), the Android runner will auto-start the emulator.
If you pass `--headless`, it will start the emulator with `-no-window`.

Advanced (rare):

- `PERF_SKIP_INSTALL_APP=1`: skip `device.installApp()` in the Jest test. Use only if you know the currently-installed app is Detox-enabled.

## Slack notifications

Slack is optional. If configured:

- failures will send a message
- regressions will send a message
- normal success does NOT send a message

Set webhook via env:

```bash
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..." \
yarn perf:ios:release
```

## Local config file (avoid env vars)

You can create a local config file (gitignored):

- `development/perf-ci/config.local.json`

Example:

```json
{
  "slackWebhookUrl": "https://hooks.slack.com/services/...",
  "sessionsDir": "/Users/<you>/perf-sessions",
  "perfServerUrl": "http://localhost:9527",
  "androidAvdName": "Pixel_7_Pro_API_34"
}
```

## Environment variables / knobs

Core:

- `PERF_SESSIONS_DIR`: where sessions are written/read (default: `$HOME/perf-sessions`)
- `PERF_SERVER_URL`: performance-server URL for health check (default: `http://localhost:9527`)
- `SLACK_WEBHOOK_URL`: optional Slack Incoming Webhook URL

Note:

- The app connects to perf-server via WebSocket (iOS uses `ws://localhost:9527`, Android emulator uses `ws://10.0.2.2:9527` by default).
- The runners use `PERF_SERVER_URL` (HTTP) only for `/api/health` checks and for starting/stopping the server process.

Server management:

- `PERF_SERVER_AUTOSTART`: set to `0` to disable auto-start and require an already-running perf-server
- `PERF_SERVER_ONESHOT`: set to `1` to stop perf-server after the job (default for one-shot scripts; daemon sets it to `0`)

Android emulator management:

- `DETOX_ANDROID_AVD_NAME`: pin AVD
- `PERF_ANDROID_EMULATOR_ONESHOT`: set to `1` to auto-kill the emulator after a run (default: keep it running)

Metro warmup:

- `METRO_URL` (default: `http://localhost:8081`)
- `METRO_BUNDLE_WARMUP_TIMEOUT_MS` (default: 5 minutes)

Timeouts (ms):

- `PERF_LAUNCH_TIMEOUT_MS`
- `PERF_MARK_TIMEOUT_MS`
- `PERF_SESSION_TIMEOUT_MS`
- `DETOX_TIMEOUT_MS`
- `DETOX_BUILD_TIMEOUT_MS`
- `PERF_TEST_TIMEOUT_MS`

## Thresholds

Files:

- iOS Debug: `development/perf-ci/thresholds/ios.debug.json`
- iOS Release: `development/perf-ci/thresholds/ios.release.json`
- Android Debug: `development/perf-ci/thresholds/android.debug.json`
- Android Release: `development/perf-ci/thresholds/android.release.json`
- Web Release: `development/perf-ci/thresholds/web.release.json`
- Desktop Release: `development/perf-ci/thresholds/desktop.release.json`
- Ext Release: `development/perf-ci/thresholds/ext.release.json`

If a threshold value is `null`, that metric is not used for regression judgement (but still reported).

Metrics:

- `tokensStartMs`: `Home:refresh:start:tokens` mark timestamp (ms since session start)
- `tokensSpanMs`: `Home:refresh:done:tokens - Home:refresh:start:tokens` (ms)
- `functionCallCount`: number of events in `function_call.log`

Strategies:

- `median` (default): alert if median > threshold
- `two_of_three`: alert if >= 2/3 runs > threshold

## Scheduling (launchd)

See `development/perf-ci/launchd/` for example plists:

- `perf-server.plist`: keep performance-server running
- `ios-perf-job.plist`: schedule the iOS perf job multiple times per day

These plists are templates only. Scripts do not auto-install them.

Use LaunchAgents (per-user) so the job runs in your logged-in GUI session (required for iOS Simulator).

Android scheduling:

- You can copy `ios-perf-job.plist` and replace the ProgramArguments with `yarn perf:android:release --headless`.
- Android emulator can run headless (`--headless`), so it can be scheduled similarly; pin `DETOX_ANDROID_AVD_NAME` for stability.

### Install to launchd (manual)

1) Copy + edit:

```bash
mkdir -p "$HOME/Library/LaunchAgents" "$HOME/perf-logs" "$HOME/perf-sessions"

cp development/perf-ci/launchd/perf-server.plist \
  "$HOME/Library/LaunchAgents/so.onekey.perf-server.plist"

cp development/perf-ci/launchd/ios-perf-job.plist \
  "$HOME/Library/LaunchAgents/so.onekey.ios-perf-job.plist"
```

Replace in the copied plist(s):

- `__REPO_ROOT__` with your repo root
- `__HOME_DIR__` with your home dir (or use absolute paths you prefer)

2) Load / start:

```bash
UID="$(id -u)"

launchctl bootstrap "gui/$UID" "$HOME/Library/LaunchAgents/so.onekey.perf-server.plist"
launchctl enable "gui/$UID/so.onekey.perf-server"
launchctl kickstart -k "gui/$UID/so.onekey.perf-server"

launchctl bootstrap "gui/$UID" "$HOME/Library/LaunchAgents/so.onekey.ios-perf-job.plist"
launchctl enable "gui/$UID/so.onekey.ios-perf-job"
```

3) Inspect:

```bash
UID="$(id -u)"
launchctl print "gui/$UID/so.onekey.perf-server" | head
launchctl print "gui/$UID/so.onekey.ios-perf-job" | head
```

4) Uninstall:

```bash
UID="$(id -u)"
launchctl bootout "gui/$UID" "$HOME/Library/LaunchAgents/so.onekey.ios-perf-job.plist"
launchctl bootout "gui/$UID" "$HOME/Library/LaunchAgents/so.onekey.perf-server.plist"
```

## Fresh machine checklist (macOS)

After cloning the repo:

```bash
# repo root
yarn install

mkdir -p "$HOME/perf-sessions"
```

iOS:

```bash
brew tap wix/brew
brew install applesimutils

# optional: start server in a separate terminal/service
yarn perf:server

# first run (Release is usually more stable because it doesn't depend on Metro)
yarn perf:ios:release
```

Android:

```bash
# make sure adb/emulator exist and an AVD is created
adb version
emulator -list-avds

# optional: start server in a separate terminal/service
yarn perf:server

yarn perf:android:release
```

## After pulling latest code

- Always run `yarn install` if `yarn.lock` changed.
- iOS: if `apps/mobile/ios/Podfile.lock` changed, run `yarn workspace @onekeyhq/mobile ios:pod-install`
- Re-verify your pinned device still exists (iOS Simulator UDID / Android AVD) and your prepared app state still works.
