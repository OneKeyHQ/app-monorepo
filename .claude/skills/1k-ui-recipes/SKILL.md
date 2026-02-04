---
name: 1k-ui-recipes
description: Practical UI recipes for OneKey. Use when dealing with iOS tab bar scroll content overlap, scroll view padding, fade-in/fade-out transitions with startViewTransition, or smooth state transition animations. Triggers on tab bar, scroll overlap, paddingBottom, tabBarHeight, useScrollContentTabBarOffset, startViewTransition, useTransition, fade, transition, smooth switch, iOS scroll, bottom padding, content hidden, tab bar offset.
allowed-tools: Read, Grep, Glob
---

# OneKey UI Recipes

Bite-sized solutions for common UI issues.

## 1. iOS Tab Bar Scroll Content Offset

### Problem

On iOS with native bottom tabs (`react-native-bottom-tabs`), scroll view content at the bottom is hidden behind the tab bar because the native tab bar overlays the content area.

### Solution

Use `useScrollContentTabBarOffset` to add dynamic `paddingBottom` to scroll containers. This hook returns the native-measured tab bar height on iOS and `undefined` on all other platforms, so it is safe to apply unconditionally.

```typescript
import { useScrollContentTabBarOffset } from '@onekeyhq/components';
```

### Pattern

```typescript
function MyTabPage() {
  const tabBarHeight = useScrollContentTabBarOffset();

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: tabBarHeight }}
    >
      {/* content */}
    </ScrollView>
  );
}
```

### Return Value by Platform

| Platform | Return Value |
|----------|-------------|
| iOS | `number` (native-measured tab bar height including safe area) |
| Android | `undefined` |
| Web | `undefined` |
| Desktop | `undefined` |

### Applicable Components

Apply to **any** scrollable container rendered inside a tab page:

| Component | How to Apply |
|-----------|-------------|
| `ScrollView` | `contentContainerStyle={{ paddingBottom: tabBarHeight }}` |
| `Tabs.ScrollView` | Wrap inner `YStack` with `style={tabBarHeight ? { paddingBottom: tabBarHeight } : undefined}` |
| `Tabs.FlatList` | `contentContainerStyle={{ paddingBottom: tabBarHeight }}` |
| `Table` (via `contentContainerStyle`) | `contentContainerStyle={{ paddingBottom: tabBarHeight }}` |
| `ListView` / `FlatList` | `contentContainerStyle={{ pb: tabBarHeight }}` |

### When to Use vs Not Use

```typescript
// Use useScrollContentTabBarOffset for scroll views inside tab pages
const tabBarHeight = useScrollContentTabBarOffset();

// Do NOT use useTabBarHeight for this purpose.
// useTabBarHeight returns a value on ALL platforms and is intended
// for layout calculations (e.g. keyboard offset, min-height),
// not for scroll content padding.
```

### Fallback Values

When the page already has a default bottom padding, use nullish coalescing:

```typescript
// Falls back to '$5' on non-iOS platforms
contentContainerStyle={{ paddingBottom: tabBarHeight ?? '$5' }}
```

### How It Works Internally

```
BottomTabBarHeightContext (from react-native-bottom-tabs on native)
        |
        v
useNativeTabBarHeight() -- reads context, returns number | undefined
        |
        v
useScrollContentTabBarOffset()
  - iOS:     returns nativeTabBarHeight ?? 0
  - Others:  returns undefined (no-op)
```

Key files:
- `packages/components/src/layouts/Page/hooks.ts` - hook definition
- `packages/components/src/layouts/Page/BottomTabBarHeightContext.native.ts` - re-exports from `react-native-bottom-tabs`
- `packages/components/src/layouts/Page/BottomTabBarHeightContext.ts` - web fallback (context with `undefined` default)

### Real Examples

```typescript
// Home page - ScrollView
// packages/kit/src/views/Home/pages/HomePageView.tsx
const tabBarHeight = useScrollContentTabBarOffset();
<ScrollView contentContainerStyle={{ paddingBottom: tabBarHeight }}>

// Market page - Tabs.FlatList
// packages/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MobileMarketTokenFlatList.tsx
const tabBarHeight = useScrollContentTabBarOffset();
<Tabs.FlatList
  contentContainerStyle={{
    paddingBottom: platformEnv.isNativeAndroid
      ? listContainerProps.paddingBottom
      : tabBarHeight,
  }}
/>

// Earn page - Tabs.ScrollView with inner YStack
// packages/kit/src/views/Earn/components/EarnMainTabs.tsx
const tabBarHeight = useScrollContentTabBarOffset();
<Tabs.ScrollView>
  <YStack style={tabBarHeight ? { paddingBottom: tabBarHeight } : undefined}>
    {children}
  </YStack>
</Tabs.ScrollView>

// Developer page - fallback value
// packages/kit/src/views/Developer/pages/TabDeveloper.tsx
const tabBarHeight = useScrollContentTabBarOffset();
<ScrollView contentContainerStyle={{ paddingBottom: tabBarHeight ?? '$5' }}>
```

---

## 2. Smooth State Transitions with `startViewTransition`

### Problem

When a large state update triggers a heavy re-render (e.g. switching from a placeholder to a fully initialized component tree), the UI can feel janky or flash abruptly.

### Solution

Wrap the state update in `startViewTransition`. This is a OneKey wrapper with **platform-specific behavior**:

| Platform | Behavior |
|----------|----------|
| Web / Desktop | Uses View Transition API — produces a smooth **fade-in/fade-out** effect |
| Native (iOS / Android) | **Falls back to `setTimeout`** — no visual fade, but still defers the update to the next tick to avoid blocking the current frame |

```typescript
import { startViewTransition } from '@onekeyhq/components';
```

> **Note:** On native platforms there is no fade animation. The callback is simply scheduled via `setTimeout`, which helps avoid janky synchronous re-renders but does not produce a visual transition.

### Pattern

```typescript
import { useEffect, useState } from 'react';

import { startViewTransition } from '@onekeyhq/components';

function MyComponent({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    void someAsyncInit().then((result) => {
      // Web: smooth fade transition; Native: deferred via setTimeout
      startViewTransition(() => {
        setIsReady(result);
      });
    });
  }, []);

  if (!isReady) {
    return <Placeholder />;
  }

  return children;
}
```

### When to Use

| Scenario | Use `startViewTransition`? |
|----------|--------------------------|
| Async init completing, switching from placeholder to full UI | Yes |
| Tab switching that triggers heavy re-renders | Yes |
| User typing in a search input (urgent feedback needed) | No - use `useDeferredValue` instead |
| Simple boolean toggle with minimal re-render | No - unnecessary overhead |

### Real Example

```typescript
import { useEffect, useState } from 'react';

import { startViewTransition } from '@onekeyhq/components';

export function GlobalJotaiReady({ children }: { children: any }) {
  const [isReady, setIsReady] = useState(false);
  useEffect(() => {
    void globalJotaiStorageReadyHandler.ready.then((ready) => {
      startViewTransition(() => {
        setIsReady(ready);
      });
    });
  }, []);

  if (!isReady) {
    return <View testID="GlobalJotaiReady-not-ready-placeholder" />;
  }

  return children;
}
```

### `startViewTransition` vs `useTransition`

```typescript
// startViewTransition - OneKey wrapper, no pending state
// Web: fade effect via View Transition API
// Native: falls back to setTimeout (no visual fade)
import { startViewTransition } from '@onekeyhq/components';

startViewTransition(() => {
  setState(newValue);
});

// useTransition - React hook, provides isPending for loading indicators
import { useTransition } from 'react';

const [isPending, startTransition] = useTransition();

startTransition(() => {
  setState(newValue);
});

// isPending can be used to show a spinner overlay
// while keeping the old UI visible
```

Use `useTransition` when you need to track pending state for a loading indicator. Use `startViewTransition` when you want a smooth fade on web (with graceful `setTimeout` fallback on native).

---

## Related Skills

- `/1k-cross-platform` - Platform-specific development
- `/1k-performance` - Performance optimization
- `/1k-coding-patterns` - General coding patterns
