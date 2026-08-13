# Native Wallet Home iOS Renderer Handoff

## 1. Status and authority

- Base branch: `x`
- Working branch: `codex/native-wallet-home-ios`
- Read-only reference branch: `codex/native-home-container`
- Current phase: the corrected iOS Pager/tab shell and pull-to-refresh path are
  implemented. The bridge is being narrowed from one full-page prop to fixed,
  strongly typed section props so Tab selection does not deserialize or apply
  unchanged Spot data. Eligible unmigrated Tabs remain isolated empty Native
  pages; later Tab renderers and release profiling have not started
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
    -> stable owner/navigation/header/theme/spotTokens props
    -> Nitro reference-dirty bridge
    -> Swift applies only dirty sections and native list diffing
    -> owner-scoped semantic intent
    -> current-owner/current-ViewModel validation in JavaScript
    -> existing action or navigation handler
```

`useNativeHomeViewModel()` is a read-only composition hook. It is not a Store,
request coordinator, reducer, cache, or readiness barrier.

It returns the complete display state available at the current instant. Slow
sections do not block fast sections, and each real section has its own explicit
state such as `initialLoading`, `ready`, `refreshing`, or `error`.

The bridge protocol is intentionally concrete. It uses fixed section props,
not a generic section collection or mutation protocol:

```ts
type HomeContainerProps = {
  protocolVersion: 1;
  owner: NativeHomeOwnerToken;
  navigation: NativeHomeNavigationViewModel; // selectedTab + tabs
  header: NativeHomeHeaderViewModel;
  spotTokens: NativeHomeSpotTokensViewModel;
  theme: NativeHomeThemeViewModel;
};
```

Later migrated content adds one explicit prop for its current real consumer,
for example `history`, `nft`, `defi`, or `perps`. Market data inside Spot is a
separate future `spotMarket` prop rather than being appended to the token-list
payload. There is no generic `sections` array, generic item renderer, JSON
business value type, or patch envelope.

Nitro's generated `CachedProp` compares each incoming JS prop with the previous
prop using JavaScript strict equality before converting it. Therefore these
section references are part of the bridge contract:

- Each section producer memoizes its own strongly typed object.
- A Tab-only change creates a new `navigation` object and preserves the
  `header`, `theme`, and `spotTokens` references.
- Swift records which generated setters ran during one update transaction and
  applies only those dirty sections in `afterUpdate()`.
- Native does not recursively compare decoded section fields. A changed section
  reference means that concrete section is converted and applied; an unchanged
  reference is not converted or applied.
- Owner is an independent prop. Owner changes force new owner-scoped Header and
  Spot-token section objects in the same React commit, reset local Native page
  continuity, and invalidate old-owner interaction before rendering the new
  owner.
- The JS ref used to revalidate semantic intents contains only the current
  section values. It is not a second Store or a last-committed Native snapshot.

### Progressive rendering rules

- A section publishes useful partial data as soon as it exists.
- Token structure can render before valuation fields are available.
- Row skeletons and resolved rows keep stable identifiers and compatible
  heights.
- Same-owner refresh keeps existing rows visible and sets `refreshing`.
- Owner change immediately publishes a new-owner loading ViewModel without old
  rows.
- Native applies diffable snapshots and does not rebuild the mounted view.
- The first version sends full values only for section props whose references
  changed. It records build time, payload bytes, commit rate, and Native diff
  time; it has no item-level patch, revision, or ACK.
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

Slice 3 valuation/style follow-up (2026-08-13):

- The approved follow-up connects each displayed token ID to its existing
  normal or aggregate fiat cell. It reuses the current formatting, currency
  conversion, rebasing, privacy, and unavailable-value utilities; it does not
  start a request or create another Home Store.
- Token structure remains independently progressive. Metadata rows render
  immediately, unresolved valuation fields use stable-height skeletons, and a
  settled missing value renders `--` instead of leaving a permanent skeleton.
- The first version continues to submit the current full typed ViewModel on a
  valuation tick. There is no partial update, patch, revision, ACK, cache, or
  persistence protocol.
- Swift token rows now match the Legacy mobile row geometry and typography:
  40 pt token icon, 60 pt row, 20 pt horizontal inset, 12 pt icon/text gap,
  16/24 primary text, 14/20 secondary text, and semantic positive/negative
  colors.
- The mounted Native list initially exposes the same six items as Legacy. A
  concrete local `Show more` / `Show less` cell changes only the mounted view's
  visible rows; it neither mutates business state nor emits a business intent.
  Owner change resets this local expansion state.
- A development-only, main-runtime controller enables same-account visual A/B
  checks without an environment variable or persisted flag:

  ```js
  $onekeyNativeHomeRenderer.set('legacy');
  $onekeyNativeHomeRenderer.set('native');
  $onekeyNativeHomeRenderer.toggle();
  ```

  The controller is absent from the iOS background runtime and production
  builds continue to select Native for eligible Home state.
- Focused tests cover renderer selection, item formatting, progressive
  loading-to-unavailable behavior, protocol fields, and current-owner intent
  validation. The iOS Debug app compiled, was cover-installed, and ran on the
  iPhone 17 Pro simulator.
- Runtime verification on the same Account #2 fixture confirmed resolved
  price/change/balance/value pixels, a six-row collapsed list, vertical fling,
  `Show more`, full-list recycling to the real bottom, `Show less`, and collapse
  back to six rows. Legacy/Native switching also resolved immediately in the
  main runtime while the background runtime exposed no controller.
- This follow-up does not claim Slice 4 completion: same-owner refresh state,
  Native pull-to-refresh, owner/request-scoped refresh completion, and release
  instrumentation remain in Slice 4.

Slice 3 DeFi/footer parity follow-up (2026-08-13):

- The Native producer now consumes the existing Token List DeFi filter state,
  scoped DeFi list, scoped valuation map, and loading state directly. The
  Native switch emits one concrete owner-scoped `toggleDeFiTokens` intent; JS
  revalidates it against the current ViewModel before calling the existing
  filter handler.
- The Legacy footer's existing visibility and navigation controller is shared
  with the Native producer. Expanded Native content now includes the same
  low-value asset count/value, collapsed risk asset count, add-token action,
  and `Show less` control without duplicating requests, filters, or business
  state.
- Low-value, risk, and manage-token rows emit concrete owner-scoped intents.
  JS verifies that the current ViewModel still exposes the action, then invokes
  the exact existing Legacy navigation handler.
- Aggregate token rows use the current aggregate token map to select the same
  network badge behavior as Legacy instead of inferring a new network identity
  in Native.
- Focused protocol, ViewModel, and intent suites passed (12 tests). Nitro code
  generation, TypeScript checks, the OneKeyNativeComponents Swift target, and
  the signed iOS Debug simulator build passed.
- Runtime A/B verification on Account #2 confirmed the same DeFi switch state
  and DeFi token rows in Legacy and Native. Expanding Native rendered `8
  Low-value assets` with `$0.00`, `70 Collapsed risk assets`, the add-token
  action, and `Show less`; both asset rows opened their existing JS-managed
  pages. Switching back to Native briefly showed stable row skeletons and then
  resolved the current DeFi data, as required by the progressive rendering
  contract.
- The Tokens header was then aligned to the Legacy measurements: a 56-point
  row, 20/28 semibold title, 12/16 regular DeFi label, an 8-point label gap,
  and a custom 32-by-20 switch with a 16-point thumb and theme-derived Legacy
  off/on colors. Signed-simulator A/B verification confirmed both visual states
  and the existing JS-owned DeFi data transition; the simulator was left off.
- Renderer eligibility is now explicit `pending | eligible | ineligible`.
  Pending vault-settings and network-support checks keep the iOS Native Home
  mounted instead of mounting Legacy first; only a confirmed ineligible path
  can fall back. Metro reload and process-level relaunch recordings showed the
  Native loading/list states directly, with no intermediate Legacy Home frame.
- Native token, low-value, and risk rows now match the Legacy `ListItem` touch
  feedback: the active background uses the concrete theme color with an
  8-point horizontal inset and 12-point continuous corner radius. Disabled and
  loading rows do not highlight. Signed-simulator hold tests confirmed the
  pressed state for all three row types, the existing JS-owned navigation after
  release, and drag cancellation without a stale highlight or accidental
  navigation.
- Manual acceptance completed on 2026-08-13. Slice 3 is closed; later work must
  not reopen its protocol or add a second display authority unless profiling or
  a concrete regression demonstrates that the accepted design is insufficient.

### Slice 4 - Portfolio valuation and pull to refresh

Deliverable:

- Progressive balance, price, fiat value, and change fields.
- Same-owner refresh preserves visible content.
- Native pull-to-refresh emits the existing semantic refresh action.
- Refresh intent is owner-scoped and current-tab-scoped; spinner duration remains
  rendering feedback and is not a business ACK.
- Instrument ViewModel build time, payload size, commit rate, and Native diff
  duration; do not add an incremental protocol yet.

Manual acceptance:

- Slow or partial valuation does not block token metadata.
- Pull-to-refresh works repeatedly and cannot complete the wrong owner.
- Price changes update the correct rows without scroll jumps.
- Background-not-ready and network-error paths remain usable.

Pager and refresh correction checkpoint (2026-08-13):

- The rejected intermediate design attached refresh to one flattened Portfolio
  collection and simulated the shared Header with collection insets. That put
  the spinner inside page content, could not preserve independent Tab offsets,
  and introduced a request ID/ACK path that Legacy refresh does not require.
- The corrected renderer has one outer vertical scroll owner for Header,
  sticky Tab bar, and refresh; one horizontal Native pager; and one isolated
  vertical collection per mounted Tab. Portfolio uses the real diffable list.
  Perps, DeFi, NFT, and History use empty Native page instances until their
  individual migration slices.
- JavaScript derives the visible Tab order and capability decisions from the
  existing Home hooks. Native owns only the selected rendering page and emits a
  typed `selectTab` intent. Both tap and swipe selection are revalidated against
  the current owner and current ViewModel before JavaScript accepts them.
- Each page preserves its own vertical offset. iOS 17.4 and newer use the
  verified unified vertical driver; the older supported iOS range keeps the
  verified nested-scroll fallback. Horizontal paging and vertical gestures are
  direction-gated so diagonal gestures cannot start both owners.
- Pull-to-refresh is attached to the outer scroll view and is available only at
  the top of the current page. Native emits only `{ owner, refreshTabId }`.
  JavaScript revalidates it and calls the existing `onHomePageRefresh()` path.
  The spinner ends after the same short visual-feedback interval used by Legacy;
  owner or Tab changes cancel it immediately. There is no request ID,
  `completeRefresh`, ACK, refresh lifecycle subscription, or business service in
  Swift.
- Failure conditions: any Legacy mount while Native state is pending, a spinner
  between Header actions and tabs, shared offsets between pages, stale-owner or
  disabled-Tab intents executing, vertical drags moving the pager, horizontal
  drags moving the Header, or Native calling a business service.
- Runtime status: an Ethereum watch-only fixture exposed the exact Legacy order
  `Spot, Perps, DeFi, NFT, History`. Spot retained the real Portfolio collection;
  the four unmigrated Tabs were mounted as separate empty Native collection
  pages. A BTC fixture reduced the same mounted shell to its eligible Tabs,
  confirming that capability changes rebuild pages without a universal Tab
  section abstraction.
- The Pager uses one horizontal `UIScrollView` direction decision. The earlier
  custom vertical gate was removed after runtime testing showed that stacking
  two recognizer decisions could leave the Pager waiting at gesture start.
  Signed-simulator pans now settle in both directions and update the selected
  semantic Tab. The Pager and page collections make mutually exclusive
  horizontal/vertical direction decisions without a recognizer dependency.
- Automated status: Nitro generation, native-components TypeScript, the `kit`
  TypeScript check, two focused protocol/intent suites (10 tests), the signed
  iOS Debug build, and covered simulator installation pass. Automated tab taps
  reached the Native semantic intent path; the remaining slow/fast swipe,
  diagonal gesture, rapid-selection, per-page offset, and repeated-refresh
  checks stay in the manual acceptance gate.

Section-prop bridge checkpoint (2026-08-13):

- The former full-page `state` prop was replaced by fixed, strongly typed
  `owner`, `navigation`, `header`, `spotTokens`, and `theme` props. This is a
  bridge partition only; all producers, Jotai state, services, requests, and
  action handlers remain the existing JavaScript business authority.
- Generated Nitro code gives every section its own `CachedProp`. It uses JSI
  strict reference equality before conversion and calls only dirty Swift
  setters in one `beforeUpdate` / `afterUpdate` transaction. No recursive field
  comparison or generic patch protocol was added.
- Swift tracks which concrete setters ran and applies only those sections.
  A navigation-only update moves the Pager and selection without rebuilding
  pages, reapplying Header pixels, or applying a Spot-token diffable snapshot.
  Owner changes remain atomic and fail closed: Header and Spot-token props are
  forced to new references, and Native clears either section if it is missing
  from the owner-change transaction.
- The React EmptyToken slot now stays attached to one permanent host inside the
  Spot collection. Tab selection no longer moves it to the parking view or a
  reusable cell, so an empty Spot page is not remounted while paging away and
  back. The JavaScript WalletBanner and EmptyToken element references are also
  memoized independently of `navigation`, so a Tab-only render does not
  reconcile their visual subtrees.
- Runtime instrumentation found and corrected one unstable Header dependency:
  a freshly calculated fiat object and `mainActions` array had kept producing a
  new Header reference. The memo now depends on resolved scalar Header values
  and a stable action-ID key.
- After data settled, an instrumented signed-simulator run selected `History ->
  Spot -> Perps -> Spot`. All four bridge transactions reported only
  `navigation=true`; `owner`, `header`, `spotTokens`, and `theme` stayed false.
  The temporary instrumentation was removed after verification.
- Focused protocol, intent, and Spot ViewModel suites passed (15 tests), as did
  Nitro generation, native-components and kit TypeScript, the
  OneKeyNativeComponents target, and the signed iOS Debug app build.

Spot follow-up handoff:

- The accepted Native Spot slice currently owns the Tokens block only: token
  metadata and valuation rows, DeFi-token filter, six-row Show more/Show less,
  low-value assets, risk assets, manage-token footer, empty state, token/footer
  intents, pressed feedback, recycling, and pull-to-refresh.
- Legacy mobile Portfolio continues below Tokens with `DeFiListBlock`
  cache/overview production, `PopularTrading`, `EarnListView`, `Upgrade`, and
  `SupportHub`. These data surfaces and their interactions are not rendered by
  Native Spot yet. Desktop-only `RecentHistory` is not part of the iOS Spot
  migration.
- Add each real follow-up consumer as a separate, strongly typed prop (for
  example `spotMarket`, `spotEarn`, or another concrete product section). Do
  not append unrelated Market, Earn, campaign, or support payloads to
  `spotTokens`, and do not introduce a generic section array, reducer, patch
  envelope, or second Home Store.
- Reuse the existing section producer, selectors, service state, navigation,
  visibility decisions, and action handlers. Native renders pixels and emits
  owner-scoped semantic intents only; JavaScript must revalidate each item or
  command against the current section ViewModel before executing it.
- Each new prop must preserve reference identity when only `navigation`
  changes, carry its own progressive loading/ready/error state, and update only
  its concrete Native subsection. Migrate and manually accept one real section
  at a time against Legacy before moving to the next.

### Slice 5 - iOS Pager and tab shell

Deliverable:

- Port only the verified iOS vertical/horizontal gesture arbitration and pager
  settling algorithms from the reference branch.
- Queue the latest tab selection while settling.
- Preserve per-page offsets inside the mounted Native view.
- Keep eligible unmigrated tabs as empty Native pages. Do not mount a second
  Legacy Home or embed RN Home display slots inside the pager.

Manual acceptance:

- Slow and fast horizontal swipes.
- Diagonal gestures and vertical scrolling near pager boundaries.
- Rapid consecutive tab selections.
- Tab taps and swipes update the selected semantic state exactly once.
- Returning to Portfolio restores its previous vertical offset.
- Refresh appears above the shared Header and only triggers at the active page
  top.

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
