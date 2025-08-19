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
  item: IMarketTokenListItem,
  {
    chainId,
    networkLogoUri,
    index,
    sortIndex,
  }: {
    chainId: string;
    networkLogoUri: string;
    index?: number;
    sortIndex?: number;
  },
): IMarketToken {
  // Normalize address: treat short addresses (< 15 chars) as empty strings for native tokens
  const normalizedAddress = item.address.length < 15 ? '' : item.address;

  return {
    id: normalizedAddress || `${index ?? 0}`,
    name: item.name,
    symbol: item.symbol,
    address: normalizedAddress,
    price: safeNumber(item.price),
    change24h: safeNumber(item.priceChange24hPercent),
    marketCap: safeNumber(item.marketCap),
    liquidity: safeNumber(item.liquidity),
    transactions: safeNumber(item.trade24hCount),
    uniqueTraders: safeNumber(item.uniqueWallet24h),
    holders: item.holders || 0,
    turnover: safeNumber(item.volume24h),
    tokenImageUri: item.logoUrl || '',
    networkLogoUri,
    networkId: item.networkId || chainId,
    chainId,
    sortIndex,
    walletInfo: {
      buy: safeNumber(item.buy24hCount),
      sell: safeNumber(item.sell24hCount),
    },
  };
}
