export type IMarketSearchMetric = 'liquidity' | 'marketCap';
export type IMarketSearchPriceChangeTitle = '24h' | 'change';

export function formatMarketSearchPriceChangeHeader({
  priceLabel,
  changeLabel,
}: {
  priceLabel: string;
  changeLabel?: string;
}): string {
  return `${priceLabel} / ${changeLabel ?? '24H'}`;
}

export function getMarketSearchMetricAmount({
  isStockListing,
  liquidity,
  marketCap,
}: {
  isStockListing: boolean;
  liquidity?: string;
  marketCap?: string;
}): { metric: IMarketSearchMetric; amount: string | undefined } {
  if (isStockListing) {
    return { metric: 'marketCap', amount: marketCap };
  }
  return { metric: 'liquidity', amount: liquidity };
}
