import {
  MAX_TICK,
  MIN_TICK,
  bucketLiquidity,
  buildLiquiditySegments,
  displayPriceToTick,
  getDisplayRange,
  getMaxUsableTick,
  getMinUsableTick,
  getRangeSideForDisplayBound,
  priceToTick,
  tickToPrice,
  toDisplayPrice,
} from '@onekeyhq/shared/src/utils/poolsMath';
import type { IPoolTickRange } from '@onekeyhq/shared/src/utils/poolsMath';
import type {
  IPool,
  IPoolTickLiquidityNet,
} from '@onekeyhq/shared/types/pools';

import { getPoolPair } from './poolsFormat';

// What the combined chart draws besides the price line, in the prices it
// shows: the liquidity strip and the range band.

/** Display prices are flipped when the user flips the chart */
function getShownInversion(pool: IPool, flipped: boolean) {
  const { inverted } = getPoolPair(pool);
  return flipped ? !inverted : inverted;
}

function getDecimals(pool: IPool) {
  return {
    decimals0: pool.token0.decimals,
    decimals1: pool.token1.decimals,
  };
}

function tickToShownPrice(pool: IPool, tick: number, inverted: boolean) {
  return toDisplayPrice(
    tickToPrice({ tick, ...getDecimals(pool) }),
    inverted,
  ).toNumber();
}

/**
 * Average active liquidity per equal-width bucket between two shown prices.
 * Range pools only; a share pool's liquidity is the same at every price.
 */
export function getShownLiquidityBuckets({
  pool,
  ticks,
  low,
  high,
  flipped,
  bucketCount,
}: {
  pool: IPool;
  ticks: IPoolTickLiquidityNet[];
  low: number;
  high: number;
  flipped: boolean;
  bucketCount: number;
}) {
  if (!pool.capabilities.priceRange || !ticks.length || !(low > 0)) {
    return [];
  }
  const inverted = getShownInversion(pool, flipped);
  const toTick = (shown: number) =>
    Math.min(
      MAX_TICK,
      Math.max(
        MIN_TICK,
        priceToTick({
          price: inverted ? 1 / shown : shown,
          ...getDecimals(pool),
        }),
      ),
    );
  const tickA = toTick(low);
  const tickB = toTick(high);
  const segments = buildLiquiditySegments({
    ticks,
    currentTick: pool.currentTick ?? 0,
    activeLiquidity: BigInt(pool.activeLiquidity ?? '0'),
  });
  return bucketLiquidity({
    segments,
    fromTick: Math.min(tickA, tickB),
    toTick: Math.max(tickA, tickB),
    bucketCount,
  }).map((bucket) => {
    const priceA = tickToShownPrice(pool, bucket.tickLower, inverted);
    const priceB = tickToShownPrice(pool, bucket.tickUpper, inverted);
    return {
      low: Math.min(priceA, priceB),
      high: Math.max(priceA, priceB),
      value: Number(bucket.liquidity),
    };
  });
}

/** A range's bounds in the shown prices; an open side is left undefined */
export function getShownRangeBounds({
  pool,
  range,
  flipped,
}: {
  pool: IPool;
  range: IPoolTickRange;
  flipped: boolean;
}) {
  const display = getDisplayRange({
    ...range,
    tickSpacing: pool.tickSpacing ?? 60,
    ...getDecimals(pool),
    inverted: getShownInversion(pool, flipped),
  });
  return {
    low: display.isMinZero ? undefined : display.min.toNumber(),
    high: display.isMaxInfinite ? undefined : display.max.toNumber(),
  };
}

/**
 * The range after one of its shown edges is dragged to a price: that edge
 * snaps to the nearest usable tick and stays a spacing clear of the other.
 */
export function getRangeWithShownEdge({
  pool,
  range,
  flipped,
  edge,
  price,
}: {
  pool: IPool;
  range: IPoolTickRange;
  flipped: boolean;
  edge: 'low' | 'high';
  price: number;
}): IPoolTickRange {
  const tickSpacing = pool.tickSpacing ?? 60;
  const inverted = getShownInversion(pool, flipped);
  const tick = Math.min(
    getMaxUsableTick(tickSpacing),
    Math.max(
      getMinUsableTick(tickSpacing),
      displayPriceToTick({
        displayPrice: price,
        inverted,
        tickSpacing,
        ...getDecimals(pool),
      }),
    ),
  );
  const side = getRangeSideForDisplayBound(
    edge === 'low' ? 'min' : 'max',
    inverted,
  );
  if (side === 'tickLower') {
    return {
      ...range,
      tickLower: Math.min(tick, range.tickUpper - tickSpacing),
    };
  }
  return { ...range, tickUpper: Math.max(tick, range.tickLower + tickSpacing) };
}

/**
 * The range moved whole, by as many tick spacings as the price under the
 * mouse moved, so its width stays the same. Stops at the usable ticks.
 */
export function getRangeShiftedByShownPrices({
  pool,
  range,
  flipped,
  from,
  to,
}: {
  pool: IPool;
  range: IPoolTickRange;
  flipped: boolean;
  from: number;
  to: number;
}): IPoolTickRange {
  const tickSpacing = pool.tickSpacing ?? 60;
  const inverted = getShownInversion(pool, flipped);
  const toTick = (shown: number) =>
    priceToTick({ price: inverted ? 1 / shown : shown, ...getDecimals(pool) });
  const shift = Math.min(
    getMaxUsableTick(tickSpacing) - range.tickUpper,
    Math.max(
      getMinUsableTick(tickSpacing) - range.tickLower,
      Math.round((toTick(to) - toTick(from)) / tickSpacing) * tickSpacing,
    ),
  );
  return {
    tickLower: range.tickLower + shift,
    tickUpper: range.tickUpper + shift,
  };
}

/**
 * Where a price sits on a range bar, 0 to 1, on a log scale centred on the
 * current price; `span` is the log distance shown on each side.
 */
export function getRangeBarPosition(
  price: number,
  current: number,
  span: number,
) {
  if (!(price > 0) || !(current > 0) || !(span > 0)) {
    return 0.5;
  }
  return Math.min(1, Math.max(0, 0.5 + Math.log(price / current) / (2 * span)));
}
