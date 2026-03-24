---
name: 1k-ui-recipes
description: UI recipes for scroll offset (useScrollContentTabBarOffset), view transitions (startViewTransition), horizontal scroll in collapsible tab headers (CollapsibleTabContext), Android bottom tab touch interception workaround, keyboard avoidance for input fields, iOS overlay navigation freeze prevention (resetAboveMainRoute), and web keyboardDismissMode cross-tab input blur prevention.
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

**Root cause**: `goBack()` triggers animated modal dismiss. Screen stacks inside detached tab views get `window=NIL` and retry indefinitely until the retry limit (50) is exhausted.

**Fix**: Use `resetAboveMainRoute()` to atomically remove all overlay routes via `CommonActions.reset` instead of sequential `goBack()` calls.

```typescript
import { resetAboveMainRoute, rootNavigationRef } from '@onekeyhq/components';

// ❌ WRONG: Sequential goBack() causes iOS window-nil freeze
const closeModalPages = async () => {
  rootNavigationRef.current?.goBack();
  await timerUtils.wait(150);
  await closeModalPages(); // recursive — each call triggers native animation
};
await closeModalPages();
await timerUtils.wait(250);
rootNavigationRef.current?.navigate(targetRoute);

// ✅ CORRECT: Atomic reset, no orphaned screen stacks
resetAboveMainRoute();
await timerUtils.wait(100);
rootNavigationRef.current?.navigate(targetRoute);
```

> **Key file**: `packages/components/src/layouts/Navigation/Navigator/NavigationContainer.tsx`
> **Reference**: commit `2cabd040` (OK-50182) — same fix applied to scan QR code navigation.

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

---

## Related Skills

- `/1k-cross-platform` - Platform-specific development
- `/1k-performance` - Performance optimization
- `/1k-coding-patterns` - General coding patterns
