import type {
  IMarketBasicConfigData,
  IMarketBasicConfigToken,
  IMarketTokenListItem,
} from '@onekeyhq/shared/types/marketV2';

/**
 * Extract default network ID from basic config
 */
export function getDefaultNetworkId(
  basicConfig?: IMarketBasicConfigData,
): string {
  return basicConfig?.networkList?.[0]?.networkId || 'sol--101';
}

/**
 * Convert recommended tokens from basic config to market token list format
 */
export function convertRecommendedTokens(
  recommendTokens?: IMarketBasicConfigToken[],
): IMarketTokenListItem[] {
  if (!recommendTokens) return [];

  return recommendTokens.map((token) => ({
    address: token.contractAddress,
    name: token.name,
    symbol: token.name, // Use name as symbol since API doesn't provide symbol
    logoUrl: '', // API doesn't provide logo URL
    decimals: 6, // Default decimals
    // Set minimal required fields for IMarketTokenListItem
    marketCap: undefined,
    fdv: undefined,
    tvl: undefined,
    holders: undefined,
    extraData: undefined,
    price: undefined,
  }));
}

/**
 * Extract minimum liquidity value
 */
export function getMinLiquidity(basicConfig?: IMarketBasicConfigData): number {
  return basicConfig?.minLiquidity || 5000;
}

/**
 * Extract refresh interval
 */
export function getRefreshInterval(
  basicConfig?: IMarketBasicConfigData,
): number {
  return basicConfig?.refreshInterval || 5;
}

/**
 * Format minimum liquidity for display (e.g., 5000 -> "5K")
 */
export function formatLiquidityValue(minLiquidity: number): string {
  if (minLiquidity >= 1000) {
    return `${minLiquidity / 1000}K`;
  }
  return minLiquidity.toString();
}

/**
 * Get network list from basic config
 */
export function getNetworkList(basicConfig?: IMarketBasicConfigData) {
  return basicConfig?.networkList || [];
}
