import BigNumber from 'bignumber.js';

import { PoolsBigNumber } from './priceMath';
import { Q96, getSqrtRatioAtTick } from './tickMath';

import type { IPoolTickRange, IPoolTokenDecimals } from './priceMath';

// Port of Uniswap v3-periphery LiquidityAmounts. BigInt is unbounded, so the
// contract's 512-bit mulDiv becomes plain multiply-then-divide.

const ZERO = BigInt(0);
const SHIFT_96 = BigInt(96);

function sortRatios(a: bigint, b: bigint): [bigint, bigint] {
  return a < b ? [a, b] : [b, a];
}

export function getAmount0ForLiquidity(
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  liquidity: bigint,
) {
  const [lower, upper] = sortRatios(sqrtRatioAX96, sqrtRatioBX96);
  return ((liquidity << SHIFT_96) * (upper - lower)) / upper / lower;
}

export function getAmount1ForLiquidity(
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  liquidity: bigint,
) {
  const [lower, upper] = sortRatios(sqrtRatioAX96, sqrtRatioBX96);
  return (liquidity * (upper - lower)) / Q96;
}

export function getAmountsForLiquidity({
  sqrtRatioX96,
  sqrtRatioAX96,
  sqrtRatioBX96,
  liquidity,
}: {
  sqrtRatioX96: bigint;
  sqrtRatioAX96: bigint;
  sqrtRatioBX96: bigint;
  liquidity: bigint;
}) {
  const [lower, upper] = sortRatios(sqrtRatioAX96, sqrtRatioBX96);
  if (sqrtRatioX96 <= lower) {
    return {
      amount0: getAmount0ForLiquidity(lower, upper, liquidity),
      amount1: ZERO,
    };
  }
  if (sqrtRatioX96 < upper) {
    return {
      amount0: getAmount0ForLiquidity(sqrtRatioX96, upper, liquidity),
      amount1: getAmount1ForLiquidity(lower, sqrtRatioX96, liquidity),
    };
  }
  return {
    amount0: ZERO,
    amount1: getAmount1ForLiquidity(lower, upper, liquidity),
  };
}

export function getLiquidityForAmount0(
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  amount0: bigint,
) {
  const [lower, upper] = sortRatios(sqrtRatioAX96, sqrtRatioBX96);
  return (amount0 * ((lower * upper) / Q96)) / (upper - lower);
}

export function getLiquidityForAmount1(
  sqrtRatioAX96: bigint,
  sqrtRatioBX96: bigint,
  amount1: bigint,
) {
  const [lower, upper] = sortRatios(sqrtRatioAX96, sqrtRatioBX96);
  return (amount1 * Q96) / (upper - lower);
}

export function getLiquidityForAmounts({
  sqrtRatioX96,
  sqrtRatioAX96,
  sqrtRatioBX96,
  amount0,
  amount1,
}: {
  sqrtRatioX96: bigint;
  sqrtRatioAX96: bigint;
  sqrtRatioBX96: bigint;
  amount0: bigint;
  amount1: bigint;
}) {
  const [lower, upper] = sortRatios(sqrtRatioAX96, sqrtRatioBX96);
  if (sqrtRatioX96 <= lower) {
    return getLiquidityForAmount0(lower, upper, amount0);
  }
  if (sqrtRatioX96 < upper) {
    const liquidity0 = getLiquidityForAmount0(sqrtRatioX96, upper, amount0);
    const liquidity1 = getLiquidityForAmount1(lower, sqrtRatioX96, amount1);
    return liquidity0 < liquidity1 ? liquidity0 : liquidity1;
  }
  return getLiquidityForAmount1(lower, upper, amount1);
}

export function toRawAmount(amount: BigNumber.Value, decimals: number) {
  const raw = new PoolsBigNumber(amount)
    .shiftedBy(decimals)
    .integerValue(BigNumber.ROUND_FLOOR);
  if (!raw.isFinite() || raw.lte(0)) {
    return ZERO;
  }
  return BigInt(raw.toFixed(0));
}

export function fromRawAmount(raw: bigint, decimals: number): BigNumber {
  return new PoolsBigNumber(raw.toString()).shiftedBy(-decimals);
}

export type IRangeContext = IPoolTickRange &
  IPoolTokenDecimals & {
    sqrtRatioX96: bigint;
  };

/** Which tokens a range takes at the current price (doc §3.4 table) */
export type IRangeDepositShape = 'both' | 'token0Only' | 'token1Only';

export function getRangeDepositShape({
  sqrtRatioX96,
  tickLower,
  tickUpper,
}: IPoolTickRange & { sqrtRatioX96: bigint }): IRangeDepositShape {
  if (sqrtRatioX96 <= getSqrtRatioAtTick(tickLower)) {
    return 'token0Only';
  }
  if (sqrtRatioX96 < getSqrtRatioAtTick(tickUpper)) {
    return 'both';
  }
  return 'token1Only';
}

/**
 * The other side's amount for one typed side, and the liquidity the pair
 * mints. Typing a side the range does not take yields zero liquidity.
 */
export function quoteRangeDeposit({
  sqrtRatioX96,
  tickLower,
  tickUpper,
  decimals0,
  decimals1,
  side,
  amount,
}: IRangeContext & { side: 0 | 1; amount: BigNumber.Value }) {
  const sqrtA = getSqrtRatioAtTick(tickLower);
  const sqrtB = getSqrtRatioAtTick(tickUpper);
  const raw = toRawAmount(amount, side === 0 ? decimals0 : decimals1);
  let liquidity = ZERO;
  if (side === 0 && sqrtRatioX96 < sqrtB) {
    liquidity = getLiquidityForAmount0(
      sqrtRatioX96 > sqrtA ? sqrtRatioX96 : sqrtA,
      sqrtB,
      raw,
    );
  } else if (side === 1 && sqrtRatioX96 > sqrtA) {
    liquidity = getLiquidityForAmount1(
      sqrtA,
      sqrtRatioX96 < sqrtB ? sqrtRatioX96 : sqrtB,
      raw,
    );
  }
  const amounts = getAmountsForLiquidity({
    sqrtRatioX96,
    sqrtRatioAX96: sqrtA,
    sqrtRatioBX96: sqrtB,
    liquidity,
  });
  return {
    liquidity,
    amount0: fromRawAmount(amounts.amount0, decimals0),
    amount1: fromRawAmount(amounts.amount1, decimals1),
  };
}

/**
 * Fit two fixed amounts into a range (after a Zap, both are known): the
 * liquidity they mint, what goes in, and what stays in the wallet.
 */
export function fitRangeDeposit({
  sqrtRatioX96,
  tickLower,
  tickUpper,
  decimals0,
  decimals1,
  amount0,
  amount1,
}: IRangeContext & { amount0: BigNumber.Value; amount1: BigNumber.Value }) {
  const raw0 = toRawAmount(amount0, decimals0);
  const raw1 = toRawAmount(amount1, decimals1);
  const sqrtA = getSqrtRatioAtTick(tickLower);
  const sqrtB = getSqrtRatioAtTick(tickUpper);
  const liquidity = getLiquidityForAmounts({
    sqrtRatioX96,
    sqrtRatioAX96: sqrtA,
    sqrtRatioBX96: sqrtB,
    amount0: raw0,
    amount1: raw1,
  });
  const used = getAmountsForLiquidity({
    sqrtRatioX96,
    sqrtRatioAX96: sqrtA,
    sqrtRatioBX96: sqrtB,
    liquidity,
  });
  return {
    liquidity,
    used0: fromRawAmount(used.amount0, decimals0),
    used1: fromRawAmount(used.amount1, decimals1),
    leftover0: fromRawAmount(raw0 - used.amount0, decimals0),
    leftover1: fromRawAmount(raw1 - used.amount1, decimals1),
  };
}

export function getRangePositionAmounts({
  sqrtRatioX96,
  tickLower,
  tickUpper,
  decimals0,
  decimals1,
  liquidity,
}: IRangeContext & { liquidity: bigint }) {
  const amounts = getAmountsForLiquidity({
    sqrtRatioX96,
    sqrtRatioAX96: getSqrtRatioAtTick(tickLower),
    sqrtRatioBX96: getSqrtRatioAtTick(tickUpper),
    liquidity,
  });
  return {
    amount0: fromRawAmount(amounts.amount0, decimals0),
    amount1: fromRawAmount(amounts.amount1, decimals1),
  };
}

// Large enough that floor rounding stays far below display precision
export const REFERENCE_LIQUIDITY = BigInt('1000000000000000000000000');

/**
 * Token amounts behind a reference liquidity. Their ratio is the deposit
 * ratio a Zap must hit, and liquidity per dollar feeds the small-amount APR
 * estimate.
 */
export function getRangeAmountsPerLiquidity(context: IRangeContext) {
  return {
    liquidity: REFERENCE_LIQUIDITY,
    ...getRangePositionAmounts({ ...context, liquidity: REFERENCE_LIQUIDITY }),
  };
}
