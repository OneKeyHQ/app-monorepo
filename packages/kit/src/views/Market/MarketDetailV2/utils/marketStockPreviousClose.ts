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
