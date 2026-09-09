import BigNumber from 'bignumber.js';

import { OneKeyError } from '@onekeyhq/shared/src/errors';

import type { IOBLevel } from './types';

// BigNumber-based precision functions with string I/O for precision preservation
function floorBN(value: BigNumber, decimals = 0): BigNumber {
  const multiplier = new BigNumber(10).pow(decimals);
  return value
    .multipliedBy(multiplier)
    .integerValue(BigNumber.ROUND_DOWN)
    .dividedBy(multiplier);
}

function ceilBN(value: BigNumber, decimals = 0): BigNumber {
  const multiplier = new BigNumber(10).pow(decimals);
  return value
    .multipliedBy(multiplier)
    .integerValue(BigNumber.ROUND_UP)
    .dividedBy(multiplier);
}

// Input validation helper
function validateInput(value: string | number, name: string): void {
  if (value === null || value === undefined) {
    throw new OneKeyError(`${name} cannot be null or undefined`);
  }
  const bn = new BigNumber(value);
  if (bn.isNaN()) {
    throw new OneKeyError(`${name} must be a valid number, got: ${value}`);
  }
}

// Removed floorToTick and ceilToTick - use fast versions directly for better performance

// Fast-path rounding helpers for hot loops (skip validation and reuse precomputed values)
// Inputs are BigNumber to avoid repeated constructions; outputs are fixed-decimal strings
export function floorToTickFast(
  nBN: BigNumber,
  invTickSizeBN: BigNumber,
  priceDecimals: number,
): string {
  return floorBN(nBN.multipliedBy(invTickSizeBN), 0)
    .dividedBy(invTickSizeBN)
    .toFixed(priceDecimals);
}

export function ceilToTickFast(
  nBN: BigNumber,
  invTickSizeBN: BigNumber,
  priceDecimals: number,
): string {
  return ceilBN(nBN.multipliedBy(invTickSizeBN), 0)
    .dividedBy(invTickSizeBN)
    .toFixed(priceDecimals);
}

export function getMidPrice(
  bestBid: string | number,
  bestAsk: string | number,
): string {
  validateInput(bestBid, 'Best bid');
  validateInput(bestAsk, 'Best ask');

  const bestBidBN = new BigNumber(bestBid);
  const bestAskBN = new BigNumber(bestAsk);

  if (bestBidBN.isZero()) {
    return bestAskBN.toFixed();
  }
  if (bestAskBN.isZero()) {
    return bestBidBN.toFixed();
  }

  return bestBidBN.plus(bestAskBN).dividedBy(2).toFixed();
}

export function getOrderBookMidPrice({
  liveMidPrice,
  bestBid,
  bestAsk,
}: {
  liveMidPrice?: string;
  bestBid?: string;
  bestAsk?: string;
}): string {
  const liveMidPriceBN = new BigNumber(liveMidPrice ?? '');
  if (liveMidPriceBN.isFinite() && liveMidPriceBN.isGreaterThan(0)) {
    return liveMidPriceBN.toFixed();
  }

  return getMidPrice(bestBid ?? '0', bestAsk ?? '0');
}

export function getOrderBookLiveMidPrice({
  isSpot,
  spotMidPrice,
  tradingMidPrice,
}: {
  isSpot: boolean;
  spotMidPrice?: string;
  tradingMidPrice?: string;
}): string | undefined {
  return isSpot ? spotMidPrice : tradingMidPrice;
}

export type IOrderBookHoverSummary = {
  averagePrice: string;
  totalSize: string;
  totalNotional: string;
};

export function getOrderBookDistanceFromMid(
  price: string | number,
  midPrice: string | number,
): string | null {
  const priceBN = new BigNumber(price);
  const midPriceBN = new BigNumber(midPrice);
  if (
    !priceBN.isFinite() ||
    !midPriceBN.isFinite() ||
    priceBN.isNegative() ||
    midPriceBN.isLessThanOrEqualTo(0)
  ) {
    return null;
  }
  return priceBN
    .minus(midPriceBN)
    .abs()
    .dividedBy(midPriceBN)
    .multipliedBy(100)
    .toFixed();
}

export function getOrderBookHoverSummary(
  levels: readonly Pick<IOBLevel, 'price' | 'size' | 'cumSize'>[],
  hoveredIndex: number,
): IOrderBookHoverSummary | null {
  if (
    !Number.isInteger(hoveredIndex) ||
    hoveredIndex < 0 ||
    hoveredIndex >= levels.length
  ) {
    return null;
  }

  const hoveredLevel = levels[hoveredIndex];
  const totalSize = new BigNumber(hoveredLevel.cumSize);
  if (!totalSize.isFinite() || totalSize.isLessThanOrEqualTo(0)) {
    return null;
  }

  let totalNotional = new BigNumber(0);
  for (let index = 0; index <= hoveredIndex; index += 1) {
    const level = levels[index];
    const price = new BigNumber(level.price);
    const size = new BigNumber(level.size);
    if (
      !price.isFinite() ||
      !size.isFinite() ||
      price.isNegative() ||
      size.isNegative()
    ) {
      return null;
    }
    totalNotional = totalNotional.plus(price.multipliedBy(size));
  }

  return {
    averagePrice: totalNotional.dividedBy(totalSize).toFixed(),
    totalSize: totalSize.toFixed(),
    totalNotional: totalNotional.toFixed(),
  };
}
