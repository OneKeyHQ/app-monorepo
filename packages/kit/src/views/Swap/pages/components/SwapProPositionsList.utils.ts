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

export function shouldRenderStockPositionsSkeleton({
  isStockMetadataLoading,
  stockOnly,
  stockTokenListResolved,
}: {
  isStockMetadataLoading?: boolean;
  stockOnly: boolean;
  stockTokenListResolved: boolean;
}) {
  return (
    stockOnly && !stockTokenListResolved && isStockMetadataLoading !== false
  );
}
