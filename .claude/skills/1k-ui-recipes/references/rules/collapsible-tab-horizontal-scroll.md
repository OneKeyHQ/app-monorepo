# Horizontal Scroll in Collapsible Tab Headers (Native)

## Problem

When placing a horizontally scrollable component (e.g. a banner carousel) inside `renderHeader` of `react-native-collapsible-tab-view`, vertical scrolling stops working in the banner area on native platforms. The user can scroll the banners horizontally but cannot scroll the page vertically when touching the banner area.

## Root Cause

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

## Why Standard Approaches Fail

| Approach | Why It Fails |
|----------|-------------|
| `directionalLockEnabled` | iOS-only, only prevents simultaneous H+V on the *same* ScrollView. Doesn't help when the vertical ScrollView is in a different view branch. |
| `nestedScrollEnabled` | Android-only, for nested ScrollViews in the same branch. Header and tab content are siblings, not nested. |
| RNGH ScrollView with `scrollEnabled={false}` | Still registers native gesture recognizers at the native layer, capturing touches. |
| `Gesture.Pan()` with `failOffsetY` / `activeOffsetX` | When the gesture fails, the touch was already dispatched to the header view. It cannot propagate to the tab ScrollView because they're in different view branches. |

## Solution: Bidirectional Gesture Handler + Programmatic Scroll Forwarding

Replace `ScrollView` with `Animated.View` + `Gesture.Pan()` that handles **both** horizontal and vertical directions. For vertical gestures, programmatically drive the underlying tab ScrollView using refs from `CollapsibleTabContext` (exported by `@onekeyhq/components`).

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
import { CollapsibleTabContext } from '@onekeyhq/components';

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

## How It Works

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

## Key Details

1. **Import from `@onekeyhq/components`**: `CollapsibleTabContext` is exported from the components package with platform-specific implementations:
   - **Native**: Re-exports `Context` from `react-native-collapsible-tab-view/src/Context`
   - **Web**: Re-exports `TabsContext` from the local Tabs context (so consumers read the same value provided by the web `Tabs.Container`)
   ```typescript
   import { CollapsibleTabContext } from '@onekeyhq/components';
   ```
   > **Do NOT** import directly from `react-native-collapsible-tab-view/src/Context`. Always use the `@onekeyhq/components` re-export.

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

## Key Files

- `packages/components/src/composite/Tabs/CollapsibleTabContext.native.ts` — Native: re-exports `Context` from `react-native-collapsible-tab-view/src/Context`
- `packages/components/src/composite/Tabs/CollapsibleTabContext.ts` — Web: re-exports `TabsContext` from the local Tabs context
- `packages/components/src/composite/Tabs/index.native.tsx` — Exports `CollapsibleTabContext` for native
- `packages/components/src/composite/Tabs/index.tsx` — Exports `CollapsibleTabContext` for web

## Real Example

See `packages/kit/src/views/Home/components/WalletBanner/WalletBanner.tsx` — the `NativeBannerScroller` component implements this pattern for the home page banner carousel.

## Checklist

- [ ] Import `CollapsibleTabContext` from `@onekeyhq/components` (NOT from `react-native-collapsible-tab-view/src/Context`)
- [ ] Use `Gesture.Pan()` WITHOUT `failOffsetY` or `activeOffsetX`
- [ ] Handle both horizontal and vertical in `onUpdate` with direction detection
- [ ] Use `scrollTo` from `react-native-reanimated` for vertical scroll forwarding
- [ ] Subtract `contentInset` from scroll position for correct header behavior
- [ ] Use `Animated.View` with `translateX`, NOT a ScrollView
- [ ] Add `withDecay` on `onEnd` for momentum on horizontal scroll
- [ ] Guard with `platformEnv.isNative` — use regular ScrollView on web
