import { getOrderBookSubscriptionTickLabel } from '../components/OrderBook/tickSizeUtils';

export const PERPS_DEPTH_BOOK_RADIUS = 0.0025;
// Preserve every returned price level and fit the chart to the observed book.
export const PERPS_DEPTH_BOOK_OPTIONS = { nSigFigs: null, mantissa: null };

export function getDepthBookPriceStep({
  price,
  szDecimals,
  isSpot,
}: {
  price: number;
  szDecimals: number | undefined;
  isSpot: boolean;
}) {
  const step = Number(
    getOrderBookSubscriptionTickLabel({
      price: String(price),
      szDecimals,
      isSpot,
      options: PERPS_DEPTH_BOOK_OPTIONS,
    }),
  );
  return Number.isFinite(step) && step > 0 ? step : undefined;
}

export function getTrueDepthMidPrice(bid?: string, ask?: string) {
  const bestBid = Number(bid);
  const bestAsk = Number(ask);
  if (
    !Number.isFinite(bestBid) ||
    !Number.isFinite(bestAsk) ||
    bestBid <= 0 ||
    bestBid >= bestAsk
  ) {
    return undefined;
  }
  return bestBid + (bestAsk - bestBid) / 2;
}
