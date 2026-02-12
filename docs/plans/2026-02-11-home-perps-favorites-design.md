# Home Page Perps Favorites Integration Design

## Problem

When Perps tokens are favorited in Market Watchlist, the Home page's "Favorites" module (`PopularTrading`) crashes because it passes Perps items (with empty chainId/contractAddress) to `fetchMarketTokenListBatch`, which only accepts Spot tokens.

## Solution: Split-Fetch-Merge Pattern

Adopt the same pattern used by `useMarketWatchlistTokenList` in the Market Watchlist tab: split watchlist into spot and perps items, fetch data from separate APIs, merge back in original watchlist order.

## Data Fetching

```
watchList.data.slice(0, 3)
  ├─ filter(!perpsCoin) → spotItems → fetchMarketTokenListBatch()
  └─ filter(perpsCoin)  → perpsItems → fetchMarketPerpsTokenList({ category: 'all' })

Merge back in original watchlist order → displayTokens[]
```

- Only call Spot API if spotItems.length > 0
- Only call Perps API if perpsItems.length > 0
- Match perps data by `perpsCoin` key against API response

### IFavoriteTokenDisplay Extension

```typescript
interface IFavoriteTokenDisplay {
  // Existing fields
  chainId: string;
  contractAddress: string;
  isNative: boolean;
  symbol: string;
  name: string;
  logoUrl: string;
  price: number;
  priceChange24h: number;
  marketCap: number;
  // New perps fields
  perpsCoin?: string;       // Present = perps item
  maxLeverage?: number;     // e.g. 40
  volume24h?: number;       // Replaces marketCap display position
}
```

## UI Rendering

### List Row (Mobile)

```
Spot (unchanged):
  ⭐ [ETH Icon] ETH        $2,450.00
                $280B       +3.12%

Perps (new):
  ⭐ [AAPL Icon] AAPL [40x]   $213.50
                  $1.2B Vol    +2.35%
```

- Leverage badge after symbol
- Volume24h in MarketCap position

### List Row (Desktop / tableLayout)

- Name column: append Leverage Badge for perps items
- MarketCap column: show Volume24h for perps items
- Price and 24h Change columns: identical to spot

## Interactions

| Action | Spot | Perps |
|--------|------|-------|
| Click row | Navigate to Market Detail | `switchTab(Perp)` + `changeActiveAsset({ coin })` |
| Remove star | `removeMarketWatchListV2({ chainId, contractAddress })` | `removeMarketWatchListV2({ perpsCoin })` |

Both trigger `RefreshMarketWatchList` event to sync Market page.

## Edge Cases

| Case | Handling |
|------|----------|
| All 3 items are Perps | Only call Perps API |
| All 3 items are Spot | Only call Spot API (current behavior) |
| Perps API failure | Perps items filtered out, show only successful Spot items |
| `disablePerp: true` | No perps items in watchlist, no impact |
| Delisted perps token | Not returned by API, row not rendered |
| Remove perps from Home | Triggers `RefreshMarketWatchList`, Market page syncs |

## Files Changed

| File | Change |
|------|--------|
| `packages/kit/src/views/Home/components/PopularTrading/PopularTrading.tsx` | Core refactor: split fetch, extend IFavoriteTokenDisplay, conditional rendering, conditional navigation |

No new files created.
