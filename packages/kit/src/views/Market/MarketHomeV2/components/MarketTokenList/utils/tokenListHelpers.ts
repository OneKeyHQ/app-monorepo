import BigNumber from 'bignumber.js';

import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';
import type { IMarketTokenListItem } from '@onekeyhq/shared/types/marketV2';

import type { IMarketTimeRangeValue } from '../../../types';
import type { IMarketToken } from '../MarketTokenData';

// Helper function to check if token is native and get normalized address for matching
// Only uses fallback address length check when isNative field is not present (undefined)
// This ensures online data with isNative field won't use fallback logic
export function getNativeTokenInfo(
  isNativeField: boolean | undefined,
  address: string | undefined,
) {
  const isNative =
    isNativeField !== undefined ? isNativeField : (address?.length ?? 0) < 30;
  const normalizedAddress = isNative ? '' : (address ?? '').toLowerCase();
  return { isNative, normalizedAddress };
}

// Mapping of column keys to token fields, shared by multiple hooks
// These map API sort parameters to component token properties
export const SORT_MAP: Record<string, keyof IMarketToken> = {
  liquidity: 'liquidity',
  mc: 'marketCap',
  v24hUSD: 'turnover',
};

export function shouldShowStockSubtitleForTokens(
  items: Array<Pick<IMarketToken, 'stock'>>,
) {
  if (items.length === 0) {
    return false;
  }

  const stockCount = items.filter((item) => !!item.stock).length;
  return stockCount > items.length / 10;
}

const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;
const ONE_MONTH = 30 * ONE_DAY;
const ONE_YEAR = 12 * ONE_MONTH;

export type ITokenAgeUnit = 'hour' | 'day' | 'month' | 'year';

export interface ITokenAgeInfo {
  amount: number;
  unit: ITokenAgeUnit;
}

const TIME_RANGE_FIELD_SUFFIX_MAP: Record<
  IMarketTimeRangeValue,
  '5m' | '1h' | '4h' | '24h'
> = {
  '5m': '5m',
  '1h': '1h',
  '4h': '4h',
  '24h': '24h',
};

export function getNetworkLogoUri(chainOrNetworkId: string): string {
  const networks = getPresetNetworks();
  const network = networks.find((n) => n.id === chainOrNetworkId);
  return network?.logoURI || '';
}

/**
 * Safely parse string to number using BigNumber for precision
 */
function safeNumber(value: string | undefined, fallback = 0): number {
  if (!value) return fallback;

  try {
    const bn = new BigNumber(value);
    if (bn.isNaN() || !bn.isFinite()) {
      return fallback;
    }
    return bn.toNumber();
  } catch {
    return fallback;
  }
}

function getMetricValueByTimeRange(
  item: IMarketTokenListItem,
  timeRange: IMarketTimeRangeValue | undefined,
  baseKey: 'priceChange' | 'trade' | 'buy' | 'sell' | 'uniqueWallet' | 'volume',
  suffix: 'Percent' | 'Count' | '',
) {
  const fieldSuffix = TIME_RANGE_FIELD_SUFFIX_MAP[timeRange ?? '24h'];
  const selectedKey =
    `${baseKey}${fieldSuffix}${suffix}` as keyof IMarketTokenListItem;
  const fallbackKey = `${baseKey}24h${suffix}` as keyof IMarketTokenListItem;

  return item[selectedKey] ?? item[fallbackKey];
}

/**
 * Convert raw api item to component token shape
 */
export function transformApiItemToToken(
  item: IMarketTokenListItem & { isNative?: boolean },
  {
    chainId,
    networkLogoUri,
    sortIndex,
    timeRange,
  }: {
    chainId: string;
    networkLogoUri: string;
    sortIndex?: number;
    timeRange?: IMarketTimeRangeValue;
  },
): IMarketToken {
  // Use token's own networkId to get network logo, fallback to passed chainId
  const tokenNetworkId = item.networkId || chainId;
  const tokenNetworkLogoUri = item.networkId
    ? getNetworkLogoUri(item.networkId)
    : networkLogoUri;

  const priceChange = safeNumber(
    getMetricValueByTimeRange(item, timeRange, 'priceChange', 'Percent') as
      | string
      | undefined,
  );
  const transactions = safeNumber(
    getMetricValueByTimeRange(item, timeRange, 'trade', 'Count') as
      | string
      | undefined,
  );
  const uniqueTraders = safeNumber(
    getMetricValueByTimeRange(item, timeRange, 'uniqueWallet', '') as
      | string
      | undefined,
  );
  const turnover = safeNumber(
    getMetricValueByTimeRange(item, timeRange, 'volume', '') as
      | string
      | undefined,
  );
  const buyCount = safeNumber(
    getMetricValueByTimeRange(item, timeRange, 'buy', 'Count') as
      | string
      | undefined,
  );
  const sellCount = safeNumber(
    getMetricValueByTimeRange(item, timeRange, 'sell', 'Count') as
      | string
      | undefined,
  );

  return {
    id: `${item.address}${item.name}${tokenNetworkLogoUri}${item.symbol}`,
    name: item.name,
    symbol: item.symbol,
    address: item.address,
    price: safeNumber(item.price),
    change24h: priceChange,
    marketCap: safeNumber(item.marketCap),
    liquidity: safeNumber(item.liquidity),
    transactions,
    uniqueTraders,
    holders: item.holders || 0,
    turnover,
    tokenImageUri: item.logoUrl || '',
    tokenImageUris: item.logoUrls,
    decimals: item.decimals,
    networkLogoUri: tokenNetworkLogoUri,
    networkId: tokenNetworkId,
    chainId: tokenNetworkId,
    firstTradeTime: item.firstTradeTime
      ? Number(item.firstTradeTime)
      : undefined,
    sortIndex,
    isNative: item.isNative,
    communityRecognized: item.communityRecognized,
    stock: item.stock,
    walletInfo: {
      buy: buyCount,
      sell: sellCount,
    },
  };
}

export function getTokenAgeInfo(
  firstTradeTime?: number,
): ITokenAgeInfo | undefined {
  if (!firstTradeTime) {
    return undefined;
  }

  const now = Date.now();
  const duration = now - firstTradeTime;

  if (duration <= 0) {
    return undefined;
  }

  if (duration < ONE_DAY) {
    return {
      amount: Math.max(1, Math.round(duration / ONE_HOUR)),
      unit: 'hour',
    };
  }

  if (duration < ONE_MONTH) {
    return {
      amount: Math.max(1, Math.round(duration / ONE_DAY)),
      unit: 'day',
    };
  }

  if (duration < ONE_YEAR) {
    return {
      amount: Math.max(1, Math.round(duration / ONE_MONTH)),
      unit: 'month',
    };
  }

  return {
    amount: Math.max(1, Math.round(duration / ONE_YEAR)),
    unit: 'year',
  };
}
