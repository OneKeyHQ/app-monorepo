import type { IL2BookOptions } from '@onekeyhq/shared/types/hyperliquid/types';

import { getOrderBookSubscriptionTickLabel } from '../components/OrderBook/tickSizeUtils';

export const PERPS_DEPTH_BOOK_RADIUS = 0.0025;
type IDepthBookPrice = {
  price: number;
  szDecimals: number | undefined;
  isSpot: boolean;
};

export type IDepthBookTarget = {
  options: IL2BookOptions;
  step: number;
};

export function getDepthBookPriceStep(
  { price, szDecimals, isSpot }: IDepthBookPrice,
  options: IL2BookOptions,
) {
  return Number(
    getOrderBookSubscriptionTickLabel({
      price: String(price),
      szDecimals,
      isSpot,
      options,
    }),
  );
}

export function getDepthBookTarget(
  input: IDepthBookPrice,
): IDepthBookTarget | undefined {
  // Preserve every returned price level. The chart fits its window to the book
  // instead of coarsening the subscription to cover a fixed percentage.
  const options = { nSigFigs: null, mantissa: null };
  const step = getDepthBookPriceStep(input, options);
  return Number.isFinite(step) && step > 0 ? { options, step } : undefined;
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
