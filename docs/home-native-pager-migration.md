# Wallet Home native pager migration

## Scope and acceptance contract

- Target: iOS and Android, including iPad. Preserve Web, desktop and extension rendering and behavior.
- Workspace: `/Volumes/T7Shield/Project/app-monorepo-home-native-pager`.
- Branch: `codex/home-native-pager`; initial base: `4a193dd92d` (`origin/x`).
- Dependencies: app-modules `3.0.157-alpha.254`. All 50 manifest references and installed workspace resolutions were checked.
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
| App/session ready and correct worktree/version | External-disk permission blocked | Passed | Local shell/vendor DevSession receipt below |
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
- Native implementation and focused source checks are complete. Android has partial interactive acceptance below; iOS interaction and comparable performance measurements remain pending. Neither PR is ready to merge.
- Home uses NativeScroller for Spot/Earn/Perps and NativeList for History/NFT. Native-only provider keys isolate wallet/account/network state. History metadata queries use stable identities, cache misses and bounded concurrency.
- NativeList includes rich Activity rows, paused media fallback, viewport-based video resource release, 2–7 grid columns, React container slots, configurable refresh distance, threshold events and ancestor-header contributions. The final audit corrected duplicate iOS refresh haptics, tall Android end-slot alignment and small-number typography.
- Each visible native media tile owns its player; background JS owns none. Android buffer settings are targets, not a total decoder-memory cap. iOS forward-buffer duration is advisory.
- New native APIs are not in published `.254`. The app draft uses modified installed sources locally and requires a released companion package before clean-checkout integration. No native package patch, version bump or npm publication is included.

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

The final Android DevSession reached `status=running`: local-built shell and vendor, cached WebEmbed, no required user notices. Receipt: `node_modules/.cache/onekey-mobile-dev/sessions/wk-e4dc44479fcd-dev-5e6f2505624f-84ba928b2ed15bfd/run-result.json`. Keep its Metro session alive. The user completed onboarding and entered the password in the App. The AVD now uses 6144 MB RAM after the earlier 2 GB configuration caused low-memory exits. TEST wallet Account #1 loads real assets. This debug emulator setup is not physical-device performance evidence.

Gallery acceptance uses Developer → Gallery → NewTabs → the native fixture. It contains public sample media, rich Activity rows, header/footer/empty slots, refresh, 2/6/7 columns and retained-page switching. Normal onboarding is required to reach Developer; do not bypass authentication or expose a new arbitrary deep link. QA backup import must follow the authorized backup directory's runbook, with temporary code excluded from commits and passwords entered in App secure fields.

The dedicated iOS simulator is `OneKey-HomePager-iOS26.5`, UDID `21AFD01B-0CB1-43E8-AD1E-1C8B89123870`. Task-owned data is under `local/home-native-pager/simulators/` with a default-device-set symlink. It has not booted successfully. Kernel logging at 2026-09-27 00:12:57 +0800 confirmed System Policy denied CoreSimulator file creation in the external device's `data/Library/Logs`, despite writable APFS and directory permissions. A specific request to grant Apple's CoreSimulatorService Full Disk Access remains pending; no privacy setting was changed. The user forbids internal-disk simulator data, so no internal fallback is allowed.

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
