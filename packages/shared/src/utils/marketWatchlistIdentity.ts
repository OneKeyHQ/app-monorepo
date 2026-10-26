import { normalizeTokenContractAddress } from './tokenUtils';

import type { IMarketWatchListItemV2 } from '../../types/market';

export function getMarketWatchlistKey(item: IMarketWatchListItemV2): string {
  if (item.assetId) return `asset:${item.assetId}`;
  if (item.stockId) return `stock:${item.stockId}`;
  if (item.perpsCoin) return `perps:${item.perpsCoin}`;
  return `${item.chainId}:${
    normalizeTokenContractAddress({
      networkId: item.chainId,
      contractAddress: item.contractAddress,
    }) || ''
  }`;
}

export function isValidMarketWatchlistItem(
  item: IMarketWatchListItemV2,
): boolean {
  const identities = [item.assetId, item.stockId, item.perpsCoin].filter(
    (id) => id !== undefined,
  );
  if (identities.length) {
    return identities.length === 1 && Boolean(identities[0]?.trim());
  }
  return Boolean(item.chainId?.trim());
}
