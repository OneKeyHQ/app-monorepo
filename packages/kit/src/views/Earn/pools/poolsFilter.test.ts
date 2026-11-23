import { queryPools } from '@onekeyhq/kit-bg/src/services/ServicePools/poolsDemoEngine';
import { buildMockCatalog } from '@onekeyhq/kit-bg/src/services/ServicePools/poolsMockBuilder';
import type { IPoolListItem } from '@onekeyhq/shared/types/pools';

import {
  EMPTY_POOLS_FILTER,
  NEW_POOL_MAX_AGE_DAYS,
  TRENDING_MIN_VOLUME_GROWTH,
  TRENDING_MIN_VOLUME_USD,
  countPanelFilters,
  filterPools,
  getPoolPairType,
  getPoolsOptionCounts,
  isPoolInCategory,
} from './poolsFilter';

import type { IPoolsFilter } from './poolsFilter';

const NOW = 1_760_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const catalog = buildMockCatalog(NOW);
const pools = queryPools(catalog);

function poolOf(seedKey: string): IPoolListItem {
  const pool = pools.find(
    (item) => item.id === catalog.poolIdBySeedKey[seedKey],
  );
  expect(pool).toBeDefined();
  return pool as IPoolListItem;
}

function filtered(filter: Partial<IPoolsFilter>) {
  return filterPools({
    pools,
    filter: { ...EMPTY_POOLS_FILTER, ...filter },
    networkIds: [],
    search: '',
    now: NOW,
  });
}

describe('pool types', () => {
  it('gives each pool one type from its two tokens', () => {
    expect(getPoolPairType(poolOf('rh-v3-tsla-usdg-3000'))).toBe('rwa');
    expect(getPoolPairType(poolOf('eth-v3-usdc-usdt-100'))).toBe('stablecoins');
    expect(getPoolPairType(poolOf('eth-v3-usdc-weth-500'))).toBe('bluechips');
    expect(getPoolPairType(poolOf('eth-v3-wbtc-weth-500'))).toBe('bluechips');
    expect(getPoolPairType(poolOf('arb-v3-arb-weth-3000'))).toBe('altcoins');
    expect(getPoolPairType(poolOf('eth-v3-pepe-weth-3000'))).toBe('altcoins');
  });

  it('covers every listed pool', () => {
    const counts = getPoolsOptionCounts({
      pools,
      filter: EMPTY_POOLS_FILTER,
      now: NOW,
    }).category;
    expect(
      counts.rwa + counts.stablecoins + counts.bluechips + counts.altcoins,
    ).toBe(pools.length);
    expect(counts).toMatchObject({
      rwa: 7,
      stablecoins: 3,
      bluechips: 17,
      // PEPE's two pools, LINK, ARB and the token with no trusted price
      altcoins: 5,
    });
  });

  it('counts pools created within 14 days as new', () => {
    const young = filtered({ category: 'new' }).map((pool) => pool.id);
    expect(young.toSorted()).toEqual(
      [
        'rh-v3-amzn-usdg-3000',
        'rh-v3-msft-usdg-3000',
        'base-v4-eth-usdc-hook-rebate',
        'eth-v3-xmoon-weth-500',
      ]
        .map((key) => catalog.poolIdBySeedKey[key])
        .toSorted(),
    );
    for (const pool of pools) {
      expect(isPoolInCategory(pool, 'new', { period: '1D', now: NOW })).toBe(
        NOW - pool.createdAt <= NEW_POOL_MAX_AGE_DAYS * DAY_MS,
      );
    }
  });

  it('counts a pool as trending on enough volume that is growing', () => {
    for (const period of ['1D', '1W', '1M'] as const) {
      const trending = new Set(
        filterPools({
          pools,
          filter: { ...EMPTY_POOLS_FILTER, category: 'trending' },
          networkIds: [],
          search: '',
          period,
          now: NOW,
        }).map((pool) => pool.id),
      );
      expect(trending.size).toBeGreaterThan(0);
      for (const pool of pools) {
        const stats = pool.windows[period];
        expect(trending.has(pool.id)).toBe(
          Number(stats.volumeUsd) >= TRENDING_MIN_VOLUME_USD &&
            Number(stats.volumeChange ?? 0) >= TRENDING_MIN_VOLUME_GROWTH,
        );
      }
    }
  });
});

describe('protocol and fee filters', () => {
  it('filters by protocol and version together', () => {
    const v2 = filtered({ protocols: ['uniswap-v2'] });
    expect(v2.length).toBe(3);
    expect(v2.every((pool) => pool.version === 'v2')).toBe(true);
  });

  it('finds dynamic-fee pools by their own option, not by a tier', () => {
    const dynamic = filtered({ feeTiers: ['dynamic'] });
    expect(dynamic.length).toBe(2);
    expect(dynamic.every((pool) => pool.isDynamicFee)).toBe(true);
    expect(
      filtered({ feeTiers: [500] }).some((pool) => pool.isDynamicFee),
    ).toBe(false);
  });

  it('counts what each option would leave, the other picks as they are', () => {
    const counts = getPoolsOptionCounts({
      pools,
      filter: { ...EMPTY_POOLS_FILTER, protocols: ['uniswap-v2'] },
      now: NOW,
    });
    // Every V2 pool is 0.3%
    expect(counts.feeTiers).toEqual({
      '100': 0,
      '500': 0,
      '3000': 3,
      '10000': 0,
      dynamic: 0,
    });
    expect(counts.category).toMatchObject({
      rwa: 1,
      stablecoins: 0,
      bluechips: 2,
      altcoins: 0,
    });
    // A group's own picks don't narrow its counts
    expect(counts.protocols['uniswap-v4']).toBe(
      filtered({ protocols: ['uniswap-v4'] }).length,
    );
  });

  it('counts the type on the Filters button only where the button holds it', () => {
    const filter: IPoolsFilter = {
      category: 'rwa',
      protocols: ['uniswap-v3'],
      feeTiers: [3000, 'dynamic'],
    };
    expect(countPanelFilters(filter, { withCategory: false })).toBe(3);
    expect(countPanelFilters(filter, { withCategory: true })).toBe(4);
  });
});
