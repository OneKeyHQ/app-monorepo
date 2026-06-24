import { normalizeTokenContractAddress } from './tokenUtils';

const MARKET_WATCHLIST_NATIVE_PLACEHOLDER_ADDRESSES = new Set([
  '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
]);

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

export function isMarketWatchListNativePlaceholderAddress(
  contractAddress: string | undefined,
) {
  return MARKET_WATCHLIST_NATIVE_PLACEHOLDER_ADDRESSES.has(
    contractAddress?.trim().toLowerCase() ?? '',
  );
}

function isMarketWatchListNativeItem(item: IMarketWatchListItemIdentity) {
  return (
    item.isNative === true ||
    (item.isNative === undefined &&
      isMarketWatchListNativePlaceholderAddress(item.contractAddress))
  );
}

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
  const shouldUseNativeAddressKey =
    normalizeNativeAddress && isMarketWatchListNativeItem(item);
  const contractAddress = shouldUseNativeAddressKey
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

export function dedupeMarketWatchListItems<
  T extends IMarketWatchListItemIdentity,
>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  items.forEach((item) => {
    const key = buildMarketWatchListItemKey(item);
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    result.push(item);
  });

  return result;
}
