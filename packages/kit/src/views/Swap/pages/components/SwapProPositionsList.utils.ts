import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

export function getSwapPositionTokenIdentityKey(token: ISwapToken) {
  return [
    token.networkId,
    token.isNative ? 'native' : (token.contractAddress ?? '').toLowerCase(),
  ].join(':');
}

export function buildStockPositionsMetadataScope({
  locale,
  tokens,
}: {
  locale: string;
  tokens: ISwapToken[];
}) {
  if (!tokens.length) {
    return '';
  }
  return [
    locale.toLowerCase(),
    ...tokens.map(getSwapPositionTokenIdentityKey).toSorted(),
  ].join(':');
}

export function shouldUseSwapProPositionsDisplaySeed({
  hasCachedTokenSnapshot,
  isLiveTokenListForCurrentOwner,
}: {
  hasCachedTokenSnapshot?: boolean;
  isLiveTokenListForCurrentOwner: boolean;
}) {
  return Boolean(hasCachedTokenSnapshot) && !isLiveTokenListForCurrentOwner;
}

export function getStockPositionTokenIdentityKeys({
  marketItems,
  tokens,
}: {
  marketItems: { stock?: unknown }[];
  tokens: ISwapToken[];
}) {
  return tokens.flatMap((token, index) =>
    marketItems[index]?.stock ? [getSwapPositionTokenIdentityKey(token)] : [],
  );
}

export function isStockPositionsMetadataResponseComplete({
  marketItems,
  tokens,
}: {
  marketItems: ({ stock?: unknown } | null | undefined)[];
  tokens: ISwapToken[];
}) {
  return (
    marketItems.length === tokens.length &&
    tokens.every((_, index) => Boolean(marketItems[index]))
  );
}

export type IStockPositionsMetadataStatus = 'success' | 'error';
export type IStockPositionsMetadataViewState = 'loading' | 'success' | 'error';

export function getStockPositionsMetadataViewState({
  isStockMetadataLoading,
  metadataStatus,
  hasUsableMetadata,
  stockOnly,
}: {
  isStockMetadataLoading?: boolean;
  metadataStatus?: IStockPositionsMetadataStatus;
  hasUsableMetadata: boolean;
  stockOnly: boolean;
}): IStockPositionsMetadataViewState {
  if (!stockOnly || hasUsableMetadata) {
    return 'success';
  }
  if (isStockMetadataLoading !== false) {
    return 'loading';
  }
  return metadataStatus === 'error' ? 'error' : 'loading';
}
