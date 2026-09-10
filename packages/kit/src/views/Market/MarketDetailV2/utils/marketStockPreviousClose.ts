import { resolveStockTokenToAssetRatio } from '@onekeyhq/kit/src/views/Swap/utils/swapStockReviewUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketStockPublicDetail } from '@onekeyhq/shared/types/marketV2';

/**
 * Previous session close from the stock detail quote as a chart price.
 * The detail feed is the only endpoint that reports it; the chart endpoints
 * carry candles alone.
 */
export function getMarketStockPreviousClose(
  stockDetail:
    | Pick<IMarketStockPublicDetail, 'previousClose'>
    | null
    | undefined,
): number | undefined {
  const rawValue = stockDetail?.previousClose?.trim();
  if (!rawValue) {
    return undefined;
  }
  const value = Number(rawValue);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * The share's previous close on a stock token's price scale. A token trades at
 * roughly the share price times its shares per token (`tokenToAssetRatio`);
 * variants that do not report a ratio are treated as one share per token.
 */
export function getMarketStockTokenPreviousClose({
  stockDetail,
  tokenToAssetRatio,
}: {
  stockDetail: Parameters<typeof getMarketStockPreviousClose>[0];
  tokenToAssetRatio?: string;
}): number | undefined {
  const sharePreviousClose = getMarketStockPreviousClose(stockDetail);
  if (sharePreviousClose === undefined) {
    return undefined;
  }
  const ratio = Number(tokenToAssetRatio?.trim());
  return Number.isFinite(ratio) && ratio > 0
    ? sharePreviousClose * ratio
    : sharePreviousClose;
}

/**
 * Previous close for a stock detail chart in its price mode. The token price
 * uses the selected variant's shares per token and only borrows the token
 * detail's ratio when that detail describes the same token, so an unusable
 * variant ratio never picks up another variant's scale.
 */
export function getMarketStockChartPreviousClose({
  priceSource,
  stockDetail,
  selectedTokenVariant,
  tokenDetail,
  tokenDetailNetworkId,
}: {
  priceSource: 'share' | 'token';
  stockDetail: Parameters<typeof getMarketStockPreviousClose>[0];
  selectedTokenVariant?: {
    networkId: string;
    contractAddress: string;
    tokenToAssetRatio?: string;
  };
  tokenDetail?: {
    address?: string;
    stock?: { tokenToAssetRatio?: string } | null;
  };
  tokenDetailNetworkId?: string;
}): number | undefined {
  if (priceSource === 'share') {
    return getMarketStockPreviousClose(stockDetail);
  }
  const selectedVariantMatchesTokenDetail = Boolean(
    selectedTokenVariant &&
    equalTokenNoCaseSensitive({
      token1: {
        networkId: selectedTokenVariant.networkId,
        contractAddress: selectedTokenVariant.contractAddress,
      },
      token2: {
        networkId: tokenDetailNetworkId,
        contractAddress: tokenDetail?.address,
      },
    }),
  );
  return getMarketStockTokenPreviousClose({
    stockDetail,
    tokenToAssetRatio: resolveStockTokenToAssetRatio({
      selectedVariantRatio: selectedTokenVariant?.tokenToAssetRatio,
      tokenDetailRatio: tokenDetail?.stock?.tokenToAssetRatio,
      hasSelectedVariant: Boolean(selectedTokenVariant),
      selectedVariantMatchesTokenDetail,
    }),
  });
}
