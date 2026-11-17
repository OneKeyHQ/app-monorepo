import {
  IMPL_BTC,
  IMPL_EVM,
  IMPL_SOL,
  IMPL_SUI,
  IMPL_TRON,
} from '../engine/engineConsts';

import networkUtils from './networkUtils';
import { normalizeTokenContractAddress } from './tokenUtils';

import type { IMarketWatchListItemV2 } from '../../types/market';

function isLegacyNativeFavorite(item: IMarketWatchListItemV2) {
  if (item.isNative !== undefined) return item.isNative;
  const address = item.contractAddress;
  if (address === '') return true;
  const impl = networkUtils.getNetworkImpl({ networkId: item.chainId });
  // Account-name chains can have a real contract named "native".
  if (address === 'native') {
    return [IMPL_BTC, IMPL_EVM, IMPL_SOL, IMPL_SUI, IMPL_TRON].includes(impl);
  }
  return (
    (impl === IMPL_EVM && /^0x(?:0{40}|e{40})$/i.test(address)) ||
    (impl === IMPL_SUI && /^0x0{0,63}2::sui::SUI$/.test(address))
  );
}

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

export function findLegacyMarketWatchlistItem(
  items: IMarketWatchListItemV2[],
  identity: { networkId: string; tokenAddress: string; isNative: boolean },
) {
  const candidates = items.filter(
    (item) =>
      !item.assetId &&
      !item.stockId &&
      !item.perpsCoin &&
      item.chainId === identity.networkId,
  );
  const key = getMarketWatchlistKey({
    chainId: identity.networkId,
    contractAddress: identity.tokenAddress,
  });
  // List APIs can use a different native address alias than the persisted favorite.
  return (
    candidates.find((item) => getMarketWatchlistKey(item) === key) ??
    (identity.isNative ? candidates.find(isLegacyNativeFavorite) : undefined)
  );
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
