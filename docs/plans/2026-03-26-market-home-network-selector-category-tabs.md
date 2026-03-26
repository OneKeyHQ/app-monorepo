# Market Home Network Selector & Category Tabs (OK-51256)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign Market home page: move network selector to tab bar right side (desktop compact pill, mobile dropdown), add time range dropdown, replace old network filter area with category tabs (Trending/X Mentioned/AI/Stocks/Precious metal), wire `type` + `timeFrame` params to existing token list API.

**Architecture:** The existing `/utility/v2/market/token/list` API gets two new params: `type` (trending/x_mentioned/ai/stocks/precious_metal) and `timeFrame` (1-4). Response format is **identical** to existing `IMarketTokenListItem` — no new types needed. We just add params to the existing `fetchMarketTokenList` service method and `useMarketTokenList` hook, then reorganize the UI layout.

**Tech Stack:** TypeScript, React/React Native, Tamagui (@onekeyhq/components), Jotai atoms, background service API calls

---

## API Summary (verified on test env)

**Existing endpoint, new params:**
```
GET /utility/v2/market/token/list
  + type:      trending | x_mentioned | ai | stocks | precious_metal  (default: trending)
  + timeFrame: 1=5m | 2=1h | 3=4h | 4=24h  (default: 4=24h)
  + Header:    x-onekey-request-version: >= 6.2.0  (for new logic)
```

Response shape: **same** as current `IMarketTokenListResponse` — no new fields.

---

## Current Architecture

- `MarketHomeV2.tsx` — main entry, manages state (networkId, timeRange, liquidityFilter)
- `DesktopLayout.tsx` — `Tabs.Container` with Watchlist/Spot/Perps; `MarketFilterBar` renders as `toolbar` prop inside Spot tab
- `MobileLayout.tsx` — Similar tabs; `MarketFilterBarSmall` renders in sticky tab bar when Spot active
- `MarketFilterBar` / `MarketFilterBarSmall` — Currently wraps `MarketTokenListNetworkSelector` (horizontal network pills)
- `MarketNetworkFilter` — Desktop horizontal ScrollView with network icons in bordered container
- `CategoryFilterItem` — Already exists for pill-style category buttons
- `TimeRangeSelector` — Exists but has `display="none"` (hidden SegmentControl)
- `useMarketTokenList` — Calls `ServiceMarketV2.fetchMarketTokenList` with networkId, sortBy, sortType, page, limit
- `ServiceMarketV2.fetchMarketTokenList` — API call to `/utility/v2/market/token/list`

## Design Summary (from Figma)

### Desktop (1216px wide)
- **Tab bar:** Left: `Watchlist | **Spot** | Perps` — Right: `24h ▼` + Compact Network Pill (`All | BSC🟡 | SOL⚫ | Base🟦 | ETH🔷 | ▼`)
- **Category bar:** Below tabs, bordered container: `🔥 Trending | 𝕏 X 热议 | AI | Stocks | Precious metal`
- **Table:** Same columns as today

### Mobile (393px)
- **Sub-tabs:** `Watchlist | **Spot** | Perps`
- **Filter row:** `🌐 All ▼` (network) + `24h ▼` (time) on same row, space-between
- **Category pills:** `🔥 Trending | Boost | AI | Stocks | Precious metal` (horizontal scroll)
- **List:** Token + chain badge | Name + Turnover | Price + Change

---

## Task 1: Add `type` and `timeFrame` params to service + hook

**Files:**
- Modify: `packages/kit-bg/src/services/ServiceMarketV2.ts` (line ~143-179)
- Modify: `packages/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useMarketTokenList.ts`
- Modify: `packages/kit/src/views/Market/MarketHomeV2/types.ts`

**Step 1:** In `types.ts`, add:

```typescript
export type IMarketCategoryType =
  | 'trending'
  | 'x_mentioned'
  | 'ai'
  | 'stocks'
  | 'precious_metal';

export type IMarketApiTimeFrame = '1' | '2' | '3' | '4'; // 1=5m, 2=1h, 3=4h, 4=24h

export interface IMarketCategoryItem {
  id: IMarketCategoryType;
  name: string;
  icon?: string;
}
```

**Step 2:** In `ServiceMarketV2.fetchMarketTokenList`, add `type` and `timeFrame` to params:

```typescript
async fetchMarketTokenList({
  networkId, sortBy, sortType, page, limit, minLiquidity, maxLiquidity,
  type,       // NEW
  timeFrame,  // NEW
}: {
  // ...existing params...
  type?: string;
  timeFrame?: string;
}) {
  const client = await this.getClient(EServiceEndpointEnum.Utility);
  const response = await client.get<{...}>('/utility/v2/market/token/list', {
    params: {
      networkId, sortBy, sortType, page, limit, minLiquidity, maxLiquidity,
      currency: 'usd',
      type,       // NEW
      timeFrame,  // NEW
    },
  });
  return response.data.data;
}
```

**Step 3:** In `useMarketTokenList`, accept and pass through:

```typescript
interface IUseMarketTokenListParams {
  networkId: string;
  initialSortBy?: string;
  initialSortType?: 'asc' | 'desc';
  pageSize?: number;
  type?: string;       // NEW
  timeFrame?: string;  // NEW
}
```

Pass `type` and `timeFrame` to `backgroundApiProxy.serviceMarketV2.fetchMarketTokenList(...)` in both the initial fetch and `loadMore`.

Add them to the dependency arrays so data refetches when category or timeFrame changes.

**Step 4:** Verify tsc: `cd packages/kit-bg && npx tsc --noEmit --pretty 2>&1 | head -20`

**Step 5:** Commit: `feat(market): add type and timeFrame params to token list API (OK-51256)`

---

## Task 2: Add category + timeFrame state to MarketHomeV2

**Files:**
- Modify: `packages/kit/src/views/Market/MarketHomeV2/MarketHomeV2.tsx`
- Modify: `packages/kit/src/views/Market/MarketHomeV2/layouts/DesktopLayout.tsx` (IDesktopLayoutProps)
- Modify: `packages/kit/src/views/Market/MarketHomeV2/layouts/MobileLayout.tsx` (IMobileLayoutProps)

**Step 1:** In `MarketHomeV2.tsx`, add state:

```typescript
import type { IMarketCategoryType, IMarketCategoryItem } from './types';

const [selectedCategory, setSelectedCategory] = useState<IMarketCategoryType>('trending');
const [timeRange, setTimeRange] = useState<ITimeRangeSelectorValue>('24h'); // change default from '5m' to '24h'

const defaultCategories: IMarketCategoryItem[] = useMemo(() => [
  { id: 'trending', name: 'Trending', icon: 'FireOutline' },
  { id: 'x_mentioned', name: 'X 热议' },
  { id: 'ai', name: 'AI' },
  { id: 'stocks', name: 'Stocks' },
  { id: 'precious_metal', name: 'Precious metal' },
], []);
```

**Step 2:** Pass `selectedCategory`, `setSelectedCategory`, `categories`, `timeRange` through filterBarProps to both Desktop and Mobile.

**Step 3:** Update `IDesktopLayoutProps` and `IMobileLayoutProps` to include the new props.

**Step 4:** Commit: `feat(market): add category and timeFrame state management (OK-51256)`

---

## Task 3: Create TimeRangeDropdown component

**Files:**
- Create: `packages/kit/src/views/Market/MarketHomeV2/components/TimeRangeDropdown/TimeRangeDropdown.tsx`
- Create: `packages/kit/src/views/Market/MarketHomeV2/components/TimeRangeDropdown/index.ts`

**Step 1:** Create dropdown component using `Popover` from `@onekeyhq/components`:

```typescript
import { memo } from 'react';
import { Icon, Popover, SizableText, XStack, YStack } from '@onekeyhq/components';
import type { ITimeRangeSelectorValue } from '../TimeRangeSelector';

const TIME_RANGE_OPTIONS: { label: string; value: ITimeRangeSelectorValue }[] = [
  { label: '5m', value: '5m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '24h', value: '24h' },
];

function TimeRangeDropdownImpl({
  value,
  onChange,
}: {
  value: ITimeRangeSelectorValue;
  onChange: (v: ITimeRangeSelectorValue) => void;
}) {
  const currentLabel = TIME_RANGE_OPTIONS.find((o) => o.value === value)?.label ?? value;

  return (
    <Popover
      placement="bottom-end"
      renderTrigger={
        <XStack bg="$bgStrong" borderRadius="$full" px="$2.5" py="$1" gap="$2" alignItems="center" cursor="pointer" userSelect="none">
          <SizableText size="$bodyMdMedium">{currentLabel}</SizableText>
          <Icon name="ChevronDownSmallOutline" size="$4.5" color="$iconSubdued" />
        </XStack>
      }
      renderContent={({ closePopover }) => (
        <YStack p="$2" gap="$1">
          {TIME_RANGE_OPTIONS.map((opt) => (
            <XStack
              key={opt.value}
              px="$3" py="$2" borderRadius="$2"
              bg={opt.value === value ? '$bgActive' : '$transparent'}
              hoverStyle={{ bg: '$bgHover' }}
              onPress={() => { onChange(opt.value); closePopover(); }}
              cursor="pointer"
            >
              <SizableText size="$bodyMdMedium" color={opt.value === value ? '$text' : '$textSubdued'}>
                {opt.label}
              </SizableText>
            </XStack>
          ))}
        </YStack>
      )}
    />
  );
}

export const TimeRangeDropdown = memo(TimeRangeDropdownImpl);
```

**Step 2:** Create index.ts re-export.

**Step 3:** Commit: `feat(market): add TimeRangeDropdown component (OK-51256)`

---

## Task 4: Create CompactNetworkSelector component (Desktop)

**Files:**
- Create: `packages/kit/src/views/Market/MarketHomeV2/components/CompactNetworkSelector/CompactNetworkSelector.tsx`
- Create: `packages/kit/src/views/Market/MarketHomeV2/components/CompactNetworkSelector/index.ts`

**Step 1:** Create compact pill selector per Figma desktop design:

- Rounded pill with `bg=$bgStrong`
- "All" text button (active state)
- 4 quick chain icons (first 4 from `useMarketNetworks`, excluding allNetwork)
- Chevron-down icon that opens MoreButton popover

Reuse existing `useMarketNetworks` hook and `MoreButton` component.

```typescript
import { memo, useCallback, useMemo } from 'react';
import { Icon, Image, SizableText, XStack } from '@onekeyhq/components';
import { useMarketNetworks } from '@onekeyhq/kit/src/views/Market/hooks';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { MoreButton } from '../MarketTokenListNetworkSelector/MoreButton';

const QUICK_NETWORK_COUNT = 4;

function CompactNetworkSelectorImpl({
  selectedNetworkId,
  onNetworkIdChange,
}: {
  selectedNetworkId?: string;
  onNetworkIdChange?: (id: string) => void;
}) {
  const { marketNetworks } = useMarketNetworks();
  const allNetwork = useMemo(() => marketNetworks.find((n) => n.isAllNetworks), [marketNetworks]);
  const quickNetworks = useMemo(() => marketNetworks.filter((n) => !n.isAllNetworks).slice(0, QUICK_NETWORK_COUNT), [marketNetworks]);
  const isAllSelected = networkUtils.isAllNetwork({ networkId: selectedNetworkId ?? '' });

  return (
    <XStack bg="$bgStrong" borderRadius="$full" p="$0.5" gap="$1" alignItems="center">
      <XStack
        bg={isAllSelected ? '$bgStrong' : '$transparent'}
        borderRadius="$full" px="$2.5" py="$0.5"
        onPress={() => allNetwork && onNetworkIdChange?.(allNetwork.id)}
        cursor="pointer"
      >
        <SizableText size="$bodyMdMedium" color="$text">All</SizableText>
      </XStack>
      {quickNetworks.map((n) => (
        <XStack
          key={n.id}
          borderRadius="$full" p="$0.5"
          bg={n.id === selectedNetworkId ? '$bgActive' : '$transparent'}
          onPress={() => onNetworkIdChange?.(n.id)}
          cursor="pointer"
        >
          <Image size={{ width: 16.67, height: 16.67 }} borderRadius="$full">
            <Image.Source source={{ uri: n.logoURI }} />
            <Image.Fallback bg="$bgStrong" />
          </Image>
        </XStack>
      ))}
      <MoreButton
        networks={marketNetworks}
        selectedNetworkId={selectedNetworkId}
        onNetworkSelect={(network) => onNetworkIdChange?.(network.id)}
        placement="bottom-end"
      />
    </XStack>
  );
}

export const CompactNetworkSelector = memo(CompactNetworkSelectorImpl);
```

**Step 2:** Commit: `feat(market): add CompactNetworkSelector for desktop tab bar (OK-51256)`

---

## Task 5: Create CategorySelector component

**Files:**
- Create: `packages/kit/src/views/Market/MarketHomeV2/components/CategorySelector/CategorySelector.tsx`
- Create: `packages/kit/src/views/Market/MarketHomeV2/components/CategorySelector/index.ts`

**Step 1:** Create component. Desktop: bordered container with pills. Mobile: horizontal scrolling pills.

Reuse existing `CategoryFilterItem` component.

```typescript
import { memo, useCallback } from 'react';
import { ScrollView, XStack, useMedia } from '@onekeyhq/components';
import { CategoryFilterItem } from '../CategoryFilterItem';
import type { IMarketCategoryItem } from '../../types';

function CategorySelectorImpl({
  categories, selectedCategoryId, onSelectCategory,
}: {
  categories: IMarketCategoryItem[];
  selectedCategoryId: string;
  onSelectCategory: (id: string) => void;
}) {
  const { md } = useMedia();

  if (md) {
    // Mobile: horizontal scroll
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 4, paddingHorizontal: 20, paddingVertical: 8 }}>
        {categories.map((item) => (
          <CategoryFilterItem
            key={item.id} name={item.name}
            isSelected={item.id === selectedCategoryId}
            onPress={() => onSelectCategory(item.id)}
          />
        ))}
      </ScrollView>
    );
  }

  // Desktop: bordered container
  return (
    <XStack p="$1" gap="$0.5" borderWidth={1} borderColor="$borderSubdued" borderRadius="$3" mt="$3" mb="$2">
      {categories.map((item) => (
        <CategoryFilterItem
          key={item.id} name={item.name}
          isSelected={item.id === selectedCategoryId}
          onPress={() => onSelectCategory(item.id)}
        />
      ))}
    </XStack>
  );
}

export const CategorySelector = memo(CategorySelectorImpl);
```

**Step 2:** Commit: `feat(market): add CategorySelector component (OK-51256)`

---

## Task 6: Redesign Desktop Layout — move selectors to tab bar right

**Files:**
- Modify: `packages/kit/src/views/Market/MarketHomeV2/layouts/DesktopLayout.tsx`
- Modify: `packages/kit/src/views/Market/MarketHomeV2/components/MarketFilterBar/MarketFilterBar.tsx`

**Step 1:** In DesktopLayout, modify `renderTabBar` to include right-side controls (TimeRangeDropdown + CompactNetworkSelector) only when Spot tab is active.

Key change: Wrap `Tabs.TabBar` in an `XStack` with `flex={1}`, add right-side controls.

```typescript
// Inside renderTabBar:
<YStack bg="$bgApp" position={'sticky'} top={0} zIndex={10}>
  <XStack alignItems="center">
    <XStack flex={1}>
      <Tabs.TabBar {...tabBarProps} onTabPress={handleTabPress} divider={false}
        containerStyle={{ position: 'relative' }} />
    </XStack>
    {activeTabName === spotTabName ? (
      <XStack gap="$3" alignItems="center" pr="$5">
        <TimeRangeDropdown value={filterBarProps.timeRange} onChange={filterBarProps.onTimeRangeChange} />
        <CompactNetworkSelector
          selectedNetworkId={filterBarProps.selectedNetworkId}
          onNetworkIdChange={filterBarProps.onNetworkIdChange}
        />
      </XStack>
    ) : null}
  </XStack>
  <div ref={portalRefCallback} />
</YStack>
```

**Step 2:** Change `MarketFilterBar` to render `CategorySelector` instead of `MarketTokenListNetworkSelector`:

```typescript
export function MarketFilterBar({
  selectedCategory, categories, onCategoryChange,
}: IMarketFilterBarProps) {
  return (
    <CategorySelector
      categories={categories ?? []}
      selectedCategoryId={selectedCategory ?? 'trending'}
      onSelectCategory={onCategoryChange ?? (() => {})}
    />
  );
}
```

**Step 3:** Update `IMarketFilterBarProps` to include new props, remove old network props.

**Step 4:** Commit: `feat(market): redesign desktop tab bar with network selector and time range (OK-51256)`

---

## Task 7: Redesign Mobile Layout — filter bar with network + time + categories

**Files:**
- Modify: `packages/kit/src/views/Market/MarketHomeV2/layouts/MobileLayout.tsx`
- Modify: `packages/kit/src/views/Market/MarketHomeV2/components/MarketFilterBarSmall/MarketFilterBarSmall.tsx`
- Create: `packages/kit/src/views/Market/MarketHomeV2/components/MobileNetworkDropdown/MobileNetworkDropdown.tsx`
- Create: `packages/kit/src/views/Market/MarketHomeV2/components/MobileNetworkDropdown/index.ts`

**Step 1:** Create `MobileNetworkDropdown` — a compact `🌐 All ▼` button that opens network selection popover.

```typescript
// Uses Popover + useMarketNetworks
// Trigger: XStack with globe icon + "All" text + chevron
// Content: ListView of networks with icons
```

**Step 2:** Redesign `MarketFilterBarSmall`:

Row 1: `MobileNetworkDropdown` (left) + `TimeRangeDropdown` (right) — `justifyContent="space-between"`
Row 2: `CategorySelector` (horizontal scroll pills)

**Step 3:** Update `MobileLayout.tsx` `TabBarDynamicContext` to pass category/timeRange/categories through.

**Step 4:** Commit: `feat(market): redesign mobile filter bar with network/time/categories (OK-51256)`

---

## Task 8: Wire category + timeFrame to data fetching

**Files:**
- Modify: `packages/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MarketNormalTokenList.tsx`
- Modify: `packages/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/MobileMarketTokenFlatList.tsx`

**Step 1:** Add `selectedCategory` and `timeRange` props to `MarketNormalTokenList`:

```typescript
function MarketNormalTokenList({
  networkId = 'sol--101',
  selectedCategory = 'trending',  // NEW
  timeRange = '24h',              // NEW
  ...rest
}) {
  const timeFrameMap = { '5m': '1', '1h': '2', '4h': '3', '24h': '4' };

  const normalResult = useMarketTokenList({
    networkId,
    initialSortBy,
    initialSortType,
    pageSize: 20,
    type: selectedCategory,                    // NEW
    timeFrame: timeFrameMap[timeRange] ?? '4', // NEW
  });
  // ...rest unchanged
}
```

**Step 2:** Same for `MobileMarketTokenFlatList`.

**Step 3:** Thread props from DesktopLayout and MobileLayout through to these list components.

**Step 4:** Commit: `feat(market): wire category and timeFrame to token list data fetching (OK-51256)`

---

## Task 9: Add `x-onekey-request-version` header

**Files:**
- Modify: `packages/kit-bg/src/services/ServiceMarketV2.ts` or check if version header is already set globally

**Step 1:** Check if `x-onekey-request-version` is already included in API requests. If not, add it to the token list API call. The version should be >= `6.2.0` for the new type/timeFrame logic.

Check `packages/shared/types/endpoint.ts` or the HTTP client setup for global headers.

**Step 2:** If already set globally, no change needed. If not, add to the specific request.

**Step 3:** Commit: `feat(market): ensure version header for new API params (OK-51256)`

---

## Task 10: Cleanup and verification

**Files:**
- Potentially remove: old `TimeRangeSelector` `display="none"`
- Clean up unused imports from files that no longer use `MarketTokenListNetworkSelector` directly

**Step 1:** Remove `display="none"` from `TimeRangeSelector` if it's no longer referenced (or keep it for backward compat — check usages).

**Step 2:** Run lint + type check:
```bash
yarn lint:staged
yarn tsc:staged
```

**Step 3:** Manual verification:
- Desktop: switch tabs → Spot shows time dropdown + compact network pill + category bar
- Desktop: switch categories → list data changes
- Desktop: change time range → list data changes
- Desktop: Watchlist / Perps tabs → no network/category selectors visible
- Mobile: same verification

**Step 4:** Commit: `chore(market): clean up old selectors and verify layout (OK-51256)`

---

## Implementation Order & Dependencies

```
Task 1 (API params)
    ↓
Task 2 (state management)
    ↓
Task 3 (TimeRangeDropdown) ──────┐
Task 4 (CompactNetworkSelector) ─┤
Task 5 (CategorySelector) ───────┘
    ↓
Task 6 (Desktop layout) ─┐
Task 7 (Mobile layout) ──┘
    ↓
Task 8 (Wire data fetching)
    ↓
Task 9 (Version header)
    ↓
Task 10 (Cleanup)
```

Tasks 3/4/5 are independent — can be parallelized.
Tasks 6/7 are independent — can be parallelized.

---

## Key Design Decisions

1. **No new API endpoints or types** — the backend extended the existing endpoint with `type`+`timeFrame` params and returns the same `IMarketTokenListItem` shape
2. **Reuse existing components** — `CategoryFilterItem`, `MoreButton`, `useMarketNetworks` are all reusable
3. **timeRange mapping** — UI uses human-readable (`5m`/`1h`/`4h`/`24h`), API uses numeric (`1`/`2`/`3`/`4`)
4. **Network selector visibility** — Only shows on Spot tab (per spec)
5. **Default values** — Network: "All", TimeRange: "24h" (API default=4), Category: "trending"
