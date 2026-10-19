import { buildMockCatalog } from '@onekeyhq/kit-bg/src/services/ServicePools/poolsMockBuilder';
import {
  getMaxUsableTick,
  getMinUsableTick,
  getRangeAroundPrice,
} from '@onekeyhq/shared/src/utils/poolsMath';
import type { IPool } from '@onekeyhq/shared/types/pools';

import { countDaysInRange, getVersusHolding } from './poolsOutcome';

const NOW = 1_760_000_000_000;
const catalog = buildMockCatalog(NOW);

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

function fullRange(pool: IPool) {
  const tickSpacing = pool.tickSpacing ?? 60;
  return {
    tickLower: getMinUsableTick(tickSpacing),
    tickUpper: getMaxUsableTick(tickSpacing),
  };
}

// A share pool against holding after a 20% drop: 2√0.8 / 1.8 − 1
const SHARE_POOL_DOWN_20 = (2 * Math.sqrt(0.8)) / 1.8 - 1;

describe('pools outcome: versus holding', () => {
  it('uses the constant-product formula for a share pool', () => {
    const { move, fraction } = getVersusHolding(poolOf('rh-v2-tsla-usdg'));
    expect(move).toBe(0.2);
    expect(fraction).toBeCloseTo(SHARE_POOL_DOWN_20, 10);
  });

  it('gives a full-range position the share pool result', () => {
    const pool = poolOf('rh-v3-tsla-usdg-3000');
    const { fraction } = getVersusHolding(pool, fullRange(pool));
    expect(fraction).toBeCloseTo(SHARE_POOL_DOWN_20, 4);
  });

  it('loses more against holding as the range narrows', () => {
    const pool = poolOf('rh-v3-tsla-usdg-3000');
    const narrow = getVersusHolding(pool, rangeAround(pool, 0.1)).fraction;
    const wide = getVersusHolding(pool, rangeAround(pool, 0.5)).fraction;
    const full = getVersusHolding(pool, fullRange(pool)).fraction;
    expect(narrow).toBeLessThan(wide);
    expect(wide).toBeLessThan(full);
    expect(full).toBeLessThan(0);
  });
});

describe('pools outcome: days in range', () => {
  it('counts every daily close inside a full range', () => {
    const pool = poolOf('rh-v3-tsla-usdg-3000');
    const history = catalog.priceHistoryByPoolId[pool.id];
    expect(countDaysInRange(pool, fullRange(pool), history)).toEqual({
      inRange: 30,
      total: 30,
    });
  });

  it('counts none for a range far above the price', () => {
    const pool = poolOf('rh-v3-tsla-usdg-3000');
    const tickSpacing = pool.tickSpacing ?? 60;
    const currentTick = pool.currentTick ?? 0;
    const history = catalog.priceHistoryByPoolId[pool.id];
    const farAbove = {
      tickLower: currentTick + 100 * tickSpacing,
      tickUpper: currentTick + 200 * tickSpacing,
    };
    expect(countDaysInRange(pool, farAbove, history).inRange).toBe(0);
  });
});
