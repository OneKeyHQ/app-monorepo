# Perf Regression Guard (Detox)

This folder provides a repeatable perf baseline runner for:

- iOS Simulator (Debug / Release)
- Android Emulator (Debug / Release)

High-level flow:

1. App connects to `development/performance-server/` and writes a new perf `sessionId` under `PERF_SESSIONS_DIR`.
2. Detox runs a single Jest file that loops 3 times:
   - launch app (fresh instance)
   - detect the new `sessionId` folder
   - wait for mark `Home:refresh:done:tokens`
3. The job runner derives metrics (`derive-session.js`), aggregates (median by default), checks thresholds, and optionally notifies Slack.

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

1. Create a sessions directory:

```bash
mkdir -p "$HOME/perf-sessions"
```

2. Start performance-server (recommended as a dedicated service):

```bash
yarn perf:server
```

The job runners can auto-start perf-server if it's missing (one-shot mode), but a dedicated server is usually more stable.

3. Prepare a stable app state so app launch reaches Home and emits:

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

# first-visit cold load matrix for entry routes.
# This uses a fresh browser context, disables browser cache, blocks service workers,
# and keeps budget failures non-fatal so it can be used to establish baselines.
yarn perf:web:cold:entries --headed

# CI-style hard gate for all cold entry routes. This is also the default
# scenario set for yarn perf:web:cold. It builds the web bundle, checks the
# startup graph, then checks per-entry cold budgets from
# development/perf-ci/thresholds/web.cold.json.
yarn perf:web:cold

# optional: narrow the cold matrix while investigating
PERF_WEB_COLD_SCENARIOS=perps,swap,defi,refer-friends yarn perf:web:cold --headed

# match the 4-vCPU CI runner on a bigger machine (see "Web cold network fixtures")
PERF_WEB_COLD_HARDWARE_CONCURRENCY=4 yarn perf:web:cold --skip-build
```

#### Web cold network fixtures

`yarn perf:web:cold` does not call live services. Every request that leaves the
local static server is handled by `lib/webColdNetwork.js`:

- API calls are answered from `fixtures/web-cold-api.json`, matched exactly by
  method, host, path, sorted query (minus `timestamp`) and JSON body. Like the
  real API hosts, each answer carries a current `Date` header and
  `Access-Control-Expose-Headers: *`, because the app reads the server time
  from every API response.
- Images get a 1x1 PNG, iframes an empty page, analytics
  (`/utility/v1/track/*`) a success body, and WebSockets an open socket that
  never answers.
- Anything else is aborted and counted as blocked.

Chromium also runs with `--no-proxy-server` and a host resolver rule that fails
every lookup except `127.0.0.1`, so a request the route misses cannot reach a
real host either; it is counted as blocked with reason `not-routed`.

Blocked requests are listed per scenario in the console and in
`scenarios[].blockedRequests` / `runs[].network.blocked` of the report, and
they fail the job (health check `blockedRequests`): a page that ran without
data it asked for may only have measured its shell. Set
`PERF_WEB_COLD_FAIL_ON_BLOCKED_REQUESTS=0` to only report them while
investigating locally. A new entry usually means a page gained an API
dependency or changed a query: re-record (below). A new endpoint or query
parameter has to be reviewed and added to `RECORDABLE_ENDPOINTS` first, and a
new host to `API_HOST_PATTERNS`. Blocked URLs in the report drop query values
and show id-like path segments and query names (addresses, hashes, tokens) as
`:id` / `:param`.

Options:

- `PERF_WEB_COLD_NETWORK=fixtures|record|live` (default `fixtures`). `live`
  restores the old behavior (real APIs, real analytics); use it only for manual
  checks.
- `PERF_WEB_COLD_API_LATENCY_MS` (default `0`): fixed delay before each fixture
  response.
- `PERF_WEB_COLD_FIXTURES_PATH`: use another fixture file.
- `PERF_WEB_COLD_HARDWARE_CONCURRENCY`: overrides `navigator.hardwareConcurrency`.
  Tab preloading follows it, so on an 8+ core machine more chunks load and
  `scriptCount` / `jsDecodedBytes` read higher than on CI. Set `4` to reproduce
  CI numbers.

Re-record the fixtures when an endpoint changes or a scenario starts showing
blocked requests:

```bash
yarn perf:web:cold:record
# when production is not reachable from your network
PERF_WEB_COLD_RECORD_SOURCE=test yarn perf:web:cold:record --skip-build
# one scenario only; entries of the other scenarios are kept
PERF_WEB_COLD_SCENARIOS=perps yarn perf:web:cold:record --skip-build
```

The script runs every scenario twice in record mode, once with the CI device
profile and once with this machine's, holding each page for 20 s so late
requests are captured. API calls are fetched from Node without following
redirects and written back to the fixture file; images, iframes and analytics
are stubbed as above and never recorded. `PERF_WEB_COLD_RECORD_SOURCE=test`
fetches the same paths from `*.onekeytest.com` but keeps the production URL in
the key.

The fixture file is committed to a public repository, so record mode only
forwards endpoints listed in `RECORDABLE_ENDPOINTS` (reviewed as public data),
with only the query parameters and POST bodies listed there (a per-call value
such as the health check's `timestamp` also needs a value pattern), and refuses
requests that carry `Authorization`, `Cookie` or `X-Onekey-Request-Token`.
Any API call that cannot be recorded fails the command and leaves the fixture
file unchanged: a refused request, a data call (XHR/fetch) to a host outside
`API_HOST_PATTERNS`, a non-2xx answer (including an unfollowed redirect), or a
2xx answer that is not JSON (an empty body is accepted only with 204). The
failure log names each request by method, host and path, with the same
placeholders as above and without query values or bodies. Both passes write to a temporary copy that
replaces the file in one rename only when everything was recorded. Still
review the diff before committing.

Budget CI also writes AI-oriented diagnostic artifacts next to the raw reports:

- Web cold: `web-cold-budget-report-ai-hints.json` and `.md`
- Web startup graph: `web-startup-graph-budget-report-ai-hints.json` and `.md`
- Native startup graph: `budget-check-ai-hints-main.*` and `budget-check-ai-hints-background.*`

Use the Markdown file as a compact prompt/context block, and the JSON file for
tooling that needs script/module candidates, failed budget deltas, runtime scope,
small chunks, duplicate script URLs, and package/prefix counts.

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
- recovered runs will send a message after a previous failure/regression
- normal success remains quiet

Set webhook via env:

```bash
SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..." \
yarn perf:ios:release
```

Recommended extra config for readable links:

- `PERF_DASHBOARD_BASE_URL`: a reachable performance-server URL, for example `http://perf-machine:9527`
- `PERF_REPORT_BASE_URL`: a reachable base URL that maps to `PERF_JOB_OUTPUT_ROOT`
- `PERF_ALERT_STATE_ROOT`: where the notifier stores last-alert state (used for recovered notifications and repeat counts)

## Local config file (avoid env vars)

You can create a local config file (gitignored):

- `development/perf-ci/config.local.json`

Example:

```json
{
  "slackWebhookUrl": "https://hooks.slack.com/services/...",
  "sessionsDir": "/Users/<you>/perf-sessions",
  "perfServerUrl": "http://localhost:9527",
  "androidAvdName": "Pixel_7_Pro_API_34",
  "dashboardBaseUrl": "http://perf-machine:9527",
  "reportBaseUrl": "https://perf.example.com/reports",
  "alertStateRoot": "/Users/<you>/perf-alert-state",
  "analyticsUrl": "https://perf-analytics.example.workers.dev",
  "analyticsSecret": "your-secret-here",
  "perfDashboardBaseUrl": "https://perf-dashboard.example.pages.dev"
}
```

## Environment variables / knobs

Core:

- `PERF_SESSIONS_DIR`: where sessions are written/read (default: `$HOME/perf-sessions`)
- `PERF_SERVER_URL`: performance-server URL for health check (default: `http://localhost:9527`)
- `SLACK_WEBHOOK_URL`: optional Slack Incoming Webhook URL
- `PERF_DASHBOARD_BASE_URL`: optional public dashboard base URL used in Slack links
- `PERF_REPORT_BASE_URL`: optional public report base URL used in Slack links
- `PERF_ALERT_STATE_ROOT`: optional directory used to persist last alert state
- `PERF_ANALYTICS_URL`: analytics worker base URL (prefer `config.local.json` → `analyticsUrl`)
- `PERF_ANALYTICS_SECRET`: analytics shared secret (prefer `config.local.json` → `analyticsSecret`)
- `PERF_DASHBOARD_URL`: Cloudflare Pages dashboard base URL for Slack deep links (prefer `config.local.json` → `perfDashboardBaseUrl`)

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
- Web Cold: `development/perf-ci/thresholds/web.cold.json`
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

1. Copy + edit:

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

2. Load / start:

```bash
UID="$(id -u)"

launchctl bootstrap "gui/$UID" "$HOME/Library/LaunchAgents/so.onekey.perf-server.plist"
launchctl enable "gui/$UID/so.onekey.perf-server"
launchctl kickstart -k "gui/$UID/so.onekey.perf-server"

launchctl bootstrap "gui/$UID" "$HOME/Library/LaunchAgents/so.onekey.ios-perf-job.plist"
launchctl enable "gui/$UID/so.onekey.ios-perf-job"
```

3. Inspect:

```bash
UID="$(id -u)"
launchctl print "gui/$UID/so.onekey.perf-server" | head
launchctl print "gui/$UID/so.onekey.ios-perf-job" | head
```

4. Uninstall:

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
