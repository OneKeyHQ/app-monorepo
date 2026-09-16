export type IMarketSearchMetric = 'liquidity' | 'marketCap';

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
