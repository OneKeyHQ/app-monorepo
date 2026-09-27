# Wallet Home native pager migration

## Scope and acceptance contract

- Target: iOS and Android, including iPad. Preserve Web, desktop and extension rendering and behavior.
- Workspace: `/Volumes/T7Shield/Project/app-monorepo-home-native-pager`.
- Branch: `codex/home-native-pager`; initial base: `4a193dd92d` (`origin/x`).
- Dependencies: all 41 app-modules packages / 50 manifest references are pinned to published `3.0.157-alpha.255`. The temporary AES registry delay resolved; see release evidence below.
- Runtime: Home renders in `main`; `bg` has a separate JS heap and initializes independently. Existing background proxies continue to transfer data. Scroll and pager views belong to mounted UI instances, not a shared background singleton.
- Native code is first tested in this worktree's installed packages. Native `@onekeyfe/*` patches must not be committed; deliver those sources through an isolated app-modules branch and PR, then integrate a published version.

Failure conditions: unintended horizontal page changes during vertical/diagonal drags, blank retained pages, header/offset jumps, broken refresh, stale account/network content, lost transaction actions, or accidental Web behavior changes.

Passing conditions: the intended active page and content remain aligned through gestures, refresh, navigation and identity changes; iOS and Android receive independent evidence. Static checks, compilation, simulator interaction and physical-device performance are reported separately.

## Work allocation and handoff order

| Owner | Files / responsibility | Handoff |
| --- | --- | --- |
| Parent | This document, integration review, device harness, final checks and evidence | Record exact build/session and verify real Home interactions |
| `home_pager` | Home pager/context, header and Spot/Earn/Perps scrolling; NativeList container slots | Implement measured React header/footer/empty hosts owned by the native scroller; coordinate generated host bindings |
| `native_lists` | Home NFT and History integration, canonical transaction serialization and native Activity rendering | Preserve business behavior and complete the NativeList parity matrix |
| `native_contract` | NativeList grid, thresholds and media; isolated app-modules synchronization | Coordinate source freeze, consolidated package rebuild and upstream PR; preserve full video source behavior |

Agents must preserve each other's files and the existing dependency upgrade. No global Tabs replacement or whole-page business-logic duplication. New platform seams default to existing non-native implementations.

## Milestones

### 0. Dependency baseline

- [x] Create isolated external-drive worktree from current `origin/x`.
- [x] Upgrade all app-modules references, including three references omitted by the existing upgrade script in `packages/kit`.
- [x] Install JavaScript dependencies and Pods; preserve unrelated package resolutions.
- [x] Pass `yarn agent:check --profile commit` for dependency changes.
- [x] Scan iOS/Android module graphs; add NativeList `models.js` registry entry.
- [x] Rescan both platform module graphs for native acceptance: add ten migration modules and the pre-existing missing `HeadlessBuyGallery.tsx` registry entry needed by strict development bundling. No existing ID changed.

### 1. Native coordination and contracts

- [ ] Establish Home-local native pager and per-page focus/refresh boundaries, with default-platform passthroughs.
- [ ] Audit all legacy Home Tabs consumers, including descendants, header gestures and refresh fallbacks.
- [ ] Preserve Spot's data-loading responsibility independently of active-page retention.
- [ ] Use stable business tab identities; measure header and sticky-bar heights.
- [ ] Ensure each leaf has one primary vertical scroller; avoid an Android outer vertical ScrollView competing with the pager.
- [ ] Verify nested-pager active-child discovery and horizontal boundary handoff without introducing new business tabs.
- [ ] Agree and implement only required NativeList API additions: History top-distance thresholds and existing iPad grid column counts.

### 2. Home integration

| Surface | Target | Required parity |
| --- | --- | --- |
| Shared Home header / tab bar | CollapsiblePagerView | Alerts, balance, actions, banners, settings, dynamic tabs |
| Spot / Earn / Perps | NativeScroller | Existing complex React cards, refresh, safe-area padding, short content |
| NFT | NativeList grid / mediaTile | Images, badges, filters, item navigation, empty/loading states, iPad columns |
| History | NativeList sectioned / activity | Date sections, transaction presentation, pending actions, notification content, pagination, top-insertion freeze |

- [ ] Switch outer coordination and leaf dependencies together; do not leave old Tabs context hooks under the new pager.
- [ ] Preserve account/network identity boundaries and business data ownership.
- [ ] Keep non-Home history and NFT callers on their existing behavior.
- [ ] Keep Web / desktop / extension implementations unchanged.

### 3. Validation matrix

Use a worktree-private simulator/emulator and user-data directory on the external drive. Import test data only from `/Users/huhuanming/Library/Mobile Documents/com~apple~CloudDocs/备份测试数据`; never record secrets in logs or this document.

| Scenario | iOS | Android | Evidence |
| --- | --- | --- | --- |
| App/session ready and correct worktree/version | Image-backed simulator boot passed; App acceptance in progress | Passed | Local shell/vendor DevSession receipt below |
| Actual Wallet Home with test data | Pending | Passed | TEST Account #1; no further imports |
| Vertical/diagonal fling from header and content | Pending | Vertical content verified; diagonal/header fling pending | Home History collapse/expand recording |
| Horizontal paging, rapid reversal and nested boundaries | Pending | Bidirectional fixture swipe passed; rapid/nested pending | Fixture recording |
| Expanded/collapsed header page switching | Pending | Passed for History/NFT roundtrip | Home recording and retained-position screenshots |
| Refresh on long/short/empty content | Pending | Fixture long/empty trigger and completion verified; Home/short pending | Refresh routing regression below |
| Account/network switching and modal return | Pending | Pending | |
| NFT layout/image reuse/navigation | Pending | Image/video fallback, 2/6/7 columns and recycle verified; navigation pending | Fixture media screenshots |
| History updates, pagination and pending actions | Pending | Real rows, fixture actions and threshold transitions verified; live updates/pagination pending | Mapping tests and fixture status |
| iPad layout/rotation | Pending | N/A | |
| Before/after frame timing on comparable data | Pending | Pending | |

### 4. Delivery

- [ ] Focused behavior tests and repository commit/PR gates.
- [ ] Review platform resolution and ensure no Web implementation changes.
- [ ] Sync necessary native sources into a separate app-modules branch and attach its PR.
- [ ] Distinguish local debug source changes from published package integration.
- [ ] Record any remaining device/performance acceptance gaps without claiming completion.

## NativeList capability completion (required, not deferred)

The user clarified on 2026-09-27 that missing NativeList capabilities must be completed because NativeList and NativeScroller are long-term building blocks. A temporary RN FlatList/SectionList adapter may unblock the first native-pager milestone, but does not satisfy final NativeList migration acceptance.

| Gap | Existing behavior to preserve | Ownership / acceptance |
| --- | --- | --- |
| Rich History transactions | Multi-transfer lines, private-send fees, swaps, approvals, address/status presentation | Bounded serializable row capabilities; existing formatting and business actions remain authoritative |
| Pending transaction actions | Speed up, cancel, cancellation speed up, status check and their enabled states | Native emits intents; existing JS business handlers execute them |
| Container header/footer | Notification prompt, empty receive/explorer actions, derived-address explorer selection | Container-owned capability, not arbitrary React embedded inside row templates |
| NFT media | Image loading/error recovery, including existing image-to-video fallback | Match existing fallback and recycled-cell lifecycle on both native platforms |
| Grid columns | Current 2/3/4/6/7-column layouts | iPad parity without reducing existing column counts |
| History scroll hysteresis | Engage at 160 points, release below 48 points | Generic low-frequency event with correct active-page and identity handling |

Each row requires a documented public contract, native iOS and Android implementation, caller integration, and focused validation. NativeScroller is validated as a reusable primary-scroller component, without Home-specific behavior in its package.

## Current handoff

### Source and review

- App draft PR: https://github.com/OneKeyHQ/app-monorepo/pull/13750 (draft).
- Module draft PR: https://github.com/OneKeyHQ/app-modules/pull/135 (draft).
- Native implementation and focused source checks are complete. Android and iOS have partial interactive acceptance below; broader interaction and comparable performance measurements remain pending. Neither PR is ready to merge.
- Home uses NativeScroller for Spot/Earn/Perps and NativeList for History/NFT. Native-only provider keys isolate wallet/account/network state. History metadata queries use stable identities, cache misses and bounded concurrency.
- NativeList includes rich Activity rows, paused media fallback, viewport-based video resource release, 2–7 grid columns, React container slots, configurable refresh distance, threshold events and ancestor-header contributions. The final audit corrected duplicate iOS refresh haptics, tall Android end-slot alignment and small-number typography.
- Each visible native media tile owns its player; background JS owns none. Android buffer settings are targets, not a total decoder-memory cap. iOS forward-buffer duration is advisory.
- NativeList/Pager APIs and fixes are published in `.255` and installed from npm. Their installed runtime files match the registry tarballs exactly; local native source overrides and package patches are not required. AES crypto initially required a temporary `.254` pin during registry propagation; its `.255` later became available and is now installed too.

### Validation evidence

| Check | Result | Evidence |
| --- | --- | --- |
| Dependency-only commit gate | Passed | `node_modules/.cache/agent-checks/2026-09-26T15-35-00-776Z/summary.json` |
| Final app commit gate including Gallery | Passed | `node_modules/.cache/agent-checks/2026-09-26T16-52-18-782Z/summary.json` |
| PR profile local checks | Passed; hosted part skipped because run preceded PR creation | `node_modules/.cache/agent-checks/2026-09-26T16-55-30-289Z/summary.json` |
| NativeList package tests | 203 passed; package typecheck passed | `local/home-native-pager/evidence/native-list-final-tests.log` |
| Focused app tests | Financial mapping 14, refresh 2, dynamic tabs 1 passed | Focused test runs |
| Native focused policies | End alignment 4, post-generation 2 passed; renderer/media API compile checks passed | Module PR validation |
| Final iOS full app build | Passed | `local/home-native-pager/evidence/ios-build-final-font.log` |
| Final Android full app build | Passed; 166 tasks executed, 1845 up-to-date | `local/home-native-pager/evidence/android-launch-final.log` |
| XCTest runtime / Home interaction / timing | Pending | No device acceptance claim |

Both-platform module graph scans completed (`local/home-native-pager/evidence/module-registry.log`). Pods installation succeeded with 197 dependencies / 218 pods. The initial Swift compiler overload failure was corrected; subsequent complete iOS builds passed.

### Device handoff

Android uses dedicated `OneKey_HomePager_API36`, serial `emulator-5580`, API 36 Google APIs arm64, Pixel 6 profile. `ANDROID_AVD_HOME`, AVD metadata and userdata are under `local/home-native-pager/android-avd/` on the external drive.

The final Android DevSession reached `status=running`: local-built shell and vendor, cached WebEmbed, no required user notices. Receipt: `node_modules/.cache/onekey-mobile-dev/sessions/wk-e4dc44479fcd-dev-5e6f2505624f-84ba928b2ed15bfd/run-result.json`. That Android session was stopped when iOS acceptance began; its userdata remains intact. The user completed onboarding and entered the password in the App. The AVD now uses 6144 MB RAM after the earlier 2 GB configuration caused low-memory exits. TEST wallet Account #1 loads real assets. This debug emulator setup is not physical-device performance evidence.

Gallery acceptance uses Developer → Gallery → NewTabs → the native fixture. It contains public sample media, rich Activity rows, header/footer/empty slots, refresh, 2/6/7 columns and retained-page switching. Normal onboarding is required to reach Developer; do not bypass authentication or expose a new arbitrary deep link. QA backup import must follow the authorized backup directory's runbook, with temporary code excluded from commits and passwords entered in App secure fields.

The dedicated iOS simulator is `OneKey-HomePager-iOS26.5`, UDID `21AFD01B-0CB1-43E8-AD1E-1C8B89123870`. Task-owned data is under `local/home-native-pager/simulators/`. The initial directory-symlink layout failed: kernel logging at 2026-09-27 00:12:57 +0800 confirmed System Policy denied CoreSimulator file creation in external `data/Library/Logs`. On 2026-09-27 the layout was replaced with `local/home-native-pager/simulators/HomePagerData.sparsebundle` (APFS, 40 GiB virtual capacity), mounted directly at `~/Library/Developer/CoreSimulator/Devices/21AFD01B-0CB1-43E8-AD1E-1C8B89123870/data`. The original 17 MiB external device data was preserved and copied into the image. Only device registration metadata and the empty mountpoint reside on the internal disk. `df` confirms a separate image volume; `simctl bootstatus` completed and the iPhone home screen was captured. No Full Disk Access change was required. Always verify the image is mounted before booting; never allow CoreSimulator to populate the unmounted internal directory.

Normal acceptance launches must use `--shell local --vendor local` while installed package source differs from published packages. Simulator boot, build success, active App readiness, row correctness and performance remain separate evidence levels.


### Android interaction findings — 2026-09-27

- QA import stopped at the native Main→BG 600-second request deadline. NativeLogger matched the timeout to `servicePrimeTransfer.startImport`; both task and worker are inactive. Current data contains 28 HD wallets, 291 logical HD accounts and no watch accounts. The user explicitly accepted TEST wallet as sufficient and stopped further import attempts.
- The three temporary QA import source files were reversed and their original hashes verified. The proposed timeout patch was never applied. Original backup and App-local backup copy remain intact; no sensitive content is committed.
- Actual TEST Account #1 Home rendered asset rows. Expanded header incorrectly obscured the first rows: Android pager native padding does not reposition Fabric-owned ReactScrollView content. Evidence: `local/home-native-pager/evidence/android-test-home-expanded.png` and `android-home-pulled-top.png`. Fixed using React Native 0.86.2 ScrollAway padding with additive ownership and detach restoration; fresh expanded Home shows Tokens and the first ETH row below the tabs (`android-home-fixed-expanded.png`).
- Android App crashed on image failure: NativeList media fallback recycled the image synchronously inside Glide's failure callback. Evidence: `local/home-native-pager/evidence/android-native-media-crash.log`, App crash at 02:15:57. Fixed by deferring terminal callbacks and checking binding/candidate/player generations before fallback. Final native rebuild passed; public fixture video first frames load and the App survives offscreen/return scrolling.
- Companion module PR checks all passed, including iOS XCTest, at HEAD `94ef1e1d`. This does not cover the subsequent device findings yet.
- App hosted checks at `34c90c5d` reported 23 passed and two failures: missing unpublished NativeList types, and main startup allocation 14,585,792 bytes exceeding the 13.8 MiB budget. Native History/NFT lazy boundaries now pass local production allocation: 14,462,653 bytes / 2694 startup modules, below the unchanged 13.8 MiB limit. The hosted result above predates this fix; clean-checkout unpublished-type integration still blocks readiness.
- Final Android build completed with 110 tasks executed / 1901 up-to-date: `local/home-native-pager/evidence/android-launch-runtime-fixes-final.log`. No required user notices. The stale common.hbc error at 02:32:54 occurred when the old App process was opened during DevSession prewarm and cleared on the launcher's normal process restart; it is not a successful-session media regression.
- TEST History vertical scroll collapses the header; switching to NFT and back retains History position; scrolling to top restores the header. Evidence: `android-history-collapsed.png`, `android-nft-collapsed.png`, `android-history-returned.png`, `android-home-runtime-scroll.mp4` under the evidence directory.
- Gallery fixture covers multi-asset rows, footer action routing, small-number typography, empty/header/footer slots, 2/6/7-column layout and paused image-to-video fallback. Horizontal swipes select pages 1 then 0; vertical scroll changes the 48/160 threshold status from Away from top to Near top. A new fixture mount shows both headers, so an earlier missing-header suspicion was not reproduced and caused no code change.
- Phone table/6/7-column fixtures exercise capability dispatch only; their cramped layout is not iPad visual acceptance. Actual iPad width/rotation remains pending.
- Refresh used the native internal row-action transport and incorrectly also notified the public row-action callback. The native JS wrapper now consumes row-less refresh events; real row events remain intact and Web behavior is unchanged. Two regression cases cover present/absent refresh callbacks and same-named real row actions.
- Native-module JS hot replacement re-registers the Nitro host and produced a development duplicate-view overlay; a process restart of the existing DevSession restored both main/background runtimes. Fresh-process long and empty pulls now produce `Page 0 · refresh 1` then `refresh 2`, with no row-action status, and Finish refresh dismisses the spinner (`android-fixture-refresh-fixed.png`, `android-fixture-empty-refresh-finished.png`). Do not treat HMR as acceptance of a fresh app runtime.
- Startup lazy-boundary commit gate passed (`2026-09-26T18-24-56-754Z`); Unlimited approval formatting and 14 focused mapping tests passed with commit gate `2026-09-26T18-37-18-610Z`. Unlimited is now a text sentinel, including the existing table symbol and phone privacy rules.
- Video evidence is chunked by Android's 180-second screenrecord limit (`android-native-fixture.mp4`, `.part-002.mp4`, `.part-003.mp4`); raw recordings have separate gesture telemetry. Android debug emulation does not establish frame-time improvements. Remaining matrix rows above must be completed independently.

- Final combined app commit gate: all 9 checks passed at `node_modules/.cache/agent-checks/2026-09-26T18-48-12-132Z/summary.json`. Native package typecheck and changed-file lint pass (one pre-existing inline-style warning); the full 203-test suite passes. Runtime module fixes are pushed in companion commit `890ae49c8`.

### iOS image-backed session — 2026-09-27

- User requested shutting down Android and moving to iOS. Task emulator `emulator-5580` and its DevSession/Metro process tree were stopped; unrelated `emulator-5600` and ports 8131/8132 were preserved.
- External image boot completed in approximately 47 seconds. Evidence: `local/home-native-pager/evidence/ios-image-boot.png`. Image path stays under this worktree, independent of other simulator images.
- Host Xcode is now 27.0 (27A266a); Device Hub replaces Simulator.app. The launcher still invokes `open -a Simulator`. An ignored, task-local `local/home-native-pager/ios-tools/open` shim redirects only that invocation to the installed DeviceHub.app. Repository launch code and global Xcode configuration were not modified.
- Screenshot capture to external absolute paths is denied by the new simulator service. Capture into the mounted image's `data` path, then copy to the worktree evidence directory; both destinations are physically external.
- Launch command: task-local shim directory prepended to PATH, then `yarn workspace @onekeyhq/mobile dev-shell --platform ios --device 21AFD01B-0CB1-43E8-AD1E-1C8B89123870 --shell local --vendor local`. Log: `local/home-native-pager/evidence/ios-devsession-image.log`. Build/App readiness and interaction acceptance remain separate from successful simulator boot.

- Hosted status refreshed before iOS acceptance: Module PR #135 at `890ae49c8` passed all 7 checks, including iOS XCTest; App PR #13750 at `9afdbedb79` passed 24 checks and fails only the unpublished NativeList type integration. Hosted startup allocation now passes (main 2694 modules / 13.77 MB; background 2422 / 18.36 MB).

- iOS DevSession completed a full Xcode 27 native build and reached `status=running`: local shell/vendor, cached WebEmbed, Metro 8081, `userNoticeRequired=false`. Receipt: `node_modules/.cache/onekey-mobile-dev/sessions/wk-e4dc44479fcd-dev-842d8ebbf095-0f790713599df2c0/run-result.json`. Normal onboarding completed with a new empty test wallet; no seed was displayed and no Android backup was re-imported.
- The standalone Gallery fixture bypassed Gallery Layout's navigation inset on iOS 26. It now uses the actual header height only on iOS 26+. Expanded controls and collapsed sticky tabs remain below navigation; evidence: `ios-fixture-sticky-fixed.png`. Production Home and Android/Web layouts were not changed. Commit gate passed at `2026-09-27T02-51-25-701Z`.
- iOS fixture renders rich multi-asset Activity rows and paused image-to-video fallback (`ios-fixture-video-fallback.png`). Standard XCTest drags switch History → NFT → History and trigger empty-list refresh; Finish refresh dismisses it (`ios-fixture-empty-refresh.png`). These are interaction observations, not frame-time measurements.
- Tool distinction: agent-device 0.17.0 `swipe`/`gesture pan` uses a synthesized pointer path; on this runtime it recognized the pager but did not settle a page change. `gesture fling` uses XCTest `press(forDuration:thenDragTo:)` and works for both directions and refresh. Its final duration argument is the initial hold duration. No native gesture arbitration change was made based on the failed synthesized input.
- A real content-shrink defect was reproduced after retained-page offset restoration: History → deep scroll → horizontal interaction/return → Empty leaves all slots offscreen. At 11:01:36 the native log reports content height 132, viewport 708, insets (108,532), valid raw range [-108,-44], but logical offsets 265 then 180.33 (maximum is 64). Evidence: `ios-fixture-shrink-after-page-return.png`. A narrowly scoped native offset correction is in progress; this case is not accepted yet.

### iOS retained-page shrink correction

- Companion commit `37c9be6c1` defers NativeList upper-bound offset correction until layout settles, with drag/deceleration/refresh deferral and disposal cancellation. Three UIKit regression cases cover inset/KVO restoration, valid and negative offsets, and refresh completion. Its full DevSession build passed (`ios-devsession-shrink-fix.log`, session `wk-e4dc44479fcd-dev-842d8ebbf095-cac7ee709fd5021e`); no required user notices.
- Device verification exposed a second writer: returning to a retained page restored the old logical offset after the list correction. At 11:18:25 the pager restored 513.67; at 11:18:36 the shortened 132-point content still had logical offset 246.33 versus maximum 64. Recording: `local/home-native-pager/evidence/ios-shrink-regression-before-pager-fix.mp4`. The list correction alone does not close this case.
- Companion commit `6deffeb6b` bounds only the pager's cached-offset restoration against the current content, viewport and final insets. It does not clamp normal gesture frames. Two XCTest cases and an independent Foundation harness cover the real bounds, repeat restoration, valid/negative offsets, zero viewport and released-state pruning; all seven harness checks passed (`local/home-native-pager/pager-restore-policy-check/result.log`). Installed and companion sources match.
- The direct incremental native build passed (`ios-pager-restore-build.log`). Its initial install omitted DevSession packaging metadata; the existing `packageIosSimulatorApp` helper restored and signed that metadata. Main/bg then loaded the correct session, but UI remained at `native-storage-bootstrap-waiting`. No storage/startup source was changed and no userdata was cleared.
- A/B installation of the previous standard-builder archive into the same simulator/data/session restored Home at 11:37. This isolates a difference between launch/build attempts but does not establish a root cause. A standard `dev-shell:build --platform ios --skip-pods` rebuild of the latest source follows; log: `ios-standard-restore-build.log`.
- Repeated forced process termination can trigger the native launch-count recovery screen without a crash. The existing Not Now action clears that launch counter and requests a restart; it also disables travel mode. No Quick Fix or data reset was used. Prefer normal backgrounding before subsequent controlled restarts. Shared Metro reload broadcasts to every connected device, so it must not be used when unrelated devices are attached.
- The standard rebuild completed successfully, was installed without clearing data, and reached Home/Gallery at 11:43. The latest native binary is now active; the original DevSession/Metro remains running. The startup issue is not reproduced on this standard build, but its root cause remains unproven.
- Current-head module PR `6deffeb6b` passed all seven hosted checks, including iOS XCTest (run `36291247269`).
- On the latest binary, deep History shrink displays header/empty/footer instead of a blank viewport; empty pull refresh increments the count, Finish refresh settles it, and restoring rows renders rich Activity content. Evidence: `ios-shrink-after-return-fixed.png` and `ios-shrink-final.mp4`. The automated horizontal drag sequence did not consistently verify an active-page change, so this is not complete transition-time regression acceptance.
- Explicit tab selection confirms History → NFT → History and preserved History position. NFT images and paused fallback frames render. Attempts to toggle Empty while NFT is active did not reliably change the control or dataset; the inactive-page shrink case remains pending a hit-testing/tool investigation. Do not infer success from command exit status.
- Remaining acceptance includes reliable horizontal/nested gestures on the latest binary, inactive-page shrink, funded iOS Home/business actions, iPad geometry and comparable frame-time measurements. The clean-checkout companion package dependency remains unpublished. Both PRs stay drafts.

- Follow-up isolates the toolbar failure to collapsed-header hit testing: the same NFT toolbar tap works after expanding the header. With the header expanded, clearing inactive History and returning displays the expected slots (`ios-inactive-shrink-expanded-fixed.png`). The pager forwarded out-of-bounds touches to its relocated shared header before applying its own bounds; the header intentionally supports internal sticky overflow. The minimal correction bounds outer forwarding and preserves Fabric pointer-event modes. Standard rebuild log: `ios-pager-hit-test-build.log`.
- Final device follow-up at 11:59–12:00: module commit `330d12166` built, signed and launched successfully. With History deeply scrolled and NFT active under a collapsed header, the same toolbar tap now changes Empty to Restore rows. Returning to History shows its header/empty/footer slots in the visible viewport. Restoring rows and separate left/right XCTest drags visibly select Page 1 then Page 0. Evidence: `ios-collapsed-toolbar-fixed.png`, `ios-inactive-shrink-collapsed-fixed.png`, `ios-hit-test-final.mp4`. This closes the reproduced toolbar hit-test and inactive-page shrink cases; combined rapid/decelerating/nested gesture stress remains outside this check.
- Latest module validation: installed/companion source equality, test-integrity (39 files), and the real UIKit test translation unit's syntax compilation pass. The new tests instantiate the actual pager and verify sibling-toolbar routing, sticky child routing, Fabric pointer modes and disabled/hidden/transparent behavior. At final device verification, current-head hosted CI has six passes and iOS XCTest still running; the preceding `6deffeb6b` passed all seven.
- Keep the dedicated iOS device, mounted external image and DevSession Metro 8081 running for the next acceptance pass. Android stays shut down with TEST data preserved. Do not repeat wallet imports or claim physical-device performance from this simulator session.

### Published package integration — 2026-09-27

- User authorized npm publication and app-monorepo integration. Preview branch `codex/home-native-pager-alpha-255` at `0f8d91f907b8db3a5da4673a0be99ed45831abc3` derives from module fix `330d12166`; its extra changes are synchronized preview versions and internal package references. The feature PR keeps its original stable source manifests.
- Release tooling passed 33 tests and the `next` dist-tag validation. Workflow `36307072394` published the 41-package set to npm `next`; 40 became visible. The registry verification failed only for `@onekeyfe/react-native-aes-crypto@3.0.157-alpha.255`. npm logged upload acceptance at 08:44:17 UTC, but registry checks continued returning 404. Single-workspace retry `36307750627` returned `E409 Cannot publish over previously staged version` at 08:56:38 UTC. No claim that the entire release workflow passed. `latest` remains unchanged.
- The first integration temporarily kept unchanged AES crypto at `.254` while npm processed its upload, updating the other 40 packages/49 references across mobile, components, kit and root plus `yarn.lock` and `Podfile.lock`. The follow-up below supersedes that temporary pin. This uses public npm versions rather than a Git URL, local path, patch or tarball dependency.
- Two-package publication audit passed: 203 NativeList and 54 Pager tracked files match the release commit; 17 built JS/types/generated-code assertions pass. After `yarn install`, all 358 NativeList and 81 Pager installed files match their downloaded npm tarballs byte for byte, with no missing/different/extra runtime files. Evidence: `local/home-native-pager/evidence/alpha255-pack-audit/{audit.md,audit.json,installed-audit.json}`.
- `yarn install` completed; existing peer warnings remain. Pods installation completed with 197 dependencies / 218 pods. Evidence: `alpha255-app-install.log`, `alpha255-pods.log`. A new standard DevSession rebuild from installed npm sources is in progress: `alpha255-ios-devsession.log`; earlier local-source device observations do not automatically certify this new binary.

- Follow-up at approximately 09:08 UTC: npm finally exposes AES `.255` and its `next` tag, with `latest` unchanged at `.156`. The temporary AES `.254` pin was removed and `yarn install` succeeded with all 41 packages / 50 references on `.255`. This was delayed registry processing, not a permanently unusable version. The failed release job was rerun to obtain complete verification without republishing existing versions.
- The initial npm-source iOS build completed successfully. Its DevSession was stopped before final acceptance to include the now-available AES package; the final all-package session is `alpha255-all-ios-devsession.log`. Initial app commit gate passed including full TypeScript (`2026-09-27T09-00-52-118Z`). An earlier failed check scanned unpacked audit copies under `local`; moving those copies into the existing excluded `ignore/` directory resolved it without application/config changes.

- Complete release verification now passes: workflow `36307072394` succeeded on rerun and independent registry verification reports `verified: 41, total: 41, missing: []` (`alpha255-all-registry-verification.log`). The first all-package DevSession emitted `ONEKEY_USER_NOTICE` / `run-failed` because deployment-mode Pods detected the AES lockfile still at `.254`; normal `yarn app:ios:pod-install` updates the lock before relaunch. This was not a clean cache hit or successful launch.

- Final npm-only iOS acceptance: all 41 installed packages are `.255`; `alpha255-final-ios-devsession.log` reports `BUILD SUCCEEDED` and `status=running`, shell/vendor `local-build`, WebEmbed `local-cache`, Metro 8081, `userNoticeRequired=false`. Session: `wk-e4dc44479fcd-dev-842d8ebbf095-b37aafcf33d644ad`. The earlier lockfile notice was resolved by standard Pods installation. Commit gate including full TypeScript passed (`2026-09-27T09-13-44-500Z`); integration commit `99ad881a9a` is pushed.
- On that npm-built binary, Gallery testIDs resolve. A vertical XCTest drag collapses History's header; left/right drags visibly select Page 1 and Page 0. With NFT active and the header collapsed, Empty clears inactive History; returning shows header/empty/footer in view. Empty pull refresh increments to 1, Finish refresh removes its control, and Restore rows renders rich multi-asset Activity again. NFT images and paused image-to-video fallback frames render. Evidence: `ios-alpha255-nft.png`, `ios-alpha255-inactive-shrink.png`, `ios-alpha255-refresh.png`, `ios-alpha255-restored.png`, and `ios-alpha255-smoke.mp4` in the evidence directory. The existing Gallery VirtualizedLists nesting warning was dismissed; no native crash or render-error screen occurred in this smoke check.
- This completes published dependency integration and its iOS smoke check, not the remaining funded Home/iPad/nested-gesture/performance matrix. Android remains stopped with its previous TEST data preserved; no new Android run is claimed for the npm-built version. Dedicated iOS and Metro remain running, with userdata on the mounted external sparsebundle. Module source HEAD `330d12166` passes all 7 hosted checks; app hosted checks on the new integration commit were still pending at the status snapshot. Both PRs remain drafts.
