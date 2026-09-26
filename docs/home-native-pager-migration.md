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
| App/session ready and correct worktree/version | Pending | Pending | |
| Actual Wallet Home with test data | Pending | Pending | |
| Vertical/diagonal fling from header and content | Pending | Pending | |
| Horizontal paging, rapid reversal and nested boundaries | Pending | Pending | |
| Expanded/collapsed header page switching | Pending | Pending | |
| Refresh on long/short/empty content | Pending | Pending | |
| Account/network switching and modal return | Pending | Pending | |
| NFT layout/image reuse/navigation | Pending | Pending | |
| History updates, pagination and pending actions | Pending | Pending | |
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

- App draft PR: https://github.com/OneKeyHQ/app-monorepo/pull/13750 (`bf4fafb389`).
- Module draft PR: https://github.com/OneKeyHQ/app-modules/pull/135 (`94ef1e1d`).
- The native implementation and focused source checks are complete. Interactive acceptance remains pending; neither PR is ready to merge.
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
| NativeList package tests | 201 passed | Module PR validation |
| Focused app tests | Financial mapping 11, refresh 2, dynamic tabs 1 passed | Focused test runs |
| Native focused policies | End alignment 4, post-generation 2 passed; renderer/media API compile checks passed | Module PR validation |
| Final iOS full app build | Passed | `local/home-native-pager/evidence/ios-build-final-font.log` |
| Final Android full app build | Passed; 166 tasks executed, 1845 up-to-date | `local/home-native-pager/evidence/android-launch-final.log` |
| XCTest runtime / Home interaction / timing | Pending | No device acceptance claim |

Both-platform module graph scans completed (`local/home-native-pager/evidence/module-registry.log`). Pods installation succeeded with 197 dependencies / 218 pods. The initial Swift compiler overload failure was corrected; subsequent complete iOS builds passed.

### Device handoff

Android uses dedicated `OneKey_HomePager_API36`, serial `emulator-5580`, API 36 Google APIs arm64, Pixel 6 profile. `ANDROID_AVD_HOME`, AVD metadata and userdata are under `local/home-native-pager/android-avd/` on the external drive.

The final Android DevSession reached `status=running`: local-built shell and vendor, cached WebEmbed, no required user notices. Receipt: `node_modules/.cache/onekey-mobile-dev/sessions/wk-e4dc44479fcd-dev-5e6f2505624f-7c7dfbe73a5f58e4/run-result.json`. Keep its Metro session alive. The real app displayed first-run onboarding and the emulator was observed in the foreground; user password entry is pending. Do not restart or manipulate the window while the user initializes it.

Gallery acceptance uses Developer → Gallery → NewTabs → the native fixture. It contains public sample media, rich Activity rows, header/footer/empty slots, refresh, 2/6/7 columns and retained-page switching. Normal onboarding is required to reach Developer; do not bypass authentication or expose a new arbitrary deep link. QA backup import must follow the authorized backup directory's runbook, with temporary code excluded from commits and passwords entered in App secure fields.

The dedicated iOS simulator is `OneKey-HomePager-iOS26.5`, UDID `21AFD01B-0CB1-43E8-AD1E-1C8B89123870`. Task-owned data is under `local/home-native-pager/simulators/` with a default-device-set symlink. It has not booted successfully. Kernel logging at 2026-09-27 00:12:57 +0800 confirmed System Policy denied CoreSimulator file creation in the external device's `data/Library/Logs`, despite writable APFS and directory permissions. A specific request to grant Apple's CoreSimulatorService Full Disk Access remains pending; no privacy setting was changed. The user forbids internal-disk simulator data, so no internal fallback is allowed.

Normal acceptance launches must use `--shell local --vendor local` while installed package source differs from published packages. Simulator boot, build success, active App readiness, row correctness and performance remain separate evidence levels.
