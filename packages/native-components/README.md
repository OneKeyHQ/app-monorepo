# Native components

This workspace owns performance-critical page containers backed by one Nitro
module. Component source files stay flat and use a component-name prefix. The
`ios`, `android`, `src`, and generated `nitrogen` directories exist only for
platform builds and code generation.

## HomeContainer runtime contract

- Runtime scope: the HybridView is created and mutated only by the `main` UI JS
  runtime. The `bg` runtime must never instantiate or retain a view reference.
- Native ownership: every mounted HomeContainer owns its pager, native lists,
  refresh controls, and scroll coordination. The bounded image cache is a
  process-wide shared native resource; page data and offsets remain per view.
- JS heap copies: background services produce data in the isolated `bg` heap.
  Data is serialized once when crossing to `main`, normalized into the current
  Home model, then serialized once more when a changed render domain crosses
  from the main runtime to native.
- Timing: `bg` and `main` initialize independently. Data adapters must subscribe
  before pulling the current snapshot and must not assume background readiness.
- Version skew: native and JS capabilities are checked with
  `isHomeContainerAvailable()` and `getCapabilities()`. HomeContainer supports
  protocol v3 only; a mismatched native binary is rejected instead of entering
  a compatibility transport.

Scroll offsets, sticky-header state, page gestures, list recycling, and refresh
indicators are native-owned. JS receives semantic actions, refresh requests,
and visible-tab changes only. It does not receive per-frame scroll events.
One native axis coordinator owns horizontal strips, page swipes, and vertical
header handoff so a drag cannot race a row tap or another scroll view.

The main runtime sends one full snapshot when a native view attaches or the
owner session changes. Subsequent values use the `shell`, `navigation`,
`section:<tabId>`, and `surface` domains. Each render domain has a
controller-owned monotonic generation and carries a complete replacement value.
Native accepts the newest generation for each domain independently, including
generation gaps, and never waits for an acknowledgement or retransmission.
Updates from a previous owner session are ignored. Same-frame writes are
coalesced to one latest value per domain, and native reconciles only the domains
that changed.

## Controlled slots

`HomeContainer` accepts visual slots for the account selector, network selector,
balance, header actions, tab labels, and per-tab accessories. The Fabric surface
mounts these React subtrees into native-calculated frames. Slots are visual-only:
the underlying native controls own taps, vertical paging, horizontal strips, and
sticky positioning. Updating a slot subtree does not submit a snapshot or reload
a native list. Slot rendering is independent from the native domain transport,
so React may merge or skip intermediate slot renders without blocking native
body data. Arbitrary page children are intentionally unsupported because they
would reintroduce unbounded measurement and gesture coordination across JS and
native.

## Code generation

Run `yarn workspace @onekeyhq/native-components codegen` after changing a
`*.nitro.ts` spec, and run React Native Codegen after changing a
`*NativeComponent.ts` Fabric spec. Generated Nitro bindings are committed so
mobile builds do not download code-generation tools.

## Performance acceptance

Profile release builds on both platforms. A migration is not ready for rollout
until vertical scrolling, page swiping, internal horizontal strips, refresh,
and item taps remain responsive under rapid data updates, with no JS scroll
listener or per-row React reconciliation in the active native path.
