import BigNumber from 'bignumber.js';

import { getPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';
import type { IMarketTokenListItem } from '@onekeyhq/shared/types/marketV2';

import type { IMarketToken } from '../MarketTokenData';

// Mapping of column keys to token fields, shared by multiple hooks
// These map API sort parameters to component token properties
export const SORT_MAP: Record<string, keyof IMarketToken> = {
  liquidity: 'liquidity',
  mc: 'marketCap',
  v24hUSD: 'turnover',
};

const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;
const ONE_MONTH = 30 * ONE_DAY;
const ONE_YEAR = 12 * ONE_MONTH;

export type ITokenAgeUnit = 'hour' | 'day' | 'month' | 'year';

export interface ITokenAgeInfo {
  amount: number;
  unit: ITokenAgeUnit;
}

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

/**
 * Convert raw api item to component token shape
 */
export function transformApiItemToToken(
  item: IMarketTokenListItem & { isNative?: boolean },
  {
    chainId,
    networkLogoUri,
    sortIndex,
  }: {
    chainId: string;
    networkLogoUri: string;
    sortIndex?: number;
  },
): IMarketToken {
  // Use token's own networkId to get network logo, fallback to passed chainId
  const tokenNetworkId = item.networkId || chainId;
  const tokenNetworkLogoUri = item.networkId
    ? getNetworkLogoUri(item.networkId)
    : networkLogoUri;

  return {
    id: `${item.address}${item.name}${tokenNetworkLogoUri}${item.symbol}`,
    name: item.name,
    symbol: item.symbol,
    address: item.address,
    price: safeNumber(item.price),
    change24h: safeNumber(item.priceChange24hPercent),
    marketCap: safeNumber(item.marketCap),
    liquidity: safeNumber(item.liquidity),
    transactions: safeNumber(item.trade24hCount),
    uniqueTraders: safeNumber(item.uniqueWallet24h),
    holders: item.holders || 0,
    turnover: safeNumber(item.volume24h),
    tokenImageUri: item.logoUrl || '',
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
    walletInfo: {
      buy: safeNumber(item.buy24hCount),
      sell: safeNumber(item.sell24hCount),
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
