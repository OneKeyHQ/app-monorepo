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

Implementation dispatched to the three owners above. The native Home integration now uses NativeList for History and NFT rows; their existing business handlers and React container header/footer content remain authoritative. NativeList capabilities and native scrolling are being validated together.

The parent created dedicated simulator `OneKey-HomePager-iOS26.5`, UDID `21AFD01B-0CB1-43E8-AD1E-1C8B89123870`. Its task-owned data directory is under `local/home-native-pager/simulators/` with a default-device-set symlink. Boot failed with CoreSimulator error 513 / POSIX Operation not permitted writing the external volume. Direct external device-set creation failed for the same reason and its incomplete allocation was deleted by CoreSimulator. No unrelated simulator was modified or booted.

The user explicitly rejected internal-disk simulator data. All task simulator data must remain on the external drive. Live kernel logging at 2026-09-27 00:12:57 +0800 confirmed `System Policy: com.apple.CoreSimulator.CoreSimu(16446) deny(1) file-write-create` for the external device's `data/Library/Logs`. The APFS volume and ordinary directory permissions are writable. System Settings has no CoreSimulator removable-volume entry. A specific authorization request is pending to add Apple's CoreSimulatorService to Full Disk Access; no privacy setting has been changed. No successful boot, app interaction or performance result is established yet.

Android harness: dedicated `OneKey_HomePager_API36`, serial `emulator-5580`, API 36 Google APIs arm64, Pixel 6 profile. `ANDROID_AVD_HOME`, AVD metadata and writable userdata are under `local/home-native-pager/android-avd/`. `sys.boot_completed=1` was verified. Emulator boot is established; application build and interaction acceptance remain pending. Emulator log: `local/home-native-pager/evidence/android-emulator.log`.

Dependency validation evidence: `node_modules/.cache/agent-checks/2026-09-26T15-35-00-776Z/summary.json`.

Integrated checks: `node_modules/.cache/agent-checks/2026-09-26T16-30-05-575Z/summary.json` passed lint, format, storage, agent context, background API, test integrity and package patch gates. TypeScript found five integration diagnostics (icon name, nullable fee token, freshly added module typings and a test intl fixture). All were corrected; the full retry passed at `node_modules/.cache/agent-checks/2026-09-26T16-43-46-996Z/summary.json`. The native-only Gallery fixture was added afterward and passed targeted lint and staged TypeScript; final gates must include that fixture.

Native compilation: Pods reinstalled successfully (197 dependencies, 218 pods).
The first local `dev-shell:build --platform ios --skip-pods` exited with a
NativeList `RNCNativeListView.swift` compilation failure; its owner is correcting
the actual compiler diagnostics before the next incremental build. The ExpoModulesJSI
nested xcframework step succeeded despite misleading quiet-mode console diagnostics. Log: `local/home-native-pager/evidence/ios-build.log`.
Both-platform module graph scan completed, log: `local/home-native-pager/evidence/module-registry.log`.
Normal acceptance launches must force `--shell local --vendor local` while native
sources and generated JS differ from the published `.254` package contents.

Implementation checkpoint: Home uses native pager coordination, NativeScroller for
Spot/Earn/Perps, and NativeList for NFT/History. Native-only provider identity keys
include wallet, account and network. History metadata requests use stable identity
keys, cache misses and bounded concurrency. The focused financial mapping suite
passes 11 tests and staged TypeScript checks passed after integration fixes; a
full commit-gate rerun passed before the Gallery fixture was added. NativeList package tests passed
201 cases. These checks do not establish UI or performance acceptance.

Android's first full local build passed (2011 Gradle tasks, 9m 2s). A subsequent
media lifecycle fix releases paused video players when retained pages leave the
visible viewport, so the final Android artifact must be rebuilt before acceptance.
iOS is rebuilding with the Swift correction and the same viewport lifecycle fix.
The native video resource owner is each intersecting UI tile; no player is shared
with the background runtime. Android buffering is bounded by configured targets,
while iOS forward-buffer duration is advisory; decoder memory is platform-owned.

First Android runtime launch reached `status=running`, with local-built shell and
vendor, remote WebEmbed, and no required user notices. Receipt:
`node_modules/.cache/onekey-mobile-dev/sessions/wk-e4dc44479fcd-dev-5e6f2505624f-0f1406ab51cb54a8/run-result.json`.
The actual app displayed the first-run wallet onboarding UI. This session was
stopped for the final native rebuild; it does not validate the later native fixes.
The Gallery fixture is in the existing NewTabs story and is gated to native; it
uses public sample media and covers native rows, container slots, refresh, column
counts and retained-page video behavior without requiring account secrets.
