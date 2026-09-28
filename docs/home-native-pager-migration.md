# Wallet Home native pager migration

## Scope and acceptance contract

- Target: iOS and Android, including iPad. Preserve Web, desktop and extension rendering and behavior.
- Workspace: `/Volumes/T7Shield/Project/app-monorepo-home-native-pager`.
- Branch: `codex/home-native-pager`; initial base: `4a193dd92d` (`origin/x`).
- Dependencies: Pager is pinned to published `3.0.157-alpha.256`; the other 40 app-modules packages remain on `3.0.157-alpha.255`. All 50 manifest references use npm releases. See release and refresh evidence below.
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

### Home refresh indicator follow-up — 2026-09-27

- User reported missing pull-to-refresh feedback on the real funded iOS Home after npm integration. The earlier Gallery smoke check did not cover this screen. Reproduced on the existing image-backed simulator, without importing or resetting wallet data. Before evidence: `ios-home-refresh-before.mp4` and `ios-home-refresh-before-events.log`.
- Temporary main-runtime diagnostics confirm History emits the refresh event and finishes its cycle. Spot also triggers once from a header pull; release overscroll was -107.33 points and the fallback did not duplicate the event. The reproduced issue is invisible/misplaced feedback; data-fetch completion is separate from this 1.2-second indicator timer.
- The native pager owns a header/sticky top inset and positions the shared header at negative content coordinates. Both RN NativeScroller and NativeList use `UIScrollView.refreshControl`; its visual offset must account for that shared header while preserving caller offsets and UIKit refresh state. A common iOS pager fix is under validation, with no new business scroll handlers or Web changes.
- Acceptance requires Spot, Perps, DeFi, NFT and History each showing a visible spinner during pull/refresh, exactly one main refresh event, and a settled end state. Header-origin and list-origin pulls, page round trips and retained-list offsets must remain usable. Temporary diagnostics must be removed before delivery.

- Source fix `549252063` shifts only the refresh control's sublayers above the shared header, leaving bounds/frame/contentOffset and caller `progressViewOffset` unchanged. Per-control ownership handles multiple pagers, late/replaced controls and detach/recycle cleanup; clipping and the original layer transform restore after the final owner releases. Six real UIKit regression methods compile; a harness using the production coordinator with real CALayer/KVO passes 16 checks. Its control wrapper is not UIKit gesture acceptance.
- Standard build `ios-refresh-position-devsession.log` passed; the pager object was compiled at 19:58:13 +0800 after the final source freeze at 19:56:31 (SHA256 `f4d7e4e8f8454909120dd1a4a942d0249c6a9a809bd236dc31daf1495a3f84af`). Session `wk-e4dc44479fcd-dev-842d8ebbf095-2e79f2333d2d6265` reached running with local shell/vendor, cached WebEmbed and `userNoticeRequired=false`.
- Real funded Home acceptance passes all five tabs, from both header and content origins (10 pulls total). Each recording shows the spinner above the wallet balance, followed by disappearance and settled content; each corresponding diagnostic log contains exactly one trigger, event-emitted and finished sequence. NativeScroller content pulls measured -134pt and exercised the release fallback without duplicate events. Evidence names: `refresh-{spot,perps,defi,nft,history}.mp4`, `refresh-{tab}-list.mp4` and their `-events.log` files under the evidence directory. Existing testID queries did not resolve the Home tabs, so coordinates were anchored to inspected screenshots and active content was verified in each recording. Temporary hook diagnostics were removed after collecting this evidence. This verifies event dispatch and visual feedback, not completion of every downstream network request.

- Final pre-publication app commit gate passes, including full TypeScript (`2026-09-27T12-09-28-971Z`). A temporary diagnostic backup originally retained a `.ts` suffix and was scanned by TypeScript; renaming the ignored backup to `.txt` resolved that verification-only failure. No diagnostic hook remains in the application.
- Hosted app lint at `82eef1690d` fails the unchanged CI dependency-cache integration test with `KeyError: snapshot_kind` at `ci-dependencies-test.py:456` after snapshot mounting falls back to a normal install. Evidence: `app-refresh-hosted-lint.log`, run `36318182010`, job `108616766846`. This is separate from the passing local gate and refresh acceptance; no cache-script change belongs to this fix.

- Hosted iOS Pager suite at source `93890747` passes all 14 tests, including the six new refresh-control cases. Job `108616933589` records `TEST SUCCEEDED` at 12:23:46 UTC (`ios-refresh-hosted-progress.log`). The first run failed because its test refresh control was offscreen; attaching the test fixture to a visible UIWindow resolves that UIKit precondition without changing production source. The complete native-tests run `36318243869` subsequently succeeded, including all six iOS XCTest suites.

- Pager-only preview `927c07f62` published `3.0.157-alpha.256` to npm `next`; release run `36319513754` succeeds and `latest` remains `3.0.156`. Registry visibility followed upload by approximately four minutes; no duplicate publish was attempted. Normal app `yarn install` succeeds, and installed production source retains the accepted SHA256 above. The other 40 packages remain `.255`. Evidence: `alpha256-app-install.log`.

- Release audit passes: 55 tracked Pager files match preview `927c07f62`, and all 82 installed package files match the npm tarball with no missing, changed or extra files. Evidence: `alpha256-pack-audit/{audit.md,audit.json,installed-audit.json}`. Normal Pods installation succeeds and changes only Pager version/checksum in `Podfile.lock`; npm-source iOS DevSession rebuild is recorded in `alpha256-ios-devsession.log`.

- Final `.256` app commit gate passes, including complete TypeScript (`2026-09-27T12-42-25-845Z`). The npm-source native build reports `BUILD SUCCEEDED`.

- Final published-package DevSession `wk-e4dc44479fcd-dev-842d8ebbf095-5e41ea8969add204` reaches running with local-built shell/vendor, cached WebEmbed and `userNoticeRequired=false`. Funded Home opens normally. Spot header-origin and History content-origin pulls visibly show the indicator below the fixed account selector and above the balance, then dismiss it and settle layout. Evidence: `ios-alpha256-refresh-smoke.mp4`, `ios-alpha256-refresh-contact.png` and `ios-alpha256-history-refresh-contact.png`. These are installation smoke checks on the exact audited production source; the earlier ten-pull recordings establish all-five-tab event counts. No diagnostics were reintroduced. The dedicated iOS/Metro remain running on the external image; Android remains stopped.


### Android Home refresh indicator correction — 2026-09-28

- Android acceptance of npm Pager `.256` reproduced an invisible spinner in Spot, Perps and DeFi; all five tabs still emitted one refresh event from both header and content origins. NFT/History indicators were visible. Evidence: `local/home-native-pager/evidence/android-home-refresh-acceptance.md`.
- The Android-only fix was developed in the app worktree's installed Pager and synchronized to module PR #135, commit `2e1c1412a`. In smooth-header mode it translates only the RN refresh indicator's drawing by header-plus-sticky height, preserving RN caller offsets, AndroidX animation/refresh state, triggers and callbacks. Shared weak owner contributions support resizing, late/replaced controls, nested owners and detach restoration. NativeList, iOS and Web implementations are unchanged.
- Local production-helper JVM regressions and test-integrity pass; the full arm64 Android native build succeeds in 3m25s. Explicit JDK 17 and ANDROID_HOME resolved host setup failures from default JDK 24 and missing SDK path. Reinstalled on task emulator `emulator-5580` with the existing TEST wallet; AVD/userdata remain physically external, and Metro 8082 is retained.
- Formal Home matrix passes all ten cases: Spot/Perps/DeFi/NFT/History, each with header-origin and content-origin pulls, visible spinner below tabs, exactly one logged refresh dispatch and normal disappearance. Evidence: `local/home-native-pager/evidence/android-spinner-fix/acceptance.md`, `acceptance.json`, per-tab recordings and comparisons. Temporary account.wallet logging was restored off. Event dispatch and UI completion do not certify downstream network completion.
- Additional Spot partial-collapse/expand/pull passes. Tapping Perps during active refresh did not switch; the same tap after refresh switched successfully. This extra scenario is not accepted and is not yet isolated as pre-existing versus regression; no gesture/navigation change is included. Dynamic caller offsets, refresh-time header resizing, nested replacement and physical-device performance remain separate acceptance work.

- Pager-only preview `a864378e` publishes `.257` via successful workflow `36366030128`; npm `next` is `.257` and `latest` remains `3.0.156`. Other 40 native packages remain `.255`. App `yarn install` and normal Pods installation succeed; Podfile.lock changes only Pager version/checksum (existing binary Info.plist scan warnings are retained in the log).
- Publication audit passes: all 82 installed Pager files match the npm tarball, all 55 compared tracked release files match the preview source, both Android production hashes match the accepted build, and all 52 JS/iOS files are unchanged. Evidence: `android-spinner-fix/npm-source-audit.json`. Standard `.257` Android DevSession launch is recorded in `android-spinner-fix/alpha257-devsession.log`.

- Final npm-source Android DevSession `wk-e4dc44479fcd-dev-5e6f2505624f-9352a3842e04fc11` reaches `status=running`: local-built shell/vendor, cached WebEmbed, Metro 8082, `userNoticeRequired=false`. Native build succeeds in 2m38s. Funded Home renders, and Spot header-origin / History content-origin pulls visibly show and dismiss the spinner (`android-spinner-fix/alpha257-smoke.mp4` and `alpha257-smoke-comparison.png`). This installation smoke check complements the earlier ten-case event matrix on byte-identical Android source. No temporary production diagnostics remain. Keep the dedicated external AVD and Metro running; other worktrees' devices/ports were preserved.
- App integration commit `50ca342e15` passes the commit gate including full TypeScript (`node_modules/.cache/agent-checks/2026-09-28T01-33-55-499Z/summary.json`) and is pushed to draft PR #13750. Module source fix `2e1c1412a` is pushed to draft PR #135. Hosted checks remain separate from local build/device evidence; neither PR has been merged.

### Android refresh placement and release jump — 2026-09-28

- User feedback on the correct task AVD (`OneKey_HomePager_API36:5580`) rejects the previous below-tab spinner placement. The old ten-case matrix proves visibility/event dispatch only, not correct geometry. Android native main-UI Views own this gesture; the separate background JS runtime is not involved in the captured offset change.
- A continuous pull with a 40 px upward reversal over 20 ms before release reproduces the jump. At 10:26:24.814, content scrollY first becomes 27 px; at .816 the existing observer changes the header from 0 to 767 px. Content dimensions remain stable and refresh is still active. The release fling, rather than proven refresh-completion layout, causes this captured jump.
- The installed native Pager now draws the active refresh indicator above the shared header at the Host viewport top. SwipeRefreshLayout retains animation, state and trigger ownership. NativeList supplies its actual coordinator inset through a native View tag so the foreground subtracts it once. No JS API/dependency or iOS/Web source changes. Direct drawing retains the native circle/arc but not the RenderNode elevation shadow.
- The Host tracks a weak pending-pull target only for this touch gesture's remaining downward travel. Its pre-fling is consumed when the same visible pull, expanded header and top content are still active; stop/replacement/page selection/detach clear that target. Actual AndroidX 1.1.0 ordering confirms this does not prevent finishSpinner from dispatching refresh. Exact zero-distance reversals can retain a visible indicator and still settle instead of flinging.
- Evidence is under `local/home-native-pager/evidence/android-refresh-jump/`: `baseline-fast-release.mp4` versus `fixed-fast-release.mp4`, scalar logs, per-tab recordings and `diagnosis.md`. The fixed case records a consumed 1818 px/s release velocity, stable expanded header and top feedback. Five Home tabs were exercised from header and content origins. This round verifies geometry; it does not independently recount callbacks or establish all downstream network completion. Additional ordinary upward scrolling and horizontal paging were observed; failed coordinate-based expansion/return attempts are excluded from acceptance.
- Standalone production-helper tests pass for native insets and foreground alpha ownership/restoration; test-integrity passes 39 files and diff checks pass. JVM checks do not exercise Canvas or Android fling dispatch. Native fixed build passes; temporary scalar diagnostics were then removed. Clean Host SHA256 is `5ccb96d34bf7097aebf1e8850b603666da09a9f957eab55660d813ed2ca3a643`. Six installed native source/test/resource files were synchronized to module PR #135 with their specs.
- This correction is a local native build over npm Pager `.257` and NativeList `.255`; those versions do not yet contain it. A fresh yarn install would replace the installed modifications until new package versions are released. Nested real owner replacement, dynamic caller geometry, physical-device performance and broader lifecycle acceptance remain open. Both PRs remain drafts.
- Final clean-source Android build succeeds in 1m56s and is installed on `emulator-5580`, preserving TEST data and Metro 8082. `final-clean-fast-release.mp4` keeps the expanded Spot header through the reproduced reversal; `final-clean-history.mp4` shows the top NativeList indicator and its dismissal after six seconds. Diagnostics are removed and their adb opt-in/capture is stopped. Module commit `a99d260d8` is pushed to PR #135. App commit profile passes (`2026-09-28T02-43-30-587Z`); current-head hosted CI remains separate.

### Independent NativeScroller — 2026-09-28

- Both mobile implementations now own their scroll engine: Android uses AndroidX NestedScrollView and SwipeRefreshLayout; iOS uses UIScrollView and UIRefreshControl. The existing package export and React content remain. No ReactAndroid source build or RN native-source patch is required. Native views belong to the main UI surface; background JS does not own their gesture state. Web and NativeList implementations remain separate.
- Fabric owns the React content frame. Native state supplies content displacement and separate ancestor displacement so child measurements match native scrolling without per-frame JS layout. A private, deduplicated layout event supplies the available content height for `flexGrow`; it excludes repeated header space and refresh-generated insets. The package SPEC defines the supported vertical API and lifecycle boundaries.
- Android first-pass device evidence confirms real NativeScroller instances and continuous non-touch travel across content offset zero into header expansion. The trace `android-perps-continuous.log` retains momentum while content reaches zero and the header continues from 760 to 467 px. A larger gesture reaches a fully expanded header. Gallery end-row measurement is 746.7 pt versus native 1960 px / 2.625 = 746.67 pt, with matching 72 pt height.
- Acceptance exposed two boundary failures before delivery: Android `flexGrow` added 284 px of artificial range after long content became empty; UIKit synchronously changed a negative pull from -240 to -200 when content became empty. The first is addressed by native available-height reporting; the second preserves the existing negative pull while retaining normal upper-range shrink clamping. The final Android binary removes the false range (local offset 0 with visible empty content); the final iOS UIKit harness preserves -240. Real-page evidence is recorded below.
- The JS contract suite passes 8 tests; package TypeScript/declaration generation and npm packaging checks pass. The app commit profile passes at `2026-09-28T10-09-20-043Z`. Initial UIKit execution passed 6 of 7 methods and identified the negative-pull failure. On the final running iOS binary, all 9 same-source UIKit harness methods and 36 assertions pass, including the corrected pull and independent pager reservations (`ignore/native-scroller-ios/uikit-results-v6.json`). This harness is not a formal XCTest runner.
- The first Android device pass covers Home Spot/Perps/DeFi scrolling and visible refresh, Gallery React presses and controlled refresh, and History/NFT/Market/Discover interaction controls. It does not establish DApp WebView readiness or physical-device frame performance. The final Android build additionally passes long-to-empty/restore, controlled short-content refresh, final-row measurement and continuous Perps return (`android-acceptance.md`). The final iOS build succeeds and reaches the running DevSession; real-page acceptance is recorded separately.
- Evidence and build logs are under `ignore/independent-native-scroller/`; UIKit assertions are under `ignore/native-scroller-ios/`. Installed sources are synchronized to the modules worktree. They are local changes over npm Pager `.257`, not a published package; a normal reinstall would replace them. Dedicated targets remain Android `emulator-5580` / Metro 8082 and iOS `21AFD01B-0CB1-43E8-AD1E-1C8B89123870` / Metro 8083, with external-drive user data.

- Final dedicated DevSessions are Android `wk-e4dc44479fcd-dev-5e6f2505624f-eafbd14a69861b48` and iOS `wk-e4dc44479fcd-dev-842d8ebbf095-37e6b4d4e8a8b660`, both local-built shell/vendor, `userNoticeRequired=false`. An earlier iOS prewarm failed because the native interface changed during vendor preparation; freezing source and rebuilding resolved it. The host Simulator application bundle is unavailable, so a task-local ignored launcher shim reuses the already running Simulator process. This does not repair the host installation.
- Final iOS Home interaction shows Spot → Perps → DeFi horizontal page changes and top-positioned native refresh feedback on all three pages (`ios-home-final.mp4`, `ios-*-refresh*.png`). `agent-device gesture pan` used a private synthesized path with an implausibly short duration and once opened a row; that attempt is excluded as reliable drag evidence. Public XCTest `gesture fling` performed the visible continuous drag/page transitions.
- Final iOS targeted acceptance passes Gallery long/empty/restore, scroll-to-end, measured child position (y786/h72 matches the native frame), one controlled refresh and completion, React press and retained-page return. Home History/NFT and Discover/Market basic controls pass without unintended detail navigation. See `ignore/independent-native-scroller/ios-acceptance.md`; keyboard, multi-touch, physical hardware and the exhaustive contract matrix remain open. Gallery's floating bottom bar can overlap the last row; measurement agreement does not establish an unobscured bottom viewport. Both dedicated devices are left at expanded Spot with Metro running.

### Android Home banner horizontal ownership — 2026-09-28

- User acceptance exposed a missed Home control: the shared Banner rail did not move horizontally, although vertical drags from that region collapsed the header. On emulator-5580, existing native logs recorded `horizontalChild=false`, `header_guard` and press cancellation. The rail used RNGH Pan plus a translated React View, while the Pager recognizes native horizontal scroll owners. Early native interception also cancels pending RNGH recognizers.
- The app-only Android rail now uses the existing horizontal ScrollView with identical React cards, padding, gap and business callbacks. iOS retains its previous Pan path; Web and native Pager interception code are unchanged. No new package or native rebuild is required.
- After a fresh launch of the existing dedicated DevSession, logs record `horizontalChild=true` and `horizontal_child`. Spot and Perps rail left/right movement, horizontal-dominant diagonal movement, vertical header collapse and return pass. Native logs still assign vertical gestures to `list`, with no horizontal page change. Evidence: `ignore/independent-native-scroller/android-banner-fixed.mp4`, screenshots and `android-banner-gesture.log`.
- Temporary click diagnostics confirm SMCI and UNITREE each emit the title of the visible tapped card after scrolling. UNITREE subsequently opens Bitway USDT; this separate business-routing observation remains unresolved and is not attributed to hit testing or declared fixed. Temporary diagnostics were removed. The close/dismiss persistence path was not exercised.
- Commit-profile checks pass at `node_modules/.cache/agent-checks/2026-09-28T12-17-13-716Z/summary.json`. The initial Metro reload did not refresh the running app; acceptance uses the restarted process and its observed native HorizontalScrollView. Existing developer warnings remain outside this fix.

### Published independent scroller integration — 2026-09-28

- Module source `3c3206f2` is pushed to PR #135. CI publishes Pager and NativeList `3.0.157-alpha.258` to `next`: runs `36425400446` and `36426144745` both succeed. The separate preview branch preserves the source branch's stable manifests. NativeList's first single-package release stopped before upload because Image declarations were missing; the preview workflow now builds Image before NativeList without publishing Image.
- App mobile and kit consumers use NativeList `.258`; the mobile Pager alias uses `.258`. The other 39 app-modules packages stay `.255`. Standard Yarn installation and immutable verification pass. Standard CocoaPods installation updates only these two pod versions/checksums. It reports existing binary Info.plist parsing warnings in ignored build output, without failing installation.
- Registry integrity and source audits pass: Pager has 70 matching tracked files and NativeList 203. All 99 Pager and 358 NativeList installed files match their npm tarballs. Production source matches the previously accepted local source; only the intentionally excluded Pager JS test file disappears on reinstall. Audit evidence is under `ignore/independent-native-scroller/release-audit/`.
- The new dependency pins remove the need for installed-package source overrides. This publication turn verifies packaging and integration, not a fresh npm-only native binary or another complete simulator acceptance matrix. Earlier device results remain scoped to the byte-identical production source recorded above.
- Source CI run `36425318407` passes Android, Kotlin and Swift checks, plus the nine NativeScroller iOS tests. The overall iOS job fails 17 assertions in the direct press-cancellation fixture; the three real wiring tests pass. Fixture investigation and rerun are tracked separately; this is not an all-green native CI claim. PRs remain drafts.
