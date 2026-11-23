import BigNumber from 'bignumber.js';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  getAmountsValueUsd,
  isPoolPriceInverted,
  tickToPrice,
} from '@onekeyhq/shared/src/utils/poolsMath';
import {
  EPoolPositionStatus,
  EPoolTaskKind,
  EPoolTaskStatus,
  EPoolTaskStepKind,
  EPoolTaskStepStatus,
} from '@onekeyhq/shared/types/pools';
import type { IPoolTask } from '@onekeyhq/shared/types/pools';

import {
  buildPortfolio,
  buildPositionView,
  createInitialDemoState,
  createTask,
  findPoolsByKey,
  getFavoritePoolIds,
  getNextStep,
  getPoolDetail,
  getPoolPriceHistory,
  getPoolTopPositions,
  isUnfinishedTask,
  planZapIn,
  previewRemove,
  queryPools,
  quoteSwap,
  setPoolFavorite,
  settleTaskStep,
  submitTaskStep,
} from './poolsDemoEngine';
import { getTrackedTvlUsd, isBelowPoolListFloors } from './poolsListing';
import { buildMockCatalog } from './poolsMockBuilder';
import {
  POOLS_POOL_SEEDS,
  POOLS_POSITION_SEEDS,
  POOLS_ROBINHOOD_NETWORK_ID,
} from './poolsMockData';

import type { IPoolsMockCatalog } from './poolsMockBuilder';
import type { IPoolsDemoDBStruct } from '../../dbs/simple/entity/SimpleDbEntityPoolsDemo';

const NOW = 1_760_000_000_000;

function relativeError(actual: BigNumber.Value, expected: BigNumber.Value) {
  return new BigNumber(actual).minus(expected).abs().div(expected).toNumber();
}

function poolBySeed(catalog: IPoolsMockCatalog, key: string) {
  const pool = catalog.pools.find(
    (item) => item.id === catalog.poolIdBySeedKey[key],
  );
  if (!pool) {
    throw new OneKeyLocalError(key);
  }
  return pool;
}

function assetBySymbol(
  catalog: IPoolsMockCatalog,
  networkId: string,
  symbol: string,
) {
  const asset = catalog.assets.find(
    (item) => item.networkId === networkId && item.symbol === symbol,
  );
  if (!asset) {
    throw new OneKeyLocalError(symbol);
  }
  return asset;
}

function runAll(
  catalog: IPoolsMockCatalog,
  state: IPoolsDemoDBStruct,
  task: IPoolTask,
) {
  // Continuing a stopped task re-sends its failed step, like the page does
  let current = task;
  do {
    submitTaskStep(state, current.id, NOW);
    current = settleTaskStep(catalog, state, current.id, NOW);
  } while (getNextStep(current) && current.status !== EPoolTaskStatus.Stopped);
  return current;
}

describe('pools demo catalog', () => {
  const catalog = buildMockCatalog(NOW);

  it('builds books whose reserves add up to the stated TVL', () => {
    for (const pool of catalog.pools) {
      const value = getAmountsValueUsd({
        amount0: pool.reserve0,
        amount1: pool.reserve1,
        price0Usd: pool.token0.priceUsd,
        price1Usd: pool.token1.priceUsd,
      });
      expect(relativeError(value, pool.tvlUsd)).toBeLessThan(0.02);
    }
  });

  it('puts the current tick at the USD price ratio', () => {
    for (const pool of catalog.pools.filter((item) => item.tickSpacing)) {
      const price = tickToPrice({
        tick: pool.currentTick ?? 0,
        decimals0: pool.token0.decimals,
        decimals1: pool.token1.decimals,
      });
      const expected = new BigNumber(pool.token0.priceUsd).div(
        pool.token1.priceUsd,
      );
      expect(relativeError(price, expected)).toBeLessThan(0.0002);
      expect(BigInt(pool.activeLiquidity ?? '0') > BigInt(0)).toBe(true);
    }
  });

  it('orders tokens like the contracts and quotes in a stablecoin', () => {
    const aapl = poolBySeed(catalog, 'rh-v4-aapl-usdg-3000');
    expect(aapl.token0.symbol).toBe('USDG');
    expect(isPoolPriceInverted(aapl)).toBe(true);
    const tsla = poolBySeed(catalog, 'rh-v3-tsla-usdg-3000');
    expect(tsla.token0.symbol).toBe('TSLA');
    expect(isPoolPriceInverted(tsla)).toBe(false);
    const nativePool = poolBySeed(catalog, 'eth-v4-eth-usdc-500');
    expect(nativePool.token0.isNative).toBe(true);
  });

  it('seeds positions at the planned values and states', () => {
    const state = createInitialDemoState(catalog, NOW);
    const views = state.positions.map((position) =>
      buildPositionView(
        catalog.pools.find((pool) => pool.id === position.poolId) ??
          catalog.pools[0],
        position,
      ),
    );
    POOLS_POSITION_SEEDS.forEach((seed, index) => {
      const view = views[index];
      if (seed.valueUsd > 0) {
        expect(relativeError(view.valueUsd, seed.valueUsd)).toBeLessThan(0.005);
      } else {
        expect(view.status).toBe(EPoolPositionStatus.Closed);
      }
    });
    const tsla = views[1];
    expect(tsla.status).toBe(EPoolPositionStatus.OutOfRange);
    expect(tsla.outOfRangeSide).toBe('above');
    expect(Number(tsla.amount0)).toBe(0);
    expect(views[0].status).toBe(EPoolPositionStatus.Active);
    expect(views[4].pool.version).toBe('v2');
    expect(views[5].pool.isOffList).toBe(true);
  });
});

describe('pools demo queries', () => {
  const catalog = buildMockCatalog(NOW);

  it('lists every pool over the floors, sorted by TVL', () => {
    const list = queryPools(catalog);
    expect(list.length).toBe(POOLS_POOL_SEEDS.length - 1);
    expect(list.every((pool) => !pool.isOffList)).toBe(true);
    expect(
      list.every(
        (pool) =>
          !isBelowPoolListFloors({
            tvlUsd: Number(pool.tvlUsd),
            volume24hUsd: Number(pool.volume24hUsd),
            fees24hUsd: Number(pool.fees24hUsd),
          }),
      ),
    ).toBe(true);
    const tvlValues = list.map((pool) => Number(pool.tvlUsd));
    expect(tvlValues).toEqual(tvlValues.toSorted((a, b) => b - a));
  });

  it('filters by network, category and pair search', () => {
    const robinhood = queryPools(catalog, {
      networkIds: [POOLS_ROBINHOOD_NETWORK_ID],
      category: 'stock',
    });
    expect(robinhood.length).toBe(7);
    const tsla = queryPools(catalog, { search: 'tsla/usdg' });
    expect(tsla.map((pool) => pool.version).toSorted()).toEqual(['v2', 'v3']);
    // No hand-kept list: both PEPE pools trade enough, so both show
    expect(
      queryPools(catalog, { search: 'pepe' }).map((pool) => pool.feeTier),
    ).toEqual([3000, 10_000]);
    // The LINK pool under the volume floor stays out of a symbol search
    expect(
      queryPools(catalog, { search: 'link' }).map((pool) => pool.feeTier),
    ).toEqual([3000]);
  });

  it('counts TVL only at trusted prices, so a claimed value cannot rank', () => {
    const sides = { value0Usd: 3_427_994_800, value1Usd: 5200 };
    expect(getTrackedTvlUsd({ ...sides, trusted0: true, trusted1: true })).toBe(
      3_428_000_000,
    );
    // Twice the trusted side, whichever it is
    expect(
      getTrackedTvlUsd({ ...sides, trusted0: false, trusted1: true }),
    ).toBe(10_400);
    expect(
      getTrackedTvlUsd({ ...sides, trusted0: true, trusted1: false }),
    ).toBe(6_855_989_600);
    expect(
      getTrackedTvlUsd({ ...sides, trusted0: false, trusted1: false }),
    ).toBe(0);

    // The seeded pool: $3.4B by its own price, last in the list by TVL
    const seed = POOLS_POOL_SEEDS.find(
      (item) => item.key === 'eth-v3-xmoon-weth-500',
    );
    expect(seed?.tvlUsd).toBe(3_428_000_000);
    const list = queryPools(catalog);
    const last = list[list.length - 1];
    expect(last.id).toBe(poolBySeed(catalog, 'eth-v3-xmoon-weth-500').id);
    expect(Number(last.tvlUsd)).toBe(10_400);
    expect(last.isOffList).toBe(false);
  });

  it('holds a pool to the floors by its trading alone', () => {
    const busy = { tvlUsd: 1_000_000, volume24hUsd: 5000, fees24hUsd: 15 };
    expect(isBelowPoolListFloors(busy)).toBe(false);
    expect(isBelowPoolListFloors({ ...busy, volume24hUsd: 99 })).toBe(true);
    // Fees under 0.001% of TVL
    expect(isBelowPoolListFloors({ ...busy, fees24hUsd: 9 })).toBe(true);
    expect(isBelowPoolListFloors({ ...busy, tvlUsd: 0 })).toBe(true);
  });

  it('finds a pool by its address, one under the floors only that way', () => {
    const quiet = poolBySeed(catalog, 'eth-v3-link-weth-10000');
    expect(quiet.isOffList).toBe(true);
    expect(queryPools(catalog, { search: quiet.poolKey })).toEqual([]);
    expect(
      findPoolsByKey(catalog, quiet.poolKey.toUpperCase()).map(
        (pool) => pool.id,
      ),
    ).toEqual([quiet.id]);
    const stable = poolBySeed(catalog, 'eth-v3-usdc-usdt-100');
    expect(
      queryPools(catalog, { search: stable.poolKey }).map((pool) => pool.id),
    ).toEqual([stable.id]);
  });

  it('computes the pool fee APR from 24h fees', () => {
    const [pool] = queryPools(catalog, { search: 'usdt' });
    expect(Number(pool.feeApr)).toBeCloseTo(
      (Number(pool.fees24hUsd) * 365) / Number(pool.tvlUsd),
      10,
    );
  });
});

describe('pools demo swaps and zaps', () => {
  const catalog = buildMockCatalog(NOW);
  const usdg = assetBySymbol(catalog, POOLS_ROBINHOOD_NETWORK_ID, 'USDG');
  const tsla = assetBySymbol(catalog, POOLS_ROBINHOOD_NETWORK_ID, 'TSLA');

  it('quotes swaps with a fee and a size-based impact', () => {
    const small = quoteSwap(catalog, {
      fromAssetId: usdg.id,
      toAssetId: tsla.id,
      amountIn: '100',
    });
    const large = quoteSwap(catalog, {
      fromAssetId: usdg.id,
      toAssetId: tsla.id,
      amountIn: '100000',
    });
    expect(Number(small.rate)).toBeLessThan(1 / Number(tsla.priceUsd));
    expect(Number(large.rate)).toBeLessThan(Number(small.rate));
    expect(Number(large.priceImpact)).toBeGreaterThan(0.03);
  });

  it('splits a Zap so almost nothing is left over', async () => {
    const pool = poolBySeed(catalog, 'rh-v3-tsla-usdg-3000');
    const tick = pool.currentTick ?? 0;
    const plan = await planZapIn(catalog, {
      poolId: pool.id,
      inputAssetId: usdg.id,
      amountIn: '1000',
      tickLower: Math.floor(tick / 60) * 60 - 1200,
      tickUpper: Math.floor(tick / 60) * 60 + 1200,
    });
    const leftoverUsd = getAmountsValueUsd({
      amount0: plan.leftover0,
      amount1: plan.leftover1,
      price0Usd: pool.token0.priceUsd,
      price1Usd: pool.token1.priceUsd,
    });
    expect(leftoverUsd.toNumber()).toBeLessThan(1);
    expect(
      Number(plan.depositUsd) + Number(plan.costUsd) + leftoverUsd.toNumber(),
    ).toBeCloseTo(1000, 0);
    // USDG is a pool token, so only the TSLA half is swapped
    expect(plan.legs.filter((leg) => leg.quote)).toHaveLength(1);
  });
});

describe('pools demo price history', () => {
  const catalog = buildMockCatalog(NOW);
  const pool = poolBySeed(catalog, 'rh-v3-tsla-usdg-3000');

  it('cuts every range from one walk that ends at the pool price', () => {
    const counts = (['1D', '1W', '1M', '1Y'] as const).map((range) => {
      const points = getPoolPriceHistory(catalog, pool.id, range);
      const times = points.map((point) => point.time);
      expect(times).toEqual(times.toSorted((a, b) => a - b));
      expect(times[times.length - 1]).toBe(NOW);
      return points.length;
    });
    // 15 minutes over a day, hourly over a week, 4h over a month, daily over a year
    expect(counts).toEqual([97, 169, 181, 366]);
    const last = getPoolPriceHistory(catalog, pool.id, '1D').at(-1);
    expect(relativeError(last?.price ?? 0, 357.4)).toBeLessThan(0.001);
  });

  it('agrees across ranges where they overlap', () => {
    const day = getPoolPriceHistory(catalog, pool.id, '1D');
    const week = getPoolPriceHistory(catalog, pool.id, '1W');
    const priceOf = ({ time, price }: { time: number; price: string }) => ({
      time,
      price,
    });
    const hourlyFromDay = day.filter((_, index) => index % 4 === 0);
    expect(week.slice(-hourlyFromDay.length).map(priceOf)).toEqual(
      hourlyFromDay.map(priceOf),
    );
    expect(catalog.priceHistoryByPoolId[pool.id]).toHaveLength(30);
  });

  it('sums volume into each bucket, the last day matching the 24h figure', () => {
    const day = getPoolPriceHistory(catalog, pool.id, '1D');
    const week = getPoolPriceHistory(catalog, pool.id, '1W');
    // An hourly bucket holds the four 15-minute buckets before it
    const lastHour = day
      .slice(-4)
      .reduce((sum, point) => sum + Number(point.volumeUsd), 0);
    expect(Number(week.at(-1)?.volumeUsd)).toBeCloseTo(lastHour, 1);
    const lastDay = day
      .slice(1)
      .reduce((sum, point) => sum + Number(point.volumeUsd), 0);
    expect(relativeError(lastDay, pool.volume24hUsd)).toBeLessThan(0.01);
  });
});

describe('pools demo list windows', () => {
  const catalog = buildMockCatalog(NOW);

  it('states each window, the day matching the pool figures', () => {
    for (const item of queryPools(catalog)) {
      expect(item.windows['1D'].volumeUsd).toBe(
        Number(item.volume24hUsd).toFixed(2),
      );
      expect(
        relativeError(item.windows['1D'].feesUsd, item.fees24hUsd),
      ).toBeLessThan(0.001);
      const week = item.windows['1W'];
      // A week trades more than a day; its APR stays in the same ballpark
      expect(Number(week.volumeUsd)).toBeGreaterThan(Number(item.volume24hUsd));
      expect(Number(week.apr)).toBeGreaterThan(Number(item.feeApr) / 4);
      expect(Number(week.apr)).toBeLessThan(Number(item.feeApr) * 4);
      expect(item.createdAt).toBeLessThan(NOW);
    }
  });
});

describe('pools demo top positions', () => {
  const catalog = buildMockCatalog(NOW);
  const pool = poolBySeed(catalog, 'eth-v3-usdc-weth-500');

  it('ranks open ranges above the value floor by what they earned', () => {
    const page = getPoolTopPositions(catalog, pool.id, { limit: 10 });
    expect(page.items).toHaveLength(10);
    expect(page.total).toBeGreaterThan(10);
    const aprValues = page.items.map((item) => Number(item.apr));
    expect(aprValues).toEqual(aprValues.toSorted((a, b) => b - a));
    for (const item of page.items) {
      expect(Number(item.valueUsd)).toBeGreaterThanOrEqual(
        Number(page.minValueUsd),
      );
      expect(item.tickLower).toBeLessThan(item.tickUpper);
      expect(
        item.inRange ===
          (item.tickLower <= (pool.currentTick ?? 0) &&
            (pool.currentTick ?? 0) < item.tickUpper),
      ).toBe(true);
    }
    // The next page continues where this one ends
    const next = getPoolTopPositions(catalog, pool.id, {
      offset: 10,
      limit: 5,
    });
    expect(Number(next.items[0].apr)).toBeLessThanOrEqual(aprValues[9]);
  });

  it('ranks by value or by fees earned on request, across pages', () => {
    const all = getPoolTopPositions(catalog, pool.id, { limit: 1000 });
    for (const [sortBy, field] of [
      ['value', 'valueUsd'],
      ['earned', 'feesEarnedUsd'],
    ] as const) {
      const page = getPoolTopPositions(catalog, pool.id, {
        limit: 5,
        sortBy,
      });
      const highest = Math.max(...all.items.map((item) => Number(item[field])));
      expect(Number(page.items[0][field])).toBe(highest);
      const values = page.items.map((item) => Number(item[field]));
      expect(values).toEqual(values.toSorted((a, b) => b - a));
      expect(page.total).toBe(all.total);
    }
  });

  it('has none for a pool without ranges', () => {
    const v2 = poolBySeed(catalog, 'eth-v2-usdc-weth');
    expect(getPoolTopPositions(catalog, v2.id).total).toBe(0);
  });
});

describe('pools demo pool detail', () => {
  const catalog = buildMockCatalog(NOW);
  const auditorsOf = (key: string) =>
    getPoolDetail(
      catalog,
      poolBySeed(catalog, key).id,
    ).protocolInfo?.items?.[0]?.audits?.items?.map((audit) => audit.title);

  it('introduces the DEX with the audits of the pool’s version', () => {
    expect(auditorsOf('eth-v2-usdc-weth')).toEqual(['dapp.org']);
    expect(auditorsOf('eth-v3-usdc-weth-500')).toEqual([
      'Trail of Bits',
      'ABDK',
      'ABDK',
    ]);
    // Nine audits by six firms, as Uniswap's v4 security post counts them
    const v4 = auditorsOf('eth-v4-eth-usdc-500') ?? [];
    expect(v4).toHaveLength(9);
    expect(new Set(v4).size).toBe(6);
  });
});

describe('pools demo favorites', () => {
  it('stars and unstars pools and keeps them across a reset', () => {
    const catalog = buildMockCatalog(NOW);
    const state = createInitialDemoState(catalog, NOW);
    const [first, second] = catalog.pools;
    setPoolFavorite(state, first.id, true);
    setPoolFavorite(state, second.id, true);
    setPoolFavorite(state, first.id, false);
    expect(getFavoritePoolIds(state)).toEqual([second.id]);
    const reset = createInitialDemoState(
      catalog,
      NOW,
      getFavoritePoolIds(state),
    );
    expect(getFavoritePoolIds(reset)).toEqual([second.id]);
  });
});

describe('pools demo positions', () => {
  it('rates what each open position earns now, nothing out of range', () => {
    const catalog = buildMockCatalog(NOW);
    const state = createInitialDemoState(catalog, NOW);
    const views = buildPortfolio(catalog, state).positions;
    const byId = (id: string) => views.find((view) => view.position.id === id);

    const earning = byId('evm--1:uniswap:v3:1042871');
    expect(earning?.status).toBe(EPoolPositionStatus.Active);
    // The view's 24h fees are rounded to cents; the rate is not
    expect(Number(earning?.currentApr)).toBeCloseTo(
      (Number(earning?.fees24hUsd) * 365) / Number(earning?.valueUsd),
      3,
    );
    expect(Number(earning?.currentApr)).toBeGreaterThan(0);

    const outside = byId('evm--4663:uniswap:v3:20915');
    expect(outside?.status).toBe(EPoolPositionStatus.OutOfRange);
    expect(outside?.currentApr).toBe('0');

    const closed = byId('evm--1:uniswap:v3:1019255');
    expect(closed?.status).toBe(EPoolPositionStatus.Closed);
    expect(closed?.currentApr).toBeUndefined();
  });
});

describe('pools demo tasks', () => {
  it('keeps what a position earned after its fees are claimed', async () => {
    const catalog = buildMockCatalog(NOW);
    const state = createInitialDemoState(catalog, NOW);
    const before = buildPortfolio(catalog, state).positions.find(
      (view) => view.position.tokenId && Number(view.uncollectedFeesUsd) > 0,
    );
    if (!before) {
      throw new OneKeyLocalError('no position with fees');
    }
    // Seeded positions older than two weeks claimed fees before
    expect(Number(before.feesEarnedUsd)).toBeGreaterThan(
      Number(before.uncollectedFeesUsd),
    );
    const task = await createTask(
      catalog,
      state,
      { kind: 'collect', positionId: before.position.id },
      NOW,
    );
    expect(runAll(catalog, state, task).status).toBe(EPoolTaskStatus.Done);
    const after = buildPortfolio(catalog, state).positions.find(
      (view) => view.position.id === before.position.id,
    );
    expect(Number(after?.uncollectedFeesUsd)).toBe(0);
    expect(
      relativeError(after?.feesEarnedUsd ?? 0, before.feesEarnedUsd),
    ).toBeLessThan(0.001);
  });

  it('runs a Zap in end to end and opens a position', async () => {
    const catalog = buildMockCatalog(NOW);
    const state = createInitialDemoState(catalog, NOW);
    const pool = poolBySeed(catalog, 'rh-v3-tsla-usdg-3000');
    const usdg = assetBySymbol(catalog, POOLS_ROBINHOOD_NETWORK_ID, 'USDG');
    const tick = pool.currentTick ?? 0;
    const usdgBefore = Number(state.balances[usdg.id]);

    const task = await createTask(
      catalog,
      state,
      {
        kind: 'add',
        params: {
          poolId: pool.id,
          mode: 'zap',
          inputAssetId: usdg.id,
          amountIn: '1000',
          tickLower: Math.floor(tick / 60) * 60 - 1200,
          tickUpper: Math.floor(tick / 60) * 60 + 1200,
        },
      },
      NOW,
    );
    expect(task.kind).toBe(EPoolTaskKind.ZapIn);
    expect(task.steps.map((step) => step.kind)).toEqual([
      EPoolTaskStepKind.Approve,
      EPoolTaskStepKind.Swap,
      EPoolTaskStepKind.Approve,
      EPoolTaskStepKind.Approve,
      EPoolTaskStepKind.AddLiquidity,
    ]);

    // The review: where it goes and what it earns
    const { preview } = task;
    expect(preview.range).toEqual({
      tickLower: Math.floor(tick / 60) * 60 - 1200,
      tickUpper: Math.floor(tick / 60) * 60 + 1200,
    });
    expect(preview.apr?.status).toBe('ok');
    expect(
      Number(preview.apr?.status === 'ok' ? preview.apr.apr : 0),
    ).toBeGreaterThan(0);

    const done = runAll(catalog, state, task);
    expect(done.status).toBe(EPoolTaskStatus.Done);
    const position = state.positions.find(
      (item) => item.id === done.resultPositionId,
    );
    expect(position).toBeDefined();
    const view = buildPositionView(pool, position ?? state.positions[0]);
    expect(Number(view.valueUsd)).toBeGreaterThan(985);
    expect(usdgBefore - Number(state.balances[usdg.id])).toBeCloseTo(1000, 0);

    // Approvals are remembered, so a second Zap skips them
    const again = await createTask(
      catalog,
      state,
      { ...task.request },
      NOW + 1,
    );
    expect(again.steps.map((step) => step.kind)).toEqual([
      EPoolTaskStepKind.Swap,
      EPoolTaskStepKind.AddLiquidity,
    ]);
  });

  it('adds to a pool under the floors only once the risk is accepted', async () => {
    const catalog = buildMockCatalog(NOW);
    const state = createInitialDemoState(catalog, NOW);
    const pool = poolBySeed(catalog, 'eth-v3-link-weth-10000');
    const weth = assetBySymbol(catalog, pool.networkId, 'WETH');
    const spacing = pool.tickSpacing ?? 200;
    const tick = Math.floor((pool.currentTick ?? 0) / spacing) * spacing;
    const params = {
      poolId: pool.id,
      mode: 'zap' as const,
      inputAssetId: weth.id,
      amountIn: '0.05',
      tickLower: tick - spacing * 10,
      tickUpper: tick + spacing * 10,
    };
    await expect(
      createTask(catalog, state, { kind: 'add', params }, NOW),
    ).rejects.toThrow('Confirm the risk of this pool first');
    const task = await createTask(
      catalog,
      state,
      { kind: 'add', params: { ...params, riskConfirmed: true } },
      NOW,
    );
    expect(task.kind).toBe(EPoolTaskKind.ZapIn);
  });

  it('refuses an add too small to mint anything before any step runs', async () => {
    const catalog = buildMockCatalog(NOW);
    const state = createInitialDemoState(catalog, NOW);
    const pool = poolBySeed(catalog, 'rh-v3-tsla-usdg-3000');
    const usdg = assetBySymbol(catalog, POOLS_ROBINHOOD_NETWORK_ID, 'USDG');
    const tick = pool.currentTick ?? 0;
    const tasksBefore = state.tasks.length;
    await expect(
      createTask(
        catalog,
        state,
        {
          kind: 'add',
          params: {
            poolId: pool.id,
            mode: 'zap',
            inputAssetId: usdg.id,
            amountIn: '0.000001',
            tickLower: Math.floor(tick / 60) * 60 - 1200,
            tickUpper: Math.floor(tick / 60) * 60 + 1200,
          },
        },
        NOW,
      ),
    ).rejects.toThrow('Amounts too small to add');
    expect(state.tasks.length).toBe(tasksBefore);
  });

  it('stops on a failed step without touching balances, then resumes', async () => {
    const catalog = buildMockCatalog(NOW);
    const state = createInitialDemoState(catalog, NOW);
    const rh = state.positions.filter(
      (position) => position.networkId === POOLS_ROBINHOOD_NETWORK_ID,
    );
    const usdg = assetBySymbol(catalog, POOLS_ROBINHOOD_NETWORK_ID, 'USDG');
    const preview = previewRemove(catalog, state, {
      positionIds: rh.map((position) => position.id),
      percent: 1,
      targetAssetId: usdg.id,
    });
    expect(preview.items).toHaveLength(2);
    expect(Number(preview.zapOut?.expectedOut)).toBeGreaterThan(4900);

    const task = await createTask(
      catalog,
      state,
      {
        kind: 'exit',
        params: {
          positionIds: rh.map((position) => position.id),
          percent: 1,
          targetAssetId: usdg.id,
        },
      },
      NOW,
    );
    expect(task.kind).toBe(EPoolTaskKind.ExitToToken);
    // One swap per asset across both positions: the out-of-range TSLA
    // position holds only USDG but its unclaimed fees include TSLA
    expect(
      task.steps
        .filter((step) => step.kind === EPoolTaskStepKind.Swap)
        .map((step) => step.tokenIn?.symbol),
    ).toEqual(['TSLA', 'NVDA']);

    // Land both removals, then fail the swap
    for (let i = 0; i < 2; i += 1) {
      submitTaskStep(state, task.id, NOW);
      settleTaskStep(catalog, state, task.id, NOW);
    }
    const balancesBefore = JSON.stringify(state.balances);
    while (getNextStep(task)?.kind !== EPoolTaskStepKind.Swap) {
      submitTaskStep(state, task.id, NOW);
      settleTaskStep(catalog, state, task.id, NOW);
    }
    const afterApprovals = JSON.stringify(state.balances);
    expect(afterApprovals).toBe(balancesBefore);
    state.failNextStep = true;
    submitTaskStep(state, task.id, NOW);
    const failed = settleTaskStep(catalog, state, task.id, NOW);
    expect(failed.status).toBe(EPoolTaskStatus.Stopped);
    expect(getNextStep(failed)?.status).toBe(EPoolTaskStepStatus.Failed);
    expect(JSON.stringify(state.balances)).toBe(afterApprovals);
    expect(isUnfinishedTask(failed)).toBe(true);
    expect(buildPortfolio(catalog, state).tasks).toHaveLength(1);

    const resumed = runAll(catalog, state, failed);
    expect(resumed.status).toBe(EPoolTaskStatus.Done);
    expect(buildPortfolio(catalog, state).tasks).toHaveLength(0);
    // Fully exited positions with nothing left drop off the list
    const ids = buildPortfolio(catalog, state).positions.map(
      (view) => view.position.id,
    );
    expect(ids).not.toContain(rh[0].id);
  });
});
