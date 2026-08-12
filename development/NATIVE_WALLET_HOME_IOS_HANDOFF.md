# Native Wallet Home iOS Renderer Handoff

## 1. Status and authority

- Base branch: `x`
- Working branch: `codex/native-wallet-home-ios`
- Read-only reference branch: `codex/native-home-container`
- Current phase: Slice 3 implemented; awaiting manual acceptance
- First target: iOS only
- Android work starts only after the iOS behavior and architecture have been accepted

This document is the implementation contract for the iOS-first migration of
Wallet Home rendering. Every implementation slice must stop at its acceptance
gate and wait for manual approval before the next slice starts.

The reference branch is authoritative only for:

1. Product behavior and UI fixtures.
2. Verified iOS scrolling, pager, gesture, sticky-header, and list-reuse
   algorithms.
3. Owner switching, empty wallet, unbacked wallet, and tab regression cases.
4. Focused tests that can be reused without importing the old architecture.

It is not an implementation base. No commits or directories will be copied as
a unit.

## 2. Objective

Move the mobile Wallet Home rendering workload to a mounted Swift
`HomeContainer` while keeping existing JavaScript state, services, requests,
balance calculation, capability decisions, and navigation as the only business
authority.

The shared boundary is deliberately asymmetric:

| Concern | Owner | Consumers |
| --- | --- | --- |
| Requests, business state, balances, capabilities, refresh, navigation | Existing `kit` / `kit-bg` code | All current platforms |
| Typed section controllers and presentation calculations | `kit` | Legacy React UI and Native ViewModel |
| Native renderer protocol | `native-components` | TypeScript and Swift initially; Kotlin later |
| Scrolling, pager, sticky header, list reuse, pull to refresh, pixels | Swift | iOS |

Web, Desktop, Extension, URL-account Home, and all unsupported Native cases
must continue to resolve to the existing React implementation.

## 3. Runtime and ownership model

iOS runs the UI `main` runtime and `bg` runtime in separate JavaScript heaps.

- `HomeContainer` is created and held only by the main UI runtime.
- Background services remain unchanged and never import or create a Native
  view.
- Main and bg initialize independently. The Native ViewModel must represent
  loading states and must not assume bg readiness.
- Pager, list instances, page data, refresh state, and scroll offsets belong to
  the mounted `HomeContainer` instance.
- Phase 1 has no process-wide Native cache.
- No new persistent Home snapshot is introduced before release profiling.

## 4. Data flow

```text
Existing Home services and Jotai contexts
    -> existing or narrowly extracted typed section hooks
    -> useNativeHomeViewModel()
    -> HomeContainer.setState(currentFullState)
    -> Swift renderer and native list diffing
    -> owner-scoped semantic intent
    -> current-owner/current-ViewModel validation in JavaScript
    -> existing action or navigation handler
```

`useNativeHomeViewModel()` is a read-only composition hook. It is not a Store,
request coordinator, reducer, cache, or readiness barrier.

It returns the complete display state available at the current instant. Slow
sections do not block fast sections, and each real section has its own explicit
state such as `initialLoading`, `ready`, `refreshing`, or `error`.

The initial protocol shape is intentionally concrete:

```ts
type NativeHomeViewModel = {
  protocolVersion: 1;
  owner: NativeHomeOwnerToken;
  selectedTab: NativeHomeTabId;
  header: NativeHomeHeaderViewModel;
  tabs: NativeHomeTabViewModel[];
  portfolio: NativeHomePortfolioViewModel;
  theme: NativeHomeThemeViewModel;
};
```

Later tabs add explicit optional fields such as `history`, `nft`, `defi`, and
`perps`. There is no generic `sections` array, generic item renderer, or JSON
business value type.

### Progressive rendering rules

- A section publishes useful partial data as soon as it exists.
- Token structure can render before valuation fields are available.
- Row skeletons and resolved rows keep stable identifiers and compatible
  heights.
- Same-owner refresh keeps existing rows visible and sets `refreshing`.
- Owner change immediately publishes a new-owner loading ViewModel without old
  rows.
- Native applies diffable snapshots and does not rebuild the mounted view.
- The first version sends the current full ViewModel. It records build time,
  payload bytes, commit rate, and Native diff time.
- Only release profiling may justify a narrow owner-scoped update channel for
  high-frequency asset valuation. It must not become a general patch protocol.

## 5. Owner and intent safety

One token protects both display state and intents:

```ts
type NativeHomeOwnerToken = {
  scopeKey: string;
  sessionId: string;
};
```

`scopeKey` is derived from the current Home selection:

```text
sceneName | walletId | accountId | effectiveTokenOwnerId | networkId
```

`effectiveTokenOwnerId` reuses the existing
`getTokenListOwnerCacheAccountId()` merge-derive rule. It is not a new owner
identity system.

`sessionId` changes whenever the mounted owner scope changes, including an
A -> B -> A switch.

Before executing an intent, JavaScript must:

1. Compare the intent token with the current mounted owner token.
2. Find the referenced action or item in the current ViewModel.
3. Re-resolve the current account and network through existing state.
4. Invoke the existing action/navigation handler only if all checks pass.

There is no command registry, presentation revision, transport revision, ACK
protocol, or second action authority. A stale intent is a no-op.

## 6. iOS implementation slices and manual acceptance gates

### Slice 0 - Handoff approval

Deliverable:

- This document on a branch based directly on `x`.
- Confirmed scope, runtime boundaries, staged implementation, and validation
  matrix.

Manual acceptance:

- Architecture and phase boundaries are approved.
- The first implementation slice is small enough to review independently.

Stop condition: do not create the Native package or modify application code
until this gate is accepted.

### Slice 1 - iOS bridge foundation

Deliverable:

- Minimal `@onekeyhq/native-components` package and Nitro iOS bridge.
- Strongly typed owner, theme, tab, header-shell, and portfolio-shell protocol.
- A mounted Swift `HomeContainer` that displays a diagnostic shell only.
- A Native-only loader gated by iOS main runtime and existing Home eligibility.
- Legacy fallback for every non-eligible path and every non-mobile platform.
- One round-trip test intent that carries the owner token but performs no
  business action.

Non-goals:

- No real Header or Portfolio data.
- No Android source or Android application wiring.
- No service calls, caches, slots, pager behavior, or navigation changes.

Automated checks:

- Protocol unit tests.
- Package TypeScript check.
- Focused Home loader/fallback tests.
- iOS Debug build or the narrowest native compilation target available.

Manual acceptance:

- Eligible Home: the diagnostic Native surface mounts only in iOS main UI.
- Ineligible and non-iOS Home paths continue to render the Legacy surface.
- Leaving and returning to Home creates and tears down the mounted view cleanly.
- Web, Desktop, Extension, and Android source paths remain unchanged.

Stop after reporting build instructions and the exact visual pass condition.

### Slice 2 - Header and owner safety

Deliverable:

- Extract the minimum reusable Header presentation calculation from current
  Home hooks.
- Native Header skeleton, resolved balance, wallet actions, and visual states.
- Owner change immediately replaces the old display with the new-owner loading
  state.
- Owner-scoped Header intents reuse current JavaScript handlers.
- No wallet, unbacked wallet, unsupported wallet, and auth-gated paths continue
  to use the Legacy surface.

Manual acceptance:

- Backed zero-balance wallet.
- Backed funded wallet.
- All Networks and a single network.
- Rapid account/network switching.
- Tapping an old-owner Header action never executes.
- Header height and sticky transition do not jump as values resolve.

Implementation checkpoint (2026-08-12):

- Expected: Header data resolves independently from later Portfolio/tab data;
  a slow balance publishes `loading`, then replaces only the Header fields when
  an exact-owner value becomes available.
- Current before Slice 2: the Swift diagnostic shell has no business data and
  emits only a diagnostic owner round trip.
- Failure conditions: reusing another owner's last balance, keeping funded
  actions enabled while a new owner is loading, executing an action absent
  from the current Header ViewModel, or invoking a different action handler
  than Legacy Home.
- Automated pass condition: the shared balance resolver is used by both Legacy
  and Native producers; focused tests cover loading/zero/funded transitions and
  stale-owner action rejection; TypeScript and iOS compilation pass.
- Visual pass condition: a stable-height Native Header shows skeleton, zero,
  and funded states; account/network switching immediately clears the previous
  owner's interactive state before the new value resolves.

Implementation result (2026-08-12):

- The Native Header now consumes the current owner-scoped balance result and
  the same resolved-balance calculation used by Legacy Home. Slow data remains
  an explicit Header `loading` state and does not block the later Portfolio
  producer.
- Legacy Wallet action components and the Native producer call the same action
  hooks. Native emits only an owner token and concrete Header action ID; the JS
  boundary checks the current owner session and verifies that the action is
  still enabled in the current Header ViewModel before executing it.
- The mounted Swift view renders loading, zero, and funded Header layouts. It
  owns the Header pixels and scrolling surface, while the Portfolio area
  remains an intentionally non-interactive Slice 2 shell.
- After the first manual review, the funded Header was aligned with the Legacy
  mobile layout: an empty action subtitle no longer reserves height, funded
  actions fill the available row evenly, labels stay on one line at the Legacy
  body-small scale, and action foreground/background colors use the existing
  neutral and primary theme values instead of the brand tint.
- The follow-up pixel pass now uses the registered Roobert faces and the exact
  Legacy metrics instead of UIKit preferred fonts: balance is 48/48 medium,
  action labels are 12/16 regular, and the focused text tab is 18/24 semibold.
  The balance decimal uses the concrete theme `disabledTextColor`, while action
  icons use `secondaryTextColor` to match `$icon` rather than `$text`.
- Funded actions now use a section-specific `UIControl` with the Legacy 10/24/
  4/16/8 vertical geometry and concrete OneKey icon paths. This replaces SF
  Symbols and `UIButton.Configuration` without adding an icon framework,
  dependency, renderer store, or business state. The 20 pt Header gap, 62 pt
  action height, 10 pt inter-card gap, 16 pt radius, 32 pt Header bottom inset,
  and 14 pt text-tab top inset match the current Legacy component tokens.
- The rebuilt app was covered-installed and launched on the iPhone 17 Pro
  simulator without clearing app data. The funded Header screenshot confirms
  proportional Roobert balance digits, disabled-color decimals, OneKey action
  shapes, and the corrected Portfolio baseline. The Native More control opened
  the existing JS action sheet, and the 48 pt balance control toggled the exact
  Legacy `****` privacy text and restored the value.
- The iOS Debug simulator build passed, and the signed app was installed and
  launched on an iPhone 17 Pro simulator. A funded All Networks fixture showed
  the expected Send/Receive/Buy/More actions, working balance privacy
  toggling, and the existing More action sheet.
- Focused validation passed: native-components lint, repository TypeScript,
  four focused Jest suites (nine tests), Nitro code generation, CocoaPods
  integration, and the iOS Debug build.
- Automated stale-owner coverage includes A -> B -> A session reuse, absent
  actions, and mismatched owner tokens. Rapid live account/network switching,
  zero-balance layout, single-network layout, and sticky-height behavior remain
  manual acceptance items.

Manual launch for this checkpoint:

```sh
yarn app:native-bundle
xcodebuild -workspace apps/mobile/ios/OneKeyWallet.xcworkspace \
  -scheme OneKeyWallet -configuration Debug \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build
```

Stop condition: do not begin Slice 3 until the Slice 2 manual matrix is
accepted.

### Slice 3 - Portfolio structure and vertical scrolling

Deliverable:

- Extract the existing Token List producer/projection seam without duplicating
  requests or business state.
- Render asset metadata as soon as the structure frame is available.
- Swift list reuse with stable item identifiers and diffable data source.
- Native vertical scrolling and sticky Header coordination.
- Asset selection intent revalidates the current item before invoking the
  existing handler.

Manual acceptance:

- Empty, zero-value, single-network funded, and All Networks portfolios.
- Long list reaches the real bottom and recycles cells.
- Structure-first/valuation-later rendering keeps stable scroll position.
- Rapid owner switching never exposes actionable old rows.

Implementation checkpoint (2026-08-12):

- Expected: the existing Token List producer publishes current-owner structure
  and metadata without waiting for valuation; Swift owns the complete vertical
  list, stable-ID reuse, scrolling, sticky Portfolio tab, and item pixels.
- Current before Slice 3: Swift renders only the accepted Slice 2 Header and a
  non-interactive Portfolio shell. Legacy React Native remains the only Token
  List renderer.
- Failure conditions: starting a second token request path, retaining rows from
  another owner, limiting the Native list to a JS-selected window, resetting
  offset when same-owner metadata resolves, or executing an item absent from
  the current ViewModel.
- Automated pass condition: focused projection/ViewModel and intent tests pass,
  Nitro generation and package lint pass, and the iOS Debug target compiles.
- Visual pass condition: an All Networks fixture can fling through the complete
  Native list to its real bottom, the Spot tab remains pinned, a current token
  opens the existing JS details flow, and returning preserves the mounted
  Native list offset.

Implementation result (2026-08-12):

- The existing Token List component now exposes a producer-only mode. It keeps
  the current hooks, requests, Jotai context, projection rules, and press
  handler alive while returning no React token rows; it does not add a Home
  Store or request coordinator.
- The iOS Native ViewModel reads the exact current-owner list structure and
  metadata cells, reuses the existing pure Home projection, and publishes
  explicit `initialLoading`, `ready`, and `empty` Portfolio states. An owner
  mismatch immediately publishes no rows.
- The protocol carries concrete Portfolio item fields and stable item IDs. It
  sends the current full state and intentionally has no pagination, display
  window, patch, ACK, revision, or generic section payload.
- Swift now renders the complete projected list through one
  `UICollectionViewDiffableDataSource`. Cells cancel image tasks on reuse;
  Pager/list state and offset remain owned by the mounted view, and no Native
  image or business cache was added.
- Portfolio item intents carry the same owner token as Header intents. The JS
  boundary verifies the current owner and current enabled item, then resolves
  the current token and invokes the existing Token List press handler.
- The iOS Debug app was rebuilt, cover-installed, and launched on an iPhone 17
  Pro simulator. A long All Networks fixture reached the real bottom through
  repeated flings, kept Spot pinned, opened the existing token details screen,
  and restored the previous Native offset after closing it.
- Focused validation passed: native-components lint, three Jest suites (nine
  tests), Nitro code generation, and the iOS Debug simulator build. Empty,
  zero-value, single-network, and rapid live owner-switch cases remain the
  manual acceptance gate for this slice.

The valuation-shaped placeholders are deliberate in Slice 3. Token quantity,
price, fiat value, same-owner refreshing, and pull to refresh belong to Slice 4
and must not be started before this gate is accepted.

### Slice 4 - Portfolio valuation and pull to refresh

Deliverable:

- Progressive balance, price, fiat value, and change fields.
- Same-owner refresh preserves visible content.
- Native pull-to-refresh emits the existing semantic refresh action.
- Refresh completion is owner-scoped and request-scoped.
- Instrument ViewModel build time, payload size, commit rate, and Native diff
  duration; do not add an incremental protocol yet.

Manual acceptance:

- Slow or partial valuation does not block token metadata.
- Pull-to-refresh works repeatedly and cannot complete the wrong owner.
- Price changes update the correct rows without scroll jumps.
- Background-not-ready and network-error paths remain usable.

### Slice 5 - iOS Pager and tab shell

Deliverable:

- Port only the verified iOS vertical/horizontal gesture arbitration and pager
  settling algorithms from the reference branch.
- Queue programmatic tab selection while settling.
- Preserve per-page offsets in the mounted view.
- Unmigrated tabs use an explicit whole-page Legacy handoff; they are not RN
  slots embedded inside the Native pager.

Manual acceptance:

- Slow and fast horizontal swipes.
- Diagonal gestures and vertical scrolling near pager boundaries.
- Rapid consecutive tab selections.
- Programmatic `SwitchWalletHomeTab` behavior.
- Returning from a Legacy handoff restores the expected selected tab.

### Slices 6-9 - One tab per slice

Order:

1. History
2. NFT
3. DeFi
4. Perps

Each slice may add only that tab's typed controller, ViewModel, Swift renderer,
intent validation, focused tests, and manual regression cases. It must stop for
manual acceptance before the next tab begins.

### Slice 10 - iOS release profiling

Run Legacy and Native on the same release fixture and device, at least three
times each, and compare medians.

Primary measurements:

- JavaScript scroll callback count and busy time.
- React commit count and reconciliation duration while scrolling.
- Dropped frames and jank during vertical scroll and pager gestures.
- Native list diff time and recycled cell count.
- ViewModel build time, payload bytes, and commit rate.
- Time to first usable Home.
- Stale-owner action count, which must remain zero.

Existing token start/span thresholds are guardrails, not proof that the Native
renderer is faster.

Only this slice may propose lazy tab materialization, a bounded image cache,
snapshot persistence, or a narrow partial update channel. Any such proposal
requires a new manual approval before implementation.

## 7. Expected initial file boundary

Slice 1 may touch only the following logical scope:

- `packages/native-components/`
  - package manifest, podspec, Nitro specification, generated bridge files,
    TypeScript protocol/wrapper, and iOS Swift implementation;
- `packages/kit/src/views/Home/`
  - iOS main-runtime renderer selection, Native page, and focused tests;
- `packages/kit/package.json`;
- `apps/mobile/package.json`;
- `yarn.lock`;
- iOS dependency metadata only if autolinking proves it is required.

Changing `Podfile`, Xcode project files, a public shared interface, `kit-bg`,
global storage, app startup, splash, AccountSelector, background runtime setup,
or adding a third-party dependency is outside Slice 1. Stop and request approval
if one of those becomes necessary.

Android source, Gradle files, and Android dependencies are explicitly out of
scope until the iOS implementation is accepted.

## 8. Permanent exclusions

Do not introduce or copy:

- Home Unified Store;
- Facts -> Semantic -> Surface -> DTO projections;
- policy or semantic frameworks;
- generic source coordinators;
- generic Home reducer, state machine, or event sourcing;
- mutation-patch infrastructure;
- Display Snapshot V2 or cross-platform Home caches;
- `IHomeRuntimeJsonValue` or generic renderer items;
- whole-tab RN slots;
- Native business services or navigation;
- unrelated AccountSelector, Splash, Desktop throttle, hardware wallet, Prime,
  ADA, Navigation, or global storage changes.

## 9. Acceptance matrix

The complete iOS implementation must cover:

- No wallet.
- Unbacked wallet.
- Backed zero-balance wallet.
- Single-network funded wallet.
- All Networks.
- Rapid owner/account/network switching.
- Portfolio, History, NFT, DeFi, and Perps.
- Pull-to-refresh.
- Rapid consecutive tab switching.
- Old-owner display actions always rejected.
- iOS release scroll, pager, tap, and refresh behavior.
- Native/Legacy UI and behavior comparison with the same state.
- No behavior change on Web, Desktop, Extension, or Android.

## 10. Validation and delivery protocol

For each slice:

1. Record expected behavior, current behavior, failure conditions, and the
   concrete manual pass condition before editing.
2. Make only the approved slice's changes.
3. Run focused unit/type/native checks proportional to the slice.
4. Provide exact iOS launch steps and a short manual checklist.
5. Stop and wait for manual acceptance.
6. After acceptance, update this document's current phase and proceed to the
   next slice.

Before any commit, stage only the slice files and run:

```sh
yarn agent:check --profile commit
```

No commit, push, PR, Android implementation, or next-slice work occurs unless
explicitly requested or accepted.
