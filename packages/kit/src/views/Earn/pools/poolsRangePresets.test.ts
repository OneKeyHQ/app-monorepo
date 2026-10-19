import { buildMockCatalog } from '@onekeyhq/kit-bg/src/services/ServicePools/poolsMockBuilder';
import {
  getDisplayRange,
  getFullRange,
} from '@onekeyhq/shared/src/utils/poolsMath';
import type { IPool } from '@onekeyhq/shared/types/pools';

import { getPoolDisplayPrice, getPoolPair } from './poolsFormat';
import {
  formatExpectedStay,
  formatPresetWidth,
  getDailyVolatility,
  getExpectedDaysInRange,
  getPresetRange,
  getRangePresets,
} from './poolsRangePresets';

const NOW = 1_760_000_000_000;
const catalog = buildMockCatalog(NOW);

function poolOf(seedKey: string): IPool {
  const pool = catalog.pools.find(
    (item) => item.id === catalog.poolIdBySeedKey[seedKey],
  );
  expect(pool).toBeDefined();
  return pool as IPool;
}

function historyOf(pool: IPool) {
  return catalog.priceHistoryByPoolId[pool.id] ?? [];
}

// USDC / WETH shows USDC per WETH, the pool price turned over; the Base
// pool lists WETH first, so its shown price is the pool price
const POOL_KEYS = ['eth-v3-usdc-weth-500', 'base-v3-weth-usdc-500'];

describe('pools range presets', () => {
  it('falls back to fixed widths without price history', () => {
    const pool = poolOf('eth-v3-usdc-weth-500');
    const presets = getRangePresets(pool);
    expect(presets.map((preset) => preset.id)).toEqual([
      'narrow',
      'balanced',
      'wide',
      'full',
    ]);
    expect(presets.map((preset) => preset.percent)).toEqual([0.1, 0.2, 0.5, 1]);
    expect(formatPresetWidth(presets[0])).toBe('±10%');
  });

  it.each(POOL_KEYS)(
    'sizes each preset to the pair’s daily moves (%s)',
    (key) => {
      const pool = poolOf(key);
      const history = historyOf(pool);
      expect(history.length).toBe(30);
      const volatility = getDailyVolatility(history) as number;
      expect(volatility).toBeGreaterThan(0);
      const presets = getRangePresets(pool, history);
      const [narrow, balanced, wide, full] = presets;
      expect(narrow.percent).toBeLessThan(balanced.percent);
      expect(balanced.percent).toBeLessThan(wide.percent);
      expect(full.percent).toBe(1);
      // ±σ√T, kept to two significant digits
      [
        [narrow, 7],
        [balanced, 30],
        [wide, 90],
      ].forEach(([preset, days]) => {
        const target = volatility * Math.sqrt(days as number);
        expect(
          Math.abs((preset as { percent: number }).percent / target - 1),
        ).toBeLessThan(0.05);
      });
    },
  );

  it.each(POOL_KEYS)(
    'expects each preset to last about its days (%s)',
    (key) => {
      const pool = poolOf(key);
      const history = historyOf(pool);
      const volatility = getDailyVolatility(history) as number;
      const [narrow, balanced, wide, full] = getRangePresets(pool, history);
      const expected = (percent: number) =>
        getExpectedDaysInRange(pool, getPresetRange(pool, percent), volatility);
      expect(Math.abs(expected(narrow.percent) / 7 - 1)).toBeLessThan(0.2);
      expect(Math.abs(expected(balanced.percent) / 30 - 1)).toBeLessThan(0.2);
      expect(Math.abs(expected(wide.percent) / 90 - 1)).toBeLessThan(0.2);
      expect(expected(full.percent)).toBe(Number.POSITIVE_INFINITY);
      expect(formatExpectedStay(expected(narrow.percent))).toBe('~1 week');
      expect(formatExpectedStay(expected(balanced.percent))).toBe('~1 month');
      expect(formatExpectedStay(expected(wide.percent))).toBe('~3 months');
    },
  );

  it('says how long a range lasts in round words', () => {
    expect(formatExpectedStay(1)).toBe('~1 day');
    expect(formatExpectedStay(3.2)).toBe('~3 days');
    expect(formatExpectedStay(14)).toBe('~2 weeks');
    expect(formatExpectedStay(61)).toBe('~2 months');
    expect(formatExpectedStay(500)).toBe('Over a year');
    expect(formatExpectedStay(Number.POSITIVE_INFINITY)).toBe('Always');
  });

  it('expects 0 days when the price is already outside', () => {
    const pool = poolOf('eth-v3-usdc-weth-500');
    const range = getPresetRange(pool, 0.1);
    const above = {
      tickLower: range.tickUpper + 600,
      tickUpper: range.tickUpper + 1200,
    };
    expect(getExpectedDaysInRange(pool, above, 0.03)).toBe(0);
  });

  it.each(POOL_KEYS)(
    'puts the same share below and above the price shown (%s)',
    (key) => {
      const pool = poolOf(key);
      const range = getPresetRange(pool, 0.1);
      const shown = getDisplayRange({
        ...range,
        tickSpacing: pool.tickSpacing ?? 60,
        decimals0: pool.token0.decimals,
        decimals1: pool.token1.decimals,
        inverted: getPoolPair(pool).inverted,
      });
      const now = getPoolDisplayPrice(pool);
      // A tick spacing of 10 moves a bound by about 0.1%
      expect(shown.min.div(now).minus(0.9).abs().toNumber()).toBeLessThan(
        0.002,
      );
      expect(shown.max.div(now).minus(1.1).abs().toNumber()).toBeLessThan(
        0.002,
      );
    },
  );

  it('takes the full range for full', () => {
    const pool = poolOf('base-v3-weth-usdc-500');
    expect(getPresetRange(pool, 1)).toEqual(
      getFullRange(pool.tickSpacing ?? 60),
    );
  });
});
