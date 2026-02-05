# Horizontal Scroll in Collapsible Tab Headers (Native)

## Problem

When placing a horizontally scrollable component (e.g. a banner carousel) inside `renderHeader` of `react-native-collapsible-tab-view`, vertical scrolling stops working in the banner area on native platforms.

## Root Cause

The header and tab content ScrollView are in **different branches** of the view tree. iOS hitTest picks the topmost view (highest zIndex) as the touch target. Any touch-accepting view in the header captures the touch.

## Why Standard Approaches Fail

| Approach | Why It Fails |
|----------|-------------|
| `directionalLockEnabled` | iOS-only, same ScrollView only |
| `nestedScrollEnabled` | Android-only, same branch only |
| RNGH ScrollView with `scrollEnabled={false}` | Still registers native gesture recognizers |
| `Gesture.Pan()` with `failOffsetY` | Touch cannot propagate to different view branch |

## Solution: Bidirectional Gesture Handler + Programmatic Scroll Forwarding

Replace `ScrollView` with `Animated.View` + `Gesture.Pan()` that handles **both** directions. For vertical gestures, programmatically drive the underlying tab ScrollView using refs from `CollapsibleTabContext` (exported by `@onekeyhq/components`).

```typescript
import { CollapsibleTabContext } from '@onekeyhq/components';
```

> **Do NOT** import directly from `react-native-collapsible-tab-view/src/Context`. Always use the `@onekeyhq/components` re-export.

### Pattern

```typescript
import { useContext, useMemo, useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { clamp, scrollTo, useAnimatedStyle, useSharedValue, withDecay } from 'react-native-reanimated';
import { CollapsibleTabContext } from '@onekeyhq/components';

function HorizontalScrollerInHeader({ items, renderItem }) {
  const tabsContext = useContext(CollapsibleTabContext);
  const refMap = tabsContext?.refMap;
  const focusedTab = tabsContext?.focusedTab;
  const scrollYCurrent = tabsContext?.scrollYCurrent;
  const contentInset = tabsContext?.contentInset ?? 0;

  const translateX = useSharedValue(0);
  const startTranslateX = useSharedValue(0);
  const startScrollY = useSharedValue(0);
  const isHorizontal = useSharedValue(undefined);

  const panGesture = useMemo(() =>
    Gesture.Pan()
      .onStart(() => {
        'worklet';
        startTranslateX.value = translateX.value;
        startScrollY.value = scrollYCurrent?.value ?? 0;
        isHorizontal.value = undefined;
      })
      .onUpdate((e) => {
        'worklet';
        if (isHorizontal.value === undefined) {
          if (Math.abs(e.translationX) > 5 || Math.abs(e.translationY) > 5) {
            isHorizontal.value = Math.abs(e.translationX) > Math.abs(e.translationY);
          }
          return;
        }
        if (isHorizontal.value) {
          translateX.value = clamp(startTranslateX.value + e.translationX, -maxTranslateX, 0);
        } else if (refMap && focusedTab) {
          const ref = refMap[focusedTab.value];
          if (ref) {
            scrollTo(ref, 0, Math.max(0, startScrollY.value - e.translationY) - contentInset, false);
          }
        }
      })
      .onEnd((e) => {
        'worklet';
        if (isHorizontal.value) {
          translateX.value = withDecay({ velocity: e.velocityX, clamp: [-maxTranslateX, 0] });
        }
      }),
    [/* deps */],
  );

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[{ flexDirection: 'row' }, animatedStyle]}>
        {items.map(renderItem)}
      </Animated.View>
    </GestureDetector>
  );
}
```

## Key Details

1. **Context values used**: `refMap`, `focusedTab`, `scrollYCurrent`, `contentInset`
2. **Direction detection**: 5px dead zone before committing to a direction
3. **No `failOffsetY`**: The gesture must NOT fail on vertical movement
4. **Platform guard**: Only needed on native. On web, use a regular `ScrollView horizontal`

## Key Files

- `packages/components/src/composite/Tabs/CollapsibleTabContext.native.ts` — Native re-export
- `packages/components/src/composite/Tabs/CollapsibleTabContext.ts` — Web re-export
- `packages/components/src/composite/Tabs/index.native.tsx` — Exports for native
- `packages/components/src/composite/Tabs/index.tsx` — Exports for web

## Real Example

See `packages/kit/src/views/Home/components/WalletBanner/WalletBanner.tsx` — `NativeBannerScroller`.

## Checklist

- [ ] Import `CollapsibleTabContext` from `@onekeyhq/components`
- [ ] Use `Gesture.Pan()` WITHOUT `failOffsetY` or `activeOffsetX`
- [ ] Handle both horizontal and vertical in `onUpdate` with direction detection
- [ ] Use `scrollTo` from `react-native-reanimated` for vertical scroll forwarding
- [ ] Subtract `contentInset` from scroll position
- [ ] Use `Animated.View` with `translateX`, NOT a ScrollView
- [ ] Add `withDecay` on `onEnd` for momentum
- [ ] Guard with `platformEnv.isNative`
