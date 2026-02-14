---
name: 1k-ui-recipes
description: UI recipes for scroll offset (useScrollContentTabBarOffset), view transitions (startViewTransition), horizontal scroll in collapsible tab headers (CollapsibleTabContext), and Android bottom tab touch interception workaround.
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

---

## Related Skills

- `/1k-cross-platform` - Platform-specific development
- `/1k-performance` - Performance optimization
- `/1k-coding-patterns` - General coding patterns
