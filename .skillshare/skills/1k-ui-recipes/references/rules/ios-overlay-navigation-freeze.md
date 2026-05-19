# iOS Modal Dismiss UI Freeze

## Symptom

On iOS (native `UITabBarController` + react-native-screens + Fabric), closing an overlay route — Modal, FullScreenPush — leaves the underlying tab page visually stale:

- Animated dismiss completes, user is back on a tab page (e.g. Home).
- The page does not reflect state changes made just before the dismiss (e.g. newly selected chain).
- **A single touch anywhere on the screen "unsticks" the UI** and pending state flushes at once.
- JS thread continues to run (background service calls, network requests are logged). JS FPS looks normal.

## Root Cause (corrected after multiple investigation rounds)

### Primary: `react-freeze` suspends tab content during modal display

When a Modal is pushed on the Root native-stack, React Navigation propagates `unfocused` state to all screens below it. The NativeTab navigator has `freezeOnBlur: true` (`TabStackNavigator.native.tsx:85`), which triggers `react-freeze` to suspend the entire tab content via `<Suspense>` + `throw Promise`.

During freeze: React does **not** reconcile or commit the frozen subtree. State updates (e.g., Jotai atom changes from `updateSelectedAccountNetwork`) are queued but not rendered.

On modal dismiss: `freezeOnBlur` should unfreeze → React resumes reconciliation → reads latest state → commits to Fabric → native view updates. **But the unfreeze → commit pipeline can fail to flush**, leaving the UI showing the pre-freeze CALayer cache. A touch event forces React to re-evaluate, triggering the pending commit.

**Fix**: Disable `freezeOnBlur` on iOS NativeTab level (`TabStackNavigator.native.tsx`):
```ts
const nativeTabScreenOptions = {
  freezeOnBlur: !platformEnv.isNativeIOS,  // iOS: false, Android: true
};
```

### Why `detachInactiveScreens` is NOT the cause (corrected)

Earlier investigation hypothesized that `detachInactiveScreens` (default true) was detaching Main from the native view hierarchy during modal display. **This is wrong.** Native-stack (`@react-navigation/native-stack`) uses `<ScreenStack>` from react-native-screens, NOT `<ScreenContainer>`. `ScreenStack` does **not** support `detachInactiveScreens` — it always keeps all screens in the native view hierarchy. Main's UIView stays in the window during modal display (visible behind the pageSheet).

The `setPushViewControllers: SKIPPED - container window not ready` + `giving up after 50 retries` log entries are from the **modal's own inner stack** being torn down during dismiss — a doomed stack with `controllers=0, window=NIL`. These retries are CPU noise, not the freeze cause.

### Secondary: `navigate(Main, {pop:true})` overlapping transitions

`switchTab()` (deprecated) uses `navigate(Main, {pop:true})` which combines modal dismiss + tab switch in one React Navigation dispatch. While this creates overlapping UIKit transitions and orphan retry storms on doomed stacks, it is a **secondary contributor** (CPU waste, sluggishness) not the primary freeze cause. The primary cause is react-freeze.

## Investigation timeline (what was tried and why it failed)

| Round | Hypothesis | Fix attempted | Result | Why it failed |
|---|---|---|---|---|
| 1 | `popStack()` animated dismiss causes window-NIL on tab stacks | `resetChainSelectorModal()` — atomic `CommonActions.reset` | ❌ Still freezes | `CommonActions.reset` still triggers `dismissViewControllerAnimated:YES` at native level — RN Screens diffs state regardless of JS dispatch method |
| 2 | `detachInactiveScreens` detaches Main during modal | Proposed `detachInactiveScreens: false` on Root stack | ❌ Not applicable | Native-stack uses `ScreenStack` not `ScreenContainer` — no `detachInactiveScreens` prop |
| 3 | `navigate(Main, {pop:true})` triple-overlap creates orphans | `switchTabAsync` serializes overlay dismiss + tab switch; `navigate` interceptor in `useAppNavigation` | ⚠️ Helps with CPU waste but doesn't fix the freeze | Orphan retries are on doomed modal inner stacks, not Home tab stacks |
| 4 | JS-side force setState / Jotai atom bump | Tried programmatic state refresh | ❌ No effect | Fabric commits to correct shadow node, but frozen React subtree doesn't process the commit |
| 5 | **`react-freeze` (`freezeOnBlur: true`) suspends tab during modal** | `freezeOnBlur: !platformEnv.isNativeIOS` on NativeTab | **🔍 Under verification** | Unfreeze → commit pipeline is the suspected break point |

## Flow diagram

```
Modal opens on Root stack
│
├─ React Navigation: Main screen becomes unfocused
│  └─ Focus propagates down: Main → TabNavigator → Home tab → all unfocused
│
├─ NativeTab (freezeOnBlur: true):
│  └─ Home tab content wrapped in <Freeze freeze={true}>
│     └─ throw Promise → React Suspense catches → subtree SUSPENDED
│        └─ No more renders, no Fabric commits for Home
│
│  ... user interacts with modal (e.g. picks a chain) ...
│  ... Jotai atom updates (networkId changes) ...
│  ... React tries to re-render Home → but frozen → SKIPPED ...
│
Modal closes (any method: goBack / pop / resetAboveMainRoute / resetModalRouteByName)
│
├─ React Navigation: Main regains focus
│  └─ NativeTab: freezeOnBlur → freeze=false
│     └─ Suspense resolves → React SHOULD resume reconciliation
│
├─ Expected: React reads latest atoms → re-renders → Fabric commits → UI updates
│
├─ Actual (bug): unfreeze fires but pending Fabric commit doesn't flush
│  └─ UI shows pre-freeze CALayer cache (old network, old balances)
│  └─ Touch → React event dispatch → forces scheduler tick → commit lands → UI refreshes
```

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

## What does NOT work (and why — lessons from this investigation)

| Approach | Why it fails |
|---|---|
| `resetAboveMainRoute()` / `resetModalRouteByName()` | Does NOT prevent the freeze. RN Screens still calls `dismissViewControllerAnimated:YES` regardless of JS dispatch method. The freeze root cause is react-freeze, not the dismiss animation. |
| `switchTabAsync` / `navigate` interceptor (serializing overlay dismiss + tab switch) | Reduces CPU waste from overlapping UIKit transitions but does NOT fix the visible freeze. The frozen React subtree (react-freeze) doesn't process commits regardless of native transition timing. |
| `detachInactiveScreens: false` on Root stack | **Not applicable** — native-stack uses `ScreenStack`, not `ScreenContainer`. There is no `detachInactiveScreens` prop on native-stack. |
| JS-side force setState / Jotai atom bump | Frozen subtree doesn't process the state change. React suspends the entire render tree under `<Freeze>`. |
| Adding `await timerUtils.wait(N)` before dismiss | The freeze is caused by react-freeze, not by dismiss timing. Waiting doesn't help. |
| Sequential `goBack()` with retries | Creates more doomed orphan stacks (CPU waste) without addressing the react-freeze issue. |

**Key learning**: The `RNSScreenStack` retry storm (`giving up after 50 retries`) in the native logs is a **red herring**. It occurs on the **modal's own inner stack** being torn down (controllers=0, window=NIL), not on the Home tab's stack. The visible freeze is a React-level issue (frozen subtree not flushing commits on unfreeze), not a native view hierarchy issue.

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

## RNSScreenStack retry storm — a red herring (but still worth fixing)

The native logs show `giving up after 50 retries` and `setPushViewControllers: SKIPPED - container window not ready`. These are from the **modal's own inner stack** being torn down during dismiss (controllers=0, window=NIL, superview=NIL). This stack is being deallocated — the retries are wasted CPU but do NOT cause the visible UI freeze.

The retries add CPU contention on the main thread (~50 × dispatch_after per doomed stack per dismiss). `switchTabAsync` and the `navigate(Main, {pop:true})` interceptor serialize overlay dismiss + tab switch, reducing overlapping UIKit transitions and the number of doomed stacks created. This is a performance improvement, not a freeze fix.

## react-freeze explained

`react-freeze` wraps screen content in `<Suspense>` and throws a never-resolving Promise when `freeze=true`:

```tsx
// react-freeze internals (simplified)
function Freeze({ freeze, children }) {
  if (freeze) throw suspendedPromise;  // React Suspense catches this
  return children;
}
```

**`freezeOnBlur: true`** on NativeTab means: when a tab loses focus (including when a Modal is pushed on the Root stack above Main), react-freeze suspends all of that tab's React rendering. No state updates, no effects, no Fabric commits. The native UIView stays in the hierarchy showing its last-rendered CALayer.

**Performance benefit**: only the active tab renders. With 5+ tabs subscribing to WebSocket data (prices, order books, balances), this saves significant JS thread time.

**The bug**: on modal dismiss, the tab should unfreeze → React resumes → reads latest state → commits. But the commit pipeline can fail to flush, leaving stale UI until a touch event forces React to re-evaluate.

**Fix**: disable `freezeOnBlur` on iOS NativeTab level. Tab-internal `freezeOnBlur` (line 48, for inner stack push/pop) is unaffected and continues to provide performance benefit.

## Key files

- `packages/components/src/layouts/Navigation/Navigator/NavigationContainer.tsx` — `switchTabAsync`, `switchTab` (deprecated), `resetAboveMainRoute`, `resetChainSelectorModal`, `resetScanModalRoute`, `resetToRoute`, `navigateFromOverlayToTab`, `popToMainRoute`
- `packages/kit/src/hooks/useAppNavigation.ts` — `switchTabAsync` + `switchTab` (deprecated), `popStack`, `pop`
- `packages/kit/src/states/jotai/contexts/discovery/actions.ts` — `handleOpenWebSite` (the UniversalSearch → DApp flow, fixed to use `switchTabAsync`)
- `patches/react-native-screens+4.23.0.patch` — the native retry + `[RNSScreenStack]` diagnostic logger
- `node_modules/@onekeyfe/react-native-native-logger/ios/OneKeyLog.swift` — writes `{Caches}/logs/app-latest.log`
