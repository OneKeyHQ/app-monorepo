import { normalizeTokenContractAddress } from './tokenUtils';

export type IMarketWatchListItemIdentity = {
  chainId?: string;
  contractAddress?: string;
  isNative?: boolean;
  perpsCoin?: string;
};

export type IMarketWatchListItemRequiredIdentity =
  IMarketWatchListItemIdentity & {
    chainId: string;
    contractAddress: string;
  };

export function buildMarketWatchListItemKey(
  item: IMarketWatchListItemIdentity,
  {
    delimiter = ':',
    normalizeNativeAddress = true,
  }: {
    delimiter?: string;
    normalizeNativeAddress?: boolean;
  } = {},
) {
  if (item.perpsCoin) {
    return ['perps', item.perpsCoin].join(delimiter);
  }
  const chainId = item.chainId ?? '';
  const contractAddress =
    normalizeNativeAddress && item.isNative
      ? ''
      : (normalizeTokenContractAddress({
          networkId: chainId,
          contractAddress: item.contractAddress,
        }) ?? '');
  return [chainId, contractAddress].join(delimiter);
}

export function isSameMarketWatchListItem(
  item1: IMarketWatchListItemIdentity,
  item2: IMarketWatchListItemIdentity,
) {
  if (item1.perpsCoin || item2.perpsCoin) {
    return !!item1.perpsCoin && item1.perpsCoin === item2.perpsCoin;
  }
  if (!item1.chainId || !item2.chainId || item1.chainId !== item2.chainId) {
    return false;
  }
  if (item1.isNative && item2.isNative) {
    return true;
  }
  return (
    buildMarketWatchListItemKey(item1) === buildMarketWatchListItemKey(item2)
  );
}
