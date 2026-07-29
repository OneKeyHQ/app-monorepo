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
  Data is serialized once when crossing to `main`, then serialized once more for
  the imperative JSI state call.
- Timing: `bg` and `main` initialize independently. Data adapters must subscribe
  before pulling current data and must not assume background readiness.
- Protocol: the bundled JS and native code use one unversioned contract. Every
  submission is a complete state containing `owner` and `payload`. Native
  applies submissions in arrival order and renders the latest state. There are
  no patches, revisions, ACKs, version negotiation, or compatibility paths.
- Ownership: slot content and intents are accepted only when both `scopeKey` and
  `sessionId` match the current state owner. Switching owner resets per-view
  navigation and scroll state.

Scroll offsets, sticky-header state, page gestures, list recycling, and refresh
indicators are native-owned. JS receives semantic actions, refresh requests,
and visible-tab changes only. It does not receive per-frame scroll events.
One native axis coordinator owns horizontal strips, page swipes, and vertical
header handoff so a drag cannot race a row tap or another scroll view. Native
uses platform list diffing when applying each complete state, preserving mounted
views and scroll state where identifiers are unchanged.

## Controlled slots

`HomeContainer` accepts visual slots for the account selector, network selector,
balance, header actions, tab labels, and per-tab accessories. The Fabric surface
mounts these React subtrees into native-calculated frames. Slots are visual-only:
the underlying native controls own taps, vertical paging, horizontal strips, and
sticky positioning. Updating a slot subtree does not submit a snapshot or reload
a native list. Arbitrary page children are intentionally unsupported because they
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
