# iOS Overlay Navigation Freeze (atomic or surgical reset)

## Symptom

On iOS (with native `UITabBarController` + react-native-screens), closing an overlay route — Modal, FullScreenPush — by calling `goBack()` / `navigation.pop()` / `navigation.popStack()` leaves the underlying tab page unresponsive for ~5 seconds:

- Animated dismiss completes, user is back on a tab page (e.g. Home).
- The page does not reflect any state change committed just before the dismiss (e.g. the newly selected chain, account, or network).
- **A single touch anywhere on the screen "unsticks" the UI** and all pending state flushes at once.
- JS FPS counter may look normal — the JS thread is not blocked; the native side is.

## Root Cause

`goBack()` on the root navigator triggers an **animated** `UIViewController.dismissViewControllerAnimated:`. During that animation, `RNSScreenStack` instances inside **detached tab views** lose their `UIWindow` reference (`window=NIL, scene=nil`).

The patched `RNSScreenStack` in this repo retries its pending container update every 100ms, up to 50 times (~5s). If no `UIView.didMoveToWindow:` fires during that window — and it usually does not, because the stack sits inside a detached tab VC — every retry fails identically, then the stack gives up. The page stays visually stale until any event (touch, scene activation) forces a relayout.

### Key insight

The freeze is driven by `setPushViewControllers: SKIPPED - container window not ready` on an **inner tab's** screen stack, not by the modal dismiss itself. The modal is already gone; the underlying tab stack is the one that cannot commit the update it was queued to run.

### Race condition flow diagram

```
❌ BAD: navigate(Main, {pop:true}) — 3 UIKit transitions in one tick

  JS dispatch                         UIKit (main thread)
  ─────────                           ──────────────────
  navigate(Main,{pop:true})
    │
    ├─ React Nav state:               ┌─────────────────────────────┐
    │  [Main(home), Modal]             │ 1. dismissVC(animated:YES)  │
    │  → [Main(discovery)]             │ 2. tabBar.selectedIndex = 2 │ ← all in same tick
    │                                  │ 3. Main re-attach (detach   │
    │                                  │    reversal)                │
    │                                  └──────────┬──────────────────┘
    │                                             │
    │                                  Home tab inner stack:
    │                                    didMoveToWindow? ──── MISSED
    │                                    window=NIL ──────── ORPHAN
    │                                    retry 1/50 (100ms)
    │                                    retry 2/50 (100ms)
    │                                    ...
    │                                    retry 50/50 → give up
    │                                             │
    │                                  Fabric commits to orphan view
    │                                  User sees stale CALayer
    │                                             │
    Touch ─────────────────────────── hitTest → relayout → UI unfreezes


✅ GOOD: switchTabAsync / navigate interceptor — serialized

  JS dispatch                         UIKit (main thread)
  ─────────                           ──────────────────
  resetAboveMainRoute()
    │                                  ┌──────────────────────────┐
    ├─ state: [Main(home), Modal]      │ 1. CommonActions.reset   │
    │  → [Main(home)]                  │    → state swap, no      │
    │                                  │      animated dismiss    │
    │                                  │    → Modal removed       │
    │                                  └──────────┬───────────────┘
    │                                             │
    await 100ms ◄─── UIKit settles ───────────────┘
    │                                  Main is now topmost
    │                                  All tab stacks: window=YES ✓
    │
  navigate(Main, {screen: discovery})
    │                                  ┌──────────────────────────┐
    ├─ state: [Main(home)]             │ 2. tabBar.selectedIndex  │
    │  → [Main(discovery)]             │    = discovery            │
    │                                  │    (single transition,   │
    │                                  │     no overlap)          │
    │                                  └──────────────────────────┘
    │
    │                                  Fabric commits to correct view ✓
    │                                  UI updates immediately ✓
```

### Confirmed trigger: UniversalSearch → DApp → Discovery (single cycle)

```
User taps search icon on Home tab
│
T+0      pushModal(UniversalSearchModal)
│        Root state: [Main(home), UniversalSearchModal]
│        Main detached (detachInactiveScreens=true)
│        Home inner RNSScreenStack → window=NIL
│
│        ... user types, sees DApp results, taps one ...
│
T+100ms  UniversalSearchDappItem.handlePress()
│        └─ setTimeout(100ms) → handleWebSite() → handleOpenWebSite()
│
│        handleOpenWebSite does 3 things concurrently:
│        ┌─────────────────────────────────────────────────────────┐
│        │ ① navigation.switchTab(Discovery)          [sync]      │
│        │   └─ navigate(Main, {screen:Discovery}, {pop:true})    │
│        │      ┌─────────────────────────────────────────┐       │
│        │      │ UIKit receives in ONE tick:              │       │
│        │      │  a. dismissVC(SearchModal, animated:YES) │       │
│        │      │  b. tabBar.selectedIndex = Discovery     │       │
│        │      │  c. Main re-attach to view tree          │       │
│        │      └──────────────────────────────────────────┘       │
│        │                                                         │
│        │ ② setTimeout(150ms) → emit SwitchDiscoveryTabInNative  │
│        │                                                         │
│        │ ③ setTimeout(300ms) → openMatchDApp → push DApp webview│
│        └─────────────────────────────────────────────────────────┘
│
│        During ① UIKit overlap:
│          Home tab inner stack (was active before switch):
│            - Main re-attaches, but tab switches to Discovery
│            - Discovery inner stack gets window=YES
│            - Home inner stack: didMoveToWindow MISSED → ORPHAN
│              window=NIL, superview=NIL
│              → starts retry: 1/50, 2/50, ... 50/50 → give up
│
T+250ms  ② fires: SwitchDiscoveryTabInNative event
│        (another state update while orphan is retrying)
│
T+400ms  ③ fires: openMatchDApp pushes DApp webview into Discovery
│        (yet another state transition)
│
│        Result: 1 orphan RNSScreenStack created this cycle
```

### Orphan accumulation across repeated cycles (3-5x to reproduce)

```
Cycle 1: Home → Search → pick DApp → switchTab(Discovery)
│  Home inner stack → orphan #1 (window=NIL, retry 50×100ms = 5s)
│  User goes back to Home tab, sees it working (NEW stack instance)
│
Cycle 2: Home → Search → pick DApp → switchTab(Discovery)
│  Home inner stack → orphan #2
│  orphan #1: still retrying or already gave up
│
Cycle 3: Home → Search → pick DApp → switchTab(Discovery)
│  Home inner stack → orphan #3
│  3 orphans now competing for main thread time
│  Fabric's view registry may now point to orphan #1 or #2
│
...after N cycles...
│
Trigger: Home → Chain selector → pick new chain → dismiss modal
│  Jotai atom updates (networkId changed)
│  React reconciles Home component with new network
│  Fabric commits props to Home's shadow node
│  ├─ Mount target: orphan #2's UIView (stale, detached, not in window)
│  └─ On-screen: live view showing OLD chain data (CALayer cache)
│
│  User sees: "UI frozen after chain switch"
│  User touches screen → UIKit hitTest → finds live view → relayout
│  → Live view re-reads latest props → UI unfreezes
```

### Orphan impact on app performance

Orphan `RNSScreenStackView` instances are **never released** until the app is killed. They are kept alive by three strong reference chains:
- React component tree (tab components are persistent, never unmounted)
- Fabric `ComponentViewRegistry` (tag → view mapping is never cleaned for orphans)
- `UITabBarController.cachedViewControllers` (tab VC caching)

**Memory**: each orphan retains a full UIView subtree (the entire tab page content — token list cells, headers, images). N cycles = N × full page view hierarchies in memory. This triggers memory warnings → image cache eviction → visible image flickering.

**CPU (main thread)**:

| Phase | Per orphan | N orphans |
|---|---|---|
| First 5s after creation | 50 × `dispatch_after(100ms)` + `NSString stringWithFormat` log | N × 50 main-queue tasks competing with rendering |
| After give-up (5s+) | Quiet — no active retry | Quiet |
| Every app foreground | `onApplicationDidBecomeActive` → check `_pendingContainerUpdate` (still YES) → one `schedulePendingContainerUpdateRetry` call → retryCount >= 50 → immediately give up | N wasted calls + N log lines per foreground |
| Every scene activation | Same as foreground | Same |

**User-perceived sluggishness**: after many cycles (10+), the accumulated orphans cause:
1. Main-thread contention during the 5s retry window of each new orphan
2. Increased memory pressure → more frequent GC / cache eviction
3. Fabric view registry lookup overhead (O(N) stale entries)
4. Periodic one-shot retry attempts on every foreground/background transition

**Fix scope**: `switchTabAsync` / `navigate` interceptor prevents **new** orphans. Already-accumulated orphans from before the fix persist until **app restart**. A future native-layer enhancement could detect orphans (superview=nil + parentVC=nil + retryCount >= max) and proactively clear `_pendingContainerUpdate` + deregister from Fabric's view registry to allow ARC deallocation.

## Useful navigation primitives (from `@onekeyhq/components`)

| Function | Behavior | Use when |
|---|---|---|
| `navigation.pop()` | `goBack()` on the current navigator; falls through to `popStack()` when it is the root | Going back **within** a modal / inner stack |
| `navigation.popStack()` | `goBack()` on the **parent** navigator — closes the entire modal with a native dismiss animation | ❌ Avoid on iOS when an overlay sits above a tab page |
| `resetAboveMainRoute()` | Atomic `CommonActions.reset` that drops **every** route above `Main`. No native dismiss animation | ✅ Only when the overlay is guaranteed to be the only route above `Main` |
| `resetModalRouteByName(modalName)` | Generic primitive: `CommonActions.reset` that drops **only** root Modal routes whose inner screen matches `modalName`, preserving parents, tabs, and FullScreenPush | Building a per-modal wrapper, or a one-off close from a single site |
| `resetChainSelectorModal()` | Thin wrapper → `resetModalRouteByName(ChainSelectorModal)` | Close chain selector from **any** context (Home, DApp, Settings, BulkSend, Onboarding) |
| `resetPrimeModal()` | Thin wrapper → `resetModalRouteByName(PrimeModal)` | Close Prime modal from any context (Prime can be pushed from AccountManagerStacks, Setting, ApprovalManagement, etc.) |
| `resetOnboardingModal()` | Thin wrapper → `resetModalRouteByName(OnboardingModal)` | Close onboarding from any context (onboarding can be pushed from LiteCard, KeyTag, Swap, Perp, AccountManagerStacks, etc.) |
| `resetAccountManagerStacksModal()` | Thin wrapper → `resetModalRouteByName(AccountManagerStacks)` | Close account manager from any context (add account, select account, export keys, batch create, wallet edit, resolve wallets) |
| `resetScanModalRoute()` | Specialized: drops `ScanQrCodeModal` **and** the `ActionCenter` FullScreenPush route | Close scan modal (handles an extra FullScreenPush sibling that the generic does not) |
| `switchTabAsync(route)` | **Async tab switch**: if overlay present, `resetAboveMainRoute()` → `wait(100ms)` → `navigate(Main, {screen: route})`. If no overlay, plain navigate. | ✅ **Preferred** for any tab switch that might happen while a modal is open |
| `switchTab(route)` | **@deprecated** Sync tab switch using `navigate(Main, {pop:true})` — overlaps modal dismiss + tab switch + Main re-attach in one UIKit tick → creates orphan RNSScreenStack instances | ❌ Legacy, keep only in fire-and-forget paths (tab bar press, bootstrap) |
| `popToMainRoute()` | `resetAboveMainRoute()` + `await 100ms` | When you truly need to clear every overlay with a settle barrier |
| `resetToRoute(name, params)` | `reset` that replaces overlay routes with a specified target | Dismiss current overlay **and** open another one in a single dispatch |
| `navigateFromOverlayToTab({ targetTab })` | Delegates to `switchTabAsync` internally | Convenience wrapper with explicit "from overlay" semantics |

### Atomic vs surgical reset — picking the right tool

`resetAboveMainRoute()` is **too aggressive** when the target overlay can be pushed from inside another modal. Real callstacks for `ChainSelectorModal`:

```
[Main, ChainSelectorModal]                       ← home tab badge              — atomic OK
[Main, DAppConnectionModal, ChainSelectorModal]  ← dapp flow                  — atomic would kill DApp ❌
[Main, BulkSendModal, ChainSelectorModal]        ← bulk send asset picker     — ❌
[Main, OnboardingModal, ChainSelectorModal]      ← onboarding chain trigger   — ❌
```

Whenever an overlay has **multiple entry points** and at least one is from inside another modal, write a surgical helper that filters by route name (`resetScanModalRoute`, `resetChainSelectorModal` are the templates). Only use `resetAboveMainRoute()` when every entry point is a tab page.

Audit before adopting `resetAboveMainRoute()`:

1. `grep -rn 'pushModal(EModalRoutes.YourModal' packages/` — list every caller.
2. For each caller, trace the route state when the push happens.
3. If any caller sits inside another overlay, add a surgical helper instead of using `resetAboveMainRoute`.

## Diagnostic approach (before writing any fix)

### 1. Reproduce the symptom

- On an iOS device or simulator with the app running.
- Trigger the interaction (e.g. home → chain selector → pick a different chain).
- Do **not** touch the screen for ~10s after the modal dismisses.
- If the UI eventually refreshes on its own or after a touch, this class of bug is in play.

### 2. Open the native log stream

```bash
xcrun simctl spawn booted log stream --predicate \
  'eventMessage CONTAINS "[RNSScreenStack]"'
```

Or read the persisted app log (CocoaLumberjack file):

- iOS: `{App Caches}/logs/app-latest.log`
- Exposed via `NativeLogger.getLogDirectory()` / in-app "Export logs".

Patched `RNSScreenStack.mm` already emits structured diagnostics — no extra instrumentation needed.

### 3. Look for these signatures, in order

| Log substring | Meaning |
|---|---|
| `setModalViewControllers: SKIPPED - both window and lastModal.window are nil` | Modal dismiss path hit window-nil |
| `setPushViewControllers: SKIPPED - container window not ready` | **Inner tab stack** push hit window-nil — most common trigger |
| `schedulePendingContainerUpdateRetry: reason=..., retryCount=N` | Retry scheduled (every 100ms) |
| `retry timer fired (N/50)` | Retry attempt N fired |
| `giving up after 50 retries` | ~5s storm completed without recovery |
| `didMoveToWindow: retrying pending container update after window restored` | iOS **self-healed** — the freeze ended on its own |
| `onSceneDidActivate: pending update detected, scheduling retry` | Scene activation pushed another retry round |

**Decision rule:** if a `SKIPPED` line is followed by ~50 `retry timer fired` lines culminating in `giving up after 50 retries`, and there is **no** `didMoveToWindow: retrying ... after window restored` until a user event arrives, the screen stack is stuck because of a `goBack()`-driven animated dismiss. That is the bug this rule targets.

If a storm exists but `didMoveToWindow: retrying` fires cleanly every time, the retry machinery is doing its job and the bug is elsewhere — do **not** apply this rule.

### 4. Minimal log example (chain selector, 2026-04-15)

```
21:55:30 [RNSScreenStack] setPushViewControllers: SKIPPED - container window not ready!
         selfWindow=NIL, superviewWindow=NIL, parentWindow=YES, ...
         setting _pendingContainerUpdate=YES
21:55:30 [RNSScreenStack] retry timer fired (1/50) requestId=7
...
21:55:35 [RNSScreenStack] retry timer fired (50/50) requestId=7
21:55:35 [RNSScreenStack] giving up after 50 retries (requestId=7)
21:55:40 app => page => pageView : [{"pageName":"TabHome"}]   ← user touched screen, UI finally updates
```

~5s of silent wall-clock freeze between `giving up` and the next user-visible state change is the diagnostic.

### 5. Map log to JS call site

- `giving up` is emitted on the main thread (`main=1`). The preceding user action is whichever JS call did a `goBack() / pop() / popStack()` on a modal that wraps a tab page.
- Grep the feature's callback (`handle*Press`, `on*Done`, `close*`) for `navigation.popStack()` / `navigation.pop()` / `rootNavigationRef.current?.goBack()` that runs right before the storm.

## Code fix

Replace the animated dismiss with an atomic reset.

### ❌ Pattern that triggers the freeze

```ts
void actions.current.updateSelectedAccountNetwork({ num, networkId: item.id });
navigation.popStack();  // goBack() on root → animated modal dismiss →
                        // RNSScreenStack window=NIL on inner tab stack → freeze
```

Recursive `goBack()` is even worse:

```ts
const closeModalPages = async () => {
  rootNavigationRef.current?.goBack();
  await timerUtils.wait(150);
  await closeModalPages();
};
await closeModalPages();
rootNavigationRef.current?.navigate(targetRoute);
```

### ✅ Replacement — surgical (preferred when the overlay has multi-context entries)

```ts
import { resetChainSelectorModal } from '@onekeyhq/components';

void actions.current.updateSelectedAccountNetwork({ num, networkId: item.id });
resetChainSelectorModal();  // drops only ChainSelectorModal — parent overlays stay
```

For a new surgical helper, reuse the shared `resetModalRouteByName` primitive in `NavigationContainer.tsx` — the full filter/reset logic lives there once:

```ts
/** Thin wrapper — see resetModalRouteByName. */
export function resetYourModal() {
  resetModalRouteByName(EModalRoutes.YourModal);
}
```

Use `resetModalRouteByName(modalName)` directly if you only need a one-off call site. Add a named wrapper when the same modal is closed from multiple files — gives grep-able intent and one place to extend behavior later.

### ✅ Replacement — atomic (only when the overlay always sits directly above `Main`)

```ts
import { resetAboveMainRoute } from '@onekeyhq/components';

resetAboveMainRoute();  // drops every overlay — do NOT use if the modal can be pushed from another modal
```

### When you need to open another overlay right after

Do not `resetAboveMainRoute()` + `navigate()` — the intermediate state can still race with native dismiss. Use `resetToRoute` to do both atomically:

```ts
import { resetToRoute } from '@onekeyhq/components';

resetToRoute(ERootRoutes.Modal, {
  screen: EModalRoutes.OnboardingModal,
  params: { ... },
});
```

### When you are in an overlay and need to end up on a tab

```ts
// ✅ PREFERRED: switchTabAsync handles everything
await navigation.switchTabAsync(ETabRoutes.Home);
// Now safe to push/navigate inside the Home tab.

// ✅ ALSO OK: navigateFromOverlayToTab (wraps switchTabAsync)
import { navigateFromOverlayToTab } from '@onekeyhq/components';
await navigateFromOverlayToTab({ targetTab: ETabRoutes.Home });
```

## What does NOT work

| Approach | Why it fails |
|---|---|
| Adding `await timerUtils.wait(N)` before `goBack()` | The animated dismiss itself is what drops `window`. Waiting longer just delays the freeze. |
| Sequential `goBack()` with retries | Each animated dismiss triggers another window-nil round. Makes the storm worse. |
| `setTimeout` to nudge state after `popStack()` | JS runs fine; the native stack is the one stuck. Re-rendering JS does not re-attach the iOS window. |
| `navigation.pop()` assuming "it's just one screen" | When the current navigator is the modal root, `pop()` falls through to `popStack()` → same freeze. |
| `switchTab()` (deprecated) with `navigate(Main, {pop:true})` | Overlaps modal dismiss + tab switch + Main re-attach in one UIKit tick; creates orphan stacks that accumulate. |
| `CommonActions.reset` / `resetModalRouteByName` alone | Still triggers animated native dismiss — react-native-screens diffs state and calls `dismissViewControllerAnimated:YES` regardless of JS dispatch type. |
| JS-side force setState / Jotai atom bump | Fabric commits to the correct shadow node, but the native UIView receiving the commit may be an orphan not in the window — the visible view on screen is a stale CALayer snapshot. |

## Scope guidance

Apply the reset helper **only** at the close-the-modal call site. Do **not** rewrite inner `navigation.pop()` calls that navigate between screens within the same modal stack (e.g. coming back from `AddCustomNetwork` to the selector). Those `pop()` calls stay on the same screen stack and do not trigger the window-nil path.

Rule of thumb:

- Going back **inside** an overlay → `navigation.pop()` (unchanged).
- Leaving the overlay:
  - Overlay always pushed directly above `Main` → `resetAboveMainRoute()`.
  - Overlay may be pushed from inside another overlay → surgical `resetXxxModal()`.

## Known fixed surfaces (reference commits)

- Scan QR code navigation — OK-50182 (`2cabd040`)
- Scan-to-onboarding flow — OK-51748
- Scan-to-home flow on background web — OK-52532
- Chain selector (home chain switch) — this doc, via `resetChainSelectorModal()`
- Prime / OneKey ID logout — this doc, via `resetPrimeModal()`
- Prime transfer exit — this doc, via `resetPrimeModal()` (partial-close) / `resetAboveMainRoute()` (full-close)
- External wallet connect onboarding — this doc, via `resetOnboardingModal()`
- Account manager stacks (add account, select account, export keys, batch create, wallet edit, resolve wallets) — OK-52482, via `resetAccountManagerStacksModal()`

## Orphan accumulation via repeated modal cycles

The freeze often does NOT trigger on the first modal open/close. It requires **repeated cycles** of "open modal → dismiss + switch tab → open modal → dismiss + switch tab" (e.g., UniversalSearch → pick DApp → Discovery tab, × 3–5 times).

**Mechanism**: Each cycle of `switchTab()` (deprecated) with an overlay present calls `navigate(Main, {pop:true})`, which overlaps:
1. Modal dismiss (animated UIKit transition)
2. Tab switch (`UITabBarController.selectedIndex` change)
3. Main screen re-attach (detachInactiveScreens reversal)

During this overlap, the **previously-active tab's inner RNSScreenStack** may not complete its `didMoveToWindow` chain — it stays as an orphan with `window=NIL, superview=NIL`. Each cycle creates a new orphan. After N cycles:
- N orphan stacks simultaneously fire 50×100ms retry timers
- One of the orphans may be the view Fabric is committing prop updates to (due to view recycling or stale component-handle mapping)
- The on-screen view shows a stale CALayer snapshot, not receiving the Fabric commits → user sees "frozen UI"
- A touch event triggers UIKit hit-test / layout pass → forces the correct view to render → "unfreezes"

**Fix**: Replace `switchTab()` with `switchTabAsync()` in any flow that opens a modal, then dismisses + switches tab. `switchTabAsync` serializes the dismiss and switch into two separate steps, avoiding the triple-overlap.

**Example fixed flow** (UniversalSearch → DApp → Discovery):
```ts
// Before (orphan-producing):
navigation.switchTab(ETabRoutes.Discovery);         // navigate(Main, {pop:true})
setTimeout(() => { openMatchDApp(...) }, 300);       // 300ms guess

// After (serialized):
await switchTabAsync(ETabRoutes.Discovery);          // reset overlay → wait → navigate
openDApp();                                          // runs after settle
```

## Key files

- `packages/components/src/layouts/Navigation/Navigator/NavigationContainer.tsx` — `switchTabAsync`, `switchTab` (deprecated), `resetAboveMainRoute`, `resetChainSelectorModal`, `resetScanModalRoute`, `resetToRoute`, `navigateFromOverlayToTab`, `popToMainRoute`
- `packages/kit/src/hooks/useAppNavigation.ts` — `switchTabAsync` + `switchTab` (deprecated), `popStack`, `pop`
- `packages/kit/src/states/jotai/contexts/discovery/actions.ts` — `handleOpenWebSite` (the UniversalSearch → DApp flow, fixed to use `switchTabAsync`)
- `patches/react-native-screens+4.23.0.patch` — the native retry + `[RNSScreenStack]` diagnostic logger
- `node_modules/@onekeyfe/react-native-native-logger/ios/OneKeyLog.swift` — writes `{Caches}/logs/app-latest.log`
