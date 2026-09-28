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

| Term | Meaning |
|---|---|
| **scope** | `global`: attached to the app window. `page`: owned by one screen, rendered in that screen's root-route host. |
| **root-route host** | A single `PageOverlayHost` rendered as the last child of each root-stack route (Main tabs, Modal, Onboarding, FullScreenPush, WebView). Because it sits there, page overlays cover native headers and the tab bar. |
| **owner page** | The nearest screen that requested a page overlay. The overlay is visible only while its owner is on top inside its root route. |
| **level** | Fixed layer. `modal` 100 < `hardware` 200 < `secure` 300 < `toast` 400 < `lock` 500 < `debug` 900. |
| **lane** | The entries sharing (scope, host, level). Strategies apply per lane. |
| **strategy** | What a new entry does to its lane. `stack` (default) appears on top. `queue` waits until the lane is empty and is ordered by `priority`. `replace` closes the top entry, or the entries sharing `replaceKey`. |
| **presentation** | Frame and default motion: `sheet`, `center`, `fullscreen`, `toast`, `anchored`. |

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

| Presentation | Enter / exit | Backdrop |
|---|---|---|
| sheet | slide from bottom, `quick` | fade, `quick` |
| center | scale 0.85 + fade, `quick` | fade, `quick` |
| toast | slide from top + fade, `toastSlide` (native 300 ms quad in-out, web 400 ms ease) | none |
| fullscreen | fade, `quick` | none |
| anchored | scale 0.95 + fade from the resolved anchor placement, `popoverQuick` | fade |

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

| Concern | iOS | Android | Web |
|---|---|---|---|
| Global level host | One passthrough `UIWindow` per active level per `UIWindowScene`, ordered by `windowLevel`. `lock` sits above RN Alert (2001). | One `OverlayHost` FrameLayout in `android.R.id.content` above the ReactRootView, with one child container per level. | Sibling `div[data-onekey-layer]` roots under `body`, one z-index band per level (`OVERLAY_WEB_Z_INDEX_BASE`). |
| Order within a level | The window's presentation chain (sheet) and subview order (other presentations). | Child order. | DOM order. |
| Global sheet | `UISheetPresentationController`, presented from the level window's root VC (reuses native-sheet). | View sheet: CoordinatorLayout + BottomSheetBehavior + dimming view (native-sheet reworked off `BottomSheetDialog`). | Custom sheet: pointer drag, snap by velocity, `visualViewport` keyboard. |
| Page host | Fabric `PageOverlayHost` as the last child of the root-route screen. Custom-drawn sheet, because UIKit sheets cannot be page-scoped. | The same host inside the root-route screen. The ReactRootView already dispatches touches, so no nested RootView. | `position: absolute` host inside the root-route card. |
| Header / tab bar coverage (page) | Covered: the host is above the tab controller and navigation bars. | Covered. | Covered. |
| Touch passthrough (toast, debug, box-none) | `hitTest` returns nil on the window or root view. | A non-blocking entry hit-tests its React content with `TouchTargetHelper` (honoring `box-none`) and falls through to the FrameLayout sibling on a miss. | `pointer-events: none` root, `auto` per entry. |
| Back / Escape | Escape via `accessibilityPerformEscape`. The interactive pop gesture is disabled while a blocking page overlay is shown. | A `Window.Callback` wrapper consumes `KEYCODE_BACK` while a blocking overlay is shown. `ReactActivity.onBackPressed` hands back to JS BackHandler (react-navigation) before the `OnBackPressedDispatcher`, and the app opts out of predictive back, so a dispatcher callback alone never runs first. The dispatcher callback is kept for the predictive-back path. The IME still gets back first to close the keyboard. | Capture-phase `keydown` that ignores IME composition. |
| Modality / accessibility | `accessibilityViewIsModal` on the blocking level window; `.screenChanged` posted on present. | `IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS` on the content below. | `inert` on the app root and lower layers, `role=dialog`, `aria-modal`, focus trap and restore. |
| Keyboard | System sheet avoidance; `keyboardLayoutGuide` for custom presentations. The main window regains key status on dismiss. | `WindowInsetsAnimationCompat` per sheet (the app uses `adjustPan`). | `visualViewport`. |
| Animation engine | `UIViewPropertyAnimator` + `UISpringTimingParameters(mass:stiffness:damping:)`, which maps 1:1 and supports damping ratio > 1. | `SpringAnimation` with `stiffness = k/m` and `dampingRatio`; `PathInterpolator` for timing curves. | WAAPI `element.animate`. Timing presets use `cubic-bezier`; custom springs use `linear()`. |
| Content hosting | `RCTSurfaceTouchHandler` on the host root. A state-driven shadow node sizes Yoga, which replaces native-sheet's forced `frame`. A nested `SafeAreaProvider`. | A `RootView` + `JSTouchDispatcher` container for global levels. A state-driven shadow node, like RN Modal. | `createPortal`. The Tamagui theme class is set on the layer root, and React event bubbling stops at the entry root. |

Known divergences:

| Divergence | Status |
|---|---|
| iOS global sheet (system physics) vs. iOS page sheet (custom physics) | Accepted (decision A). Revisit after on-device comparison. |
| RN `Modal` and third-party dialogs on Android are windows above every layer | Accepted, mitigated by the lock policy (§5.7). |
| Web anchored origin follows the resolved placement after flip; today's code uses the requested placement | Intentional fix. |

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
- App lock: `overlayStore.setSecurityBlocked(true)` closes and refuses every
  level below `lock` (wired from kit `NativeSheetRoot`), because the current
  lock screen still lives in the app window below the overlay windows.

P4a toast notes:

- Message toasts (`Toast.success` / `message` / `error` …) keep their
  libraries (sonner on web, `@backpackapp-io/react-native-toast` on native)
  and render inside one persistent, non-blocking `toast`-level fullscreen
  entry (kit `ToastOverlayContainer`). The iOS raise tokens are gone.
- Custom toasts (`Toast.show` / `ShowCustom`) are their own `toast` entries:
  transparent blocking backdrop (tap closes when `dismissOnOverlayPress`),
  `scale 0.8 + offsetY -20 + fade` on `quick`, PanResponder swipe up to
  close. `Toast.show` unmounts its portal on the overlay's `onClose`, after
  the exit animation, instead of a 300 ms timer.
- Security closures do not count as a store close: while locked the
  controller does not re-request, and an overlay whose `visible` is still
  true comes back after unlock (`snapshot.securityBlockedBelow`).

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

| Contract | iOS | Android | Web |
|---|---|---|---|
| Level host | `NativeOverlayWindowManager.swift` | `NativeOverlayHost.kt` | `web/overlayLayers.ts` |
| Entry, hit testing, backdrop | `NativeOverlayEntryView` in `NativeOverlayContainerView.swift` | `NativeOverlayEntryRootView.kt` | `WebOverlayEntry` in `OverlayView.web.tsx` |
| Page host | `NativeOverlayPageHostView.swift` | `NativeOverlayPageHostView.kt` | `OverlayPageHost.web.tsx` |
| Sheet | `NativeOverlaySheetController.swift` | `NativeOverlayEntryRootView.configureSheet` | `OverlayView.web.tsx` + `web/useSheetDrag.ts` |
| Enter / exit animation | `NativeOverlayAnimation.swift` (`UIViewPropertyAnimator`) | `NativeOverlayAnimation.kt` (analytic spring interpolator) | `web/animateTransition.ts` (WAAPI) |
| Store bridge | `useOverlayController.ts` | same | same |

Known gaps:

- Content sizing uses the JS window size (`useWindowDimensions`) instead of a
  state-driven shadow node. Frames render correctly, but Fabric `measure` /
  `measureInWindow` inside an overlay still report the staging origin. This
  must be fixed before anchored presentations (P5) and Spotlight migrate.
- Message toasts stack inside their libraries; custom toasts stack by
  request order and overlap at the top, as before.
- `disableSwipeGesture` on custom toasts was never honored and still is not;
  swipe up always closes them.
- Android sheet keyboard avoidance relies on the activity's `adjustPan`;
  not verified on device yet (the emulator keyboard ran in stylus mode).
- iOS status bar style follows the app window underneath. A full-screen dark
  overlay on a light app (lock screen) shows dark status bar text; add a
  `statusBarStyle` prop before the lock screen migrates (P4).
- The dev package version is a plain `0.1.0`: CocoaPods does not resolve a
  local podspec whose version has a prerelease suffix.
- VoiceOver cross-window modality needs on-device verification.
- Today, native toasts disappear under screen readers
  (`@backpackapp-io/react-native-toast` returns null). The toast host must
  announce content and extend its timer when a screen reader is on.
