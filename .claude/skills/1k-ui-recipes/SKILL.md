---
name: 1k-ui-recipes
description: Practical UI recipes for OneKey. Use when dealing with iOS tab bar scroll content overlap, scroll view padding, fade-in/fade-out transitions with startViewTransition, smooth state transition animations, or horizontal scroll gesture conflicts inside collapsible tab headers. Triggers on tab bar, scroll overlap, paddingBottom, tabBarHeight, useScrollContentTabBarOffset, startViewTransition, useTransition, fade, transition, smooth switch, iOS scroll, bottom padding, content hidden, tab bar offset, collapsible tab, horizontal scroll, gesture conflict, renderHeader, scrollview in header, react-native-collapsible-tab-view, banner scroll, GestureDetector, pan gesture, vertical scroll blocked.
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

## 3. Horizontal Scroll in Collapsible Tab Headers (Native)

### Problem

When placing a horizontally scrollable component (e.g. a banner carousel) inside `renderHeader` of `react-native-collapsible-tab-view`, vertical scrolling stops working in the banner area on native platforms. The user can scroll the banners horizontally but cannot scroll the page vertically when touching the banner area.

### Root Cause

`react-native-collapsible-tab-view` renders the header as `position: absolute, zIndex: 100` overlaying the PagerView content. All header containers use `pointerEvents="box-none"`.

```
<Animated.View style={[styles.container]}>
  <!-- Header: position absolute, zIndex 100 -->
  <Animated.View style={[styles.topContainer]} pointerEvents="box-none">
    {renderHeader(...)}    <!-- YOUR COMPONENT IS HERE -->
    {renderTabBar(...)}
  </Animated.View>

  <!-- Tab content: StyleSheet.absoluteFill, UNDERNEATH the header -->
  <AnimatedPagerView style={[StyleSheet.absoluteFill]}>
    {/* Tab ScrollViews are here */}
  </AnimatedPagerView>
</Animated.View>
```

**Key architectural constraint:** The header and tab content ScrollView are in **different branches** of the view tree. iOS hitTest picks the topmost view (highest zIndex) as the touch target. Any touch-accepting view in the header captures the touch — the underlying tab ScrollView **never receives it**, even if you set `failOffsetY` on a gesture handler.

### Why Standard Approaches Fail

| Approach | Why It Fails |
|----------|-------------|
| `directionalLockEnabled` | iOS-only, only prevents simultaneous H+V on the *same* ScrollView. Doesn't help when the vertical ScrollView is in a different view branch. |
| `nestedScrollEnabled` | Android-only, for nested ScrollViews in the same branch. Header and tab content are siblings, not nested. |
| RNGH ScrollView with `scrollEnabled={false}` | Still registers native gesture recognizers at the native layer, capturing touches. |
| `Gesture.Pan()` with `failOffsetY` / `activeOffsetX` | When the gesture fails, the touch was already dispatched to the header view. It cannot propagate to the tab ScrollView because they're in different view branches. |

### Solution: Bidirectional Gesture Handler + Programmatic Scroll Forwarding

Replace `ScrollView` with `Animated.View` + `Gesture.Pan()` that handles **both** horizontal and vertical directions. For vertical gestures, programmatically drive the underlying tab ScrollView using refs from the library's internal Context.

```typescript
import { useContext, useMemo, useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  clamp,
  scrollTo,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
} from 'react-native-reanimated';
// Access the collapsible-tab-view internal context (NOT publicly exported)
import { Context as CollapsibleTabContext } from 'react-native-collapsible-tab-view/src/Context';

const ITEM_WIDTH = 280;
const GAP = 8;
const PADDING_H = 20;

function HorizontalScrollerInHeader({
  items,
  renderItem,
}: {
  items: any[];
  renderItem: (item: any) => React.ReactNode;
}) {
  // 1. Access collapsible-tab-view context
  const tabsContext = useContext(CollapsibleTabContext);
  const refMap = tabsContext?.refMap;
  const focusedTab = tabsContext?.focusedTab;
  const scrollYCurrent = tabsContext?.scrollYCurrent;
  const contentInset = tabsContext?.contentInset ?? 0;

  // 2. Shared values for horizontal scroll
  const translateX = useSharedValue(0);
  const startTranslateX = useSharedValue(0);
  const startScrollY = useSharedValue(0);
  const isHorizontal = useSharedValue<boolean | undefined>(undefined);

  const [containerWidth, setContainerWidth] = useState(0);

  const maxTranslateX = useMemo(() => {
    const totalWidth =
      items.length * ITEM_WIDTH +
      (items.length - 1) * GAP +
      PADDING_H * 2;
    const width = containerWidth || 375;
    return Math.max(0, totalWidth - width);
  }, [items.length, containerWidth]);

  // 3. Pan gesture that handles BOTH directions
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          'worklet';
          startTranslateX.value = translateX.value;
          startScrollY.value = scrollYCurrent?.value ?? 0;
          isHorizontal.value = undefined; // Reset direction
        })
        .onUpdate((e) => {
          'worklet';
          // Determine direction on first significant movement
          if (isHorizontal.value === undefined) {
            if (
              Math.abs(e.translationX) > 5 ||
              Math.abs(e.translationY) > 5
            ) {
              isHorizontal.value =
                Math.abs(e.translationX) > Math.abs(e.translationY);
            }
            return;
          }

          if (isHorizontal.value) {
            // Horizontal: drive banner translateX
            translateX.value = clamp(
              startTranslateX.value + e.translationX,
              -maxTranslateX,
              0,
            );
          } else if (refMap && focusedTab) {
            // Vertical: programmatically scroll the underlying tab ScrollView
            const ref = refMap[focusedTab.value];
            if (ref) {
              const nextY = startScrollY.value - e.translationY;
              scrollTo(ref, 0, Math.max(0, nextY) - contentInset, false);
            }
          }
        })
        .onEnd((e) => {
          'worklet';
          if (isHorizontal.value) {
            translateX.value = withDecay({
              velocity: e.velocityX,
              clamp: [-maxTranslateX, 0],
            });
          }
        }),
    [/* all shared values and context refs */],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <YStack
      overflow="hidden"
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            {
              flexDirection: 'row',
              paddingHorizontal: PADDING_H,
              gap: GAP,
            },
            animatedStyle,
          ]}
        >
          {items.map(renderItem)}
        </Animated.View>
      </GestureDetector>
    </YStack>
  );
}
```

### How It Works

```
Touch lands on banner area (header, zIndex: 100)
        |
        v
Gesture.Pan() captures the touch (no failOffsetY — accepts ALL directions)
        |
        v
First 5px movement → determine direction
        |
   ┌────┴────┐
   v         v
Horizontal   Vertical
   |            |
   v            v
Drive         Get focused tab's ScrollView ref from CollapsibleTabContext
translateX    Call scrollTo(ref, 0, nextY, false)
with clamp    The ScrollView's onScroll handler fires → updates header translateY
   |            |
   v            v
onEnd:        Header collapses/expands correctly because
withDecay()   scrollYCurrent is updated by the ScrollView's handler
```

### Key Details

1. **Import from internal path**: `Context` is NOT publicly exported from `react-native-collapsible-tab-view/src/index.tsx`. You must import from the internal `src/Context` path:
   ```typescript
   import { Context as CollapsibleTabContext } from 'react-native-collapsible-tab-view/src/Context';
   ```

2. **Context values used**:
   - `refMap` — Map of tab names to their ScrollView refs (animated refs)
   - `focusedTab` — SharedValue containing the currently focused tab name
   - `scrollYCurrent` — SharedValue of the current vertical scroll position
   - `contentInset` — Number representing the header content inset offset

3. **Direction detection threshold**: 5px dead zone before committing to a direction. This prevents accidental diagonal gestures from being misclassified.

4. **No `failOffsetY`**: The gesture must NOT fail on vertical movement. If it fails, the touch cannot be forwarded to the underlying ScrollView (different view branch). Instead, the gesture handles vertical movement itself via programmatic `scrollTo`.

5. **Platform guard**: This pattern is only needed on native. On web, use a regular `ScrollView` with `horizontal`:
   ```typescript
   if (platformEnv.isNative) {
     return <NativeBannerScroller ... />;
   }
   return (
     <ScrollView horizontal showsHorizontalScrollIndicator={false}>
       {/* items */}
     </ScrollView>
   );
   ```

### Real Example

See `packages/kit/src/views/Home/components/WalletBanner/WalletBanner.tsx` — the `NativeBannerScroller` component implements this pattern for the home page banner carousel.

### Checklist

- [ ] Import `Context` from `react-native-collapsible-tab-view/src/Context` (internal path)
- [ ] Use `Gesture.Pan()` WITHOUT `failOffsetY` or `activeOffsetX`
- [ ] Handle both horizontal and vertical in `onUpdate` with direction detection
- [ ] Use `scrollTo` from `react-native-reanimated` for vertical scroll forwarding
- [ ] Subtract `contentInset` from scroll position for correct header behavior
- [ ] Use `Animated.View` with `translateX`, NOT a ScrollView
- [ ] Add `withDecay` on `onEnd` for momentum on horizontal scroll
- [ ] Guard with `platformEnv.isNative` — use regular ScrollView on web

---

## Related Skills

- `/1k-cross-platform` - Platform-specific development
- `/1k-performance` - Performance optimization
- `/1k-coding-patterns` - General coding patterns
