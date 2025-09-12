import BigNumber from 'bignumber.js';

import { OneKeyError } from '@onekeyhq/shared/src/errors';

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
