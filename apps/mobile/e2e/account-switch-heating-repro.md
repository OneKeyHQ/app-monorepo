# iOS Account Switching: Thermal and Memory Regression Testing

This document describes how to reproduce account switching, collect measurements, assess acceptance, and attribute memory usage. It applies to Release builds on iOS Simulator. Simulator results do not establish thermal acceptance on a physical device. The following checked-in files define the test flow and thresholds; update this document when they change:

- [Business actions and interaction checks](./account-switch-heating-repro.test.js)
- [Host runner, log capture, and acceptance calculations](../../../development/scripts/run-ios-account-switch-heating-repro.js)
- [Regression tests for sampling and acceptance calculations](../../../development/scripts/run-ios-account-switch-heating-repro.node-test.js)
- [Main runtime census and FPS collection](../../../packages/shared/src/performance/collectors/jsBlockCollector.ts)
- [Account-switch diagnostic switch](../../../packages/shared/src/performance/enabled.ts)
- [Detox native memory patch](../../../patches/detox+20.46.3.patch)

## 1. Scope and Required Test State

On iOS, `main` and `bg` are separate JS runtimes. They initialize independently, become ready independently, and do not share heap objects. Data crossing the bridge may be deserialized again by the receiving runtime; the main census does not describe the bg heap. Host `ps` CPU/RSS measurements cover the entire app process, including native resources such as UIKit, images, and shared storage. These resources cannot be attributed directly to main Hermes. Analyze the native UI main thread and the main JS runtime separately.

An AI operator must prepare the environment and test data before starting the runner. Follow Section 2 in order: prepare the build and simulator, request human wallet import, verify the resulting app state, and then run the test. The runner does not import recovery phrases, create missing accounts, or populate Market favorites.

| Item | Required state |
| --- | --- |
| Simulator | A dedicated iOS Simulator with its actual UDID, device model, and OS version recorded |
| OS reference | Previously validated on iOS 26.5; record differences for a new environment |
| Bundle ID | `so.onekey.wallet` |
| Initial wallet / target wallet | Two distinct wallets, identified from the current account selector rather than assumed IDs |
| Initial account | Account index 0 must be accessible; a nonzero initial balance is optional for this configuration |
| Target accounts | At least indices 0–5 must exist and be accessible; account 0 must expose a visible nonzero Home balance and a BSC token row |
| Initial network | BNB Chain / BSC, followed by All Networks at the scheduled point |
| Market data | Required stock rows must open, and Favorites → Crypto must contain a visible token that opens a detail page |
| App state | Onboarding complete, English UI, visible balances, app unlocked, and no blocking prompts |
| Formal workload | Inactive step enabled, 53 actions, immediately followed by 70 seconds idle on Home |
| Acceptance runs | Three consecutive complete runs with the same configuration; report the median and worst values |

Six accessible target accounts are the script's functional minimum, not proof that a new fixture reproduces the original stress level. Use the approved QA wallet fixture with its intended account, token, and network coverage. Record aggregate counts without secret material. A fresh fixture or a different simulator starts a new measurement cohort; do not present it as an identical reproduction of the historical cohort without checking workload comparability.

Do not obtain a pass by reducing accounts, networks, or business actions, extending waits, or relaxing thresholds. After fixing a known test harness issue, run the repaired version directly and preserve the existing baseline without rerunning it. Retain failed attempts too, and report launch attempts, completed runs, and failure stages separately.

## 2. Prepare the Environment Before Starting the Script

Run commands from the repository root and keep the shell variables below in the same shell. These steps are preparation, outside the measured timeline.

### Step 1: Prepare Tools and a Traceable Release Build

Verify Xcode and its selected command-line tools, an available iOS Simulator runtime, the repository's Node/Yarn dependencies, CocoaPods dependencies, Detox, and the UI inspection tool used for preparation. On a fresh checkout, install dependencies with `yarn install --immutable`; use the [mobile dependency guide](../../../.skillshare/skills/1k-dev-commands/references/mobile-dependencies.md) if native dependencies are missing. Confirm that installation applied the repository's Detox patch.

Obtain a Release simulator `.app` for the revision under test, or build one using the current repository configuration. The checked-in simulator build entry point is `yarn workspace @onekeyhq/mobile detox:build:ios:sim:release`; inspect [the build configuration](../.detoxrc.js) and the current branch's native/background bundle setup before using it. Its configured output is `apps/mobile/ios/build/detox/Build/Products/Release-iphonesimulator/OneKeyWallet.app`. A build command returning successfully is not sufficient: verify packaged main/bg bundles, segments, native executable, signing, and build provenance before freezing the artifact.

Save the actual build commit, dirty state, and artifact hashes in `build-manifest.json` when freezing the build, as described under Build and Tool Identity. If an existing artifact has no trustworthy provenance, obtain a traceable build instead of assigning it the current checkout SHA. The manifest is an input to this runner; the runner does not generate build provenance.

Formal runs do not depend on Metro; the runner sets `PERF_USE_METRO=0`. Use a Release simulator app with embedded bundles, the census, raw FPS samples, and RPC/network logging. A Debug DevSession or a device-only IPA does not meet these prerequisites.

#### Enable Account-Switch Diagnostics Before Building

Account-switch diagnostics are **off by default**, including in Detox Release builds. Before producing the regression artifact, temporarily change this one constant in [performance/enabled.ts](../../../packages/shared/src/performance/enabled.ts):

```ts
const ACCOUNT_SWITCH_DIAGNOSTICS_ENABLED = true;
```

This enables the runtime health census (JS blocking, available Hermes allocation/GC counters, and additional process samples), raw main-runtime FPS windows, incoming background-message counts/sizes, and Home token refresh/dispatch traces. When disabled, the census does not install timers or visibility/account-switch listeners, bridge statistics do not accumulate, and Home diagnostic payloads are not built or logged. Business request generations, cancellation, and dispatch remain active regardless of the switch.

Rebuild and package **both main and background JS bundles** with that source change. iOS runtimes have separate module instances; editing the checkout or setting a host environment variable after the build cannot enable an installed bundle. Record the enabled source diff/dirty state together with the artifact hashes in the build manifest or linked build receipt. For a Debug-only investigation, restart Metro and reload both runtimes after changing the constant; formal acceptance still requires the frozen Release artifact.

`PERF_MONITOR_ENABLED=1` remains the independent switch for the existing performance-server tooling, and the Release Detox build configuration already sets it. It does **not** enable these account-switch diagnostics by itself. The existing `react-native-perf-stats` CPU/RSS/UI FPS/JS FPS sampler and its overlay controls are unchanged; this source switch neither starts nor stops that sampler.

Before the formal run, confirm that the installed build produces `runtimeHealthCensus` with `fpsSamplingAvailable: 1` and populated `fpsSamples`, `mainInboundCensus` when bridge traffic exists, and `homeTokenListRefreshTrace` during a Home refresh. Missing diagnostics mean preparation is incomplete; the presence of the native FPS overlay alone is insufficient. Keep the switch enabled for all three runs in the same cohort, then restore it to `false` before committing or producing a normal release. A measured artifact keeps its embedded setting even after the source is restored.

Set the paths, then build the Detox framework before preparing the test data:

```bash
HEATING_APP_PATH='/absolute/path/to/OneKeyWallet.app'
HEATING_BUILD_MANIFEST='/absolute/path/to/build-manifest.json'
node node_modules/detox/local-cli/cli.js build-framework-cache --detox
```

### Step 2: Select or Provision a Dedicated Simulator and Install the App

Discover available devices and runtimes rather than copying a historical UDID:

```bash
xcrun simctl list devices available
xcrun simctl list runtimes
```

For continued work on the original machine, reuse the historical simulator listed in Section 7 and preserve its data. For a fresh environment, provision a dedicated simulator using an installed runtime and device type, following the workspace's isolation and storage rules. In an external-drive worktree, keep simulator user data on that drive alongside the worktree. Verify that normal `xcrun simctl` commands can resolve the resulting UDID: the current runner does not accept a custom device-set path.

Copy the selected device's actual UDID into the variable below. If it is shut down, run the boot command; if it is already booted, skip that command. Wait for boot completion before installing:

```bash
HEATING_UDID='<actual simulator UDID>'
xcrun simctl boot "$HEATING_UDID"
xcrun simctl bootstatus "$HEATING_UDID" -b
xcrun simctl install "$HEATING_UDID" "$HEATING_APP_PATH"
xcrun simctl launch "$HEATING_UDID" so.onekey.wallet
```

If replacing a running installation, terminate only this target app first. Do not erase the simulator or uninstall the app to refresh a build. Open the selected simulator for the human operator. Resolve launch failures before asking for wallet import; a startup crash is a preparation failure, not an account-switch measurement.

### Step 3: Ask the Human to Import the QA Wallet

On an empty installation, complete non-secret onboarding and navigate to the wallet import entry point. Before the recovery phrase screen, stop UI snapshots, screen recording, and automated interaction. Ask the human to enter the approved QA recovery phrase directly in the app and handle any password or unlock steps. Never ask them to paste a recovery phrase into chat, a shell, a fixture, or a log, and do not read their clipboard.

Suggested request to the human:

> The test app is ready on the selected simulator. Please import the approved QA recovery phrase directly in the app, complete any password or unlock prompts, and return to Wallet Home. Use the test wallet with the intended account/network history and a nonzero balance on target account 0. We also need a distinct initial wallet with account 0 available; an existing test wallet can serve that role. Please reply when you are back on Home. Do not send the recovery phrase or password in this conversation.

Wait for the human's completion message before resuming inspection, and verify that no recovery phrase or password screen remains open. If both wallets already exist and the human confirms that they are the intended QA fixtures, verify and reuse them without reimporting. Importing a recovery phrase alone may not add all indexed accounts to the selector; continue with Step 4 before starting the runner.

### Step 4: Prepare Accounts, Networks, and Market State

Use the current app's visible controls and semantic IDs. Complete the following outside formal sampling:

1. **Identify both wallets.** Open the account selector and inspect the wallet-row `testID`s, which have the form `wallet-<walletId>`. Map the human-selected target wallet and a different initial wallet to their actual IDs. Strip only the `wallet-` prefix when setting runner arguments. Wallet IDs are assigned locally; do not assume the old `hd-7` / `hd-8` mapping, display names, or row order. Record only the selector IDs needed for the run, without dumping full account trees.
2. **Make the target accounts available.** Verify every `account-item-index-0` through `account-item-index-5` in the target wallet. If an index is missing, add/discover the corresponding account through the normal account-management UI using the imported fixture. Preserve any additional accounts required by the stress scenario. Verify that the initial wallet has account 0. Do not substitute a smaller workload or skip unavailable indices.
3. **Verify balances and network state.** On target account 0, unhide the balance and confirm a nonzero `home-total-balance`. Use English UI and a currency format supported by the current balance check, such as USD. Select BNB Chain / BSC and verify the single-network trigger plus a `home-token-item-evm--56-*` row, with no active All Networks trigger. Confirm that All Networks can be selected and that the intended networks are available, then restore BSC. If the fixture cannot meet these requirements, ask the human for the appropriate QA fixture; do not disable the balance check or initiate a funding transaction.
4. **Prepare Market.** Confirm that Trade, Perps, Discover, and Market are accessible. Verify stock rows for AAPL, GOOGL, GOOG, MSFT, AMZN, TSM, META, and VOO and that their detail pages open. In Favorites → Crypto, add a supported test token through the UI if the list is empty, and verify that the first visible token opens and returns to the watchlist. Record which favorite was used and keep it consistent across the cohort. The script opens stocks from the stock list; they do not all need to be favorites.
5. **Resolve first-use state.** Complete introductory dialogs, permissions, and supported simulator authentication prompts outside the measured flow. Ask the human to handle secret entry if needed. Verify app/backend connectivity, visible balances, and Home readiness after a normal restart. Return to Wallet Home with no modal, import page, or keyboard open.

Set IDs from these observations, without the `wallet-` prefix:

```bash
HEATING_INITIAL_WALLET_ID='<observed initial wallet ID>'
HEATING_TARGET_WALLET_ID='<observed target wallet ID>'
HEATING_UI_SESSION='heating-regression-sim'
```

### Step 5: Check Readiness and Bind the UI Session

Before invoking the runner, save a short, non-secret preparation receipt outside the future run directory. Record the selected UDID/model/runtime, build/manifest paths, observed wallet IDs, account-index availability, aggregate fixture coverage, BSC and balance checks, Market favorite, stock availability, and human import completion. Record missing prerequisites as preparation failures and resolve them before running.

The script's `prepareInitialState()` rechecks target account access and balance, selects BSC, and returns to initial account 0. It does not replace the human import, account creation, language setup, or Market preparation above. Do not fabricate `prepared.json` or `collector-ready.json`; the script and runner create those handshake files themselves.

End diagnostic sessions for the target process and verify that it has not inherited settings such as `MallocStackLogging`. Do not run `heap`, `leaks`, or `malloc_history` during formal sampling. If the UIKit hittable-area fallback is needed, bind the installed `agent-device` tool to the same simulator:

```bash
agent-device open so.onekey.wallet --platform ios \
  --udid "$HEATING_UDID" \
  --session "$HEATING_UI_SESSION" --session-lock reject --json
```

### Step 6: Run and Review Three Complete Iterations

Start only after all readiness checks pass. Each attempt must use a new output directory; never overwrite a failed attempt. Reuse the variables established above:

```bash
HEATING_RUN_DIR="$(pwd)/development/output/perf-sessions/account-switch-heating/$(date +%Y%m%d-%H%M%S)-r1"

env -u SIMCTL_CHILD_MallocStackLogging \
  -u SIMCTL_CHILD_MallocStackLoggingNoCompact \
  -u MallocStackLogging -u MallocStackLoggingNoCompact \
  HEATING_REPRO_NATIVE_UI_SESSION="$HEATING_UI_SESSION" \
  node development/scripts/run-ios-account-switch-heating-repro.js \
    --udid "$HEATING_UDID" \
    --app-path "$HEATING_APP_PATH" \
    --build-manifest "$HEATING_BUILD_MANIFEST" \
    --initial-wallet-id "$HEATING_INITIAL_WALLET_ID" \
    --target-wallet-id "$HEATING_TARGET_WALLET_ID" \
    --include-inactive-step \
    --output-dir "$HEATING_RUN_DIR"
```

Set `HEATING_REPRO_NATIVE_UI_SESSION` only after binding that session. Omit it if the UIKit fallback is not needed. Do not use `--skip-recording`, `--allow-unfunded-target`, or wallet fallback options for formal acceptance. The target balance check is enabled by default; this configuration does not require a nonzero initial wallet balance.

Review `summary.json`, the successful action count, video/log completeness, immediate idle duration, and timeline drift after each attempt. Stop and investigate an incomplete flow or capture before continuing. Once the setup is stable, obtain three consecutive complete runs, using a new directory and iteration label each time, and aggregate the metrics defined below. A measured performance FAIL still belongs in the report; do not discard a slow run to improve the cohort. Do not infer acceptance solely from the process exit code: the runner can exit successfully while performance acceptance is FAIL.

### Build and Tool Identity

The runner records the current checkout SHA, the installed `main.jsbundle` SHA, and the build SHA from the manifest. The manifest requires at least the actual 40-character `buildCommitSha` and a `mainBundleSha256` matching the installed bundle. An omitted manifest produces `UNMEASURED`; a supplied manifest with missing or mismatched fields produces `FAIL`. Do not use the current checkout SHA as the build SHA of an older app.

For a complete comparison, also record and verify `background.bundle`, `common.bundle`, `module-id-map.json`, the native executable, main/bg segment file trees, e2e and host runner SHAs, the Detox framework binary SHA, the patch SHA, and OS/Xcode versions. The host runner currently checks only the main bundle against the manifest automatically. Record the remaining checks separately rather than claiming full automatic verification.

Keep the app, scripts, framework, simulator data, and sampling configuration identical within a cohort. When test tools change, the results compare tool revisions and cannot be attributed directly to product code optimization.

## 3. Timeline and Interaction Verification

Preparation is outside the formal workload: launch and wait for Home, verify that target accounts 0–5 are accessible, check the balance, confirm BSC single-network mode, then return to account 0 of the initial wallet and stop the app. Formal timing starts only after the collectors are ready.

| Planned time | Business actions |
| --- | --- |
| 0–7 seconds | Cold launch, open the account selector, switch to target wallet account 0, return Home |
| 10–39 seconds | Trade / Discover Market; browse AAPL, GOOGL, GOOG, MSFT, and AMZN |
| 41–45 seconds | Home; switch BSC accounts 0 → 1 → 2 |
| 48–71 seconds | Trade, Perps, Market; browse GOOG, TSM, GOOG, and META |
| 72–73 seconds | Send the app to the system Home screen and resume; these are two actions, not an additional 72-second idle period |
| 74–93 seconds | Switch BSC to account 4, visit Watchlist Crypto and VOO, then return Home |
| 95–104 seconds | Rapid BSC account switching: 4 → 0 → 1 → 5 → 4 |
| 108–121 seconds | Open the selector, enter All Networks, and confirm Home |
| 127–168 seconds | Switch All Networks accounts to 0, 2, 3, 5, 1, and 5 |
| Immediately after the final action | Stay idle on Home for 70 seconds, with no export, navigation, or additional interaction |

These are planned start times. Use `action-timeline.jsonl` for actual start/end times and drift. With the inactive step enabled, all 53 actions must succeed. Disabling it produces a different workload that does not belong in this three-run comparison.

Prefer Detox `testID` selectors. UIKit fallback uses current semantic nodes and hittable positions checked against visibility, ancestors, and frame constraints; it must not use fixed coordinates. Verify the active state after tapping. Confirming BSC requires excluding All Networks and checking both the single-network entry point and a BNB token row. A BNB row alone does not establish BSC mode.

In `interaction-timeline.jsonl`, `tap-dispatched` / `tap-completed` measure host dispatch and Detox completion, not rendered feedback latency. A visible Home element also does not establish input readiness or that the final assets belong to the current account.

## 4. Logs and Artifacts

Read logs directly from the simulator's data directory without using the app's export UI. Locate the directory with:

```bash
HEATING_DATA_DIR="$(xcrun simctl get_app_container \
  "$HEATING_UDID" so.onekey.wallet data)"
ls -l "$HEATING_DATA_DIR/Library/Caches/logs/"
```

The active file is `Library/Caches/logs/app-latest.log`. The runner stops the app, preserves the previous file in the run directory, and starts a fresh log to reduce the risk of crossing the 20 MiB rollover boundary. After preparation, the collector keeps file descriptors by inode, discovers newly rotated files, and saves the byte ranges for the run. Do not truncate logs manually during a run.

| Artifact | Purpose |
| --- | --- |
| `environment.json` | Device, checkout, build provenance, and run options |
| `prepared.json`, `collector-ready.json` | Preparation and collector handshake |
| `run-meta.json`, `formal-end.json`, `observation-end.json` | Boundaries of the formal run and immediate idle observation |
| `action-timeline.jsonl` | Success, duration, and drift for all 53 actions |
| `interaction-timeline.jsonl` | Interaction dispatch, completion, and cooldown markers |
| `process-samples.jsonl` | Raw process CPU/RSS samples at approximately one-second intervals |
| `native-log-segment.log`, `native-log-capture.json` | Raw logs, source byte ranges, and capture completeness |
| `native-log-before-run.log` | Previous log, preserved if one existed before the run |
| Recording and `detox-artifacts/` | Page and interaction verification, plus failure investigation |
| `summary.json` | Single-run functional, capture, metric, and acceptance results |

Check `native-log-capture.json.complete` and any native logger throttling/drop notices. Successful file copying does not prove that no log events were lost; request counts in affected windows are lower bounds. RPC/network timestamps have one-second precision, and multiline RPC entries inherit the preceding timestamp. Do not claim millisecond correlation precision from these records.

Keep diagnostic trees, raw logs, and account data as local evidence; share redacted summaries. Do not output full account objects, address lists, keys, or raw memory strings.

## 5. Metric Definitions and Acceptance Criteria

### Functional, Capture, and Overall Status

- `functionalPassed`: Detox exited successfully. Separately verify that all 53 actions succeeded.
- `capturePassed`: Functional success with the logs, process samples, and recordings required by the runner. Separately verify the immediate 70-second idle period and coverage of each phase.
- `acceptance.status`: Performance and evidence assessment. The single-run runner currently returns only `FAIL` or `INCOMPLETE`, never a complete performance PASS, because three-run aggregation and some experience/physical-device metrics still require additional evidence.

Keep missing data as `UNMEASURED`; do not treat it as 0 or a pass. A measured failure makes the overall result FAIL. With no measured failure but required evidence missing, the result is INCOMPLETE.

### JS FPS: Acceptance by Time Distribution

Use raw main-runtime rAF samples: `[wallStartMs, wallEndMs, monotonicDurationMs, frames, validityCode]`. FPS = `frames × 1000 / monotonicDurationMs`. Percentages and P10 are weighted by actual valid duration. Short samples closing a census must retain their actual weight rather than count as a full second.

Use only valid foreground samples fully contained in the phase; do not prorate samples crossing phase boundaries. Report coverage, lifecycle invalidation, boundary omissions, overlaps, and clock anomalies. Insufficient coverage cannot establish an FPS pass. The continuous-switching phase starts at the actual start of the rapid BSC action planned for 95 seconds and ends when the last All Networks action finishes. The All Networks phase runs from its first account switch to its last; it excludes the preceding network-selector preparation actions.

Each of these two phases must satisfy:

| Condition | Threshold |
| --- | --- |
| Valid time coverage | ≥95%, with no sample overlap or clock anomaly; the implementation also rejects coverage >100.1% |
| Share of valid time at FPS ≥45 | ≥90% |
| Share of valid time at FPS <30 | ≤5% |
| Adjacent low-FPS full nominal one-second windows | ≤1 |
| Continuous low-FPS duration | <2000 ms |

A gap greater than 2 ms breaks adjacency; short samples still count toward continuous low-FPS duration. The minimum JS FPS, including an isolated value of 12, is diagnostic only and does not independently fail acceptance. Any observed JS Block >1 second independently fails acceptance regardless of average FPS.

### CPU, Memory, GC, Blocking, and Requests

The following thresholds come from the host runner. Preserve the distinction between `<` and `≤`:

| Window / metric | Condition |
| --- | --- |
| Functional failures and missing evidence | Both 0 |
| Maximum positive timeline drift | <10000 ms |
| Final 30 seconds of formal run: mean / maximum CPU | <100% / <200% |
| Formal RSS: last value minus first value | <500 MiB |
| Main census allocation / GC time / GC count | <2000 MiB / <2000 ms / <600 |
| Main census total / maximum JS Block | <3000 ms / <300 ms |
| Main census count of Blocks >500 ms / >1000 ms | ≤1 / 0 |
| Final 60 seconds of formal run: BG RPC / network requests | <1200 / <200 |
| All Networks account-switch window: BG RPC / network requests / token fetches | ≤600 / ≤120 / ≤42 |
| Immediate idle: mean CPU after the first 10 seconds | <30% |
| Immediate idle: RSS delta during seconds 60–70 | ≤0 MiB, with at least 5 samples |

CPU is the host `ps` value for the entire process and can exceed 100% across multiple cores. RSS is the `ps` value in KiB divided by 1024; although the field is named `rssMB`, it is reported here in MiB. The native census's legacy `rssMB` field is actually physical footprint, with resident size as a fallback. Do not mix it with host RSS.

GC, allocation, and Block metrics for the "final 30 seconds of the formal run" are measured only when the census boundaries exactly match that window. Other censuses fully contained in the formal run, with no suspension and actual duration ≥30 seconds, retain their actual duration and are checked against the existing nominal 30-second thresholds. An observed violation establishes failure; an observed value below the threshold does not establish a pass for the exact final 30 seconds. Do not prorate GC or blocking by window overlap, or interpret missing intervals as having no events.

Keep the following unmeasured until evidence is available: click visual-feedback P95, Home interactivity P95, account activation latency, stale-owner handling and final account asset correctness, ownership of inactive business requests, and physical-device thermal state. For each metric, the three-run report must include valid coverage, the median, and the worst value. For metrics where higher is better, the worst value is the minimum.

## 6. RSS Attribution Outside Formal Sampling

Complete the formal 53 actions and 70-second idle period before taking process snapshots. When allocation stacks are needed, use a separate diagnostic launch with the same app, page, waits, and query counts. Restore a normal launch afterward and verify that diagnostic settings are no longer injected. Bind all actions and PIDs to the specified UDID; do not select the first process with a matching name.

Example host diagnostic commands follow. First verify `HEATING_PID` against the target simulator's `launchctl list` and the app executable path:

```bash
xcrun simctl spawn "$HEATING_UDID" launchctl list
xcrun simctl get_app_container \
  "$HEATING_UDID" so.onekey.wallet app

ps -p "$HEATING_PID" -o pid,lstart,%cpu,rss,etime
footprint -p "$HEATING_PID" --swapped -f bytes
heap --forkCorpse --noContent --sortBySize "$HEATING_PID"
leaks --forkCorpse --noContent --groupByType --nostacks "$HEATING_PID"
```

In a separate diagnostic launch with `SIMCTL_CHILD_MallocStackLogging=1`, inspect allocation stacks for large strings. Use an address observed in that same process:

```bash
heap --forkCorpse --noContent --sortBySize \
  --addresses='CFString.*[128k-]' "$HEATING_PID"
malloc_history "$HEATING_PID" -noContent "$HEATING_ALLOCATION_ADDRESS"
```

A `leaks` exit code of 1 can mean that leaks were found; inspect the report before treating it as a tool failure. `--noContent` / `-noContent` prevents raw content output. RSS, footprint, heap, and leaks have different, overlapping scopes and meanings; do not add them together. Untagged VM categories or large non-object allocations do not automatically establish a leak.

### Independent Control Experiments for Test Tools

Use a fresh process for each group, the same stable Home page, identical waits, and an idle control. Do not switch accounts or pages. Preserve before/after footprint, heap, and leaks measurements along with tool identity:

| Experiment | Actions and expected verification |
| --- | --- |
| Successful queries | A 30-second idle control, followed by 60 successful Home `getAttributes` calls and 10 XML hierarchy queries; record each stage's delta separately |
| Missing-element queries | 20 `getAttributes` calls for a missing element; each must reject with `No elements found` |
| Wait timeouts | 20 `waitFor(...).toExist().withTimeout(500)` calls for a missing element; each must actually time out and retain complete final diagnostics |

The Detox patch fixes an unreleased Create-owned CGImage used for image cropping, exception cleanup for missing-element attribute queries, and the cost of generating a full diagnostic tree on every wait retry. Final timeouts must still include diagnostics; do not eliminate allocations by swallowing assertion failures.

Native assertion regression coverage should include existing/missing elements, positive/negative assertions, multiple matches, valid/out-of-range indices, immediate queries, wait success/failure, and restoration of the diagnostic flag after waiting. The validated matrix contains 27 cases. Detox `.atIndex()` mutates the element object, so each independent assertion should create its own `element(...)` to avoid interference. Existing out-of-range `toExist()` semantics differ from attribute lookup semantics and must remain unchanged by the memory patch.

### Patch Reproducibility Checks

The `detox@20.46.3` npm package ships a source archive; modifying only a locally extracted `ios/` directory is insufficient. The repository patch extracts that archive, applies the inner native diff, and builds the framework. The cache is located at `~/Library/Detox/ios/framework/onekey-<patch-and-build-hash>/<detox-and-xcode-hash>/Detox.framework`. The first consumer builds it automatically, and concurrent consumers share a single build through a lock.

After changing the patch, verify application and reverse checking of the outer patch against a clean npm package, application of the inner diff to the source archive, absence of build artifacts in the patch, native compilation and signing, concurrent first use, and the native assertions above. Record a new SHA for a rebuilt framework even when its sources are unchanged. Do not relabel existing performance results as measurements of the new binary.

## 7. Recorded Results and Follow-up Runs

The historical environment was `Codex-SWR-GC-Repro-iOS26-20260922`, UDID `3ACDE506-842B-4A02-95C4-1B9FE1376FE6`, running iOS 26.5 with initial wallet `hd-8` and target wallet `hd-7`. Reuse it when continuing that original cohort on the same machine. These identifiers document that environment; they are not prerequisites or default values for a new installation.

The Detox memory-fix validation on 2026-09-23 used frozen app build `cdea04947f7995a266cda4b34d742a005b72b17e`. Of the final four launch attempts, the first exited with CloudKit `containerIdentifier can not be nil` before completing any formal actions (0). The subsequent r2/r3/r4 runs each completed 53 actions and the immediate 70-second idle period consecutively. This work did not fix the CloudKit issue.

The table below compares three-run medians from the previous records and the final repaired version. This is a comparison of test tool revisions:

| Metric | Previous records | Repaired version |
| --- | ---: | ---: |
| RSS at formal end | 1843.7 MiB | 1479.8 MiB |
| Peak RSS | 1992.7 MiB | 1603.9 MiB |
| RSS at idle end | 1801.3 MiB | 1471.3 MiB |
| Continuous switching: time at FPS ≥45 | 75.80% | 72.65% |
| Continuous switching: time at FPS <30 | 8.20% | 11.94% |
| Mean CPU in final 30 seconds | 95.6% | 98.5% |
| BG RPC / network requests in final 60 seconds | 1370 / 291 | 1379 / 292 |

After the repair, continuous-switching FPS coverage was 98.72% / 98.94% / 98.77%. The worst observed JS Block was 1.010 seconds, and valid request dispatch still fanned out to 22 tasks. Functional regression completed and large test-tool leaks were reduced, but product performance acceptance remained FAIL. In the independent controls, CG Raster growth from 60 successful queries fell from 729.66 MiB to 0.28 MiB, and CFString growth from 20 wait timeouts fell from 116.03 MiB to 2.02 KiB.

Historical artifacts on this machine are under `development/output/perf-sessions/account-switch-heating/` in the repository. They are ignored local evidence and are not included in a fresh checkout:

- `detox-memory-fix-20260923/result.zh.md`: Final results and attribution limits.
- `detox-memory-fix-20260923/report-v2/`: Three-run comparisons, failed attempts, and raw evidence verification.
- `bridge-cdea0494-detox-poll-fixed-r2/`, `bridge-cdea0494-detox-poll-fixed-r3/`, `bridge-cdea0494-detox-poll-fixed-r4/`: Artifacts from the three formal runs.
- `detox-patch-20260923/final-verification.json`: Clean installation, build, and native assertion evidence for the durable patch. The three performance runs above were not measurements of the repackaged framework.

Use this protocol for subsequent product fixes. Add counts per owner generation for admitted/dispatched/dropped tasks, cache/live completion, and discarded stale results; verify network coverage and asset correctness for the final owner. A missing finish event remains unknown and must not be recorded as success. Separate inbound deserialization, aggregation, atom publication, persistence, and rendering when attributing main allocation/blocking. Use independent diagnostics to attribute native VM/non-object memory.

When changing sampling calculations only, start with the checked-in host logic regression tests. These do not replace interaction acceptance on the simulator:

```bash
node --test development/scripts/run-ios-account-switch-heating-repro.node-test.js
```
