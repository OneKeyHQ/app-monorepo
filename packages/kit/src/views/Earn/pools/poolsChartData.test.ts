import { buildMockCatalog } from '@onekeyhq/kit-bg/src/services/ServicePools/poolsMockBuilder';
import {
  getMaxUsableTick,
  getRangeAroundPrice,
} from '@onekeyhq/shared/src/utils/poolsMath';
import type { IPool } from '@onekeyhq/shared/types/pools';

import {
  getRangeShiftedByShownPrices,
  getRangeWithShownEdge,
  getShownRangeBounds,
} from './poolsChartData';

const NOW = 1_760_000_000_000;
const catalog = buildMockCatalog(NOW);

// Half a spacing of 10 ticks is about 0.05% of the price
const PRICE_TOLERANCE = 0.002;

function poolOf(seedKey: string): IPool {
  const pool = catalog.pools.find(
    (item) => item.id === catalog.poolIdBySeedKey[seedKey],
  );
  expect(pool).toBeDefined();
  return pool as IPool;
}

function rangeAround(pool: IPool, percent: number) {
  return getRangeAroundPrice({
    sqrtRatioX96: BigInt(pool.sqrtPriceX96 ?? '0'),
    percent,
    tickSpacing: pool.tickSpacing ?? 60,
    decimals0: pool.token0.decimals,
    decimals1: pool.token1.decimals,
  });
}

function expectNear(actual: number | undefined, expected: number) {
  expect(actual).toBeDefined();
  expect(Math.abs((actual as number) / expected - 1)).toBeLessThan(
    PRICE_TOLERANCE,
  );
}

// USDC / WETH shows USDC per WETH, the pool price turned over; the Base
// pool lists WETH first, so its shown price is the pool price
const POOL_KEYS = ['eth-v3-usdc-weth-500', 'base-v3-weth-usdc-500'];

describe('pools chart: dragging a range on the chart', () => {
  it.each(POOL_KEYS)('moves only the dragged edge (%s)', (key) => {
    const pool = poolOf(key);
    const range = rangeAround(pool, 0.1);
    const before = getShownRangeBounds({ pool, range, flipped: false });
    const target = (before.high as number) * 1.05;
    const next = getRangeWithShownEdge({
      pool,
      range,
      flipped: false,
      edge: 'high',
      price: target,
    });
    const after = getShownRangeBounds({ pool, range: next, flipped: false });
    expectNear(after.high, target);
    expect(after.low).toBe(before.low);
    const spacing = pool.tickSpacing ?? 60;
    // abs: a negative multiple leaves -0
    expect(Math.abs(next.tickLower % spacing)).toBe(0);
    expect(Math.abs(next.tickUpper % spacing)).toBe(0);
  });

  it.each(POOL_KEYS)('follows the chart when it is flipped (%s)', (key) => {
    const pool = poolOf(key);
    const range = rangeAround(pool, 0.1);
    const before = getShownRangeBounds({ pool, range, flipped: true });
    const target = (before.low as number) * 0.97;
    const next = getRangeWithShownEdge({
      pool,
      range,
      flipped: true,
      edge: 'low',
      price: target,
    });
    const after = getShownRangeBounds({ pool, range: next, flipped: true });
    expectNear(after.low, target);
    expect(after.high).toBe(before.high);
  });

  it('keeps a dragged edge a spacing clear of the other', () => {
    const pool = poolOf('eth-v3-usdc-weth-500');
    const range = rangeAround(pool, 0.1);
    const before = getShownRangeBounds({ pool, range, flipped: false });
    const next = getRangeWithShownEdge({
      pool,
      range,
      flipped: false,
      edge: 'low',
      price: (before.high as number) * 2,
    });
    expect(next.tickUpper - next.tickLower).toBe(pool.tickSpacing);
    const after = getShownRangeBounds({ pool, range: next, flipped: false });
    expect(after.low as number).toBeLessThan(after.high as number);
  });

  it.each(POOL_KEYS)('moves the band whole at the same width (%s)', (key) => {
    const pool = poolOf(key);
    const range = rangeAround(pool, 0.1);
    const before = getShownRangeBounds({ pool, range, flipped: false });
    const next = getRangeShiftedByShownPrices({
      pool,
      range,
      flipped: false,
      from: 2000,
      to: 2100,
    });
    expect(next.tickUpper - next.tickLower).toBe(
      range.tickUpper - range.tickLower,
    );
    const after = getShownRangeBounds({ pool, range: next, flipped: false });
    expectNear(after.low, (before.low as number) * 1.05);
    expectNear(after.high, (before.high as number) * 1.05);
  });

  it('stops a moved band at the last usable tick', () => {
    const pool = poolOf('base-v3-weth-usdc-500');
    const range = rangeAround(pool, 0.1);
    const next = getRangeShiftedByShownPrices({
      pool,
      range,
      flipped: false,
      from: 1e-30,
      to: 1e30,
    });
    expect(next.tickUpper).toBe(getMaxUsableTick(pool.tickSpacing ?? 60));
    expect(next.tickUpper - next.tickLower).toBe(
      range.tickUpper - range.tickLower,
    );
  });
});
