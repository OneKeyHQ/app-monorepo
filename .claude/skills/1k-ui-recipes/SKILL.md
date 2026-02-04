---
name: 1k-ui-recipes
description: UI recipes for scroll offset (useScrollContentTabBarOffset), view transitions (startViewTransition), and horizontal scroll in collapsible tab headers (CollapsibleTabContext).
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

---

## Related Skills

- `/1k-cross-platform` - Platform-specific development
- `/1k-performance` - Performance optimization
- `/1k-coding-patterns` - General coding patterns
