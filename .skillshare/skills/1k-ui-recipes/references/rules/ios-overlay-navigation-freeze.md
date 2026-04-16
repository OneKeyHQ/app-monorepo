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
| `resetScanModalRoute()` | Specialized: drops `ScanQrCodeModal` **and** the `ActionCenter` FullScreenPush route | Close scan modal (handles an extra FullScreenPush sibling that the generic does not) |
| `popToMainRoute()` | `resetAboveMainRoute()` + `await 100ms` | When you truly need to clear every overlay with a settle barrier |
| `resetToRoute(name, params)` | `reset` that replaces overlay routes with a specified target | Dismiss current overlay **and** open another one in a single dispatch |
| `navigateFromOverlayToTab({ targetTab, switchTab })` | Reset above Main + switch tab + wait | Jumping to a different tab from inside an overlay |

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
import { navigateFromOverlayToTab } from '@onekeyhq/components';

await navigateFromOverlayToTab({
  targetTab: ETabRoutes.Home,
  switchTab: (tab) => navigation.switchTab(tab),
});
// Now safe to push/navigate inside the Home tab.
```

## What does NOT work

| Approach | Why it fails |
|---|---|
| Adding `await timerUtils.wait(N)` before `goBack()` | The animated dismiss itself is what drops `window`. Waiting longer just delays the freeze. |
| Sequential `goBack()` with retries | Each animated dismiss triggers another window-nil round. Makes the storm worse. |
| `setTimeout` to nudge state after `popStack()` | JS runs fine; the native stack is the one stuck. Re-rendering JS does not re-attach the iOS window. |
| `navigation.pop()` assuming "it's just one screen" | When the current navigator is the modal root, `pop()` falls through to `popStack()` → same freeze. |

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

## Key files

- `packages/components/src/layouts/Navigation/Navigator/NavigationContainer.tsx` — `resetAboveMainRoute`, `resetChainSelectorModal`, `resetScanModalRoute`, `resetToRoute`, `navigateFromOverlayToTab`, `popToMainRoute`
- `packages/kit/src/hooks/useAppNavigation.ts` — `popStack` (`getParent()?.goBack()`) and `pop` (`canGoBack() ? goBack() : popStack()`)
- `patches/react-native-screens+4.23.0.patch` — the native retry + `[RNSScreenStack]` diagnostic logger
- `node_modules/@onekeyfe/react-native-native-logger/ios/OneKeyLog.swift` — writes `{Caches}/logs/app-latest.log`
