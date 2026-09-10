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
