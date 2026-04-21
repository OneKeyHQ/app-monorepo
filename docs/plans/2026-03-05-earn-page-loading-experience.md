# Earn Page Loading Experience Analysis

Date: 2026-03-05

## Current Status

### Skeleton Loading (Done)

| Area | Component | Details |
|------|-----------|---------|
| Banner | `BannerV2.tsx` | Fixed 130px height skeleton, no CLS |
| Recommended | `Recommended.tsx` | 4 skeleton items, desktop grid / mobile horizontal scroll |
| Portfolio Tab | `PortfolioTabContent.tsx` | Full skeleton matching final layout (header + 2 rows) |
| FAQ Tab | `FAQContent.tsx` | Title + 4 accordion skeleton items |
| Pendle Quote | `PendleSharedComponents.tsx` | Skeleton for transaction details during quote fetching |

### Missing Skeleton Loading (Needs Improvement)

#### P0: Available Assets List

- **File**: `AvailableAssetsTabViewList.tsx`
- **Problem**: `TableList` has no skeleton state at all
- **Behavior**: Initial render is empty table, data populates abruptly
- **Impact**: All users see this on the main Earn tab - most visible CLS
- **Fix**: Add `TableListSkeleton` (already exists in `TableList.tsx`) when `assets.length === 0 && loading`

#### P1: Overview Rebate Section

- **File**: `Overview.tsx`
- **Problem**: `shouldShowReferralBonus` is false during loading, section appears suddenly when rebate data arrives
- **Behavior**: Referral bonus section pushes content down after async load
- **Impact**: Layout shift for users with referral bonuses
- **Fix**: Either pre-allocate space or show skeleton while `isRebateLoading`

## Smoothness Improvements

#### Available Assets Tab Switching

- **File**: `AvailableAssetsTabViewList.tsx`
- **Problem**: `key={assets-tab-${selectedTabIndex}}` forces full remount on tab switch
- **Behavior**: Empty -> loading -> populated on every sub-tab switch (Earn / Fixed APY / Staking)
- **Fix**: Show skeleton during tab transition, or prefetch adjacent tab data

#### Skeleton-to-Content Transition

- **Problem**: All skeleton -> real content transitions are hard cuts
- **Fix**: Add fade-in animation when data replaces skeleton (cross-fade or opacity transition)

#### Portfolio Progressive Loading

- **File**: `useEarnPortfolio.ts`
- **Problem**: Uses `p-limit(6)` concurrent fetch + 500ms throttled UI update, but content replaces as a block
- **Fix**: Consider per-row fade-in as investments load incrementally

## Architecture Notes

### Data Flow

```
EarnHomePage
  -> useEarnPortfolio()     (portfolio data, cached in atom)
  -> useFAQListInfo()       (FAQ data)
  -> useBannerInfo()        (banner data from atom)
  -> EarnMainTabs
       -> Tab: Assets
            -> Recommended          (usePromiseResult, has skeleton)
            -> AvailableAssetsTabViewList  (usePromiseResult, NO skeleton)
       -> Tab: Portfolio
            -> PortfolioTabContent  (props from useEarnPortfolio, has skeleton)
       -> Tab: FAQs
            -> FAQContent           (props, has skeleton)
```

### Key Patterns

- `usePromiseResult()` with `watchLoading: true` for async data
- `Skeleton` component from `@onekeyhq/components` for loading placeholders
- `TableListSkeleton` already exists in `TableList.tsx` - can be reused
- Loading state tracked via `setLoadingState(key, bool)` in Earn atom

## Tab Switching Lag (Fixed APY / Staking buttons)

### Root Cause

Clicking sub-tab buttons (Earn / Fixed APY / Staking) in Available Assets triggers noticeable lag.

**P0: `key` prop forces full remount**

```tsx
// AvailableAssetsTabViewList.tsx:323
<TableList key={`assets-tab-${selectedTabIndex}`} ... />
```

When `selectedTabIndex` changes, React treats this as a completely new component — unmounts the old TableList, destroys all internal state (sort, scroll position), then mounts a fresh one. This is the primary cause of the lag.

**P1: Missing skeleton during remount**

After unmount, the new TableList renders with `data={[]}` until the async fetch completes. Users see an empty table flash before data appears, making the lag feel worse.

**P2: `stringify` deep comparison in memo (secondary)**

`TableList` uses `fast-json-stable-stringify` to deep-compare `data` and `columns` in `compareTableListProps`. However, the `key` change bypasses memo entirely (full remount), so this only matters if key is removed.

**P3: Synchronous sorting on mount**

`BasicTableList` calls `data.toSorted(comparator)` synchronously on every render. Combined with remount, this adds CPU work to an already expensive operation.

### Recommended Fix Priority

| Priority | Fix | Impact |
|----------|-----|--------|
| P0 | Remove `key` prop, let TableList update in-place with new data | Eliminates remount, preserves scroll/sort state |
| P1 | Add `TableListSkeleton` when `assets.length === 0 && loading` | Smooth transition during data fetch |
| P2 | Cache fetched tab data in atom (already partially done via `availableAssetsByType`) so tab switches show cached data instantly | Near-instant tab switches |

### Relationship to Skeleton Issues

The tab switching lag is **related but distinct** from the missing skeleton issues. Missing skeleton (P0 in main list) makes the empty→populated transition jarring. The `key` prop remount (this section's P0) causes unnecessary destruction and recreation. Fixing both together would provide the best improvement.

## Related Issues

- OK-50888: Pendle skeleton loading (merged)
- OK-51012: Fixed APY scroll issue (under observation)
