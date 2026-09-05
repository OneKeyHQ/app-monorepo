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

// Check if a network supports holders tab
export function isHoldersTabSupported(networkId: string): boolean {
  return !NETWORKS_WITHOUT_HOLDERS_SUPPORT.includes(networkId);
}
