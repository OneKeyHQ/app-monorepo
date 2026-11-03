import type { IMarketToken } from '../../../MarketHomeV2/components/MarketTokenList/MarketTokenData';

// Same rule as the Market Favorites rows: only a '-' from the feed or a
// non-numeric value reads as missing. Perps rows carry `change24h` without a
// `priceChangeRaw`, so its absence is not taken as missing data.
export function getWatchlistSidebarPriceChange(item: IMarketToken) {
  return item.priceChangeRaw === '-' || !Number.isFinite(item.change24h)
    ? undefined
    : item.change24h;
}
