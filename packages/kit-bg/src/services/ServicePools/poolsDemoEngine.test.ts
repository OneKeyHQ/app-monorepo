import BigNumber from 'bignumber.js';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  getAmountsValueUsd,
  isPoolPriceInverted,
  tickToPrice,
} from '@onekeyhq/shared/src/utils/poolsMath';
import {
  EPoolListingStatus,
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
  getNextStep,
  isUnfinishedTask,
  planZapIn,
  previewRemove,
  queryPools,
  quoteSwap,
  settleTaskStep,
  submitTaskStep,
} from './poolsDemoEngine';
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
    expect(views[5].pool.listingStatus).toBe(EPoolListingStatus.Unlisted);
  });
});

describe('pools demo queries', () => {
  const catalog = buildMockCatalog(NOW);

  it('lists only whitelisted pools, sorted by TVL', () => {
    const list = queryPools(catalog);
    expect(list.length).toBe(POOLS_POOL_SEEDS.length - 1);
    expect(
      list.every((pool) => pool.listingStatus === EPoolListingStatus.Listed),
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
    expect(queryPools(catalog, { search: 'pepe' })).toEqual([]);
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

describe('pools demo tasks', () => {
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
