import type { IBook } from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IL2BookOptions } from '@onekeyhq/shared/types/hyperliquid/types';

import { getOrderBookSubscriptionTickLabel } from '../components/OrderBook/tickSizeUtils';

export const PERPS_DEPTH_BOOK_RADIUS = 0.0025;
const LEVELS_PER_SIDE = 20;

const DEPTH_BOOK_OPTIONS = [
  { nSigFigs: null, mantissa: null },
  { nSigFigs: 5, mantissa: null },
  { nSigFigs: 5, mantissa: 2 },
  { nSigFigs: 5, mantissa: 5 },
  { nSigFigs: 4, mantissa: null },
  { nSigFigs: 3, mantissa: null },
  { nSigFigs: 2, mantissa: null },
] as const satisfies IL2BookOptions[];

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

export function getDepthBookTarget(input: IDepthBookPrice) {
  const requiredHalfSpan = input.price * PERPS_DEPTH_BOOK_RADIUS;
  let lastTarget: IDepthBookTarget | undefined;
  for (const options of DEPTH_BOOK_OPTIONS) {
    const step = getDepthBookPriceStep(input, options);
    if (!Number.isFinite(step) || step <= 0) return undefined;
    lastTarget = { options, step };
    if (step * (LEVELS_PER_SIDE - 1) >= requiredHalfSpan) return lastTarget;
  }
  return lastTarget;
}

export function getWiderDepthBookTarget(
  input: IDepthBookPrice,
  target: IDepthBookTarget,
) {
  const currentStep = getDepthBookPriceStep(input, target.options);
  return DEPTH_BOOK_OPTIONS.map((options) => ({
    options,
    step: getDepthBookPriceStep(input, options),
  })).find(({ step }) => step > currentStep);
}

function coversDepthWindow(book: IBook, mid: number) {
  const [bids, asks] = book.levels;
  return (
    Number(bids.at(-1)?.px) <= mid * (1 - PERPS_DEPTH_BOOK_RADIUS) &&
    Number(asks.at(-1)?.px) >= mid * (1 + PERPS_DEPTH_BOOK_RADIUS)
  );
}

export function getFinerCoveringBookTarget(
  input: IDepthBookPrice,
  book: IBook,
) {
  if (!coversDepthWindow(book, input.price)) return undefined;
  const expected = getDepthBookTarget(input);
  const options = DEPTH_BOOK_OPTIONS.find(
    (option) =>
      option.nSigFigs === book.nSigFigs && option.mantissa === book.mantissa,
  );
  if (!options || !expected) return undefined;

  const step = getDepthBookPriceStep(input, options);
  return step <= expected.step ? { options, step } : undefined;
}

export function shouldWidenDepthBook(book: IBook, mid: number) {
  const [bids, asks] = book.levels;
  // The real BBO and the grouped book arrive on separate feeds.
  if (!(Number(bids[0]?.px) <= mid && mid <= Number(asks[0]?.px))) {
    return false;
  }
  return (
    (bids.length >= LEVELS_PER_SIDE &&
      Number(bids.at(-1)?.px) > mid * (1 - PERPS_DEPTH_BOOK_RADIUS)) ||
    (asks.length >= LEVELS_PER_SIDE &&
      Number(asks.at(-1)?.px) < mid * (1 + PERPS_DEPTH_BOOK_RADIUS))
  );
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
