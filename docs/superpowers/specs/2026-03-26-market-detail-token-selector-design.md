# Market Detail Token Selector

## Problem

The Market detail page currently requires users to navigate back to the home page to switch tokens. This creates friction compared to the Perps module, which allows inline token switching.

## Solution

Add a token search/switch modal to the Market detail page, allowing users to switch tokens without leaving the page. The approach mirrors Perps: atom-driven data with URL sync via `navigation.replace()`.

## Architecture

### Data Layer

**New `changeActiveToken` action** in `marketV2/actions.ts`:

Composes existing actions:
1. `clearTokenDetail()` — clear stale data
2. `setTokenAddress(tokenAddress)` — set new address
3. `setNetworkId(networkId)` — set new network
4. `setIsNative(isNative)` — set native flag
5. `fetchTokenDetail(tokenAddress, networkId)` — fetch new data

**Data flow on token switch:**
1. `changeActiveToken()` updates atoms — UI responds immediately (header, price)
2. `navigation.replace()` syncs URL — no component remount
3. `fetchTokenDetail()` completes — K-line, transactions, holders load

**Initial page load unchanged:** Route params initialize atoms as before.

### Why Atom-Driven (Not Route-Driven)

All child components of MarketDetailV2 already read from atoms via `useTokenDetail()` hook. Only `MarketDetailV2.tsx` reads route params, and only for initial atom seeding. This means:

- Updating atoms triggers immediate UI refresh across all child components
- `navigation.replace()` only syncs the URL, does not trigger data logic or remount
- Minimal code changes — the architecture already supports this pattern

### Search Modal

**Desktop:** Popover (width ~800px), triggered from token header. Same pattern as `PerpTokenSelector`.

**Mobile:** Full-screen modal via `pushModal`, triggered from `Page.Header` title area. Same pattern as `MobilePerpMarket.tsx`.

**Internal structure:**
- Search bar (debounced, name/symbol matching)
- Three tabs: Favorites / Spot / Futures
- Per-tab filters:
  - Favorites tab: category filter (reuse existing)
  - Spot tab: network filter (reuse existing)
  - Futures tab: category filter (reuse existing)
- Sortable column headers (Asset / Price / 24h Change)
- Virtualized token list (FlashList)

**Data sources:** Directly reuse Market home page's existing hooks and data logic for each tab. No new data fetching logic needed.

### Trigger Component

**Desktop (`TokenDetailHeaderLeft` area):**
- Token icon + Symbol + network badge + chevron down icon
- Entire area clickable, opens Popover
- `hoverStyle={{ opacity: 0.8 }}`, `pressStyle={{ opacity: 0.6 }}`

**Mobile (`Page.Header` headerTitle):**
- Token icon + Symbol + chevron down icon
- Clickable, calls `navigation.pushModal(EModalRoutes.MarketModal, { screen: EModalMarketRoutes.MobileTokenSelector })`

### Routing

**New modal route:**
- `EModalMarketRoutes.MobileTokenSelector` — for mobile full-screen search modal
- Registered in `ModalMarketStack`

**Existing routes unchanged:** `MarketDetailV2`, `MarketNativeDetail`, etc.

Desktop uses Popover (no route needed).

### Token Selection Handler

```
handleSelectToken({ tokenAddress, networkId, isNative, network }):
  1. changeActiveToken({ tokenAddress, networkId, isNative })
  2. navigation.replace(MarketDetailV2, { network, tokenAddress, isNative })
  3. Desktop: closePopover() / Mobile: navigation.popStack()
```

### Navigation Behavior

- **Back button:** Returns to Market home (replace doesn't add to stack)
- **Browser refresh:** URL is synced, shows correct token
- **Deep link:** Works as before — route params initialize atoms

## Platform Coverage

All platforms (Desktop, Web, Extension, iOS, Android) use the same data flow. Only the trigger UI differs:
- Desktop/Web/Extension: Popover
- iOS/Android: pushModal full-screen

## Files to Create

- `packages/kit/src/views/Market/MarketDetailV2/components/TokenSelector/MarketTokenSelector.tsx` — Desktop Popover + shared content
- `packages/kit/src/views/Market/MarketDetailV2/components/TokenSelector/MobileTokenSelector.tsx` — Mobile full-screen modal
- `packages/kit/src/views/Market/MarketDetailV2/components/TokenSelector/MarketTokenSelectorRow.tsx` — Token row component
- `packages/kit/src/views/Market/MarketDetailV2/components/TokenSelector/useMarketTokenSelector.ts` — Search/filter hook

## Files to Modify

- `packages/kit/src/states/jotai/contexts/marketV2/actions.ts` — Add `changeActiveToken` action
- `packages/kit/src/views/Market/MarketDetailV2/components/TokenDetailHeader/TokenDetailHeaderLeft.tsx` — Add clickable trigger (desktop)
- `packages/kit/src/views/Market/MarketDetailV2/components/MarketDetailHeader/MarketDetailHeader.tsx` — Add clickable trigger (mobile header)
- `packages/shared/src/routes/market.ts` — Add `MobileTokenSelector` route enum
- `packages/kit/src/views/Market/router/` — Register modal route

## Not Changing

- Market home page tabs/layout
- Detail page child components (already atom-driven)
- Existing route definitions
- K-line/TradingView component
- Data fetching logic (reusing existing)
