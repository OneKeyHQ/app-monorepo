# iOS Tab Bar Scroll Content Offset

## Problem

On iOS with native bottom tabs (`react-native-bottom-tabs`), scroll view content at the bottom is hidden behind the tab bar because the native tab bar overlays the content area.

## Solution

Use `useScrollContentTabBarOffset` to add dynamic `paddingBottom` to scroll containers. This hook returns the native-measured tab bar height on iOS and `undefined` on all other platforms, so it is safe to apply unconditionally.

```typescript
import { useScrollContentTabBarOffset } from '@onekeyhq/components';
```

## Pattern

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

## Return Value by Platform

| Platform | Return Value |
|----------|-------------|
| iOS | `number` (native-measured tab bar height including safe area) |
| Android | `undefined` |
| Web | `undefined` |
| Desktop | `undefined` |

## Applicable Components

Apply to **any** scrollable container rendered inside a tab page:

| Component | How to Apply |
|-----------|-------------|
| `ScrollView` | `contentContainerStyle={{ paddingBottom: tabBarHeight }}` |
| `Tabs.ScrollView` | Wrap inner `YStack` with `style={tabBarHeight ? { paddingBottom: tabBarHeight } : undefined}` |
| `Tabs.FlatList` | `contentContainerStyle={{ paddingBottom: tabBarHeight }}` |
| `Table` (via `contentContainerStyle`) | `contentContainerStyle={{ paddingBottom: tabBarHeight }}` |
| `ListView` / `FlatList` | `contentContainerStyle={{ pb: tabBarHeight }}` |

## When to Use vs Not Use

```typescript
// Use useScrollContentTabBarOffset for scroll views inside tab pages
const tabBarHeight = useScrollContentTabBarOffset();

// Do NOT use useTabBarHeight for this purpose.
// useTabBarHeight returns a value on ALL platforms and is intended
// for layout calculations (e.g. keyboard offset, min-height),
// not for scroll content padding.
```

## Fallback Values

When the page already has a default bottom padding, use nullish coalescing:

```typescript
// Falls back to '$5' on non-iOS platforms
contentContainerStyle={{ paddingBottom: tabBarHeight ?? '$5' }}
```

## How It Works Internally

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

## Real Examples

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
