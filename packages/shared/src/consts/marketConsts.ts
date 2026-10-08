import type { IMarketStockPublicListSortBy } from '../../types/marketV2';

// Networks that do not support holders data in market detail
export const NETWORKS_WITHOUT_HOLDERS_SUPPORT = [
  'evm--42161', // Arbitrum
  'evm--43114', // Avalanche
  'evm--10', // Optimism
  'evm--137', // Polygon
];

export const MARKET_TOP_COINS_CATEGORY_ID = 'top_coins';
export const MARKET_TOP_COINS_LEGACY_CATEGORY_ID = 'cgk-market-cap';
export const MARKET_CATEGORY_WITHOUT_NETWORK_FILTER_ID = 'robinhood_meme';

export const DEFAULT_MARKET_STOCK_SORT_BY: IMarketStockPublicListSortBy =
  'marketCap';
export const DEFAULT_MARKET_STOCK_SORT_TYPE = 'desc' as const;
// `/utility/v1/stocks/batch` rejects requests with more IDs than this.
export const MARKET_STOCK_BATCH_MAX_IDS = 100;

// Check if a network supports holders tab
export function isHoldersTabSupported(networkId: string): boolean {
  return !NETWORKS_WITHOUT_HOLDERS_SUPPORT.includes(networkId);
}
