import BigNumber from 'bignumber.js';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  MAX_SQRT_RATIO,
  MAX_TICK,
  MIN_SQRT_RATIO,
  MIN_TICK,
  Q96,
  getSqrtRatioAtTick,
  getTickAtSqrtRatio,
} from './tickMath';

// Prices near the tick limits reach ~1e-56 once decimals are applied; the
// default 20 decimal places would round them to zero.
export const PoolsBigNumber = BigNumber.clone({ DECIMAL_PLACES: 90 });

const Q96_BN = new PoolsBigNumber(Q96.toString());

export type IPoolTokenDecimals = {
  decimals0: number;
  decimals1: number;
};

export type IPoolTickRange = {
  tickLower: number;
  tickUpper: number;
};

export type ITickAlignMode = 'down' | 'up' | 'nearest';

export type IRangeDisplayBound = 'min' | 'max';

/** Human price: how much token1 one token0 is worth */
export function sqrtRatioX96ToPrice({
  sqrtRatioX96,
  decimals0,
  decimals1,
}: { sqrtRatioX96: bigint } & IPoolTokenDecimals): BigNumber {
  const ratio = new PoolsBigNumber(sqrtRatioX96.toString()).div(Q96_BN);
  return ratio.times(ratio).shiftedBy(decimals0 - decimals1);
}

export function tickToPrice({
  tick,
  decimals0,
  decimals1,
}: { tick: number } & IPoolTokenDecimals): BigNumber {
  return sqrtRatioX96ToPrice({
    sqrtRatioX96: getSqrtRatioAtTick(tick),
    decimals0,
    decimals1,
  });
}

export function priceToSqrtRatioX96({
  price,
  decimals0,
  decimals1,
}: { price: BigNumber.Value } & IPoolTokenDecimals): bigint {
  const rawPrice = new PoolsBigNumber(price).shiftedBy(decimals1 - decimals0);
  if (!rawPrice.isFinite() || rawPrice.lte(0)) {
    throw new OneKeyLocalError('Price must be a positive number');
  }
  const sqrtRatio = BigInt(
    rawPrice
      .sqrt()
      .times(Q96_BN)
      .integerValue(BigNumber.ROUND_FLOOR)
      .toFixed(0),
  );
  if (sqrtRatio < MIN_SQRT_RATIO) {
    return MIN_SQRT_RATIO;
  }
  if (sqrtRatio >= MAX_SQRT_RATIO) {
    return MAX_SQRT_RATIO - BigInt(1);
  }
  return sqrtRatio;
}

/** Greatest tick whose price is at or below the given human price */
export function priceToTick(
  params: { price: BigNumber.Value } & IPoolTokenDecimals,
): number {
  return getTickAtSqrtRatio(priceToSqrtRatioX96(params));
}

// Math.round/floor/ceil can return -0, which would later print as "-0"
function withoutNegativeZero(value: number) {
  return value === 0 ? 0 : value;
}

export function getMinUsableTick(tickSpacing: number) {
  return withoutNegativeZero(Math.ceil(MIN_TICK / tickSpacing) * tickSpacing);
}

export function getMaxUsableTick(tickSpacing: number) {
  return withoutNegativeZero(Math.floor(MAX_TICK / tickSpacing) * tickSpacing);
}

/** Snap a tick to the spacing grid; floor semantics also hold below zero */
export function alignTick({
  tick,
  tickSpacing,
  mode = 'nearest',
}: {
  tick: number;
  tickSpacing: number;
  mode?: ITickAlignMode;
}) {
  const steps = tick / tickSpacing;
  let aligned: number;
  if (mode === 'down') {
    aligned = Math.floor(steps) * tickSpacing;
  } else if (mode === 'up') {
    aligned = Math.ceil(steps) * tickSpacing;
  } else {
    aligned = Math.round(steps) * tickSpacing;
  }
  const bounded = Math.min(
    Math.max(aligned, getMinUsableTick(tickSpacing)),
    getMaxUsableTick(tickSpacing),
  );
  return withoutNegativeZero(bounded);
}

export function getFullRange(tickSpacing: number): IPoolTickRange {
  return {
    tickLower: getMinUsableTick(tickSpacing),
    tickUpper: getMaxUsableTick(tickSpacing),
  };
}

export function isFullRange({
  tickLower,
  tickUpper,
  tickSpacing,
}: IPoolTickRange & { tickSpacing: number }) {
  return (
    tickLower <= getMinUsableTick(tickSpacing) &&
    tickUpper >= getMaxUsableTick(tickSpacing)
  );
}

/** The contract's definition: tickLower <= currentTick < tickUpper */
export function isTickInRange({
  tickLower,
  tickUpper,
  tick,
}: IPoolTickRange & { tick: number }) {
  return tickLower <= tick && tick < tickUpper;
}

/**
 * ±percent around the current price, snapped to the spacing grid. The
 * current price always stays inside the result, so a narrow preset on a wide
 * grid still earns fees right away.
 */
export function getRangeAroundPrice({
  sqrtRatioX96,
  percent,
  tickSpacing,
  decimals0,
  decimals1,
}: {
  sqrtRatioX96: bigint;
  percent: number;
  tickSpacing: number;
} & IPoolTokenDecimals): IPoolTickRange {
  if (percent >= 1) {
    return getFullRange(tickSpacing);
  }
  const price = sqrtRatioX96ToPrice({ sqrtRatioX96, decimals0, decimals1 });
  const currentTick = getTickAtSqrtRatio(sqrtRatioX96);
  let tickLower = alignTick({
    tick: priceToTick({
      price: price.times(1 - percent),
      decimals0,
      decimals1,
    }),
    tickSpacing,
  });
  let tickUpper = alignTick({
    tick: priceToTick({
      price: price.times(1 + percent),
      decimals0,
      decimals1,
    }),
    tickSpacing,
  });
  if (tickLower > currentTick) {
    tickLower = alignTick({ tick: currentTick, tickSpacing, mode: 'down' });
  }
  if (tickUpper <= currentTick) {
    tickUpper = alignTick({ tick: currentTick + 1, tickSpacing, mode: 'up' });
  }
  return { tickLower, tickUpper };
}

/** Which tick a displayed bound maps to; inverting the price swaps the ends */
export function getRangeSideForDisplayBound(
  bound: IRangeDisplayBound,
  inverted: boolean,
): keyof IPoolTickRange {
  if (bound === 'min') {
    return inverted ? 'tickUpper' : 'tickLower';
  }
  return inverted ? 'tickLower' : 'tickUpper';
}

export function toDisplayPrice(price: BigNumber, inverted: boolean) {
  return inverted ? new PoolsBigNumber(1).div(price) : price;
}

/**
 * Range bounds as shown to the user. When token1 is the base asset the
 * displayed price is 1 / pool price.
 */
export function getDisplayRange({
  tickLower,
  tickUpper,
  tickSpacing,
  decimals0,
  decimals1,
  inverted,
}: IPoolTickRange &
  IPoolTokenDecimals & { tickSpacing: number; inverted: boolean }) {
  const priceLower = tickToPrice({ tick: tickLower, decimals0, decimals1 });
  const priceUpper = tickToPrice({ tick: tickUpper, decimals0, decimals1 });
  const atMinTick = tickLower <= getMinUsableTick(tickSpacing);
  const atMaxTick = tickUpper >= getMaxUsableTick(tickSpacing);
  if (!inverted) {
    return {
      min: priceLower,
      max: priceUpper,
      isMinZero: atMinTick,
      isMaxInfinite: atMaxTick,
    };
  }
  return {
    min: toDisplayPrice(priceUpper, true),
    max: toDisplayPrice(priceLower, true),
    isMinZero: atMaxTick,
    isMaxInfinite: atMinTick,
  };
}

/** Tick for a typed display price, snapped to the nearest usable tick */
export function displayPriceToTick({
  displayPrice,
  inverted,
  tickSpacing,
  decimals0,
  decimals1,
}: {
  displayPrice: BigNumber.Value;
  inverted: boolean;
  tickSpacing: number;
} & IPoolTokenDecimals) {
  const value = new PoolsBigNumber(displayPrice);
  const poolPrice = inverted ? new PoolsBigNumber(1).div(value) : value;
  return alignTick({
    tick: priceToTick({ price: poolPrice, decimals0, decimals1 }),
    tickSpacing,
  });
}

/**
 * Move one displayed bound by one spacing step (the −/+ buttons). Raising a
 * displayed price lowers the pool price when the display is inverted.
 */
export function stepDisplayBound({
  range,
  bound,
  direction,
  inverted,
  tickSpacing,
}: {
  range: IPoolTickRange;
  bound: IRangeDisplayBound;
  direction: 'up' | 'down';
  inverted: boolean;
  tickSpacing: number;
}): IPoolTickRange {
  const side = getRangeSideForDisplayBound(bound, inverted);
  const poolDirectionUp = inverted ? direction === 'down' : direction === 'up';
  const nextTick = alignTick({
    tick: range[side] + (poolDirectionUp ? tickSpacing : -tickSpacing),
    tickSpacing,
  });
  const next = { ...range, [side]: nextTick };
  if (next.tickLower >= next.tickUpper) {
    return range;
  }
  return next;
}

type IQuoteCandidate = {
  category?: string;
  canonicalId: string;
};

function quoteRank(token: IQuoteCandidate) {
  if (token.category === 'stablecoin') {
    return 2;
  }
  return token.canonicalId.endsWith(':ETH') ? 1 : 0;
}

/**
 * Prices are shown in the quote asset: a stablecoin first, then ETH, else
 * token1 (doc §3.3). When token0 is the quote, the shown price is 1 / pool
 * price.
 */
export function isPoolPriceInverted({
  token0,
  token1,
}: {
  token0: IQuoteCandidate;
  token1: IQuoteCandidate;
}) {
  return quoteRank(token0) > quoteRank(token1);
}
