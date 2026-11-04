import { OneKeyLocalError } from '../errors';

import { equalTokenNoCaseSensitive } from './tokenUtils';

import type { IMarketAssetDetailData } from '../../types/market';

export function resolveMarketAssetVariant({
  detail,
  networkId,
  tokenAddress,
  isNative,
}: {
  detail: Pick<IMarketAssetDetailData, 'selectedVariant' | 'variants'>;
  networkId: string;
  tokenAddress: string;
  isNative?: boolean;
}) {
  // Asset-only favorites have no chain selection; token entries must keep it.
  if (!networkId) return detail.selectedVariant;
  return [detail.selectedVariant, ...detail.variants].find((variant) => {
    if (variant.isNative !== Boolean(isNative)) return false;
    if (variant.isNative) return variant.networkId === networkId;
    return equalTokenNoCaseSensitive({
      token1: { networkId, contractAddress: tokenAddress },
      token2: {
        networkId: variant.networkId,
        contractAddress: variant.tokenAddress,
      },
    });
  });
}

export function requireMarketAssetVariant(
  params: Parameters<typeof resolveMarketAssetVariant>[0],
) {
  const variant = resolveMarketAssetVariant(params);
  if (!variant) {
    throw new OneKeyLocalError(
      'Market asset variant does not match the selected token',
    );
  }
  return variant;
}
