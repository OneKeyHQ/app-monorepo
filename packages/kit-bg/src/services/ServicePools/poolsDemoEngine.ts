import BigNumber from 'bignumber.js';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  PoolsBigNumber,
  estimateRangeApr,
  estimateShareApr,
  fitRangeDeposit,
  getAmountsValueUsd,
  getPoolFeeApr,
  getRangeAmountsPerLiquidity,
  getRangePositionAmounts,
  getRangePositionStatus,
  getShareMint,
  getSharePositionAmounts,
  getSharePositionStatus,
  isTickInRange,
  mergeAssetAmounts,
  planZapSplit,
  tickToPrice,
} from '@onekeyhq/shared/src/utils/poolsMath';
import {
  EPoolPositionStatus,
  EPoolTaskKind,
  EPoolTaskStatus,
  EPoolTaskStepKind,
  EPoolTaskStepStatus,
} from '@onekeyhq/shared/types/pools';
import type {
  IPool,
  IPoolAddLiquidityParams,
  IPoolAsset,
  IPoolDetail,
  IPoolListItem,
  IPoolListQuery,
  IPoolPosition,
  IPoolPositionView,
  IPoolPricePoint,
  IPoolPriceRange,
  IPoolRemovePreview,
  IPoolSwapQuote,
  IPoolTask,
  IPoolTaskAprPreview,
  IPoolTaskPreview,
  IPoolTaskRequest,
  IPoolTaskStep,
  IPoolTopPosition,
  IPoolTopPositionsPage,
  IPoolTopPositionsSortKey,
  IPoolZapInLeg,
  IPoolZapInPlan,
  IPoolZapInPlanParams,
  IPoolZapOutLeg,
  IPoolsPortfolio,
  IPoolsWallet,
} from '@onekeyhq/shared/types/pools';

import {
  POOLS_DEMO_OWNER,
  POOL_SPENDER_NAMES,
  buildSeedBalances,
  buildSeedPositions,
  mockHex,
} from './poolsMockBuilder';
import { getPoolProtocolIntro } from './poolsProtocolIntro';

import type { IPoolsMockCatalog } from './poolsMockBuilder';
import type { IPoolsDemoDBStruct } from '../../dbs/simple/entity/SimpleDbEntityPoolsDemo';

// Pure demo logic behind ServicePools. Functions that change state mutate the
// state object they are given; the service loads and saves it around them.

// 2: positions remember the fees they claimed
export const POOLS_DEMO_STATE_VERSION = 2;

export const POOLS_SWAP_SPENDER_NAME = 'OneKey Swap router';
// What the steps call the spenders; the wallet shows the contract
const SWAP_SPENDER_LABEL = 'OneKey Swap';
const POOL_SPENDER_LABEL = 'Uniswap';

const FIRST_DEMO_TOKEN_ID = 1_200_001;
const SWAP_FEE_RATE = 0.0025;
const MAX_DONE_TASKS = 20;

// Liquidity a swap route can draw on before its price moves ~50%
const ROUTE_DEPTH_USD: Record<string, number> = {
  stablecoin: 40_000_000,
  stock: 3_000_000,
  ETH: 60_000_000,
  default: 8_000_000,
};

type IState = IPoolsDemoDBStruct;

export function createInitialDemoState(
  catalog: IPoolsMockCatalog,
  now: number,
  favoritePoolIds: string[] = [],
): IState {
  return {
    version: POOLS_DEMO_STATE_VERSION,
    positions: buildSeedPositions(catalog, now),
    balances: buildSeedBalances(catalog),
    approvals: {},
    tasks: [],
    nextTokenId: FIRST_DEMO_TOKEN_ID,
    failNextStep: false,
    favoritePoolIds,
  };
}

// Favorites (proposal): starred pools, kept across demo resets

export function getFavoritePoolIds(state: IState) {
  return state.favoritePoolIds ?? [];
}

export function setPoolFavorite(
  state: IState,
  poolId: string,
  favorite: boolean,
) {
  const ids = new Set(getFavoritePoolIds(state));
  if (favorite) {
    ids.add(poolId);
  } else {
    ids.delete(poolId);
  }
  state.favoritePoolIds = Array.from(ids);
  return state.favoritePoolIds;
}

function bn(value: BigNumber.Value | undefined) {
  return new PoolsBigNumber(value ?? 0);
}

function toAmountString(value: BigNumber, decimals: number) {
  return value.decimalPlaces(decimals, BigNumber.ROUND_FLOOR).toFixed();
}

export function getPool(catalog: IPoolsMockCatalog, poolId: string) {
  const pool = catalog.pools.find((item) => item.id === poolId);
  if (!pool) {
    throw new OneKeyLocalError(`Pool not found: ${poolId}`);
  }
  return pool;
}

export function getAsset(catalog: IPoolsMockCatalog, assetId: string) {
  const asset = catalog.assets.find((item) => item.id === assetId);
  if (!asset) {
    throw new OneKeyLocalError(`Asset not found: ${assetId}`);
  }
  return asset;
}

function getPosition(state: IState, positionId: string) {
  const position = state.positions.find((item) => item.id === positionId);
  if (!position) {
    throw new OneKeyLocalError(`Position not found: ${positionId}`);
  }
  return position;
}

function tokenAmount(asset: IPoolAsset, amount: BigNumber) {
  return {
    assetId: asset.id,
    symbol: asset.symbol,
    amount: toAmountString(amount, asset.decimals),
  };
}

// Pool list (doc §2.3)

function toListItem(catalog: IPoolsMockCatalog, pool: IPool): IPoolListItem {
  const feeApr = getPoolFeeApr({
    fees24hUsd: pool.fees24hUsd,
    tvlUsd: pool.tvlUsd,
  })?.toFixed();
  const fallback = {
    volumeUsd: pool.volume24hUsd,
    feesUsd: pool.fees24hUsd,
    apr: feeApr,
  };
  return {
    ...pool,
    feeApr,
    windows: catalog.windowStatsByPoolId[pool.id] ?? {
      '1D': fallback,
      '1W': fallback,
      '1M': fallback,
    },
    createdAt: catalog.createdAtByPoolId[pool.id] ?? 0,
  };
}

function matchesKeyword(pool: IPool, term: string) {
  return (
    (term.startsWith('0x') && pool.poolKey.toLowerCase() === term) ||
    [pool.token0, pool.token1].some(
      (token) =>
        token.symbol.toLowerCase().includes(term) ||
        token.name.toLowerCase().includes(term) ||
        (term.startsWith('0x') && token.address === term),
    )
  );
}

export function queryPools(
  catalog: IPoolsMockCatalog,
  query: IPoolListQuery = {},
): IPoolListItem[] {
  const terms = (query.search ?? '')
    .trim()
    .toLowerCase()
    .split(/[\s/]+/u)
    .filter(Boolean);
  const networkIds = new Set(query.networkIds ?? []);
  const versions = new Set(query.versions ?? []);
  const feeTiers = new Set(query.feeTiers ?? []);
  const sortBy = query.sortBy ?? 'tvl';

  const items = catalog.pools
    // Every pool that trades enough; one under the floors takes its address
    .filter((pool) => !pool.isOffList)
    .filter((pool) => !networkIds.size || networkIds.has(pool.networkId))
    .filter((pool) => !versions.size || versions.has(pool.version))
    .filter((pool) => !feeTiers.size || feeTiers.has(pool.feeTier))
    .filter(
      (pool) =>
        !query.category ||
        pool.token0.category === query.category ||
        pool.token1.category === query.category,
    )
    .filter((pool) => terms.every((term) => matchesKeyword(pool, term)))
    .map((pool) => toListItem(catalog, pool));

  const sortValue = (item: IPoolListItem) => {
    if (sortBy === 'apr') {
      return Number(item.feeApr ?? 0);
    }
    if (sortBy === 'volume24h') {
      return Number(item.volume24hUsd);
    }
    if (sortBy === 'fees') {
      return Number(item.fees24hUsd);
    }
    return Number(item.tvlUsd);
  };
  return items.toSorted((a, b) => sortValue(b) - sortValue(a));
}

/**
 * Pools whose address (V4: pool ID) is exactly this, also under the list's
 * floors: how a pool the list leaves out is found
 */
export function findPoolsByKey(
  catalog: IPoolsMockCatalog,
  poolKey: string,
): IPoolListItem[] {
  const key = poolKey.trim().toLowerCase();
  return catalog.pools
    .filter((pool) => pool.poolKey.toLowerCase() === key)
    .map((pool) => toListItem(catalog, pool));
}

export function getPoolNetworkIds(catalog: IPoolsMockCatalog) {
  const ids = new Set<string>();
  for (const pool of catalog.pools) {
    if (!pool.isOffList) {
      ids.add(pool.networkId);
    }
  }
  return Array.from(ids);
}

export function getPoolDetail(
  catalog: IPoolsMockCatalog,
  poolId: string,
): IPoolDetail {
  const pool = getPool(catalog, poolId);
  return {
    pool: toListItem(catalog, pool),
    ticks: catalog.ticksByPoolId[pool.id] ?? [],
    priceHistory: catalog.priceHistoryByPoolId[pool.id] ?? [],
    pairPools: catalog.pools
      .filter(
        (item) =>
          item.pairKey === pool.pairKey &&
          item.id !== pool.id &&
          !item.isOffList,
      )
      .map((item) => toListItem(catalog, item)),
    protocolInfo: getPoolProtocolIntro(pool.version),
  };
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
// How far back each range reaches and how often it samples the walk
const PRICE_RANGES: Record<
  IPoolPriceRange,
  { spanMs: number; stepMs: number }
> = {
  '1D': { spanMs: DAY_MS, stepMs: 15 * 60 * 1000 },
  '1W': { spanMs: 7 * DAY_MS, stepMs: HOUR_MS },
  '1M': { spanMs: 30 * DAY_MS, stepMs: 4 * HOUR_MS },
  '1Y': { spanMs: 365 * DAY_MS, stepMs: DAY_MS },
};

export function getPoolPriceHistory(
  catalog: IPoolsMockCatalog,
  poolId: string,
  range: IPoolPriceRange,
): IPoolPricePoint[] {
  const series = catalog.priceSeriesByPoolId[getPool(catalog, poolId).id] ?? [];
  const latest = series[series.length - 1]?.time ?? 0;
  const { spanMs, stepMs } = PRICE_RANGES[range];
  const sampled = series.filter((point) => {
    const ageMs = latest - point.time;
    return ageMs <= spanMs && ageMs % stepMs === 0;
  });
  // Each bucket's volume is what traded since the bucket before it; the
  // series is at least as fine as the step, so the sums are exact
  return sampled.map((point) => {
    let volume = 0;
    for (const item of series) {
      if (item.time > point.time - stepMs && item.time <= point.time) {
        volume += Number(item.volumeUsd ?? 0);
      }
    }
    return { ...point, volumeUsd: volume.toFixed(2) };
  });
}

// Top positions (proposal): other LPs' open ranges, ranked by what they
// earned over their life, so a user can copy a range that works

const TOP_POSITION_MIN_VALUE_USD = 500;

const TOP_POSITION_SORT_FIELDS: Record<
  IPoolTopPositionsSortKey,
  'apr' | 'valueUsd' | 'feesEarnedUsd'
> = {
  apr: 'apr',
  value: 'valueUsd',
  earned: 'feesEarnedUsd',
};

export function getPoolTopPositions(
  catalog: IPoolsMockCatalog,
  poolId: string,
  {
    offset = 0,
    limit = 5,
    sortBy = 'apr',
  }: {
    offset?: number;
    limit?: number;
    sortBy?: IPoolTopPositionsSortKey;
  } = {},
): IPoolTopPositionsPage {
  const pool = getPool(catalog, poolId);
  const book = catalog.bookByPoolId[pool.id] ?? [];
  const series = catalog.priceSeriesByPoolId[pool.id] ?? [];
  const now = series[series.length - 1]?.time ?? 0;
  const dailyCloses = series.filter(
    (point) => (now - point.time) % DAY_MS === 0,
  );
  const activeLiquidity = new BigNumber(pool.activeLiquidity ?? '0');
  const currentTick = pool.currentTick ?? 0;
  const decimals = {
    decimals0: pool.token0.decimals,
    decimals1: pool.token1.decimals,
  };
  const ranked = book
    .filter((entry) => entry.valueUsd >= TOP_POSITION_MIN_VALUE_USD)
    .map((entry, index): IPoolTopPosition => {
      const inRange =
        entry.tickLower <= currentTick && currentTick < entry.tickUpper;
      const liquidity = new BigNumber(entry.liquidity.toString());
      // Its share of the liquidity that earns while the price is inside
      const share = liquidity.div(
        inRange ? activeLiquidity : activeLiquidity.plus(liquidity),
      );
      const aprWhileInRange = share
        .times(pool.fees24hUsd)
        .times(365)
        .div(entry.valueUsd);
      const createdAt = now - Math.round(entry.ageDays * DAY_MS);
      const low = tickToPrice({ tick: entry.tickLower, ...decimals });
      const high = tickToPrice({ tick: entry.tickUpper, ...decimals });
      const closes = dailyCloses.filter((point) => point.time >= createdAt);
      const inside = closes.filter(
        (point) => low.lte(point.price) && high.gt(point.price),
      ).length;
      let inRangeShare = inRange ? 1 : 0;
      if (closes.length) {
        inRangeShare = inside / closes.length;
      }
      const apr = aprWhileInRange.isFinite()
        ? aprWhileInRange.times(inRangeShare)
        : new BigNumber(0);
      return {
        id: `${pool.id}:top:${index}`,
        tokenId: entry.tokenId,
        owner: entry.owner,
        tickLower: entry.tickLower,
        tickUpper: entry.tickUpper,
        valueUsd: entry.valueUsd.toFixed(2),
        feesEarnedUsd: apr
          .times(entry.valueUsd)
          .times(entry.ageDays)
          .div(365)
          .toFixed(2),
        apr: apr.toFixed(),
        inRange,
        createdAt,
      };
    })
    .toSorted((a, b) => {
      const field = TOP_POSITION_SORT_FIELDS[sortBy];
      return Number(b[field]) - Number(a[field]);
    });
  return {
    items: ranked.slice(offset, offset + limit),
    total: ranked.length,
    minValueUsd: String(TOP_POSITION_MIN_VALUE_USD),
  };
}

// Positions (doc §3.9)

/** Claimed plus unclaimed, at today's prices; auto-compounded fees are in the value */
function getFeesEarnedUsd(pool: IPool, position: IPoolPosition) {
  if (pool.capabilities.feeCollection !== 'CLAIMABLE') {
    return bn(0);
  }
  return getAmountsValueUsd({
    amount0: bn(position.uncollectedFees0).plus(position.collectedFees0 ?? 0),
    amount1: bn(position.uncollectedFees1).plus(position.collectedFees1 ?? 0),
    price0Usd: pool.token0.priceUsd,
    price1Usd: pool.token1.priceUsd,
  });
}

export function buildPositionView(
  pool: IPool,
  position: IPoolPosition,
): IPoolPositionView {
  const fees = getAmountsValueUsd({
    amount0: position.uncollectedFees0,
    amount1: position.uncollectedFees1,
    price0Usd: pool.token0.priceUsd,
    price1Usd: pool.token1.priceUsd,
  });

  if (!pool.capabilities.priceRange) {
    const amounts = getSharePositionAmounts({
      reserve0: pool.reserve0,
      reserve1: pool.reserve1,
      totalSupply: pool.lpTotalSupply ?? 0,
      lpBalance: position.lpBalance ?? 0,
    });
    const valueUsd = getAmountsValueUsd({
      amount0: amounts.amount0,
      amount1: amounts.amount1,
      price0Usd: pool.token0.priceUsd,
      price1Usd: pool.token1.priceUsd,
    });
    // V2 splits fees by share of the pool
    const fees24hUsd = bn(pool.fees24hUsd).times(amounts.shareOfPool);
    return {
      position,
      pool,
      status: getSharePositionStatus(position.lpBalance ?? 0),
      amount0: toAmountString(amounts.amount0, pool.token0.decimals),
      amount1: toAmountString(amounts.amount1, pool.token1.decimals),
      valueUsd: valueUsd.toFixed(2),
      uncollectedFeesUsd: fees.toFixed(2),
      feesEarnedUsd: getFeesEarnedUsd(pool, position).toFixed(2),
      fees24hUsd: fees24hUsd.toFixed(2),
      currentApr: getCurrentApr(fees24hUsd, valueUsd),
      shareOfPool: amounts.shareOfPool.toFixed(),
    };
  }

  const liquidity = BigInt(position.liquidity ?? '0');
  const tickLower = position.tickLower ?? 0;
  const tickUpper = position.tickUpper ?? 0;
  const amounts = getRangePositionAmounts({
    sqrtRatioX96: BigInt(pool.sqrtPriceX96 ?? '0'),
    tickLower,
    tickUpper,
    decimals0: pool.token0.decimals,
    decimals1: pool.token1.decimals,
    liquidity,
  });
  const { status, outOfRangeSide } = getRangePositionStatus({
    liquidity,
    tickLower,
    tickUpper,
    currentTick: pool.currentTick ?? 0,
  });
  const valueUsd = getAmountsValueUsd({
    amount0: amounts.amount0,
    amount1: amounts.amount1,
    price0Usd: pool.token0.priceUsd,
    price1Usd: pool.token1.priceUsd,
  });
  const fees24hUsd = getRangeFees24hUsd(pool, liquidity, status);
  let currentApr: string | undefined;
  if (pool.aprEstimateSupported) {
    currentApr =
      status === EPoolPositionStatus.OutOfRange
        ? '0'
        : getCurrentApr(fees24hUsd, valueUsd);
  }
  return {
    position,
    pool,
    status,
    outOfRangeSide,
    amount0: toAmountString(amounts.amount0, pool.token0.decimals),
    amount1: toAmountString(amounts.amount1, pool.token1.decimals),
    valueUsd: valueUsd.toFixed(2),
    uncollectedFeesUsd: fees.toFixed(2),
    feesEarnedUsd: getFeesEarnedUsd(pool, position).toFixed(2),
    fees24hUsd: fees24hUsd.toFixed(2),
    currentApr,
  };
}

/** Unrounded, so a small position's cents still give its rate */
function getCurrentApr(fees24hUsd: BigNumber, valueUsd: BigNumber) {
  return valueUsd.gt(0)
    ? fees24hUsd.times(365).div(valueUsd).toFixed()
    : undefined;
}

/**
 * In range, a position takes L ÷ (L_active + L) of the pool's fees. Hooks
 * that change LP fees make this unknowable, so they count as zero.
 */
function getRangeFees24hUsd(
  pool: IPool,
  liquidity: bigint,
  status: EPoolPositionStatus,
) {
  const active = bn(pool.activeLiquidity ?? '0');
  if (
    status !== EPoolPositionStatus.Active ||
    !pool.aprEstimateSupported ||
    liquidity <= BigInt(0)
  ) {
    return bn(0);
  }
  const own = bn(liquidity.toString());
  return bn(pool.fees24hUsd).times(own).div(active.plus(own));
}

const ASSET_CHANGING_STEPS = new Set<EPoolTaskStepKind>([
  EPoolTaskStepKind.Swap,
  EPoolTaskStepKind.AddLiquidity,
  EPoolTaskStepKind.IncreaseLiquidity,
  EPoolTaskStepKind.RemoveLiquidity,
  EPoolTaskStepKind.CollectFees,
]);

/**
 * A task stopped after it moved assets: something sits in the wallet halfway,
 * so it is offered as continue or abandon. A task that stopped before any
 * asset moved simply never happened (doc §3.8).
 */
export function isUnfinishedTask(task: IPoolTask) {
  if (
    task.status === EPoolTaskStatus.Done ||
    task.status === EPoolTaskStatus.Abandoned
  ) {
    return false;
  }
  const movedAssets = task.steps.some(
    (step) =>
      ASSET_CHANGING_STEPS.has(step.kind) &&
      step.status === EPoolTaskStepStatus.Done,
  );
  const hasRemaining = task.steps.some(
    (step) => step.status !== EPoolTaskStepStatus.Done,
  );
  return movedAssets && hasRemaining;
}

export function buildPortfolio(
  catalog: IPoolsMockCatalog,
  state: IState,
): IPoolsPortfolio {
  const views = state.positions
    .map((position) =>
      buildPositionView(getPool(catalog, position.poolId), position),
    )
    // A closed position stays only while it still holds unclaimed fees
    // (doc §3.9); a closed one without fees is history
    .filter(
      (view) =>
        view.status !== EPoolPositionStatus.Closed ||
        bn(view.uncollectedFeesUsd).gt(0),
    );
  const isOpen = (view: IPoolPositionView) =>
    view.status !== EPoolPositionStatus.Closed;
  const positions = views.toSorted((a, b) => {
    if (isOpen(a) !== isOpen(b)) {
      return isOpen(a) ? -1 : 1;
    }
    return Number(b.valueUsd) - Number(a.valueUsd);
  });
  const total = (key: 'valueUsd' | 'uncollectedFeesUsd' | 'fees24hUsd') =>
    positions
      .reduce((sum, view) => sum.plus(view[key]), new PoolsBigNumber(0))
      .toFixed(2);
  return {
    positions,
    totalValueUsd: total('valueUsd'),
    uncollectedFeesUsd: total('uncollectedFeesUsd'),
    fees24hUsd: total('fees24hUsd'),
    tasks: state.tasks.filter(isUnfinishedTask),
  };
}

export function buildWallet(
  catalog: IPoolsMockCatalog,
  state: IState,
  networkId: string,
): IPoolsWallet {
  // A token with no trusted price is nothing to pay with or exit into
  const assets = catalog.assets.filter(
    (asset) => asset.networkId === networkId && !asset.hasUntrustedPrice,
  );
  const balances: Record<string, string> = {};
  for (const asset of assets) {
    balances[asset.id] = state.balances[asset.id] ?? '0';
  }
  return { networkId, assets, balances };
}

// Swaps (Zap legs). Mid price from USD prices, a flat route fee and a
// size-based impact, so larger Zaps visibly cost more.

function routeDepthUsd(asset: IPoolAsset) {
  if (asset.canonicalId.endsWith(':ETH')) {
    return ROUTE_DEPTH_USD.ETH;
  }
  return (
    ROUTE_DEPTH_USD[asset.category ?? 'default'] ?? ROUTE_DEPTH_USD.default
  );
}

export function quoteSwap(
  catalog: IPoolsMockCatalog,
  {
    fromAssetId,
    toAssetId,
    amountIn,
  }: { fromAssetId: string; toAssetId: string; amountIn: BigNumber.Value },
): IPoolSwapQuote {
  const from = getAsset(catalog, fromAssetId);
  const to = getAsset(catalog, toAssetId);
  const amount = bn(amountIn);
  const valueInUsd = amount.times(from.priceUsd);
  // ETH ↔ WETH wraps 1:1
  const isWrap = from.canonicalId === to.canonicalId;
  const priceImpact = isWrap
    ? new PoolsBigNumber(0)
    : valueInUsd.div(
        valueInUsd.plus(Math.min(routeDepthUsd(from), routeDepthUsd(to))),
      );
  const keep = isWrap
    ? new PoolsBigNumber(1)
    : new PoolsBigNumber(1)
        .minus(SWAP_FEE_RATE)
        .times(new PoolsBigNumber(1).minus(priceImpact));
  const amountOut = amount
    .times(from.priceUsd)
    .div(to.priceUsd)
    .times(keep)
    .decimalPlaces(to.decimals, BigNumber.ROUND_FLOOR);
  const valueOutUsd = amountOut.times(to.priceUsd);
  return {
    fromAssetId,
    toAssetId,
    amountIn: amount.toFixed(),
    amountOut: amountOut.toFixed(),
    rate: amount.gt(0) ? amountOut.div(amount).toFixed() : '0',
    priceImpact: priceImpact.toFixed(),
    costUsd: PoolsBigNumber.max(valueInUsd.minus(valueOutUsd), 0).toFixed(2),
  };
}

// Zap in (doc §3.6)

function getRangeContext(
  pool: IPool,
  range: { tickLower?: number; tickUpper?: number },
) {
  if (range.tickLower === undefined || range.tickUpper === undefined) {
    throw new OneKeyLocalError('A range pool needs a price range');
  }
  return {
    sqrtRatioX96: BigInt(pool.sqrtPriceX96 ?? '0'),
    tickLower: range.tickLower,
    tickUpper: range.tickUpper,
    decimals0: pool.token0.decimals,
    decimals1: pool.token1.decimals,
  };
}

/** The pool token an input pays directly, without a swap */
function getDirectSide(pool: IPool, input: IPoolAsset): 0 | 1 | undefined {
  const tokens = [pool.token0, pool.token1];
  for (const side of [0, 1] as const) {
    const token = tokens[side];
    if (token.id === input.id) {
      return side;
    }
    // V2 / V3 take ETH for the WETH side and wrap it (doc §3.11)
    if (
      input.isNative &&
      !token.isNative &&
      token.canonicalId === input.canonicalId &&
      pool.capabilities.nativeToken === 'WRAP'
    ) {
      return side;
    }
  }
  return undefined;
}

/** Fit two amounts into the pool: what goes in, what stays, what it mints */
function fitDeposit(
  pool: IPool,
  range: { tickLower?: number; tickUpper?: number },
  amount0: BigNumber,
  amount1: BigNumber,
) {
  if (!pool.capabilities.priceRange) {
    const mint = getShareMint({
      reserve0: pool.reserve0,
      reserve1: pool.reserve1,
      totalSupply: pool.lpTotalSupply ?? 0,
      amount0,
      amount1,
    });
    return {
      liquidity: mint.liquidity.toFixed(18, BigNumber.ROUND_FLOOR),
      used0: mint.used0,
      used1: mint.used1,
      leftover0: mint.leftover0,
      leftover1: mint.leftover1,
    };
  }
  const fit = fitRangeDeposit({
    ...getRangeContext(pool, range),
    amount0,
    amount1,
  });
  return { ...fit, liquidity: fit.liquidity.toString() };
}

export async function planZapIn(
  catalog: IPoolsMockCatalog,
  params: IPoolZapInPlanParams,
): Promise<IPoolZapInPlan> {
  const pool = getPool(catalog, params.poolId);
  const input = getAsset(catalog, params.inputAssetId);
  const tokens = [pool.token0, pool.token1];
  const amountIn = bn(params.amountIn);

  let perLiquidity0: BigNumber.Value = pool.reserve0;
  let perLiquidity1: BigNumber.Value = pool.reserve1;
  if (pool.capabilities.priceRange) {
    const per = getRangeAmountsPerLiquidity(getRangeContext(pool, params));
    perLiquidity0 = per.amount0;
    perLiquidity1 = per.amount1;
  }

  const inputSide = getDirectSide(pool, input);
  const split = await planZapSplit({
    amountIn,
    perLiquidity0,
    perLiquidity1,
    inputSide,
    quote: async ({ side, amountIn: sideAmount }) =>
      bn(
        quoteSwap(catalog, {
          fromAssetId: input.id,
          toAssetId: tokens[side].id,
          amountIn: sideAmount,
        }).amountOut,
      ),
  });

  // Quote the final split once more so the plan shows exact leg outputs
  const legs: IPoolZapInLeg[] = [];
  const expected = [new PoolsBigNumber(0), new PoolsBigNumber(0)];
  const sideAmounts = [split.toToken0, split.toToken1];
  for (const side of [0, 1] as const) {
    const sideAmount = sideAmounts[side].decimalPlaces(
      input.decimals,
      BigNumber.ROUND_FLOOR,
    );
    if (sideAmount.lte(0)) {
      // oxlint-disable-next-line no-continue
      continue;
    }
    if (side === inputSide) {
      legs.push({ side, amountIn: sideAmount.toFixed() });
      expected[side] = sideAmount;
    } else {
      const quote = quoteSwap(catalog, {
        fromAssetId: input.id,
        toAssetId: tokens[side].id,
        amountIn: sideAmount,
      });
      legs.push({ side, amountIn: sideAmount.toFixed(), quote });
      expected[side] = bn(quote.amountOut);
    }
  }

  const fit = fitDeposit(pool, params, expected[0], expected[1]);
  const costUsd = legs.reduce(
    (sum, leg) => sum.plus(leg.quote?.costUsd ?? 0),
    new PoolsBigNumber(0),
  );
  return {
    inputAssetId: input.id,
    amountIn: amountIn.toFixed(),
    legs,
    expected0: toAmountString(expected[0], pool.token0.decimals),
    expected1: toAmountString(expected[1], pool.token1.decimals),
    used0: toAmountString(fit.used0, pool.token0.decimals),
    used1: toAmountString(fit.used1, pool.token1.decimals),
    leftover0: toAmountString(fit.leftover0, pool.token0.decimals),
    leftover1: toAmountString(fit.leftover1, pool.token1.decimals),
    depositUsd: getAmountsValueUsd({
      amount0: fit.used0,
      amount1: fit.used1,
      price0Usd: pool.token0.priceUsd,
      price1Usd: pool.token1.priceUsd,
    }).toFixed(2),
    costUsd: costUsd.toFixed(2),
    liquidity: fit.liquidity,
  };
}

// Remove, Zap out and exit to one token (doc §2.7, §3.7)

function getRemovalAmounts(
  catalog: IPoolsMockCatalog,
  position: IPoolPosition,
  percent: number,
) {
  const pool = getPool(catalog, position.poolId);
  const view = buildPositionView(pool, position);
  const share = new PoolsBigNumber(Math.min(Math.max(percent, 0), 1));
  // Range positions settle every unclaimed fee with any removal
  const fees0 = bn(position.uncollectedFees0);
  const fees1 = bn(position.uncollectedFees1);
  return {
    pool,
    amount0: bn(view.amount0).times(share),
    amount1: bn(view.amount1).times(share),
    fees0,
    fees1,
  };
}

export function previewRemove(
  catalog: IPoolsMockCatalog,
  state: IState,
  {
    positionIds,
    percent,
    targetAssetId,
  }: { positionIds: string[]; percent: number; targetAssetId?: string },
): IPoolRemovePreview {
  const received: Array<{ assetId: string; amount: BigNumber }> = [];
  const items = positionIds.map((positionId) => {
    const position = getPosition(state, positionId);
    const { pool, amount0, amount1, fees0, fees1 } = getRemovalAmounts(
      catalog,
      position,
      percent,
    );
    received.push(
      { assetId: pool.token0.id, amount: amount0.plus(fees0) },
      { assetId: pool.token1.id, amount: amount1.plus(fees1) },
    );
    return {
      positionId,
      amount0: toAmountString(amount0, pool.token0.decimals),
      amount1: toAmountString(amount1, pool.token1.decimals),
      fees0: toAmountString(fees0, pool.token0.decimals),
      fees1: toAmountString(fees1, pool.token1.decimals),
      valueUsd: getAmountsValueUsd({
        amount0: amount0.plus(fees0),
        amount1: amount1.plus(fees1),
        price0Usd: pool.token0.priceUsd,
        price1Usd: pool.token1.priceUsd,
      }).toFixed(2),
    };
  });

  const merged = mergeAssetAmounts(received).map(({ assetId, amount }) =>
    tokenAmount(getAsset(catalog, assetId), amount),
  );
  const receivedUsd = merged.reduce(
    (sum, item) =>
      sum.plus(bn(item.amount).times(getAsset(catalog, item.assetId).priceUsd)),
    new PoolsBigNumber(0),
  );

  let zapOut: IPoolRemovePreview['zapOut'];
  if (targetAssetId) {
    const target = getAsset(catalog, targetAssetId);
    const legs: IPoolZapOutLeg[] = merged.map((item) =>
      item.assetId === target.id
        ? { assetId: item.assetId, amount: item.amount }
        : {
            assetId: item.assetId,
            amount: item.amount,
            quote: quoteSwap(catalog, {
              fromAssetId: item.assetId,
              toAssetId: target.id,
              amountIn: item.amount,
            }),
          },
    );
    const expectedOut = legs.reduce(
      (sum, leg) => sum.plus(leg.quote?.amountOut ?? leg.amount),
      new PoolsBigNumber(0),
    );
    const costUsd = legs.reduce(
      (sum, leg) => sum.plus(leg.quote?.costUsd ?? 0),
      new PoolsBigNumber(0),
    );
    zapOut = {
      targetAssetId: target.id,
      legs,
      expectedOut: toAmountString(expectedOut, target.decimals),
      costUsd: costUsd.toFixed(2),
    };
  }

  return {
    items,
    received: merged,
    receivedUsd: receivedUsd.toFixed(2),
    zapOut,
  };
}

// Tasks (doc §3.8, §3.11)

function approvalKey(assetId: string, spenderName: string) {
  return `${assetId}>${spenderName}`;
}

function makeStepId(taskId: string, index: number) {
  return `${taskId}:${index}`;
}

type IPlannedStep = Omit<IPoolTaskStep, 'id' | 'status'>;

/** Approval steps a set of tokens needs before a contract can pull them */
function planApprovals(
  state: IState,
  pool: IPool | undefined,
  assets: Array<{ asset: IPoolAsset; amount: BigNumber }>,
  spender: 'swap' | 'pool',
): IPlannedStep[] {
  const steps: IPlannedStep[] = [];
  const erc20 = assets.filter(
    ({ asset, amount }) => !asset.isNative && amount.gt(0),
  );
  if (spender === 'swap' || !pool) {
    for (const { asset, amount } of erc20) {
      if (!state.approvals[approvalKey(asset.id, POOLS_SWAP_SPENDER_NAME)]) {
        steps.push({
          kind: EPoolTaskStepKind.Approve,
          spenderName: POOLS_SWAP_SPENDER_NAME,
          spenderLabel: SWAP_SPENDER_LABEL,
          tokenIn: tokenAmount(asset, amount),
        });
      }
    }
    return steps;
  }
  const spenderName = POOL_SPENDER_NAMES[pool.version];
  const isPermit2 = pool.capabilities.approvalModel === 'PERMIT2';
  for (const { asset, amount } of erc20) {
    if (!state.approvals[approvalKey(asset.id, spenderName)]) {
      steps.push({
        kind: isPermit2
          ? EPoolTaskStepKind.ApprovePermit2
          : EPoolTaskStepKind.Approve,
        spenderName,
        spenderLabel: POOL_SPENDER_LABEL,
        poolId: pool.id,
        tokenIn: tokenAmount(asset, amount),
      });
    }
  }
  // Permit2 grants the position manager its allowance by signature, once
  // per add (doc §3.11)
  if (isPermit2 && erc20.length) {
    steps.push({ kind: EPoolTaskStepKind.SignPermit, poolId: pool.id });
  }
  return steps;
}

function getNativeAsset(catalog: IPoolsMockCatalog, networkId: string) {
  return catalog.assets.find(
    (asset) => asset.networkId === networkId && asset.isNative,
  );
}

/** The asset that actually leaves the wallet for one side of an add */
function getPayAsset(
  catalog: IPoolsMockCatalog,
  pool: IPool,
  side: 0 | 1,
  payWithNative: boolean,
) {
  const token = side === 0 ? pool.token0 : pool.token1;
  const native = getNativeAsset(catalog, pool.networkId);
  if (
    payWithNative &&
    native &&
    !token.isNative &&
    pool.capabilities.nativeToken === 'WRAP' &&
    // The chain's wrapped coin (WETH, WBNB) is paid in the coin itself
    token.canonicalId === native.canonicalId
  ) {
    return native;
  }
  return token;
}

/** Adding to a position keeps its range; a new position uses the request's */
function resolveAddRange(state: IState, params: IPoolAddLiquidityParams) {
  if (params.positionId) {
    const position = getPosition(state, params.positionId);
    return { tickLower: position.tickLower, tickUpper: position.tickUpper };
  }
  return { tickLower: params.tickLower, tickUpper: params.tickUpper };
}

async function planAddSteps(
  catalog: IPoolsMockCatalog,
  state: IState,
  params: IPoolAddLiquidityParams,
): Promise<IPlannedStep[]> {
  const pool = getPool(catalog, params.poolId);
  // A pool the list leaves out, or one with a token that has no trusted
  // price, takes liquidity once the user accepts the risk
  const needsRiskConfirm =
    pool.isOffList ||
    Boolean(pool.token0.hasUntrustedPrice || pool.token1.hasUntrustedPrice);
  if (needsRiskConfirm && !params.riskConfirmed) {
    throw new OneKeyLocalError('Confirm the risk of this pool first');
  }
  const steps: IPlannedStep[] = [];
  let pays: Array<{ asset: IPoolAsset; amount: BigNumber }>;

  if (params.mode === 'zap') {
    const input = getAsset(catalog, params.inputAssetId);
    const plan = await planZapIn(catalog, {
      ...params,
      ...resolveAddRange(state, params),
    });
    const swapLegs = plan.legs.filter((leg) => leg.quote);
    steps.push(
      ...planApprovals(
        state,
        pool,
        swapLegs.length ? [{ asset: input, amount: bn(plan.amountIn) }] : [],
        'swap',
      ),
    );
    for (const leg of swapLegs) {
      const token = leg.side === 0 ? pool.token0 : pool.token1;
      steps.push({
        kind: EPoolTaskStepKind.Swap,
        poolId: pool.id,
        tokenIn: tokenAmount(input, bn(leg.amountIn)),
        tokenOut: tokenAmount(token, bn(leg.quote?.amountOut)),
      });
    }
    const directLeg = plan.legs.find((leg) => !leg.quote);
    pays = [0, 1].map((side) => {
      const payWithNative = Boolean(input.isNative && directLeg?.side === side);
      return {
        asset: getPayAsset(catalog, pool, side as 0 | 1, payWithNative),
        amount: bn(side === 0 ? plan.used0 : plan.used1),
      };
    });
  } else {
    pays = [
      {
        asset: getPayAsset(catalog, pool, 0, Boolean(params.payWithNative)),
        amount: bn(params.amount0),
      },
      {
        asset: getPayAsset(catalog, pool, 1, Boolean(params.payWithNative)),
        amount: bn(params.amount1),
      },
    ];
  }

  steps.push(...planApprovals(state, pool, pays, 'pool'));
  steps.push({
    kind: params.positionId
      ? EPoolTaskStepKind.IncreaseLiquidity
      : EPoolTaskStepKind.AddLiquidity,
    poolId: pool.id,
    positionId: params.positionId,
    tokenIn: tokenAmount(pays[0].asset, pays[0].amount),
    tokenOut: tokenAmount(pays[1].asset, pays[1].amount),
  });
  return steps;
}

function planRemoveSteps(
  catalog: IPoolsMockCatalog,
  state: IState,
  {
    positionIds,
    percent,
    targetAssetId,
  }: { positionIds: string[]; percent: number; targetAssetId?: string },
): IPlannedStep[] {
  const steps: IPlannedStep[] = [];
  const networkIds = new Set<string>();
  for (const positionId of positionIds) {
    const position = getPosition(state, positionId);
    const pool = getPool(catalog, position.poolId);
    networkIds.add(pool.networkId);
    // V2 burns LP tokens through the router, which needs an allowance first
    if (!pool.capabilities.priceRange) {
      const spenderName = POOL_SPENDER_NAMES[pool.version];
      if (!state.approvals[approvalKey(`${pool.id}:lp`, spenderName)]) {
        steps.push({
          kind: EPoolTaskStepKind.Approve,
          spenderName,
          spenderLabel: POOL_SPENDER_LABEL,
          poolId: pool.id,
          positionId,
          tokenIn: {
            assetId: `${pool.id}:lp`,
            symbol: 'UNI-V2',
            amount: bn(position.lpBalance).times(percent).toFixed(18),
          },
        });
      }
    }
    steps.push({
      kind: EPoolTaskStepKind.RemoveLiquidity,
      poolId: pool.id,
      positionId,
    });
  }
  if (networkIds.size > 1) {
    throw new OneKeyLocalError('Positions must be on one network');
  }
  if (!targetAssetId) {
    return steps;
  }

  const preview = previewRemove(catalog, state, {
    positionIds,
    percent,
    targetAssetId,
  });
  const target = getAsset(catalog, targetAssetId);
  const swapLegs = (preview.zapOut?.legs ?? []).filter((leg) => leg.quote);
  steps.push(
    ...planApprovals(
      state,
      undefined,
      swapLegs.map((leg) => ({
        asset: getAsset(catalog, leg.assetId),
        amount: bn(leg.amount),
      })),
      'swap',
    ),
  );
  for (const leg of swapLegs) {
    steps.push({
      kind: EPoolTaskStepKind.Swap,
      tokenIn: tokenAmount(getAsset(catalog, leg.assetId), bn(leg.amount)),
      tokenOut: tokenAmount(target, bn(leg.quote?.amountOut)),
    });
  }
  return steps;
}

// Below a cent a leftover is rounding, not something to tell the user about
const DUST_USD = 0.01;

/** Amounts that mint nothing would fail only at the last step, after swaps */
function assertAddsLiquidity(liquidity: string) {
  if (!bn(liquidity).gt(0)) {
    throw new OneKeyLocalError('Amounts too small to add');
  }
}

function amountsOf(items: Array<{ asset: IPoolAsset; amount: BigNumber }>) {
  return items
    .filter(({ amount }) => amount.gt(0))
    .map(({ asset, amount }) => tokenAmount(asset, amount));
}

/** The same estimate the form shows for this deposit (doc §3.5) */
function getAddApr(
  pool: IPool,
  range: { tickLower?: number; tickUpper?: number },
  deposit: { liquidity: string; valueUsd: BigNumber.Value },
): IPoolTaskAprPreview {
  let estimate;
  if (pool.capabilities.priceRange) {
    const { tickLower = 0, tickUpper = 0 } = range;
    const liquidity = BigInt(deposit.liquidity);
    estimate = estimateRangeApr({
      fees24hUsd: pool.fees24hUsd,
      tvlUsd: pool.tvlUsd,
      activeLiquidity: BigInt(pool.activeLiquidity ?? '0'),
      inRange: isTickInRange({
        tickLower,
        tickUpper,
        tick: pool.currentTick ?? 0,
      }),
      supported: pool.aprEstimateSupported,
      deposit:
        liquidity > BigInt(0)
          ? { liquidity, valueUsd: deposit.valueUsd }
          : undefined,
    });
  } else {
    estimate = estimateShareApr({
      fees24hUsd: pool.fees24hUsd,
      tvlUsd: pool.tvlUsd,
      depositUsd: deposit.valueUsd,
    });
  }
  return estimate.status === 'ok'
    ? { status: 'ok', apr: estimate.apr.toFixed() }
    : { status: estimate.status };
}

async function buildTaskPreview(
  catalog: IPoolsMockCatalog,
  state: IState,
  request: IPoolTaskRequest,
): Promise<IPoolTaskPreview> {
  const empty: IPoolTaskPreview = {
    pay: [],
    deposit: [],
    receive: [],
    leftover: [],
    valueUsd: '0',
    costUsd: '0',
  };
  switch (request.kind) {
    case 'add': {
      const { params } = request;
      const pool = getPool(catalog, params.poolId);
      const range = resolveAddRange(state, params);
      const shownRange =
        pool.capabilities.priceRange &&
        range.tickLower !== undefined &&
        range.tickUpper !== undefined
          ? { tickLower: range.tickLower, tickUpper: range.tickUpper }
          : undefined;
      if (params.mode === 'zap') {
        const input = getAsset(catalog, params.inputAssetId);
        const plan = await planZapIn(catalog, { ...params, ...range });
        assertAddsLiquidity(plan.liquidity);
        return {
          ...empty,
          range: shownRange,
          apr: getAddApr(pool, range, {
            liquidity: plan.liquidity,
            valueUsd: plan.depositUsd,
          }),
          pay: [tokenAmount(input, bn(plan.amountIn))],
          deposit: amountsOf([
            { asset: pool.token0, amount: bn(plan.used0) },
            { asset: pool.token1, amount: bn(plan.used1) },
          ]),
          leftover: amountsOf(
            [
              { asset: pool.token0, amount: bn(plan.leftover0) },
              { asset: pool.token1, amount: bn(plan.leftover1) },
            ].filter(({ asset, amount }) =>
              amount.times(asset.priceUsd).gte(DUST_USD),
            ),
          ),
          valueUsd: plan.depositUsd,
          costUsd: plan.costUsd,
        };
      }
      const fit = fitDeposit(
        pool,
        range,
        bn(params.amount0),
        bn(params.amount1),
      );
      assertAddsLiquidity(fit.liquidity);
      const payWithNative = Boolean(params.payWithNative);
      const valueUsd = getAmountsValueUsd({
        amount0: fit.used0,
        amount1: fit.used1,
        price0Usd: pool.token0.priceUsd,
        price1Usd: pool.token1.priceUsd,
      });
      return {
        ...empty,
        range: shownRange,
        apr: getAddApr(pool, range, { liquidity: fit.liquidity, valueUsd }),
        pay: amountsOf([
          {
            asset: getPayAsset(catalog, pool, 0, payWithNative),
            amount: fit.used0,
          },
          {
            asset: getPayAsset(catalog, pool, 1, payWithNative),
            amount: fit.used1,
          },
        ]),
        deposit: amountsOf([
          { asset: pool.token0, amount: fit.used0 },
          { asset: pool.token1, amount: fit.used1 },
        ]),
        valueUsd: valueUsd.toFixed(2),
      };
    }
    case 'remove':
    case 'exit': {
      const preview = previewRemove(catalog, state, {
        positionIds:
          request.kind === 'remove'
            ? [request.params.positionId]
            : request.params.positionIds,
        percent: request.params.percent,
        targetAssetId: request.params.targetAssetId,
      });
      if (preview.zapOut) {
        const target = getAsset(catalog, preview.zapOut.targetAssetId);
        return {
          ...empty,
          receive: [tokenAmount(target, bn(preview.zapOut.expectedOut))],
          valueUsd: bn(preview.zapOut.expectedOut)
            .times(target.priceUsd)
            .toFixed(2),
          costUsd: preview.zapOut.costUsd,
        };
      }
      return {
        ...empty,
        receive: preview.received.filter((item) => bn(item.amount).gt(0)),
        valueUsd: preview.receivedUsd,
      };
    }
    case 'collect': {
      const position = getPosition(state, request.positionId);
      const pool = getPool(catalog, position.poolId);
      return {
        ...empty,
        receive: amountsOf([
          { asset: pool.token0, amount: bn(position.uncollectedFees0) },
          { asset: pool.token1, amount: bn(position.uncollectedFees1) },
        ]),
        valueUsd: getAmountsValueUsd({
          amount0: position.uncollectedFees0,
          amount1: position.uncollectedFees1,
          price0Usd: pool.token0.priceUsd,
          price1Usd: pool.token1.priceUsd,
        }).toFixed(2),
      };
    }
    default:
      return empty;
  }
}

function getTaskKind(request: IPoolTaskRequest) {
  switch (request.kind) {
    case 'add':
      if (request.params.mode === 'zap') {
        return EPoolTaskKind.ZapIn;
      }
      return request.params.positionId
        ? EPoolTaskKind.IncreaseLiquidity
        : EPoolTaskKind.AddLiquidity;
    case 'remove':
      return request.params.targetAssetId
        ? EPoolTaskKind.ZapOut
        : EPoolTaskKind.RemoveLiquidity;
    case 'collect':
      return EPoolTaskKind.CollectFees;
    case 'exit':
      return EPoolTaskKind.ExitToToken;
    default:
      throw new OneKeyLocalError('Unknown pool task');
  }
}

function getRequestPositionIds(request: IPoolTaskRequest) {
  switch (request.kind) {
    case 'add':
      return request.params.positionId ? [request.params.positionId] : [];
    case 'remove':
      return [request.params.positionId];
    case 'collect':
      return [request.positionId];
    case 'exit':
      return request.params.positionIds;
    default:
      return [];
  }
}

/** Drop tasks that never moved assets and keep a short done history */
function pruneTasks(state: IState) {
  const done = state.tasks.filter(
    (task) => task.status === EPoolTaskStatus.Done,
  );
  const keptDone = new Set(
    done
      .toSorted((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, MAX_DONE_TASKS)
      .map((task) => task.id),
  );
  state.tasks = state.tasks.filter(
    (task) => keptDone.has(task.id) || isUnfinishedTask(task),
  );
}

export async function createTask(
  catalog: IPoolsMockCatalog,
  state: IState,
  request: IPoolTaskRequest,
  now: number,
): Promise<IPoolTask> {
  let planned: IPlannedStep[];
  let networkId: string;
  switch (request.kind) {
    case 'add':
      planned = await planAddSteps(catalog, state, request.params);
      networkId = getPool(catalog, request.params.poolId).networkId;
      break;
    case 'remove':
      planned = planRemoveSteps(catalog, state, {
        positionIds: [request.params.positionId],
        percent: request.params.percent,
        targetAssetId: request.params.targetAssetId,
      });
      networkId = getPosition(state, request.params.positionId).networkId;
      break;
    case 'collect': {
      const position = getPosition(state, request.positionId);
      planned = [
        {
          kind: EPoolTaskStepKind.CollectFees,
          poolId: position.poolId,
          positionId: position.id,
        },
      ];
      networkId = position.networkId;
      break;
    }
    case 'exit':
      if (!request.params.positionIds.length) {
        throw new OneKeyLocalError('Select at least one position');
      }
      planned = planRemoveSteps(catalog, state, request.params);
      networkId = getPosition(state, request.params.positionIds[0]).networkId;
      break;
    default:
      throw new OneKeyLocalError('Unknown pool task');
  }

  const preview = await buildTaskPreview(catalog, state, request);
  pruneTasks(state);
  const id = `pools-task-${now}-${state.tasks.length}`;
  const positionIds = getRequestPositionIds(request);
  const poolIds = Array.from(
    new Set(
      planned
        .map((step) => step.poolId)
        .filter((poolId): poolId is string => Boolean(poolId)),
    ),
  );
  const task: IPoolTask = {
    id,
    kind: getTaskKind(request),
    networkId,
    owner: POOLS_DEMO_OWNER,
    poolIds,
    positionIds,
    status: EPoolTaskStatus.Running,
    steps: planned.map((step, index) => ({
      ...step,
      id: makeStepId(id, index),
      status: EPoolTaskStepStatus.Pending,
    })),
    createdAt: now,
    updatedAt: now,
    request,
    preview,
  };
  state.tasks.push(task);
  return task;
}

export function getTask(state: IState, taskId: string) {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) {
    throw new OneKeyLocalError(`Task not found: ${taskId}`);
  }
  return task;
}

function getBalance(state: IState, assetId: string) {
  return bn(state.balances[assetId]);
}

function addBalance(state: IState, asset: IPoolAsset, amount: BigNumber) {
  state.balances[asset.id] = toAmountString(
    getBalance(state, asset.id).plus(amount),
    asset.decimals,
  );
}

function spendBalance(state: IState, asset: IPoolAsset, amount: BigNumber) {
  const balance = getBalance(state, asset.id);
  // Tolerate rounding dust from repeated decimal conversions
  if (
    balance.plus(new PoolsBigNumber(1).shiftedBy(-asset.decimals)).lt(amount)
  ) {
    throw new OneKeyLocalError(`Not enough ${asset.symbol}`);
  }
  state.balances[asset.id] = toAmountString(
    PoolsBigNumber.max(balance.minus(amount), 0),
    asset.decimals,
  );
}

/** What earlier steps of this task actually delivered, by asset */
function sumDelivered(
  task: IPoolTask,
  kinds: EPoolTaskStepKind[],
  assetId: string,
) {
  return task.steps
    .filter(
      (step) =>
        kinds.includes(step.kind) && step.status === EPoolTaskStepStatus.Done,
    )
    .flatMap((step) => step.received ?? [])
    .filter((item) => item.assetId === assetId)
    .reduce((sum, item) => sum.plus(item.amount), new PoolsBigNumber(0));
}

function runSwap(
  catalog: IPoolsMockCatalog,
  state: IState,
  task: IPoolTask,
  step: IPoolTaskStep,
) {
  if (!step.tokenIn || !step.tokenOut) {
    throw new OneKeyLocalError('Swap step is missing its tokens');
  }
  const from = getAsset(catalog, step.tokenIn.assetId);
  const to = getAsset(catalog, step.tokenOut.assetId);
  // Zap out swaps what the removal actually returned, never older wallet
  // funds of the same token (doc §3.8)
  const removed = sumDelivered(
    task,
    [EPoolTaskStepKind.RemoveLiquidity],
    from.id,
  );
  const amountIn = task.steps.some(
    (item) => item.kind === EPoolTaskStepKind.RemoveLiquidity,
  )
    ? removed
    : bn(step.tokenIn.amount);
  const quote = quoteSwap(catalog, {
    fromAssetId: from.id,
    toAssetId: to.id,
    amountIn,
  });
  spendBalance(state, from, amountIn);
  addBalance(state, to, bn(quote.amountOut));
  step.tokenIn = tokenAmount(from, amountIn);
  step.tokenOut = tokenAmount(to, bn(quote.amountOut));
  step.received = [step.tokenOut];
}

function nextPositionId(state: IState, pool: IPool) {
  const tokenId = String(state.nextTokenId);
  state.nextTokenId += 1;
  return {
    tokenId,
    id: `${pool.networkId}:uniswap:${pool.version}:${tokenId}`,
  };
}

function runAdd(
  catalog: IPoolsMockCatalog,
  state: IState,
  task: IPoolTask,
  step: IPoolTaskStep,
  now: number,
) {
  if (task.request.kind !== 'add') {
    throw new OneKeyLocalError('Add step outside an add task');
  }
  const { params } = task.request;
  const pool = getPool(catalog, params.poolId);
  const existing = params.positionId
    ? getPosition(state, params.positionId)
    : undefined;
  const range = resolveAddRange(state, params);

  // Swap outputs this task produced, plus the input part kept as is
  const available = [pool.token0, pool.token1].map((token, side) => {
    if (params.mode === 'both') {
      return bn(side === 0 ? params.amount0 : params.amount1);
    }
    return sumDelivered(task, [EPoolTaskStepKind.Swap], token.id);
  });
  if (params.mode === 'zap') {
    const input = getAsset(catalog, params.inputAssetId);
    const directSide = getDirectSide(pool, input);
    if (directSide !== undefined) {
      const swappedTotal = task.steps
        .filter(
          (item) =>
            item.kind === EPoolTaskStepKind.Swap &&
            item.status === EPoolTaskStepStatus.Done,
        )
        .reduce(
          (sum, item) => sum.plus(item.tokenIn?.amount ?? 0),
          new PoolsBigNumber(0),
        );
      available[directSide] = available[directSide].plus(
        bn(params.amountIn).minus(swappedTotal),
      );
    }
  }

  const fit = fitDeposit(pool, range, available[0], available[1]);
  if (bn(fit.liquidity).lte(0)) {
    throw new OneKeyLocalError('Amounts too small to add');
  }
  const payNative =
    params.mode === 'both'
      ? Boolean(params.payWithNative)
      : getAsset(catalog, params.inputAssetId).isNative;
  const pay0 = getPayAsset(catalog, pool, 0, Boolean(payNative));
  const pay1 = getPayAsset(catalog, pool, 1, Boolean(payNative));
  spendBalance(state, pay0, fit.used0);
  spendBalance(state, pay1, fit.used1);
  step.spent = [tokenAmount(pay0, fit.used0), tokenAmount(pay1, fit.used1)];

  if (!pool.capabilities.priceRange) {
    // One share position per pool; adding again tops it up
    const shareId = `${pool.id}:${POOLS_DEMO_OWNER}`;
    const position = state.positions.find((item) => item.id === shareId);
    if (position) {
      position.lpBalance = bn(position.lpBalance)
        .plus(fit.liquidity)
        .toFixed(18);
    } else {
      state.positions.push({
        id: shareId,
        poolId: pool.id,
        networkId: pool.networkId,
        owner: POOLS_DEMO_OWNER,
        lpBalance: fit.liquidity,
        uncollectedFees0: '0',
        uncollectedFees1: '0',
        createdAt: now,
      });
    }
    task.resultPositionId = shareId;
    return;
  }

  if (existing) {
    existing.liquidity = (
      BigInt(existing.liquidity ?? '0') + BigInt(fit.liquidity)
    ).toString();
    task.resultPositionId = existing.id;
    return;
  }
  const { id, tokenId } = nextPositionId(state, pool);
  state.positions.push({
    id,
    poolId: pool.id,
    networkId: pool.networkId,
    owner: POOLS_DEMO_OWNER,
    tokenId,
    tickLower: range.tickLower,
    tickUpper: range.tickUpper,
    liquidity: fit.liquidity,
    uncollectedFees0: '0',
    uncollectedFees1: '0',
    createdAt: now,
  });
  task.resultPositionId = id;
}

function getRequestPercent(request: IPoolTaskRequest) {
  if (request.kind === 'remove' || request.kind === 'exit') {
    return request.params.percent;
  }
  throw new OneKeyLocalError('Remove step outside a remove task');
}

function runRemove(
  catalog: IPoolsMockCatalog,
  state: IState,
  task: IPoolTask,
  step: IPoolTaskStep,
) {
  const position = getPosition(state, step.positionId ?? '');
  const percent = Math.min(Math.max(getRequestPercent(task.request), 0), 1);
  const { pool, amount0, amount1, fees0, fees1 } = getRemovalAmounts(
    catalog,
    position,
    percent,
  );
  const total0 = amount0.plus(fees0);
  const total1 = amount1.plus(fees1);
  addBalance(state, pool.token0, total0);
  addBalance(state, pool.token1, total1);
  step.received = [
    tokenAmount(pool.token0, total0),
    tokenAmount(pool.token1, total1),
  ];

  if (!pool.capabilities.priceRange) {
    const lp = bn(position.lpBalance);
    position.lpBalance =
      percent >= 1 ? '0' : lp.minus(lp.times(percent)).toFixed(18);
    return;
  }
  const liquidity = BigInt(position.liquidity ?? '0');
  const removed =
    percent >= 1
      ? liquidity
      : BigInt(
          new PoolsBigNumber(liquidity.toString())
            .times(percent)
            .integerValue(BigNumber.ROUND_FLOOR)
            .toFixed(0),
        );
  position.liquidity = (liquidity - removed).toString();
  keepClaimedFees(position, pool, fees0, fees1);
}

/** A remove or a claim pays out the unclaimed fees; the position keeps the tally */
function keepClaimedFees(
  position: IPoolPosition,
  pool: IPool,
  fees0: BigNumber,
  fees1: BigNumber,
) {
  position.collectedFees0 = bn(position.collectedFees0 ?? 0)
    .plus(fees0)
    .toFixed(pool.token0.decimals);
  position.collectedFees1 = bn(position.collectedFees1 ?? 0)
    .plus(fees1)
    .toFixed(pool.token1.decimals);
  position.uncollectedFees0 = '0';
  position.uncollectedFees1 = '0';
}

function runCollect(
  catalog: IPoolsMockCatalog,
  state: IState,
  step: IPoolTaskStep,
) {
  const position = getPosition(state, step.positionId ?? '');
  const pool = getPool(catalog, position.poolId);
  const fees0 = bn(position.uncollectedFees0);
  const fees1 = bn(position.uncollectedFees1);
  addBalance(state, pool.token0, fees0);
  addBalance(state, pool.token1, fees1);
  step.received = [
    tokenAmount(pool.token0, fees0),
    tokenAmount(pool.token1, fees1),
  ];
  keepClaimedFees(position, pool, fees0, fees1);
}

export function getNextStep(task: IPoolTask) {
  return task.steps.find((step) => step.status !== EPoolTaskStepStatus.Done);
}

/** Marks the next step as sent, before the simulated chain delay */
export function submitTaskStep(state: IState, taskId: string, now: number) {
  const task = getTask(state, taskId);
  if (
    task.status === EPoolTaskStatus.Done ||
    task.status === EPoolTaskStatus.Abandoned
  ) {
    throw new OneKeyLocalError('This task has ended');
  }
  const step = getNextStep(task);
  if (!step) {
    throw new OneKeyLocalError('Nothing left to run');
  }
  step.status = EPoolTaskStepStatus.Submitted;
  step.error = undefined;
  task.status = EPoolTaskStatus.Running;
  task.updatedAt = now;
  return task;
}

/** Lands the submitted step: applies its effect, or fails it */
export function settleTaskStep(
  catalog: IPoolsMockCatalog,
  state: IState,
  taskId: string,
  now: number,
) {
  const task = getTask(state, taskId);
  const step = getNextStep(task);
  if (!step) {
    return task;
  }
  task.updatedAt = now;
  const fail = (message: string) => {
    step.status = EPoolTaskStepStatus.Failed;
    step.error = message;
    task.status = EPoolTaskStatus.Stopped;
    return task;
  };
  if (state.failNextStep) {
    state.failNextStep = false;
    return fail('Transaction failed on chain (demo)');
  }
  // A failed step must leave the wallet and positions as they were
  const snapshot = JSON.stringify({
    balances: state.balances,
    positions: state.positions,
    approvals: state.approvals,
    nextTokenId: state.nextTokenId,
  });
  try {
    switch (step.kind) {
      case EPoolTaskStepKind.Approve:
      case EPoolTaskStepKind.ApprovePermit2:
        if (step.tokenIn && step.spenderName) {
          state.approvals[approvalKey(step.tokenIn.assetId, step.spenderName)] =
            true;
        }
        break;
      case EPoolTaskStepKind.SignPermit:
        break;
      case EPoolTaskStepKind.Swap:
        runSwap(catalog, state, task, step);
        break;
      case EPoolTaskStepKind.AddLiquidity:
      case EPoolTaskStepKind.IncreaseLiquidity:
        runAdd(catalog, state, task, step, now);
        break;
      case EPoolTaskStepKind.RemoveLiquidity:
        runRemove(catalog, state, task, step);
        break;
      case EPoolTaskStepKind.CollectFees:
        runCollect(catalog, state, step);
        break;
      default:
        throw new OneKeyLocalError('Unknown step');
    }
  } catch (error) {
    Object.assign(state, JSON.parse(snapshot) as Partial<IState>);
    return fail(error instanceof Error ? error.message : 'Step failed');
  }
  step.status = EPoolTaskStepStatus.Done;
  // Signatures are off-chain, so they get no transaction hash
  step.txId =
    step.kind === EPoolTaskStepKind.SignPermit
      ? undefined
      : mockHex(`${step.id}:${now}`, 32);
  if (!getNextStep(task)) {
    task.status = EPoolTaskStatus.Done;
  }
  return task;
}

/** The user left the flow between steps */
export function stopTask(state: IState, taskId: string, now: number) {
  const task = getTask(state, taskId);
  if (task.status === EPoolTaskStatus.Running) {
    task.status = EPoolTaskStatus.Stopped;
    task.updatedAt = now;
    const step = getNextStep(task);
    if (step && step.status !== EPoolTaskStepStatus.Failed) {
      step.status = EPoolTaskStepStatus.Pending;
    }
  }
  return task;
}

/** Assets stay where they are; nothing is swapped back (doc §3.8) */
export function abandonTask(state: IState, taskId: string, now: number) {
  const task = getTask(state, taskId);
  if (task.status !== EPoolTaskStatus.Done) {
    task.status = EPoolTaskStatus.Abandoned;
    task.updatedAt = now;
  }
  return task;
}
