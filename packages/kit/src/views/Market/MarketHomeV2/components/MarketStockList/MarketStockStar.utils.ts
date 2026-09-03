import type { IMarketStockTokenVariantSummary } from '@onekeyhq/shared/types/marketV2';

import type { IMarketWatchlistIdentity } from '../../../components/MarketAsyncStarV2';

export function parseMarketStockVariantTokenId(
  tokenId: string,
): IMarketWatchlistIdentity | undefined {
  const parts = tokenId.split(':');
  if (parts.length < 4 || parts[0] !== 'spot_token') {
    return undefined;
  }
  const chainId = parts[2];
  const contractAddress = parts.slice(3).join(':');
  if (!chainId || !contractAddress) {
    return undefined;
  }
  return { chainId, contractAddress };
}

export function getMarketStockVariantSummaryIdentities(
  variants: IMarketStockTokenVariantSummary[] | undefined,
) {
  return (variants ?? []).flatMap((variant) => {
    const identity = parseMarketStockVariantTokenId(variant.tokenId);
    return identity ? [identity] : [];
  });
}
