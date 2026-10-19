import BigNumber from 'bignumber.js';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  REFERENCE_LIQUIDITY,
  alignTick,
  getFullRange,
  getRangePositionAmounts,
  getTickAtSqrtRatio,
  isPoolPriceInverted,
  priceToSqrtRatioX96,
  priceToTick,
} from '@onekeyhq/shared/src/utils/poolsMath';
import { EPoolListingStatus, EPoolType } from '@onekeyhq/shared/types/pools';
import type {
  IPool,
  IPoolAsset,
  IPoolCapabilities,
  IPoolPosition,
  IPoolPricePoint,
  IPoolProtocolVersion,
  IPoolTickLiquidityNet,
} from '@onekeyhq/shared/types/pools';

import {
  POOLS_ASSET_SEEDS,
  POOLS_BALANCE_SEEDS,
  POOLS_POOL_SEEDS,
  POOLS_POSITION_SEEDS,
} from './poolsMockData';

import type {
  IPoolsAssetSeed,
  IPoolsLiquidityShape,
  IPoolsPoolSeed,
} from './poolsMockData';

// Builds the demo's pools from seeds. Every V3/V4 pool gets a synthetic book
// of LP positions, so TVL, reserves, active liquidity and the tick
// distribution agree with each other the way they would on chain.

export const POOLS_DEMO_OWNER = 'demo';

const DAY_MS = 24 * 60 * 60 * 1000;
const SYNTHETIC_POSITION_COUNT = 56;
// Shares of LP value in full-range positions and in stale ranges the price
// has left. Both count in TVL without earning, as on chain, so a range near
// the price earns more than the pool average.
const FULL_RANGE_SHARE = 0.12;
const STALE_RANGE_SHARE = 0.15;
const PRICE_HISTORY_DAYS = 30;

export const POOL_CAPABILITIES: Record<
  IPoolProtocolVersion,
  IPoolCapabilities
> = {
  v2: {
    priceRange: false,
    positionForm: 'FUNGIBLE',
    feeCollection: 'AUTO_COMPOUND',
    nativeToken: 'WRAP',
    approvalModel: 'ERC20_APPROVE',
    hooks: false,
  },
  v3: {
    priceRange: true,
    positionForm: 'NFT',
    feeCollection: 'CLAIMABLE',
    nativeToken: 'WRAP',
    approvalModel: 'ERC20_APPROVE',
    hooks: false,
  },
  v4: {
    priceRange: true,
    positionForm: 'NFT',
    feeCollection: 'CLAIMABLE',
    nativeToken: 'NATIVE',
    approvalModel: 'PERMIT2',
    hooks: true,
  },
};

export const POOL_SPENDER_NAMES: Record<IPoolProtocolVersion, string> = {
  v2: 'Uniswap V2 Router',
  v3: 'Uniswap V3 Position Manager',
  v4: 'Permit2',
};

const POOL_TYPES: Record<IPoolProtocolVersion, EPoolType> = {
  v2: EPoolType.V2Like,
  v3: EPoolType.V3Like,
  v4: EPoolType.V4Like,
};

const TICK_SPACING_BY_FEE: Record<number, number> = {
  100: 1,
  500: 10,
  3000: 60,
  10_000: 200,
};

const SHAPES: Record<
  IPoolsLiquidityShape,
  { center: number; width: number; dailyMove: number }
> = {
  stable: { center: 0.0006, width: 0.0025, dailyMove: 0.0004 },
  volatile: { center: 0.04, width: 0.14, dailyMove: 0.025 },
  stock: { center: 0.03, width: 0.12, dailyMove: 0.018 },
};

function hashString(text: string) {
  // FNV-1a
  let hash = 2_166_136_261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function createRandom(seed: string) {
  // mulberry32, so the demo book is identical on every launch
  let state = hashString(seed);
  return () => {
    state = (state + 0x6d_2b_79_f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function gaussian(random: () => number) {
  const u = Math.max(random(), Number.EPSILON);
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function mockHex(seed: string, bytes: number) {
  let hex = '';
  let round = 0;
  while (hex.length < bytes * 2) {
    hex += hashString(`${seed}:${round}`).toString(16).padStart(8, '0');
    round += 1;
  }
  return `0x${hex.slice(0, bytes * 2)}`;
}

function toAsset(networkId: string, seed: IPoolsAssetSeed): IPoolAsset {
  const address = seed.address.toLowerCase();
  return {
    id: `${networkId}:${address || 'native'}`,
    networkId,
    address,
    symbol: seed.symbol,
    name: seed.name,
    decimals: seed.decimals,
    logoURI: seed.logoURI,
    isNative: !address,
    canonicalId: `${networkId}:${seed.canonical ?? address}`,
    priceUsd: String(seed.priceUsd),
    category: seed.category,
    issuer: seed.issuer,
  };
}

export function buildMockAssets() {
  const assets: IPoolAsset[] = [];
  for (const [networkId, seeds] of Object.entries(POOLS_ASSET_SEEDS)) {
    for (const seed of seeds) {
      assets.push(toAsset(networkId, seed));
    }
  }
  return assets;
}

function findAsset(assets: IPoolAsset[], networkId: string, symbol: string) {
  const asset = assets.find(
    (item) => item.networkId === networkId && item.symbol === symbol,
  );
  if (!asset) {
    throw new OneKeyLocalError(
      `Pools demo asset missing: ${networkId} ${symbol}`,
    );
  }
  return asset;
}

/** Contract order: the native coin first, otherwise by address */
function sortPoolTokens(
  a: IPoolAsset,
  b: IPoolAsset,
): [IPoolAsset, IPoolAsset] {
  if (a.isNative) {
    return [a, b];
  }
  if (b.isNative) {
    return [b, a];
  }
  return a.address < b.address ? [a, b] : [b, a];
}

// Ticks for the synthetic book only; float math is plenty for that
function approximateTick(price: number, decimals0: number, decimals1: number) {
  const rawPrice = price * 10 ** (decimals1 - decimals0);
  return Math.floor(Math.log(rawPrice) / Math.log(1.0001));
}

type IBuiltPool = {
  pool: IPool;
  ticks: IPoolTickLiquidityNet[];
  priceHistory: IPoolPricePoint[];
};

function buildPriceHistory(
  seed: IPoolsPoolSeed,
  price: number,
  now: number,
): IPoolPricePoint[] {
  const random = createRandom(`${seed.key}:history`);
  const { dailyMove } = SHAPES[seed.shape];
  const points: IPoolPricePoint[] = [];
  let current = price;
  for (let day = 0; day < PRICE_HISTORY_DAYS; day += 1) {
    points.push({ time: now - day * DAY_MS, price: String(current) });
    current /= Math.exp(gaussian(random) * dailyMove);
  }
  return points.toReversed();
}

function buildRangeBook({
  seed,
  pool,
  price,
}: {
  seed: IPoolsPoolSeed;
  pool: IPool;
  price: number;
}) {
  const random = createRandom(seed.key);
  const shape = SHAPES[seed.shape];
  const tickSpacing = pool.tickSpacing ?? 60;
  const sqrtRatioX96 = BigInt(pool.sqrtPriceX96 ?? '0');
  const currentTick = pool.currentTick ?? 0;
  const { decimals: decimals0, priceUsd: price0 } = pool.token0;
  const { decimals: decimals1, priceUsd: price1 } = pool.token1;
  const fullRange = getFullRange(tickSpacing);

  const entries = Array.from({ length: SYNTHETIC_POSITION_COUNT }, () => {
    const weight = Math.exp(gaussian(random) * 1.1);
    const kind = random();
    if (kind < FULL_RANGE_SHARE) {
      return { ...fullRange, weight };
    }
    const halfWidth = shape.width * Math.exp(gaussian(random) * 0.6);
    // A stale range sits just beside the price, so the chart stays readable
    const staleOffset =
      (random() < 0.5 ? -1 : 1) * (halfWidth + shape.width * (0.2 + random()));
    const center =
      kind < FULL_RANGE_SHARE + STALE_RANGE_SHARE
        ? staleOffset
        : gaussian(random) * shape.center;
    const tickLower = alignTick({
      tick: approximateTick(
        price * Math.exp(center - halfWidth),
        decimals0,
        decimals1,
      ),
      tickSpacing,
      mode: 'down',
    });
    let tickUpper = alignTick({
      tick: approximateTick(
        price * Math.exp(center + halfWidth),
        decimals0,
        decimals1,
      ),
      tickSpacing,
      mode: 'up',
    });
    if (tickUpper <= tickLower) {
      tickUpper = tickLower + tickSpacing;
    }
    return { tickLower, tickUpper, weight };
  });

  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  const nets = new Map<number, bigint>();
  let activeLiquidity = BigInt(0);
  let reserve0 = new BigNumber(0);
  let reserve1 = new BigNumber(0);

  for (const entry of entries) {
    const valueUsd = (seed.tvlUsd * entry.weight) / totalWeight;
    const reference = getRangePositionAmounts({
      sqrtRatioX96,
      tickLower: entry.tickLower,
      tickUpper: entry.tickUpper,
      decimals0,
      decimals1,
      liquidity: REFERENCE_LIQUIDITY,
    });
    const referenceValue = reference.amount0
      .times(price0)
      .plus(reference.amount1.times(price1));
    if (referenceValue.lte(0)) {
      // oxlint-disable-next-line no-continue
      continue;
    }
    const scale = new BigNumber(valueUsd).div(referenceValue);
    const liquidity = BigInt(
      new BigNumber(REFERENCE_LIQUIDITY.toString())
        .times(scale)
        .integerValue(BigNumber.ROUND_FLOOR)
        .toFixed(0),
    );
    nets.set(
      entry.tickLower,
      (nets.get(entry.tickLower) ?? BigInt(0)) + liquidity,
    );
    nets.set(
      entry.tickUpper,
      (nets.get(entry.tickUpper) ?? BigInt(0)) - liquidity,
    );
    if (entry.tickLower <= currentTick && currentTick < entry.tickUpper) {
      activeLiquidity += liquidity;
    }
    reserve0 = reserve0.plus(reference.amount0.times(scale));
    reserve1 = reserve1.plus(reference.amount1.times(scale));
  }

  const ticks = Array.from(nets.entries())
    .filter(([, net]) => net !== BigInt(0))
    .map(([tick, net]) => ({ tick, liquidityNet: net.toString() }))
    .toSorted((a, b) => a.tick - b.tick);

  return {
    ticks,
    activeLiquidity,
    reserve0: reserve0.toFixed(decimals0, BigNumber.ROUND_FLOOR),
    reserve1: reserve1.toFixed(decimals1, BigNumber.ROUND_FLOOR),
  };
}

function buildPool(
  seed: IPoolsPoolSeed,
  assets: IPoolAsset[],
  now: number,
): IBuiltPool {
  const [token0, token1] = sortPoolTokens(
    findAsset(assets, seed.networkId, seed.symbols[0]),
    findAsset(assets, seed.networkId, seed.symbols[1]),
  );
  const price = Number(token0.priceUsd) / Number(token1.priceUsd);
  const isV4 = seed.version === 'v4';
  const poolKey = mockHex(seed.key, isV4 ? 32 : 20);
  const canonicalPair = [token0.canonicalId, token1.canonicalId]
    .map((id) => id.split(':').slice(1).join(':'))
    .toSorted()
    .join('-');
  const fees24hUsd =
    seed.fees24hUsd ?? (seed.volume24hUsd * seed.feeTier) / 1_000_000;

  const pool: IPool = {
    id: `${seed.networkId}:uniswap:${seed.version}:${poolKey}`,
    networkId: seed.networkId,
    deploymentId: `${seed.networkId}:uniswap:${seed.version}`,
    protocol: 'uniswap',
    version: seed.version,
    poolType: POOL_TYPES[seed.version],
    capabilities: POOL_CAPABILITIES[seed.version],
    poolKey,
    pairKey: `${seed.networkId}:${canonicalPair}`,
    token0,
    token1,
    feeTier: seed.feeTier,
    isDynamicFee: Boolean(seed.isDynamicFee),
    hook: seed.hook
      ? { ...seed.hook, address: mockHex(`${seed.key}:hook`, 20) }
      : undefined,
    listingStatus: seed.unlisted
      ? EPoolListingStatus.Unlisted
      : EPoolListingStatus.Listed,
    tvlUsd: String(seed.tvlUsd),
    volume24hUsd: String(seed.volume24hUsd),
    fees24hUsd: String(fees24hUsd),
    reserve0: '0',
    reserve1: '0',
    aprEstimateSupported: seed.aprEstimateSupported ?? true,
  };

  const priceHistory = buildPriceHistory(seed, price, now);

  if (seed.version === 'v2') {
    const reserve0 = new BigNumber(seed.tvlUsd).div(2).div(token0.priceUsd);
    const reserve1 = new BigNumber(seed.tvlUsd).div(2).div(token1.priceUsd);
    pool.reserve0 = reserve0.toFixed(token0.decimals, BigNumber.ROUND_FLOOR);
    pool.reserve1 = reserve1.toFixed(token1.decimals, BigNumber.ROUND_FLOOR);
    pool.lpTotalSupply = reserve0.times(reserve1).sqrt().toFixed(18);
    return { pool, ticks: [], priceHistory };
  }

  const sqrtRatioX96 = priceToSqrtRatioX96({
    price,
    decimals0: token0.decimals,
    decimals1: token1.decimals,
  });
  pool.tickSpacing = TICK_SPACING_BY_FEE[seed.feeTier] ?? 60;
  pool.sqrtPriceX96 = sqrtRatioX96.toString();
  pool.currentTick = getTickAtSqrtRatio(sqrtRatioX96);

  const book = buildRangeBook({ seed, pool, price });
  pool.activeLiquidity = book.activeLiquidity.toString();
  pool.reserve0 = book.reserve0;
  pool.reserve1 = book.reserve1;
  return { pool, ticks: book.ticks, priceHistory };
}

export type IPoolsMockCatalog = {
  assets: IPoolAsset[];
  pools: IPool[];
  ticksByPoolId: Record<string, IPoolTickLiquidityNet[]>;
  priceHistoryByPoolId: Record<string, IPoolPricePoint[]>;
  poolIdBySeedKey: Record<string, string>;
};

export function buildMockCatalog(now: number): IPoolsMockCatalog {
  const assets = buildMockAssets();
  const catalog: IPoolsMockCatalog = {
    assets,
    pools: [],
    ticksByPoolId: {},
    priceHistoryByPoolId: {},
    poolIdBySeedKey: {},
  };
  for (const seed of POOLS_POOL_SEEDS) {
    const built = buildPool(seed, assets, now);
    catalog.pools.push(built.pool);
    catalog.ticksByPoolId[built.pool.id] = built.ticks;
    catalog.priceHistoryByPoolId[built.pool.id] = built.priceHistory;
    catalog.poolIdBySeedKey[seed.key] = built.pool.id;
  }
  return catalog;
}

/** Ticks of a range given as offsets from the displayed price */
function rangeFromDisplayPercent(
  pool: IPool,
  [lowerPercent, upperPercent]: [number, number],
) {
  const tickSpacing = pool.tickSpacing ?? 60;
  const decimals = {
    decimals0: pool.token0.decimals,
    decimals1: pool.token1.decimals,
  };
  const price = Number(pool.token0.priceUsd) / Number(pool.token1.priceUsd);
  const inverted = isPoolPriceInverted(pool);
  // Inverting the price swaps which display bound maps to which tick
  const priceLower = inverted
    ? price / (1 + upperPercent)
    : price * (1 + lowerPercent);
  const priceUpper = inverted
    ? price / (1 + lowerPercent)
    : price * (1 + upperPercent);
  const tickLower = alignTick({
    tick: priceToTick({
      price: priceLower,
      ...decimals,
    }),
    tickSpacing,
  });
  let tickUpper = alignTick({
    tick: priceToTick({
      price: priceUpper,
      ...decimals,
    }),
    tickSpacing,
  });
  if (tickUpper <= tickLower) {
    tickUpper = tickLower + tickSpacing;
  }
  return { tickLower, tickUpper };
}

export function buildSeedPositions(
  catalog: IPoolsMockCatalog,
  now: number,
): IPoolPosition[] {
  return POOLS_POSITION_SEEDS.map((seed) => {
    const pool = catalog.pools.find(
      (item) => item.id === catalog.poolIdBySeedKey[seed.poolKey],
    );
    if (!pool) {
      throw new OneKeyLocalError(`Pools demo pool missing: ${seed.poolKey}`);
    }
    const price0 = new BigNumber(pool.token0.priceUsd);
    const price1 = new BigNumber(pool.token1.priceUsd);
    const halfFees = new BigNumber(seed.feesUsd).div(2);
    const base = {
      poolId: pool.id,
      networkId: pool.networkId,
      owner: POOLS_DEMO_OWNER,
      uncollectedFees0: halfFees.div(price0).toFixed(pool.token0.decimals),
      uncollectedFees1: halfFees.div(price1).toFixed(pool.token1.decimals),
      createdAt: now - seed.daysAgo * DAY_MS,
    };

    if (pool.version === 'v2') {
      const share = new BigNumber(seed.valueUsd).div(pool.tvlUsd);
      return {
        ...base,
        id: `${pool.id}:${POOLS_DEMO_OWNER}`,
        lpBalance: share.times(pool.lpTotalSupply ?? 0).toFixed(18),
        uncollectedFees0: '0',
        uncollectedFees1: '0',
      };
    }

    const range = rangeFromDisplayPercent(
      pool,
      seed.rangePercent ?? [-0.1, 0.1],
    );
    const reference = getRangePositionAmounts({
      sqrtRatioX96: BigInt(pool.sqrtPriceX96 ?? '0'),
      ...range,
      decimals0: pool.token0.decimals,
      decimals1: pool.token1.decimals,
      liquidity: REFERENCE_LIQUIDITY,
    });
    const referenceValue = reference.amount0
      .times(price0)
      .plus(reference.amount1.times(price1));
    const liquidity = new BigNumber(REFERENCE_LIQUIDITY.toString())
      .times(seed.valueUsd)
      .div(referenceValue)
      .integerValue(BigNumber.ROUND_FLOOR);
    return {
      ...base,
      id: `${pool.networkId}:uniswap:${pool.version}:${seed.tokenId ?? ''}`,
      tokenId: seed.tokenId,
      ...range,
      liquidity: liquidity.toFixed(0),
    };
  });
}

export function buildSeedBalances(catalog: IPoolsMockCatalog) {
  const balances: Record<string, string> = {};
  for (const [networkId, amounts] of Object.entries(POOLS_BALANCE_SEEDS)) {
    for (const [symbol, amount] of Object.entries(amounts)) {
      const asset = findAsset(catalog.assets, networkId, symbol);
      balances[asset.id] = String(amount);
    }
  }
  return balances;
}
