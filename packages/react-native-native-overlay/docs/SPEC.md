# react-native-native-overlay SPEC

Status: P2. The JS ordering store, the animation model, the global level
hosts (center / toast / fullscreen) and the global sheet presentation are
implemented on iOS, Android and Web. `@onekeyhq/components`'
`NativeSheetPresentation` (Dialog / Popover / ActionList / Select with
`nativeSheet`) renders through `OverlayView`. P3 adds page scope. Anchored
presentations and caller migration follow in P4–P5.

This package is developed in `app-monorepo/packages/react-native-native-overlay`
and moves to `app-modules/native-views/react-native-native-overlay` once
verified. It absorbs `@onekeyfe/react-native-native-sheet`. The native-sheet
source moves in with `git mv` to keep its history, and native-sheet keeps
shipping as a re-export shim for two releases.

## 5.1 Purpose, scope, and non-goals

The package owns **where an overlay is drawn, which overlay is on top, and how
it enters and exits** on iOS, Android, and Web (web, desktop, extension).

Callers are `@onekeyhq/components` (Dialog, Toast, Popover, ActionList, Select,
DatePicker) and `@onekeyhq/kit` global containers: hardware stage and dialogs,
password verify, DialogLoading, app lock, Spotlight, in-app notification.

Non-goals:

- Business UI. Titles, buttons, forms, toast cards, the hardware stage morph and
  the lock screen UI stay React content owned by components and kit.
- Navigation. Screens and navigation modals stay in react-navigation and
  react-native-screens.
- Third-party windows such as RN `Modal`, WalletConnect, and system dialogs.
  They are only handled defensively by the `lock` level (§5.7).

## 5.2 Definitions and ownership boundaries

| Term                | Meaning                                                                                                                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **scope**           | `global`: attached to the app window. `page`: owned by one screen, rendered in that screen's root-route host.                                                                                                      |
| **root-route host** | A single `PageOverlayHost` rendered as the last child of each root-stack route (Main tabs, Modal, Onboarding, FullScreenPush, WebView). Because it sits there, page overlays cover native headers and the tab bar. |
| **owner page**      | The nearest screen that requested a page overlay. The overlay is visible only while its owner is on top inside its root route.                                                                                     |
| **level**           | Fixed layer. `modal` 100 < `hardware` 200 < `secure` 300 < `toast` 400 < `lock` 500 < `debug` 900.                                                                                                                 |
| **lane**            | The entries sharing (scope, host, level). Strategies apply per lane.                                                                                                                                               |
| **strategy**        | What a new entry does to its lane. `stack` (default) appears on top. `queue` waits until the lane is empty and is ordered by `priority`. `replace` closes the top entry, or the entries sharing `replaceKey`.      |
| **presentation**    | Frame and default motion: `sheet`, `center`, `fullscreen`, `toast`, `anchored`.                                                                                                                                    |

Ordering rule:

- Every page entry renders below every global entry.
- Inside a scope, entries are ordered by level, then by request order.
- Nothing else affects order: not mount order, portal order, or window add
  order.

Ownership:

- **JS store** (`OverlayStore`, one per JS runtime, `main` only) owns ordering,
  queues, page visibility, and back/Escape resolution.
- **Native hosts** own drawing, hit testing, animation, keyboard, and back-key
  capture, and report lifecycle back to the store.
- **Content** is the caller's React subtree. The overlay view stays where the
  caller rendered it. Native code reparents its content into the host, so React
  context is preserved; there is no root-siblings portal.

The package MUST NOT infer anything from product data. Levels and strategies
come only from props.

## 5.3 Public API and defaults

### Store (implemented)

- `overlayStore.request(request, { onRemoved })` returns an `IOverlayEntry`.
  - Defaults: `scope: 'global'`, `level: 'modal'`, `strategy: 'stack'`,
    `priority: 0`.
  - `blocking` defaults to false for `toast` and `debug`, and true for every
    other level.
  - `dismissible` defaults to the value of `blocking`.
  - `page` scope requires `hostKey` and `ownerKey`. Missing either throws
    `OverlayRequestError`.
  - Re-requesting an id that already exists is a no-op.
- `dismiss(id, reason)` moves an entry to `closing`. `finalize(id)` removes it
  after the native exit animation. A closing entry that is never finalized is
  removed after 5 s.
- `dismissAll({ scope, belowLevel, reason })`, `setPageVisible(ownerKey,
visible)`, `removePage(ownerKey)`.
- `resolveBack(focusedHostKey?)` returns `dismiss(id)`, `block`, or `pass`.
- `getBlockingTop()` returns the entry that makes everything below it inert.
- `subscribe` and `getSnapshot` are compatible with `useSyncExternalStore`.

### Component (P1)

```tsx
<OverlayView
  open
  scope="global" | "page"
  level="modal"
  strategy="stack"
  priority={0}
  replaceKey?
  presentation="sheet" | "center" | "fullscreen" | "toast" | "anchored"
  animation?={{ enter, exit, backdrop }}
  backdrop?={{ opacity, dismissOnPress }}
  dismissOnBackPress
  dismissOnPanDown   // sheet and toast only
  anchor?            // anchored only: a trigger ref or a window rect
  onPresented onDismissRequest onDismissed(reason)
/>
```

- `usePageOverlayHost()` resolves `hostKey` and `ownerKey` from navigation
  context.
- `useInPageDialog`, `useInModalDialog`, and `useInTabDialog` become aliases of
  page scope. Tab scope is removed.

### Animation (implemented model)

- `animation.enter` and `animation.exit` are each
  `{ type: none|fade|slide|scale, edge, distance, scale, offsetY, fade, origin: center|anchor, motion }`.
- `exit` defaults to `enter`.
- `motion` is a preset name or a concrete `{ type: 'spring', spring: { mass, stiffness, damping, overshootClamping } }`
  or `{ type: 'timing', timing: { durationMs, easing: cubicBezier } }`.
- Presets are resolved per platform:
  - Native mirrors the Reanimated driver: `quick` is a spring with m 0.1,
    k 100, c 20 (damping ratio ≈ 3.16).
  - Web mirrors the CSS driver: `quick` is 150 ms `cubic-bezier(.25,.1,.25,1)`.
  - Converting native springs for web is opt-in (`springToCssLinear`), because
    it would slow web overlays down 4–9×.
- Presentation defaults (`DEFAULT_OVERLAY_ANIMATIONS`):

| Presentation | Enter / exit                                                                     | Backdrop      |
| ------------ | -------------------------------------------------------------------------------- | ------------- |
| sheet        | slide from bottom, `quick`                                                       | fade, `quick` |
| center       | scale 0.85 + fade, `quick`                                                       | fade, `quick` |
| toast        | slide from top + fade, `toastSlide` (native 300 ms quad in-out, web 400 ms ease) | none          |
| fullscreen   | fade, `quick`                                                                    | none          |
| anchored     | scale 0.95 + fade from the resolved anchor placement, `popoverQuick`             | fade          |

- Special cases the callers set explicitly:
  - App lock: `enter: none`, `exit: fade lockFade`. The web tamper check reloads
    the page if the lock fades in from opacity 0.
  - Hardware stage (MorphOverlay), TradingView fullscreen, ScreenshotBranding,
    DevOverlay: `presentation: fullscreen`, `enter`/`exit: none`, transparent,
    touches pass through where content is `box-none`. MorphOverlay keeps its
    Reanimated springs. The container must not animate alpha, transform, or
    frame while its content is animating.
  - Custom toast (`Toast.show`): `scale 0.8 + offsetY -20`, `quick`, with an
    opt-in blocking backdrop.

## 5.4 Lifecycle and concurrency

Lifecycle:

```
request ─► queued ─► active ─► (enter anim) presented
                       │
     dismiss / replace / page-removed / back / backdrop / pan
                       ▼
                    closing ─► (exit anim) onDismissed ─► finalize ─► onRemoved
```

- Content stays mounted until `finalize`. This replaces today's hardcoded
  timers: the Dialog 300 ms portal destroy, the ColorPicker 300 ms, the
  ActionList and Select 150 ms waits, and the DialogLoading 50 ms delays.
- A queued entry is promoted only after the previous entry in its lane is
  finalized, so exit and enter never overlap. `replace` is the exception: the
  new entry enters while the replaced one exits.
- Reopening an entry that is still closing retargets the running animation from
  its current value. It does not restart.
- `onRemoved` fires exactly once per entry, even when a finalize and the
  timeout race.
- Page entries:
  - They are suspended (hidden but kept) while the owner page is covered or
    detached.
  - Queued page entries are not promoted into a hidden page.
  - `removePage` closes them with reason `page-removed`.
- Hide signals must come from native, because tab stacks use `freezeOnBlur`
  and frozen React trees receive no updates:
  - iOS: the owner `RNSScreen`'s `viewWillDisappear` / `viewWillAppear`.
  - Android: the owner `ScreenFragment`'s view detach / attach.
  - Web: navigation focus.
- Threads: store mutations happen on the JS thread. Native animation and layout
  run on the UI thread. Events are delivered as direct events.

## 5.5 Data, cache, and identity

- Identity is the entry `id`: caller-provided, otherwise `overlay-<seq>`.
- Nothing is persisted. The store is per runtime and empty on reload.
- `replaceKey` is the only identity shared across entries.

## 5.6 Platform contract

| Concern                                    | iOS                                                                                                                                                          | Android                                                                                                                                                                                                                                                                                                                                                                                                                 | Web                                                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Global level host                          | One passthrough `UIWindow` per active level per `UIWindowScene`, ordered by `windowLevel`. `lock` sits above RN Alert (2001).                                | One `OverlayHost` FrameLayout in `android.R.id.content` above the ReactRootView, with one child container per level.                                                                                                                                                                                                                                                                                                    | Sibling `div[data-onekey-layer]` roots under `body`, one z-index band per level (`OVERLAY_WEB_Z_INDEX_BASE`).       |
| Order within a level                       | The window's presentation chain (sheet) and subview order (other presentations).                                                                             | Child order.                                                                                                                                                                                                                                                                                                                                                                                                            | DOM order.                                                                                                          |
| Global sheet                               | `UISheetPresentationController`, presented from the level window's root VC (reuses native-sheet).                                                            | View sheet: CoordinatorLayout + BottomSheetBehavior + dimming view (native-sheet reworked off `BottomSheetDialog`).                                                                                                                                                                                                                                                                                                     | Custom sheet: pointer drag, snap by velocity, `visualViewport` keyboard.                                            |
| Page host                                  | Fabric `PageOverlayHost` as the last child of the root-route screen. Custom-drawn sheet, because UIKit sheets cannot be page-scoped.                         | The same host inside the root-route screen. The ReactRootView already dispatches touches, so no nested RootView.                                                                                                                                                                                                                                                                                                        | `position: absolute` host inside the root-route card.                                                               |
| Header / tab bar coverage (page)           | Covered: the host is above the tab controller and navigation bars.                                                                                           | Covered.                                                                                                                                                                                                                                                                                                                                                                                                                | Covered.                                                                                                            |
| Touch passthrough (toast, debug, box-none) | `hitTest` returns nil on the window or root view.                                                                                                            | A non-blocking entry hit-tests its React content with `TouchTargetHelper` (honoring `box-none`) and falls through to the FrameLayout sibling on a miss.                                                                                                                                                                                                                                                                 | `pointer-events: none` root, `auto` per entry.                                                                      |
| Back / Escape                              | Escape via `accessibilityPerformEscape`. The interactive pop gesture is disabled while a blocking page overlay is shown.                                     | A `Window.Callback` wrapper consumes `KEYCODE_BACK` while a blocking overlay is shown. `ReactActivity.onBackPressed` hands back to JS BackHandler (react-navigation) before the `OnBackPressedDispatcher`, and the app opts out of predictive back, so a dispatcher callback alone never runs first. The dispatcher callback is kept for the predictive-back path. The IME still gets back first to close the keyboard. | Capture-phase `keydown` that ignores IME composition.                                                               |
| Modality / accessibility                   | `accessibilityViewIsModal` on the blocking level window; `.screenChanged` posted on present.                                                                 | `IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS` on the content below.                                                                                                                                                                                                                                                                                                                                                 | `inert` on the app root and lower layers, `role=dialog`, `aria-modal`, focus trap and restore.                      |
| Keyboard                                   | System sheet avoidance; `keyboardLayoutGuide` for custom presentations. The main window regains key status on dismiss.                                       | `WindowInsetsAnimationCompat` per sheet (the app uses `adjustPan`).                                                                                                                                                                                                                                                                                                                                                     | `visualViewport`.                                                                                                   |
| Animation engine                           | `UIViewPropertyAnimator` + `UISpringTimingParameters(mass:stiffness:damping:)`, which maps 1:1 and supports damping ratio > 1.                               | `SpringAnimation` with `stiffness = k/m` and `dampingRatio`; `PathInterpolator` for timing curves.                                                                                                                                                                                                                                                                                                                      | WAAPI `element.animate`. Timing presets use `cubic-bezier`; custom springs use `linear()`.                          |
| Content hosting                            | `RCTSurfaceTouchHandler` on the host root. A state-driven shadow node sizes Yoga, which replaces native-sheet's forced `frame`. A nested `SafeAreaProvider`. | A `RootView` + `JSTouchDispatcher` container for global levels. A state-driven shadow node, like RN Modal.                                                                                                                                                                                                                                                                                                              | `createPortal`. The Tamagui theme class is set on the layer root, and React event bubbling stops at the entry root. |

Known divergences:

| Divergence                                                                                               | Status                                                     |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| iOS global sheet (system physics) vs. iOS page sheet (custom physics)                                    | Accepted (decision A). Revisit after on-device comparison. |
| RN `Modal` and third-party dialogs on Android are windows above every layer                              | Accepted, mitigated by the lock policy (§5.7).             |
| Web anchored origin follows the resolved placement after flip; today's code uses the requested placement | Intentional fix.                                           |

## 5.7 Failure, fallback, and safety

- A page request without host or owner keys throws `OverlayRequestError`. This
  is a programming error; there is no silent global fallback, unlike today's
  `Portal.Render` retry.
- A closing entry is removed after 5 s even if native never reports the end of
  its exit animation.
- Lock level:
  - iOS: the lock window sits above everything this app creates.
  - Android: when lock shows, the app's foreign windows are found with
    `WindowInspector.getGlobalWindowViews()` (API 29+) and hidden or
    dismissed. An alternative is to make lock a focus-owning `ComponentDialog`
    that re-raises itself.
  - Web: layers below lock get `inert`. Third-party roots are left alone.
- System view controllers (document picker, PHPicker, share sheet,
  ASWebAuthenticationSession anchor) must be presented through
  `OverlayPresenterResolver` on iOS, so they appear above the overlay windows.
  `lock` is never lowered.
- No secrets or content are logged. Logs carry only entry id, level, scope and
  reason.

## 5.8 Performance and resource budget

- iOS level windows are created lazily per active level and hidden when empty.
  There are at most 6 per scene.
- Android layers are views, not windows: no extra surfaces or WindowManager IPC.
- Store operations are O(n) in the number of live entries. Snapshots are
  rebuilt once per mutation.
- Animations run entirely on the UI thread. JS receives only lifecycle events:
  no per-frame bridge traffic.
- Content height changes animate only between settled measurements (the
  two-frame stable pattern from Popover). Continuous per-frame height changes,
  such as the DatePicker month-row interpolation, are clipped inside the
  content.

## 5.9 Conformance and acceptance

Automated (P0):

- `src/__tests__/OverlayStore.test.ts` covers:
  - level ordering regardless of request order;
  - page below global;
  - `stack`, `queue` (priority, lane isolation, promotion after finalize) and
    `replace` (top entry and `replaceKey`);
  - the closing timeout and single `onRemoved`;
  - page suspend, restore and removal;
  - back resolution (global first, `block`, `pass`, focused host) and the
    blocking top.
- `src/__tests__/animation.test.ts` covers:
  - the spring response in all damping regimes, overshoot clamping and settle
    time;
  - Android `SpringForce` conversion and CSS `linear()` sampling;
  - presentation defaults and per-platform preset resolution.

Runtime matrix, required per platform before migrating callers (P1–P3):

1. Show sheet, toast, hardware dialog, password and lock in all 5! orders. The
   final z-order is always level order.
2. A queue of 3 hardware dialogs with a priority insert.
3. `replace` DialogLoading text updates without flicker.
4. Page overlay:
   - push another screen: the overlay hides;
   - pop: it restores;
   - switch tab and come back: it restores;
   - remove the page: it closes with `page-removed`;
   - the native header and tab bar are covered.
5. Back/Escape reaches the topmost blocking overlay; the lock swallows it.
6. Keyboard: an input in a global sheet, a page sheet and a secure dialog.
7. iOS: a system picker opened from an overlay appears above it.
8. Split view: page overlays stay in their own pane.
9. Reduce motion degrades to fade.

P3 page scope notes:

- kit wraps every root route component (`withOverlayPageHost`) with
  `OverlayPageHostScope` and renders `OverlayPageHost` after the navigator,
  keyed by the root route key. components `Page` wraps its content in
  `PageOverlayOwner`, keyed by the screen's route key.
- Visibility: `PageOverlayOwner` listens to the screen's `focus` / `blur`
  events (they fire even while `freezeOnBlur` freezes the React tree) and
  reports `setPageVisible(owner, activeWithinHost)`. "Active within host"
  checks every navigator up to, but not including, the root stack, so a root
  modal over Main does not hide Main's page overlays; a push or tab switch
  does. Unmounting the page calls `removePage`.
- The owner may be frozen, so the host applies suspension: `OverlayPageHost`
  subscribes to the store and hides entries of suspended owners natively
  (`suspendedOwners`) or in the DOM (`visibility: hidden` + `inert`). Page
  entries keep `visible=true` while suspended; they are not dismissed.
- Page entries live inside the React surface: iOS does not attach the
  overlay's own `RCTSurfaceTouchHandler`, Android disables the entry's
  `JSTouchDispatcher` (the ReactRootView already dispatches), otherwise every
  touch would be delivered twice.
- iOS page sheets are drawn by the entry (bottom-pinned content view, pan to
  close) because UIKit sheets always cover the window. Android and Web reuse
  their global sheet implementation inside the page host.
- Android back also resolves page entries: global overlays first, then the
  topmost visible page overlay.
- A page request without a resolvable host or owner falls back to global
  scope.

P2 sheet notes:

- iOS presents the sheet (`.pageSheet` + one custom detent, ported from
  native-sheet) from the top of its level window's presentation chain.
  Non-sheet entries are subviews of the same window, so within a level,
  sheets and center / toast entries stack by request order. Dismissing a
  lower sheet makes UIKit dismiss the sheets presented above it; those report
  `onDismissed('system')` and the store closes them.
- Android hosts the sheet in a CoordinatorLayout + BottomSheetBehavior inside
  the level container (no BottomSheetDialog window). Enter / exit use the
  overlay motion; dragging fades the backdrop; a drag to hidden reports
  `pan`.
- Web renders a bottom surface with pointer drag (40% distance or 0.5 px/ms
  flick dismisses, never from scrolled content).
- A fitted sheet measures its content with `onLayout` before presenting.
  Hidden content stays mounted inside the zero-width host (clipped on iOS,
  INVISIBLE on Android), and the host height stays auto: a fixed 0 height
  makes Yoga measure the content at most 0 tall.
- `keepContentMounted` renders content while closed so callers can measure it
  before opening (Popover waits for header / scroll measurements).
- `pan` dismissals cannot be vetoed; `onRequestDismiss('pan')` is informative.

P4a toast notes:

- Message toasts (`Toast.success` / `message` / `error` …) keep their
  libraries (sonner on web, `@backpackapp-io/react-native-toast` on native)
  and render inside one persistent, non-blocking `toast`-level fullscreen
  entry (kit `ToastOverlayContainer`). The iOS raise tokens are gone.
- Custom toasts (`Toast.show` / `ShowCustom`) are their own `toast` entries:
  transparent blocking backdrop (tap closes when `dismissOnOverlayPress`),
  `scale 0.8 + offsetY -20 + fade` on `quick`, PanResponder swipe up to
  close unless `disableSwipeGesture` (the Tamagui toast ignored the flag). `Toast.show` unmounts its portal on the overlay's `onClose`, after
  the exit animation, instead of a 300 ms timer.

P4b dialog loading notes:

- Dialog takes an internal `overlayLevel` prop. With it, `DialogFrame`
  renders through `OverlayDialogPresentation` on every platform: a sheet
  (24 pt corners, no handle) on narrow windows, a centered 400 pt card
  otherwise, the theme `$bgBackdrop`, Escape never closes on web, Android
  back closes unless `disableSystemClose`.
- The kit DialogLoading container uses `overlayLevel="modal"`: request order
  puts it above earlier dialogs, and hardware / password prompts stay above
  it. Its 50 ms delays and the iOS remount key are gone; text updates in
  place.
- Android sheets pad their content by the navigation-bar inset, matching the
  UIKit sheet's home-indicator inset.

P1 implementation map:

| Contract                     | iOS                                                            | Android                                                    | Web                                           |
| ---------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------- |
| Level host                   | `NativeOverlayWindowManager.swift`                             | `NativeOverlayHost.kt`                                     | `web/overlayLayers.ts`                        |
| Entry, hit testing, backdrop | `NativeOverlayEntryView` in `NativeOverlayContainerView.swift` | `NativeOverlayEntryRootView.kt`                            | `WebOverlayEntry` in `OverlayView.web.tsx`    |
| Page host                    | `NativeOverlayPageHostView.swift`                              | `NativeOverlayPageHostView.kt`                             | `OverlayPageHost.web.tsx`                     |
| Sheet                        | `NativeOverlaySheetController.swift`                           | `NativeOverlayEntryRootView.configureSheet`                | `OverlayView.web.tsx` + `web/useSheetDrag.ts` |
| Enter / exit animation       | `NativeOverlayAnimation.swift` (`UIViewPropertyAnimator`)      | `NativeOverlayAnimation.kt` (analytic spring interpolator) | `web/animateTransition.ts` (WAAPI)            |
| Store bridge                 | `useOverlayController.ts`                                      | same                                                       | same                                          |

P4c dialog notes:

- Every Dialog renders through `OverlayDialogPresentation` (sheet on narrow
  windows, centered card otherwise); the Tamagui Sheet / Dialog and the
  NativeSheetPresentation branches of `DialogFrame` are gone. `nativeSheet`
  is a no-op for Dialog.
- `floatingPanelProps` style the centered card (width, maxWidth, maxHeight,
  bg, overflow, radius…); `zIndex`, `sheetOverlayProps`, `sheetProps`
  (except `disableDrag`), `modal` and `forceMount` no longer apply.
- Level: `overlayLevel` prop, else from the portal container (`lock` for the
  lock screen's container, `secure` for the password prompt's, otherwise
  `modal`). `isOverTopAllViews` is redundant: every level is above app
  content.
- `useInPageDialog` / `useInTabDialog` pass the page's host and owner keys:
  in-page dialogs are page overlays (hidden while the page is covered).
- `Dialog.show` unmounts its portal when the exit animation ends
  (`onExited`), with a 1.5 s fallback, instead of a 300 ms timer.
- Web: a blocking page overlay inerts the siblings on the path from its page
  host to the app root, not the app root that contains it.
- Native sheets pad the home indicator / navigation bar and lift above the
  keyboard natively; the dialog adds no keyboard padding on native (the
  bounded login layout still caps its scroll view by the keyboard height).

P4d hardware / password notes:

- The hardware stage (MorphOverlay / DeviceStage) renders its portal inside
  one persistent, non-blocking `hardware`-level fullscreen entry (kit
  `HardwareStageOverlayContainer`); the stage's own wall blocks the app
  while it is up, and taps pass through once it is gone. The iOS raise
  tokens and the Android split-view offset are gone.
- Hardware dialogs (device confirm, errors, BLE permission, third-party
  install / permission) use `overlayLevel: 'hardware'`: above every modal
  dialog, ordered by request with the stage.
- Password setup / verify prompts use `overlayLevel: 'secure'`, above the
  stage and every dialog; their web z-index and portal workarounds are gone.

P4e lock screen notes:

- kit `AppStateContainer` (one file for every platform) hosts the lock
  screen and its dialog portal in a persistent blocking `lock`-level
  fullscreen entry with no overlay animation (the lock screen keeps its own
  AnimatePresence fade). Everything below it stays open and is covered.
- `setSecurityBlocked`, the `security` dismiss reason and
  `snapshot.securityBlockedBelow` are removed.
- Dialogs opened into the lock screen's container (forgot passcode, export
  logs) take the `lock` level from the container, so they render above the
  lock screen; on web in the same `document.body` child the lock screen keeps
  interactive (OK-62416).
- Android back is swallowed on the lock screen (blocking, not dismissible);
  it no longer reaches navigation behind the lock.
- The web lock tamper check and the lock screen's body-level inert pass are
  unchanged; the lock layer root is a `document.body` child.

P5a native popover notes:

- Every native Popover / ActionList / Select sheet is a native overlay sheet
  (`NativeSheetPresentation`); the Tamagui Popover sheet (`TMPopover.Adapt`),
  its external backdrop, z-index and back handler are gone, and
  `nativeSheet` is a no-op. iPad / wide windows keep the 400–480 pt centered
  frame inside the sheet. `usingSheet={false}` still renders no panel on
  native (web / desktop floating panels).
- The native popover renders inline in the caller's tree (its contexts
  apply) instead of through the full-window portal; content still mounts
  only while open unless `keepChildrenMounted`.

P5b web popover notes:

- Web Popover / ActionList / Select render in `OverlayView` at the `modal`
  level; the Tamagui Popover and `PopoverContent` are gone.
  - Below `md` with `usingSheet` (the default): an overlay sheet with a
    header and a dismissing backdrop.
  - Otherwise: `presentation="anchored"`, non-blocking and without a backdrop.
    Floating UI (`@floating-ui/dom`) places the panel: offset, flip, shift,
    and a max height from the available space. `autoUpdate` follows scroll
    and resize.
- The enter animation scales an ancestor of the panel, so the panel measures
  smaller while it runs. The panel is positioned again on `onPresented`.
- Anchored panels close on an outside press. Presses on the trigger, on the
  panel, or inside an overlay ranked above it do not close it, so a nested
  Select or a Dialog opened from the panel keeps it open. They also close on
  Escape, unless `hoverable`.
- `hoverable` opens and closes on mouse enter / leave of the trigger and
  panel. The default close delay is 100 ms, so the pointer can cross the gap.
- `keepChildrenMounted` maps to `keepContentMounted`. On web a closed entry
  stays in its layer, `visibility: hidden` and `inert`.
- `OverlayStore.resolveBack` also resolves non-blocking entries that are
  dismissible, so Escape reaches an anchored panel.

P5c tooltip and nested-level notes:

- `OverlayView` provides its level to its content.
  - `useEnclosingOverlayLevel()` reads that level.
  - `useNestedOverlayLevel(minimum = 'modal')` returns the higher of it and
    `minimum`.
  - Popover (web anchored and sheet), the native popover sheet
    (`NativeSheetPresentation`) and Tooltip open at that level. A popover in a
    password prompt or on the lock screen then renders above it, not beneath.
- Web Tooltip renders in `OverlayView`: anchored, non-blocking, no backdrop.
  Floating UI places it with offset 6, flip and shift. The Tamagui tooltip is
  gone; the trigger is still a Tamagui `View`, so `triggerAsChild` works.
  - Hover and keyboard focus (`:focus-visible`) open it; leaving or blurring
    the trigger closes it.
  - A tap toggles it on touch.
  - A mouse/pen press closes it until the pointer leaves (unchanged).
  - Escape and an outside press close it.
  - Non-`hovering` tooltips let the pointer pass through. `hovering` ones
    stay open while the pointer is over the content.
  - A controlled `open` wins; requests go to `onOpenChange`.
  - Native Tooltip still renders only the trigger.
- iOS: an overlay whose host view lives inside a level window resolves that
  window back to the app window. Before this, closing a sheet opened from a
  `secure` overlay recursed forever in `preferredStatusBarStyle`
  (`_appearingOrAppearedChildModalViewController` stack overflow). The level
  root controller also never forwards to itself.

P5d Spotlight notes:

- Spotlight renders in a blocking `OverlayView`: `presentation="fullscreen"`
  (fade), a 0.3 black backdrop, and the nested level. Back and Escape are
  swallowed, and the backdrop does not dismiss it; only "Done" ends the tour.
- It renders inline, so the highlighted copy of the trigger keeps its
  contexts. The deferred-trigger plumbing and `SPOTLIGHT_OVERLAY_PORTAL`
  (container and enum member) are gone.
- The Windows / Linux desktop -30 px title-bar offset is dropped: the overlay
  layer covers the whole window, so `measureInWindow` coordinates line up.
  Not yet checked on a Windows / Linux desktop build.

Measurement:

- `RNCNativeOverlay` has a hand-written shadow node (`common/cpp`, codegen
  `interfaceOnly`), like `<Modal>`: it is a `RootNodeKind` (measurements stop
  at it) and `Unstable_uncullableView`. Its state holds the window origin of
  the view the content currently lives in (level window, sheet, page host,
  or the host itself while staged), returned from
  `getContentOriginOffset`, so Fabric `measure` / `measureInWindow` report
  on-screen frames.
- iOS reports the origin after presenting, on entry / sheet layout, and after
  restaging; Android on the same events plus container layout changes. Both
  read model geometry, so a running enter / exit transform is ignored.
- Web measures the DOM and needs nothing extra.
- Android builds the codegen library from `android/src/main/jni/CMakeLists.txt`
  (as react-native-screens does); `jni/RNCNativeOverlay.h` shadows the
  generated header so autolinking sees the custom descriptor.

Keyboard avoidance:

- One rule on every platform (`computeKeyboardShift` on web,
  `NativeOverlayKeyboardShift` on iOS, `updateKeyboardShift` on Android): a
  sheet rises until its content bottom clears the keyboard; other content
  rises until its bottom is 16 pt above it; nothing rises above the top safe
  area, so full-window content (toaster host, lock screen) never moves.
- The lift lives on a keyboard layer between the entry and its animated
  content, so it composes with enter / exit transforms, and `measure`
  includes it.
- iOS: a shared tracker follows `keyboardWillChangeFrame` from the first
  overlay host on, animated with the keyboard's own curve; UIKit sheets keep
  their native avoidance.
- Android: each entry reads IME insets (applied insets at rest, the insets
  animation per frame, nothing consumed); the app runs edge-to-edge through
  react-native-keyboard-controller, so the window never pans for overlays.
- Web: `visualViewport` resize / scroll on mobile browsers.
- Center dialogs put the card itself at the overlay root (auto margins), so
  the native content extent is the card, not a full-window wrapper.

Status bar:

- `statusBarStyle` (`light` | `dark`) on an overlay; the topmost shown,
  unsuspended entry that sets one owns the status bar
  (`findStatusBarOwner`, render order: level, then request order).
- The owner mounts a React Native `<StatusBar>`, the same stack the pages
  use: the app runs without view-controller-based status bar appearance on
  iOS, and Android sets the window appearance. Web has no status bar.
- iOS asks the root view controller of level windows above the status bar
  (`lock`, `debug`) anyway; without view-controller-based appearance it
  answers with the app-wide style, so the StatusBar stack still decides.

Migration rules (decided 2026-09-28):

- No transition period. Every overlay (Dialog, Sheet, Toast, DialogLoading,
  hardware stage and dialogs, password prompts, lock screen, Popover,
  ActionList, Select, Spotlight) moves onto this package, and the JS
  overlays (Tamagui Dialog / Sheet / Popover portals, `Portal.Container`
  overlay hosts, `useOverlayZIndex`) are removed. No lint rule: each old
  entry point that has to stay exported throws at runtime once its last
  caller migrates, so a leftover or new use fails at once (2026-09-29).
- The global Portal exists only for the JS overlays; it is removed once
  its last caller migrates.
- The app lock is unified with the rest: the lock screen renders at the
  `lock` level and covers everything below it. Overlays are no longer
  closed on lock (done in P4e).
- Every presentation avoids the keyboard (center, sheet, page sheet) on
  iOS, Android, and web.
- Fabric `measure` / `measureInWindow` inside an overlay must report the
  on-screen frame.
- The status bar follows the topmost full-screen overlay (`statusBarStyle`).
- Custom toasts honor `disableSwipeGesture`.

Accepted limitations:

- The iOS page sheet is drawn by the entry (UIKit sheets always cover the
  window): it has no grabber and does not coordinate its pan with inner
  scroll views. Page sheets should keep scrollable content short or pass
  `dismissOnPanDown={false}`.
- Custom toasts stack by request order and overlap at the top, as before;
  message toasts stack inside their libraries.

Future work (better to have):

- VoiceOver / TalkBack cross-window modality, verified on device.
- Screen-reader toasts: the native toast library renders nothing under a
  screen reader today; the toast host should announce content and extend
  its timer instead.

Known gaps:

- `statusBarStyle` follows React Native's StatusBar stack, so a page that
  mounts a new `<StatusBar>` while an overlay owns the style, or the
  imperative theme calls (`StatusBar.setBarStyle`), take over until the owner
  changes; rare while a full-screen overlay covers the page.
- The dev package version is a plain `0.1.0`: CocoaPods does not resolve a
  local podspec whose version has a prerelease suffix.
