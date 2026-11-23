import {
  MAX_TICK,
  MIN_TICK,
  bucketLiquidity,
  buildLiquiditySegments,
  getAmountsValueUsd,
  getRangePositionAmounts,
  isFullRange,
} from '@onekeyhq/shared/src/utils/poolsMath';
import type {
  ILiquiditySegment,
  IPoolTickRange,
} from '@onekeyhq/shared/src/utils/poolsMath';
import type {
  IPool,
  IPoolTickLiquidityNet,
} from '@onekeyhq/shared/types/pools';

import { getLiquidityPileHalfWidth } from './poolsChartData';
import { getPoolPair, getTickDisplayPrice } from './poolsFormat';

// A position against its pool's liquidity: each stretch of price is a bar,
// the rest of the pool at its foot and the position's piece on top. The
// piece against its bar is the position's share at that price, and the bars
// it spans are its range.

/** Stretches holding less than this share of the tallest are thin edges */
const THIN_SHARE = 0.08;
/** Room either side of what the view is cut to, as a share of it */
const MARGIN = 0.12;
/** A range narrower than this share of the view is framed on its own */
const MIN_RANGE_SHARE = 0.1;
/** Framed on its own, a range takes the price in unless that is farther off */
const MAX_FRAME_STRETCH = 5;
/** Room either side of a range framed on its own */
const FRAME_MARGIN = 0.2;

export type IStrataPosition = IPoolTickRange & { liquidity: bigint };

export type IStrataWindow = { fromTick: number; toTick: number };

/** One bar: average liquidity, the position's and everyone else's */
export type IStrataSlice = {
  tickLower: number;
  tickUpper: number;
  mine: number;
  rest: number;
};

export type IStrataPicture = {
  window: IStrataWindow;
  segments: ILiquiditySegment[];
  /** Left to right in the pair's display direction */
  slices: IStrataSlice[];
  /** Where the price is across the picture, 0 to 1; outside when off it */
  nowX: number;
};

function getSegments(pool: IPool, ticks: IPoolTickLiquidityNet[]) {
  return buildLiquiditySegments({
    ticks,
    currentTick: pool.currentTick ?? 0,
    activeLiquidity: BigInt(pool.activeLiquidity ?? '0'),
  });
}

function padWindow(
  fromTick: number,
  toTick: number,
  share: number,
  tickSpacing: number,
): IStrataWindow {
  const room = Math.max((toTick - fromTick) * share, 2 * tickSpacing);
  return {
    fromTick: Math.max(MIN_TICK, Math.round(fromTick - room)),
    toTick: Math.min(MAX_TICK, Math.round(toTick + room)),
  };
}

/**
 * What the picture shows: where the pool's liquidity piles up around the
 * price, with the range taken in, so the range is seen where it sits in the
 * whole. The pile's thin edges are left out. A range that would be a sliver
 * of that is framed on its own, with the price unless the price is far off;
 * a full range shows the pile, which it covers.
 */
export function getStrataWindow({
  pool,
  segments,
  range,
  bars,
}: {
  pool: IPool;
  segments: ILiquiditySegment[];
  range: IPoolTickRange;
  bars: number;
}): IStrataWindow {
  const current = pool.currentTick ?? 0;
  const tickSpacing = pool.tickSpacing ?? 60;
  const half = Math.max(
    getLiquidityPileHalfWidth(segments, current),
    tickSpacing * 4,
  );
  if (isFullRange({ ...range, tickSpacing })) {
    return padWindow(current - half, current + half, 0, tickSpacing);
  }
  const unionFrom = Math.min(current - half, range.tickLower);
  const unionTo = Math.max(current + half, range.tickUpper);
  const cut = bucketLiquidity({
    segments,
    fromTick: unionFrom,
    toTick: unionTo,
    bucketCount: Math.max(1, bars),
  });
  const peak = cut.reduce(
    (most, slice) => Math.max(most, Number(slice.liquidity)),
    0,
  );
  const thick = cut.filter(
    (slice) => peak > 0 && Number(slice.liquidity) >= peak * THIN_SHARE,
  );
  const from = Math.min(
    range.tickLower,
    current,
    thick[0]?.tickLower ?? range.tickLower,
  );
  const to = Math.max(
    range.tickUpper,
    current + 1,
    thick[thick.length - 1]?.tickUpper ?? range.tickUpper,
  );
  const width = range.tickUpper - range.tickLower;
  if (width >= (to - from) * MIN_RANGE_SHARE) {
    return padWindow(from, to, MARGIN, tickSpacing);
  }
  const framedFrom = Math.min(range.tickLower, current);
  const framedTo = Math.max(range.tickUpper, current + 1);
  if (framedTo - framedFrom <= width * MAX_FRAME_STRETCH) {
    return padWindow(framedFrom, framedTo, FRAME_MARGIN, tickSpacing);
  }
  return padWindow(range.tickLower, range.tickUpper, FRAME_MARGIN, tickSpacing);
}

/**
 * The window cut into `count` bars, each split into the position's
 * liquidity and the rest of the pool's. On chain the pool's liquidity counts
 * the position, so the rest is what is left, never below nothing.
 */
export function getStrataSlices({
  segments,
  position,
  window,
  count,
}: {
  segments: ILiquiditySegment[];
  position: IStrataPosition;
  window: IStrataWindow;
  count: number;
}): IStrataSlice[] {
  const cut = {
    fromTick: window.fromTick,
    toTick: window.toTick,
    bucketCount: count,
  };
  const whole = bucketLiquidity({ segments, ...cut });
  const own =
    position.liquidity > BigInt(0)
      ? bucketLiquidity({
          segments: [
            {
              tickLower: position.tickLower,
              tickUpper: position.tickUpper,
              liquidity: position.liquidity,
            },
          ],
          ...cut,
        })
      : [];
  return whole.map((slice, index) => {
    const pool = Number(slice.liquidity);
    const mine = Number(own[index]?.liquidity ?? 0);
    // In floats: a pool of this position alone leaves a rounding error
    const rest = pool - mine > pool * 1e-9 ? pool - mine : 0;
    return {
      tickLower: slice.tickLower,
      tickUpper: slice.tickUpper,
      mine,
      rest,
    };
  });
}

export function getStrataPicture({
  pool,
  ticks,
  position,
  count,
  flipped = false,
}: {
  pool: IPool;
  ticks: IPoolTickLiquidityNet[];
  position: IStrataPosition;
  count: number;
  /** Prices the other way round, as a flipped chart on the page shows them */
  flipped?: boolean;
}): IStrataPicture {
  const segments = getSegments(pool, ticks);
  const window = getStrataWindow({
    pool,
    segments,
    range: position,
    bars: count,
  });
  const slices = getStrataSlices({ segments, position, window, count });
  const inverted = getPoolPair(pool).inverted !== flipped;
  const x =
    ((pool.currentTick ?? 0) - window.fromTick) /
    (window.toTick - window.fromTick);
  return {
    window,
    segments,
    slices: inverted ? slices.toReversed() : slices,
    nowX: inverted ? 1 - x : x,
  };
}

/**
 * Bar heights in px: the rest of the pool at the foot, the position's piece
 * on top. The tallest bar fills `room`. Wherever the position holds anything
 * its piece is at least `least` tall, so the smallest position is still
 * seen; the pool's keeps to scale, a sliver of it a 1 px stub.
 */
export function getStrataBarHeights(
  slices: IStrataSlice[],
  { room, least }: { room: number; least: number },
) {
  const most = slices.reduce(
    (max, slice) => Math.max(max, slice.mine + slice.rest),
    0,
  );
  const scale = most > 0 ? Math.max(0, room - least) / most : 0;
  return slices.map((slice) => {
    const own = slice.mine > 0 ? Math.max(least, slice.mine * scale) : 0;
    const others =
      slice.rest > 0 ? Math.max(own > 0 ? 0 : 1, slice.rest * scale) : 0;
    return { own, others };
  });
}

/** A bar's prices, low to high, as the pair shows them */
export function getStrataSlicePrices(pool: IPool, slice: IStrataSlice) {
  const a = getTickDisplayPrice(pool, slice.tickLower).toNumber();
  const b = getTickDisplayPrice(pool, slice.tickUpper).toNumber();
  return { low: Math.min(a, b), high: Math.max(a, b) };
}

/**
 * What a bar holds at today's prices: the whole pool's liquidity there, and
 * the position's part of it.
 */
export function getStrataSliceValues({
  pool,
  segments,
  position,
  slice,
}: {
  pool: IPool;
  segments: ILiquiditySegment[];
  position: IStrataPosition;
  slice: IStrataSlice;
}) {
  const sqrtRatioX96 = BigInt(pool.sqrtPriceX96 ?? '0');
  const valueOf = (tickLower: number, tickUpper: number, liquidity: bigint) => {
    if (tickUpper <= tickLower || liquidity <= BigInt(0)) {
      return 0;
    }
    const amounts = getRangePositionAmounts({
      sqrtRatioX96,
      tickLower,
      tickUpper,
      decimals0: pool.token0.decimals,
      decimals1: pool.token1.decimals,
      liquidity,
    });
    return getAmountsValueUsd({
      amount0: amounts.amount0,
      amount1: amounts.amount1,
      price0Usd: pool.token0.priceUsd,
      price1Usd: pool.token1.priceUsd,
    }).toNumber();
  };
  let poolUsd = 0;
  for (const segment of segments) {
    poolUsd += valueOf(
      Math.max(segment.tickLower, slice.tickLower),
      Math.min(segment.tickUpper, slice.tickUpper),
      segment.liquidity,
    );
  }
  const mineUsd = valueOf(
    Math.max(position.tickLower, slice.tickLower),
    Math.min(position.tickUpper, slice.tickUpper),
    position.liquidity,
  );
  // A position read after the pool's ticks can outweigh them
  return { poolUsd: Math.max(poolUsd, mineUsd), mineUsd };
}

/** The window's two ends, as the pair shows them, left then right */
export function getStrataEdgePrices(pool: IPool, window: IStrataWindow) {
  const { inverted } = getPoolPair(pool);
  return {
    left: getTickDisplayPrice(pool, inverted ? window.toTick : window.fromTick),
    right: getTickDisplayPrice(
      pool,
      inverted ? window.fromTick : window.toTick,
    ),
  };
}
