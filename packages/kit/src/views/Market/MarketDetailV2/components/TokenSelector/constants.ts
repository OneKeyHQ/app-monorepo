import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketSearchV2Token } from '@onekeyhq/shared/types/market';

import type { IMarketToken } from '../../../MarketHomeV2/components/MarketTokenList/MarketTokenData';

export const TOKEN_SELECTOR_POLLING_INTERVAL = timerUtils.getTimeDurationMs({
  seconds: 15,
});

export const TOKEN_SELECTOR_HIDDEN_DESKTOP_COLUMNS = [
  'transactions',
  'uniqueTraders',
  'holders',
  'tokenAge',
] as const;

// Column widths shared between header and row
export const COLUMN_WIDTH_NAME = 240;
export const COLUMN_WIDTH_PRICE = 110;
export const COLUMN_WIDTH_CHANGE = 90;
export const COLUMN_WIDTH_MARKET_CAP = 100;
export const COLUMN_WIDTH_LIQUIDITY = 100;
export const COLUMN_WIDTH_TURNOVER = 100;

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
