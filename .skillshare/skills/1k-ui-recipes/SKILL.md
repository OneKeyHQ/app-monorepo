---
name: 1k-ui-recipes
description: Reference-only catalog of UI workaround recipes. Do NOT auto-load — invoke ONLY when the user explicitly asks for "1k-ui-recipes" or a specific recipe by name (iOS tab bar scroll offset, startViewTransition, collapsible tab horizontal scroll, Android bottom tab touch intercept, keyboard avoidance, iOS overlay navigation freeze, web keyboardDismissMode, iOS modal Fabric frame animation, Android background thread timers/microtasks).
allowed-tools: Read, Grep, Glob
---

# OneKey UI Recipes

Bite-sized solutions for common UI issues.

## Quick Reference

| Recipe | Guide | Key Points |
|--------|-------|------------|
| iOS Tab Bar Scroll Offset | [ios-tab-bar-scroll-offset.md](references/rules/ios-tab-bar-scroll-offset.md) | Use `useScrollContentTabBarOffset` for `paddingBottom` on iOS tab pages |
| Smooth State Transitions | [start-view-transition.md](references/rules/start-view-transition.md) | Wrap heavy state updates in `startViewTransition` for fade on web |
| Horizontal Scroll in Collapsible Tab Headers | [collapsible-tab-horizontal-scroll.md](references/rules/collapsible-tab-horizontal-scroll.md) | Bidirectional `Gesture.Pan()` + programmatic `scrollTo` via `CollapsibleTabContext` |
| Android Bottom Tab Touch Interception | [android-bottom-tab-touch-intercept.md](references/rules/android-bottom-tab-touch-intercept.md) | **Temporary** — `GestureDetector` + `Gesture.Tap()` in `.android.tsx` to bypass native tab bar touch stealing |
| Keyboard Avoidance for Input Fields | [keyboard-avoidance.md](references/rules/keyboard-avoidance.md) | `KeyboardAwareScrollView` auto-scroll, Footer animated padding, `useKeyboardHeight` / `useKeyboardEvent` hooks |
| iOS Overlay Navigation Freeze | [ios-overlay-navigation-freeze.md](references/rules/ios-overlay-navigation-freeze.md) | Use `resetAboveMainRoute()` instead of sequential `goBack()` to close overlays before navigating |
| Web keyboardDismissMode Cross-Tab Blur | — | Never use `on-drag` on web; it globally blurs inputs via `TextInputState` |
| iOS Modal Fabric Frame Animation | [ios-modal-fabric-frame-animation.md](references/rules/ios-modal-fabric-frame-animation.md) | Fabric recycled views retain stale frames; wrap `updateLayoutMetrics` in `performWithoutAnimation` during modal transition |
| Android Background Thread Timers + Microtasks | [android-background-thread-timers-microtasks.md](references/rules/android-background-thread-timers-microtasks.md) | Bg Hermes runtime has no `setTimeout` and never drains the microtask queue — install JSI timers + call `rt->drainMicrotasks()` (fixed in `@onekeyfe/react-native-background-thread` 3.0.18) |

## Critical Rules Summary

### 1. iOS Tab Bar Scroll Content Offset

Use `useScrollContentTabBarOffset` to add dynamic `paddingBottom` to scroll containers inside tab pages. Returns tab bar height on iOS, `undefined` on other platforms.

```typescript
import { useScrollContentTabBarOffset } from '@onekeyhq/components';

const tabBarHeight = useScrollContentTabBarOffset();
<ScrollView contentContainerStyle={{ paddingBottom: tabBarHeight }} />
```

### 2. Smooth State Transitions with `startViewTransition`

Wrap heavy state updates in `startViewTransition` — fade on web/desktop via View Transition API, `setTimeout` fallback on native.

```typescript
import { startViewTransition } from '@onekeyhq/components';

startViewTransition(() => {
  setIsReady(true);
});
```

### 3. Horizontal Scroll in Collapsible Tab Headers (Native)

When placing a horizontal scroller inside `renderHeader` of collapsible tabs, use `Gesture.Pan()` that handles **both** directions — horizontal drives `translateX`, vertical calls `scrollTo` on the focused tab's ScrollView via `CollapsibleTabContext`.

```typescript
import { CollapsibleTabContext } from '@onekeyhq/components';
```

> **Do NOT** import directly from `react-native-collapsible-tab-view/src/Context`. Always use the `@onekeyhq/components` re-export.

### 4. Android Bottom Tab Touch Interception (Temporary Workaround)

> **Temporary fix** — the root cause is `react-native-bottom-tabs` intercepting touches even when hidden. This workaround should be removed once the upstream issue is fixed.

On Android, `react-native-bottom-tabs` intercepts touches in the tab bar region even when the tab bar is `GONE`. Buttons near the bottom of the screen become unclickable. Fix by creating a `.android.tsx` variant that wraps buttons with `GestureDetector` + `Gesture.Tap()`:

```typescript
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

const tapGesture = useMemo(
  () => Gesture.Tap().onEnd(() => { 'worklet'; runOnJS(onPress)(); }),
  [onPress],
);

<GestureDetector gesture={tapGesture}>
  <View>
    <Button>Label</Button>
  </View>
</GestureDetector>
```

> Use `.android.tsx` file extension so other platforms are unaffected.

### 5. Keyboard Avoidance for Input Fields

Standard `Page` and `Dialog` components handle keyboard avoidance automatically. Only add manual handling for custom layouts.

- **Page inputs**: Automatic — `PageContainer` wraps with `KeyboardAwareScrollView` (90px `bottomOffset`)
- **Page Footer**: Automatic — animates `paddingBottom` via `useReanimatedKeyboardAnimation`
- **Dialog**: Automatic — keyboard avoidance is handled at the Dialog level for all dialogs (including `showFooter: false`)
- **Custom layout**: Use `Keyboard.AwareScrollView` with custom `bottomOffset`

```typescript
import { Keyboard } from '@onekeyhq/components';

// Custom scrollable area with keyboard avoidance
<Keyboard.AwareScrollView bottomOffset={150}>
  {/* inputs */}
</Keyboard.AwareScrollView>

// Dismiss keyboard before navigation
await Keyboard.dismissWithDelay();
```

Hooks for custom behavior:

```typescript
import { useKeyboardHeight, useKeyboardEvent } from '@onekeyhq/components';

const height = useKeyboardHeight(); // 0 when hidden

useKeyboardEvent({
  keyboardWillShow: (e) => { /* e.endCoordinates.height */ },
  keyboardWillHide: () => { /* ... */ },
});
```

> Use `useKeyboardEventWithoutNavigation` for components outside NavigationContainer (Dialog, Modal).

### 6. iOS Overlay Navigation Freeze (`resetAboveMainRoute`)

On iOS with native `UITabBarController`, closing overlay routes (Modal, FullScreenPush) via sequential `goBack()` calls triggers an `RNSScreenStack` window-nil race condition. Popped pages' screen stacks lose their iOS window reference and enter a retry storm (50 retries × ~100ms), freezing navigation for ~5 seconds.

**Symptom**: After closing a modal, the app appears stuck on the home page. A touch on the screen "unsticks" navigation.

**Root cause**: `react-freeze` (`freezeOnBlur: true` on NativeTab) suspends tab content when a Modal is above Main. On modal dismiss, the unfreeze → Fabric commit pipeline can fail to flush, leaving the UI showing pre-freeze stale content until a touch event forces React to re-evaluate. The `RNSScreenStack` retry storms (`giving up after 50 retries`) visible in native logs are on the doomed modal's inner stack — CPU noise, not the freeze cause.

**Fix**: Disable `freezeOnBlur` on iOS NativeTab level (`TabStackNavigator.native.tsx`). Additionally, use `switchTabAsync()` instead of `switchTab()` for overlay → tab navigation to reduce overlapping UIKit transitions.

```typescript
// ❌ WRONG: switchTab overlaps modal dismiss + tab switch
navigation.switchTab(ETabRoutes.Home);

// ✅ CORRECT: switchTabAsync serializes overlay dismiss and tab switch
await navigation.switchTabAsync(ETabRoutes.Home);
```

> **Key file**: `packages/components/src/layouts/Navigation/Navigator/TabStackNavigator.native.tsx`
> **Reference**: See `ios-overlay-navigation-freeze.md` for full investigation timeline and corrected root cause analysis.

### 7. Web: ScrollView `keyboardDismissMode="on-drag"` Causes Cross-Tab Input Blur

On web, `react-native-web`'s `keyboardDismissMode="on-drag"` calls `dismissKeyboard()` on every scroll event. `dismissKeyboard()` uses `TextInputState` — a **global singleton** that tracks the currently focused input across the entire app, not scoped to individual tabs. This means a ScrollView scrolling on a **background tab** (e.g. Home) will blur an input on the **active tab** (e.g. Perps).

**Symptom**: Input fields lose focus periodically (~every 5 seconds) without user interaction.

**Root cause chain**:
1. Carousel on Home tab has `autoPlayInterval={5000}` → triggers scroll every 5s
2. Web PagerView uses `<ScrollView keyboardDismissMode="on-drag">` → `dismissKeyboard()` on scroll
3. `dismissKeyboard()` → `TextInputState.blurTextInput(currentlyFocusedField())` → blurs Perps input

**Fix (two layers)**:
- `Carousel/pager.tsx` (web-only): Force `keyboardDismissMode="none"` — web has no virtual keyboard, so dismiss is pure side-effect
- `Carousel/index.tsx`: Pause auto-play via `IntersectionObserver` when the Carousel is not visible in viewport

**Rules**:
- **NEVER** use `keyboardDismissMode="on-drag"` on web ScrollViews that may run in background tabs. On web, it globally blurs the focused input via `TextInputState`.
- For Carousel/PagerView, the web `pager.tsx` already forces `"none"`. For standalone ScrollViews, wrap with `platformEnv.isNative` if `on-drag` is needed only on mobile.
- Background Carousel auto-play should be paused when not visible (`IntersectionObserver`).

```typescript
// ❌ WRONG: Will blur inputs on other tabs when this ScrollView scrolls
<ScrollView keyboardDismissMode="on-drag" />

// ✅ CORRECT: Only use on-drag on native
<ScrollView keyboardDismissMode={platformEnv.isNative ? 'on-drag' : 'none'} />
```

> **Key files**: `packages/components/src/composite/Carousel/pager.tsx`, `packages/components/src/composite/Carousel/index.tsx`

### 8. iOS Modal Content Displacement During Presentation (Fabric)

On iOS with Fabric (New Architecture), modal pages (pageSheet/formSheet) show content flying in from wrong positions during the slide-up animation. Root cause: Fabric recycles native views that retain stale frames; when mounted during modal transition, UIKit captures the frame correction as an implicit animation.

**Fix**: Wrap Fabric's `updateLayoutMetrics` and `invalidateLayer` in `UIView.performWithoutAnimation:` during modal transitions using a global `RNSModalTransitionInProgress` flag.

```objc
// In UIView+ComponentViewProtocol.mm updateLayoutMetrics:
extern BOOL RNSModalTransitionInProgress;
if (RNSModalTransitionInProgress) {
    [UIView performWithoutAnimation:^{
        self.center = CGPoint{CGRectGetMidX(frame), CGRectGetMidY(frame)};
        self.bounds = CGRect{CGPointZero, frame.size};
        [self layoutIfNeeded];
    }];
}
```

> **Key files**: `patches/react-native-screens+4.23.0.patch`, `patches/react-native+0.81.5.patch`
> **Reference**: [ios-modal-fabric-frame-animation.md](references/rules/ios-modal-fabric-frame-animation.md)

### 9. Android Background Thread Missing `setTimeout` / Microtask Queue

On Android, the background JS runtime spun up by `@onekeyfe/react-native-background-thread` is a standalone Hermes runtime. RN's built-in timer module only wires into the **main** runtime, and the custom RPC executor that dispatches work into the bg runtime never drains the Hermes microtask queue. Two symptoms fall out of this:

- `setTimeout` / `setInterval` / `requestAnimationFrame` / `requestIdleCallback` are `undefined` → `await timerUtils.wait(ms)` hangs forever.
- `Promise.then()` / `async`/`await` continuations (even `await Promise.resolve()`) never run → any async RPC handler stalls at the first `await`, which surfaces as bridge-call timeouts.

**Fix**: Shipped in `@onekeyfe/react-native-background-thread` **3.0.18** at `android/src/main/cpp/cpp-adapter.cpp`. Bump `apps/mobile/package.json` — no patch-package needed.

Two changes on the bg runtime only:

1. **Drain microtasks after every cross-runtime work execution** — inside `nativeExecuteWork`, call `rt->drainMicrotasks()` after `work(*rt)`. This is the one line that makes `Promise.then` / `async`/`await` work.
2. **Install JSI-level timers** — `installTimersOnRuntime()` registers `setTimeout`, `setInterval`, `clearTimeout`, `clearInterval`, `requestAnimationFrame`, `cancelAnimationFrame`, `requestIdleCallback`, `cancelIdleCallback` as host functions backed by a single C++ worker thread that dispatches callbacks back onto the bg JS queue via the same `RPCRuntimeExecutor` used by `SharedRPC`.

```cpp
// Both fixes are required — they address orthogonal bugs on the same code path.
try { work(*rt); } catch (...) { /* ... */ }
rt->drainMicrotasks(); // ← fixes Promise/async hangs

// In nativeInstallSharedBridge, background branch only:
if (!capturedIsMain) { gBgTimerExecutor = executor; }
SharedRPC::install(*rt, std::move(executor), runtimeId);
if (!capturedIsMain) {
    installTimersOnRuntime(*rt); // ← fixes setTimeout/setInterval/rAF/rIC
}
```

**Rules**:
- **Do NOT** add a JS-land polyfill for `setTimeout` in `polyfillsPlatform.js` — the bug is below the JS layer, and a JS polyfill would hide (not fix) the missing microtask drain.
- Any future code that spawns a third JSI runtime from C++ **must** also call `drainMicrotasks()` after each work execution, or the Promise-hang symptom will reappear.
- iOS is unaffected — `BackgroundRunnerReactNativeDelegate` reuses RN's built-in timer module and default microtask handling.

> **Key files**: `native-modules/react-native-background-thread/android/src/main/cpp/cpp-adapter.cpp` (upstream in `~/project/app-modules`), `apps/mobile/package.json` (dependency bump to `3.0.18`)
> **Reference**: [android-background-thread-timers-microtasks.md](references/rules/android-background-thread-timers-microtasks.md)

---

## Related Skills

- `/1k-cross-platform` - Platform-specific development
- `/1k-performance` - Performance optimization
- `/1k-coding-patterns` - General coding patterns
