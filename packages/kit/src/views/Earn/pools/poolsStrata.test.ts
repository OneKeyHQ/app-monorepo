import { buildMockCatalog } from '@onekeyhq/kit-bg/src/services/ServicePools/poolsMockBuilder';
import {
  getFullRange,
  getRangeAroundPrice,
} from '@onekeyhq/shared/src/utils/poolsMath';
import type { IPool } from '@onekeyhq/shared/types/pools';

import {
  getStrataBarHeights,
  getStrataPicture,
  getStrataSlicePrices,
  getStrataSliceValues,
} from './poolsStrata';

import type { IStrataPosition } from './poolsStrata';

const NOW = 1_760_000_000_000;
const catalog = buildMockCatalog(NOW);
const BARS = 80;

function poolOf(seedKey: string): IPool {
  const pool = catalog.pools.find(
    (item) => item.id === catalog.poolIdBySeedKey[seedKey],
  );
  expect(pool).toBeDefined();
  return pool as IPool;
}

function positionAround(
  pool: IPool,
  percent: number,
  share = 0.001,
): IStrataPosition {
  const range = getRangeAroundPrice({
    sqrtRatioX96: BigInt(pool.sqrtPriceX96 ?? '0'),
    percent,
    tickSpacing: pool.tickSpacing ?? 60,
    decimals0: pool.token0.decimals,
    decimals1: pool.token1.decimals,
  });
  const liquidity = BigInt(
    Math.round(Number(pool.activeLiquidity ?? '0') * share),
  );
  return { ...range, liquidity };
}

function pictureOf(pool: IPool, position: IStrataPosition) {
  return getStrataPicture({
    pool,
    ticks: catalog.ticksByPoolId[pool.id] ?? [],
    position,
    count: BARS,
  });
}

// USDC / WETH reads inverted (USDC per WETH); the Base pool does not
const POOL_KEYS = ['eth-v3-usdc-weth-500', 'base-v3-weth-usdc-500'];

describe('pools strata: a position against its pool', () => {
  it.each(POOL_KEYS)('frames the range and the price (%s)', (key) => {
    const pool = poolOf(key);
    const position = positionAround(pool, 0.1);
    const { window, slices, nowX } = pictureOf(pool, position);
    expect(window.fromTick).toBeLessThan(position.tickLower);
    expect(window.toTick).toBeGreaterThan(position.tickUpper);
    expect(nowX).toBeGreaterThan(0);
    expect(nowX).toBeLessThan(1);
    expect(slices).toHaveLength(BARS);
    // Lowest shown price on the left, whichever way the pair reads
    const lows = slices.map((slice) => getStrataSlicePrices(pool, slice).low);
    expect(lows).toEqual(lows.toSorted((a, b) => a - b));
  });

  it.each(POOL_KEYS)('puts the piece only on the bars it spans (%s)', (key) => {
    const pool = poolOf(key);
    const position = positionAround(pool, 0.1);
    const { slices } = pictureOf(pool, position);
    for (const slice of slices) {
      const overlaps =
        slice.tickUpper > position.tickLower &&
        slice.tickLower < position.tickUpper;
      expect(slice.mine > 0).toBe(overlaps);
    }
    expect(slices.some((slice) => slice.rest > 0)).toBe(true);
  });

  it('keeps a narrow range wide enough to read', () => {
    const pool = poolOf('eth-v3-usdc-weth-500');
    const position = positionAround(pool, 0.005);
    const { slices } = pictureOf(pool, position);
    const spanned = slices.filter((slice) => slice.mine > 0).length;
    expect(spanned).toBeGreaterThanOrEqual(BARS * 0.1);
  });

  it('shows a range the price has left, with the price', () => {
    const pool = poolOf('eth-v3-usdc-weth-500');
    const spacing = pool.tickSpacing ?? 60;
    const current = pool.currentTick ?? 0;
    const tickLower = Math.ceil((current + 600) / spacing) * spacing;
    const position = {
      tickLower,
      tickUpper: tickLower + 40 * spacing,
      liquidity: BigInt(10) ** BigInt(15),
    };
    const { window, nowX } = pictureOf(pool, position);
    expect(window.fromTick).toBeLessThanOrEqual(current);
    expect(window.toTick).toBeGreaterThan(position.tickUpper);
    expect(nowX).toBeGreaterThanOrEqual(0);
    expect(nowX).toBeLessThanOrEqual(1);
  });

  it('covers every bar with a full range', () => {
    const pool = poolOf('eth-v3-usdc-weth-500');
    const position = {
      ...getFullRange(pool.tickSpacing ?? 60),
      liquidity: BigInt(10) ** BigInt(15),
    };
    const { slices } = pictureOf(pool, position);
    expect(slices.every((slice) => slice.mine > 0)).toBe(true);
  });
});

describe('pools strata: bar heights', () => {
  it('fills the room with the tallest bar and never loses a small piece', () => {
    const heights = getStrataBarHeights(
      [
        { tickLower: 0, tickUpper: 1, mine: 0, rest: 100 },
        { tickLower: 1, tickUpper: 2, mine: 0.001, rest: 50 },
        { tickLower: 2, tickUpper: 3, mine: 0, rest: 0.0001 },
      ],
      { room: 40, least: 3 },
    );
    expect(heights[0].own).toBe(0);
    expect(heights[0].others).toBeCloseTo(37);
    expect(heights[1].own).toBe(3);
    expect(heights[1].others).toBeCloseTo(18.5);
    // A sliver of the pool is still a stub
    expect(heights[2].others).toBe(1);
  });
});

describe('pools strata: what a bar holds', () => {
  it('values the pool and the position at the price', () => {
    const pool = poolOf('eth-v3-usdc-weth-500');
    const position = positionAround(pool, 0.1, 0.01);
    const { slices, segments } = pictureOf(pool, position);
    const inside = slices.filter((slice) => slice.mine > 0);
    const outside = slices.find((slice) => slice.mine === 0);
    expect(inside.length).toBeGreaterThan(0);
    for (const slice of inside) {
      const { poolUsd, mineUsd } = getStrataSliceValues({
        pool,
        segments,
        position,
        slice,
      });
      expect(mineUsd).toBeGreaterThan(0);
      expect(poolUsd).toBeGreaterThanOrEqual(mineUsd);
    }
    expect(outside).toBeDefined();
    if (outside) {
      expect(
        getStrataSliceValues({ pool, segments, position, slice: outside })
          .mineUsd,
      ).toBe(0);
    }
  });
});
