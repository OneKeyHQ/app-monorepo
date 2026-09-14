import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';

import type { IMarketToken } from '../../../MarketHomeV2/components/MarketTokenList/MarketTokenData';

export const TOKEN_SELECTOR_POLLING_INTERVAL = timerUtils.getTimeDurationMs({
  seconds: 15,
});

export const TOKEN_SELECTOR_HEADER_HEIGHT = 40;
export const TOKEN_SELECTOR_ROW_HEIGHT = 56;

export const TOKEN_SELECTOR_HIDDEN_DESKTOP_COLUMNS = [
  'liquidity',
  'transactions',
  'uniqueTraders',
  'holders',
  'tokenAge',
] as const;

// The header "#" cell and the row star share this box so the star centers
// under "#" and every name cell starts the logo where the header label starts.
export const TOKEN_SELECTOR_STAR_COLUMN_WIDTH = 24;
export const TOKEN_SELECTOR_NAME_GAP = '$1.5' as const;
export const TOKEN_SELECTOR_COLUMN_PADDING = '$2' as const;

// Same grid as the stocks tab: a 32% name column, the rest split evenly across
// the metric columns of the active tab.
const NAME_COLUMN_PERCENTAGE = 32;

export function getTokenSelectorColumnWidths(metricColumnCount: number): {
  nameColumnWidth: `${number}%`;
  metricColumnWidth: `${number}%`;
} {
  return {
    nameColumnWidth: `${NAME_COLUMN_PERCENTAGE}%`,
    metricColumnWidth: `${(100 - NAME_COLUMN_PERCENTAGE) / metricColumnCount}%`,
  };
}

export type IMarketTokenSelectorMetricColumn =
  | 'price'
  | 'change'
  | 'marketCap'
  | 'liquidity'
  | 'turnover';

/**
 * `coins` covers every 24h-metric data set (favorites, top coins, search),
 * `trending` covers the v2 category list whose metrics follow the requested
 * time frame. Header labels and row cells both map over these lists so the
 * two can never drift apart.
 */
export type IMarketTokenSelectorColumnVariant = 'coins' | 'trending';

export const TOKEN_SELECTOR_METRIC_COLUMNS: Record<
  IMarketTokenSelectorColumnVariant,
  IMarketTokenSelectorMetricColumn[]
> = {
  coins: ['price', 'change', 'marketCap', 'turnover'],
  trending: ['marketCap', 'price', 'change', 'liquidity', 'turnover'],
};

export interface IMarketTokenSelectorColumns {
  nameColumnWidth: `${number}%`;
  metricColumnWidth: `${number}%`;
  metrics: IMarketTokenSelectorMetricColumn[];
}

// Default all-networks ID (constant, never changes)
export const ALL_NETWORK_ID = getNetworkIdsMap().onekeyall;

// Shared search token → market token converter
export function convertSearchTokenToMarketToken(
  item: IMarketSearchV2Token & { networkLogoURI: string },
): IMarketToken {
  return {
    id: `${item.network}_${item.address}`,
    name: item.name,
    symbol: item.symbol,
    address: item.address,
    decimals: item.decimals,
    price: Number(item.price) || 0,
    change24h: Number(item.priceChange24hPercent) || 0,
    // Carried raw so a '-' (no data) can be told apart from a real 0% after
    // the numeric normalization above.
    priceChangeRaw: item.priceChange24hPercent,
    marketCap: Number(item.marketCap) || 0,
    liquidity: Number(item.liquidity) || 0,
    transactions: 0,
    uniqueTraders: 0,
    holders: 0,
    turnover: Number(item.volume_24h || item.volume24h) || 0,
    tokenImageUri: item.logoUrl,
    tokenImageUris: item.logoUrls,
    networkLogoUri: item.networkLogoURI,
    networkId: item.network,
    chainId: item.network,
    isNative: item.isNative,
    communityRecognized: item.communityRecognized,
    stock: item.stock,
  };
}
