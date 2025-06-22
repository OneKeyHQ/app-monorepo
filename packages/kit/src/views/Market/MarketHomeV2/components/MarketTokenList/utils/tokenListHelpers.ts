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
 * Convert raw api item to component token shape
 */
export function transformApiItemToToken(
  item: IMarketTokenListItem,
  {
    chainId,
    networkLogoUri,
    index,
  }: {
    chainId: string;
    networkLogoUri: string;
    index?: number;
  },
): IMarketToken {
  return {
    id: item.address || `${index ?? 0}`,
    name: item.name,
    symbol: item.symbol,
    address: item.address,
    price: parseFloat(item.price || '0'),
    change24h: parseFloat(item.priceChange24hPercent || '0'),
    marketCap: parseFloat(item.marketCap || '0'),
    liquidity: parseFloat(item.tvl || '0'),
    transactions: parseInt(item.trade24hCount || '0', 10),
    uniqueTraders: parseInt(item.uniqueWallet24h || '0', 10),
    holders: item.holders || 0,
    turnover: parseFloat(item.volume24h || '0'),
    tokenImageUri: item.logoUrl || '',
    networkLogoUri,
    chainId,
    walletInfo: {
      buy: parseInt(item.buy24hCount || '0', 10),
      sell: parseInt(item.sell24hCount || '0', 10),
    },
  };
}
