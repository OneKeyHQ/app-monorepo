# Native Wallet Home iOS Renderer Handoff

## 1. Status and authority

- Base branch: `x`
- Working branch: `codex/native-wallet-home-ios`
- Read-only reference branch: `codex/native-home-container`
- Current phase: design handoff; implementation has not started
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
- A Native-only loader behind a disabled-by-default development flag.
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

- Feature off: current Home is unchanged.
- Feature on: the diagnostic Native surface mounts only in iOS main UI.
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
  - Native-only renderer loader, development feature gate, diagnostic Native
    page, and focused tests;
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
