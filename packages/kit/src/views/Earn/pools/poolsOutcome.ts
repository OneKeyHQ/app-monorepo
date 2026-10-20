import BigNumber from 'bignumber.js';

import {
  REFERENCE_LIQUIDITY,
  getRangeAmountsPerLiquidity,
  getRangePositionAmounts,
  priceToSqrtRatioX96,
  tickToPrice,
} from '@onekeyhq/shared/src/utils/poolsMath';
import type { IPool, IPoolPricePoint } from '@onekeyhq/shared/types/pools';

import { getPoolPair, getPoolPrice } from './poolsFormat';

// What a range means for the user, in numbers the add page can say plainly

// A swap that costs more than this share of the whole amount is worth a look
const SWAP_COST_NOTICE = 0.01;

/**
 * Whether a swap's cost earns a row: past 1% of everything that goes
 * through it, cost included. Below that, the steps carry the swap.
 */
export function isCostlySwap(
  costUsd: BigNumber.Value,
  valueUsd: BigNumber.Value,
) {
  const cost = new BigNumber(costUsd);
  return cost.gt(0) && cost.div(cost.plus(valueUsd)).gt(SWAP_COST_NOTICE);
}

type IRange = { tickLower: number; tickUpper: number };

function decimalsOf(pool: IPool) {
  return {
    decimals0: pool.token0.decimals,
    decimals1: pool.token1.decimals,
  };
}

/** Daily closes, from the price history, that sat inside the range */
export function countDaysInRange(
  pool: IPool,
  range: IRange,
  history: IPoolPricePoint[],
) {
  const lower = tickToPrice({ tick: range.tickLower, ...decimalsOf(pool) });
  const upper = tickToPrice({ tick: range.tickUpper, ...decimalsOf(pool) });
  const inRange = history.filter(
    (point) => lower.lte(point.price) && upper.gte(point.price),
  ).length;
  return { inRange, total: history.length };
}

/**
 * The position against holding what went in, after the base token moves by
 * `move` while the quote keeps its dollar price; fees left out. As a share
 * of the holding: negative means behind.
 */
function versusHoldingAt(pool: IPool, range: IRange | undefined, move: number) {
  const factor = 1 + move;
  if (!range || !pool.capabilities.priceRange) {
    // Constant product: the position is worth 2√r / (1 + r) of holding
    return (2 * Math.sqrt(factor)) / (1 + factor) - 1;
  }
  // The base is token1 when the pair reads inverted
  const { inverted } = getPoolPair(pool);
  const price0Usd = new BigNumber(pool.token0.priceUsd).times(
    inverted ? 1 : factor,
  );
  const price1Usd = new BigNumber(pool.token1.priceUsd).times(
    inverted ? factor : 1,
  );
  const decimals = decimalsOf(pool);
  const before = getRangeAmountsPerLiquidity({
    sqrtRatioX96: BigInt(pool.sqrtPriceX96 ?? '0'),
    ...range,
    ...decimals,
  });
  const after = getRangePositionAmounts({
    sqrtRatioX96: priceToSqrtRatioX96({
      price: getPoolPrice(pool).times(inverted ? 1 / factor : factor),
      ...decimals,
    }),
    ...range,
    ...decimals,
    liquidity: REFERENCE_LIQUIDITY,
  });
  const valueOf = (amounts: { amount0: BigNumber; amount1: BigNumber }) =>
    amounts.amount0.times(price0Usd).plus(amounts.amount1.times(price1Usd));
  const holding = valueOf(before);
  return holding.gt(0) ? valueOf(after).div(holding).minus(1).toNumber() : 0;
}

/**
 * The worse of a move up and a move down: 20% for volatile and stock pairs,
 * 1% when both tokens are stable, the scale their range presets use.
 */
export function getVersusHolding(pool: IPool, range?: IRange) {
  const isStablePair =
    pool.token0.category === 'stablecoin' &&
    pool.token1.category === 'stablecoin';
  const move = isStablePair ? 0.01 : 0.2;
  return {
    move,
    fraction: Math.min(
      versusHoldingAt(pool, range, move),
      versusHoldingAt(pool, range, -move),
    ),
  };
}
