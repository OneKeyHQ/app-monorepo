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
import { EPoolType } from '@onekeyhq/shared/types/pools';
import type {
  IPool,
  IPoolAsset,
  IPoolCapabilities,
  IPoolPosition,
  IPoolPricePoint,
  IPoolProtocolVersion,
  IPoolStatsWindow,
  IPoolTickLiquidityNet,
  IPoolWindowStats,
} from '@onekeyhq/shared/types/pools';

import { getTrackedTvlUsd, isBelowPoolListFloors } from './poolsListing';
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
const HOUR_MS = 60 * 60 * 1000;
// Pools are this many days old at least and at most
const POOL_AGE_DAYS = { min: 40, max: 1300 };
// Synthetic positions were opened up to this long ago
const BOOK_MAX_AGE_DAYS = 180;

export const POOL_STATS_WINDOW_DAYS: Record<IPoolStatsWindow, number> = {
  '1D': 1,
  '1W': 7,
  '1M': 30,
};

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
    hasUntrustedPrice: seed.untrustedPrice || undefined,
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

/** One synthetic LP position behind a range pool's liquidity */
export type IPoolsBookEntry = {
  tokenId: string;
  owner: string;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  valueUsd: number;
  ageDays: number;
};

type IBuiltPool = {
  pool: IPool;
  ticks: IPoolTickLiquidityNet[];
  priceSeries: IPoolPricePoint[];
  book: IPoolsBookEntry[];
  windows: Record<IPoolStatsWindow, IPoolWindowStats>;
  createdAt: number;
};

// The walk's steps, newest stretch first: finer where it is recent, so the
// 1D, 1W, 1M and 1Y charts all read from one history and agree
const PRICE_SERIES_SEGMENTS = [
  { untilMs: DAY_MS, stepMs: 15 * 60 * 1000 },
  { untilMs: 7 * DAY_MS, stepMs: HOUR_MS },
  { untilMs: 30 * DAY_MS, stepMs: 4 * HOUR_MS },
  { untilMs: 365 * DAY_MS, stepMs: DAY_MS },
];

/** A random walk back from today's price, oldest point first */
function buildPriceSeries(
  seed: IPoolsPoolSeed,
  price: number,
  now: number,
): IPoolPricePoint[] {
  const random = createRandom(`${seed.key}:history`);
  const { dailyMove } = SHAPES[seed.shape];
  const points: IPoolPricePoint[] = [];
  let current = price;
  let ageMs = 0;
  for (const segment of PRICE_SERIES_SEGMENTS) {
    const move = dailyMove * Math.sqrt(segment.stepMs / DAY_MS);
    while (ageMs < segment.untilMs) {
      points.push({ time: now - ageMs, price: String(current) });
      current /= Math.exp(gaussian(random) * move);
      ageMs += segment.stepMs;
    }
  }
  points.push({ time: now - ageMs, price: String(current) });
  return points.toReversed();
}

/** How busy the pool is over time: slow waves, so weeks and months differ */
function createActivityWave(seed: IPoolsPoolSeed) {
  const random = createRandom(`${seed.key}:activity`);
  const waves = [
    { periodDays: 3.1, amplitude: 0.12 },
    { periodDays: 9.7, amplitude: 0.22 },
    { periodDays: 37, amplitude: 0.18 },
  ].map((wave) => ({ ...wave, phase: random() * 2 * Math.PI }));
  return (time: number) =>
    waves.reduce(
      (sum, wave) =>
        sum +
        wave.amplitude *
          Math.sin(
            (2 * Math.PI * time) / (wave.periodDays * DAY_MS) + wave.phase,
          ),
      0,
    );
}

/**
 * Volume for each point's interval: busier when the price moves, with noise
 * and slow waves, scaled so the last 24h match the seed's 24h volume.
 */
function addVolumes(
  seed: IPoolsPoolSeed,
  points: IPoolPricePoint[],
  now: number,
): IPoolPricePoint[] {
  const random = createRandom(`${seed.key}:volume`);
  const { dailyMove } = SHAPES[seed.shape];
  const wave = createActivityWave(seed);
  const raw = points.map((point, index) => {
    const previous = points[index - 1] ?? points[index + 1] ?? point;
    const stepMs = Math.abs(point.time - previous.time);
    const expectedMove = dailyMove * Math.sqrt(Math.max(stepMs, 1) / DAY_MS);
    const move = Math.abs(
      Math.log(Number(point.price) / Number(previous.price)),
    );
    const activity =
      Math.exp(wave(point.time) + gaussian(random) * 0.3) *
      (1 + (2 * move) / Math.max(expectedMove, 1e-9));
    return stepMs * activity;
  });
  const lastDay = points.reduce(
    (sum, point, index) => (now - point.time < DAY_MS ? sum + raw[index] : sum),
    0,
  );
  const scale = lastDay > 0 ? seed.volume24hUsd / lastDay : 0;
  return points.map((point, index) => ({
    ...point,
    volumeUsd: (raw[index] * scale).toFixed(2),
  }));
}

/** Volume in (now − fromAgo, now − toAgo] */
function sumVolume(
  points: IPoolPricePoint[],
  now: number,
  fromAgoMs: number,
  toAgoMs: number,
) {
  let sum = 0;
  for (const point of points) {
    const ageMs = now - point.time;
    if (ageMs < fromAgoMs && ageMs >= toAgoMs) {
      sum += Number(point.volumeUsd ?? 0);
    }
  }
  return sum;
}

function change(current: number, previous: number) {
  return previous > 0 ? String(current / previous - 1) : undefined;
}

/** Each window against the one before it */
function buildWindowStats(
  seed: IPoolsPoolSeed,
  points: IPoolPricePoint[],
  now: number,
): Record<IPoolStatsWindow, IPoolWindowStats> {
  const random = createRandom(`${seed.key}:tvl`);
  const feeRatio =
    (seed.fees24hUsd ?? (seed.volume24hUsd * seed.feeTier) / 1_000_000) /
    seed.volume24hUsd;
  const entries = (
    Object.entries(POOL_STATS_WINDOW_DAYS) as [IPoolStatsWindow, number][]
  ).map(([window, days]) => {
    const spanMs = days * DAY_MS;
    // The 1D window is exactly the seed's 24h figures
    const volume =
      window === '1D' ? seed.volume24hUsd : sumVolume(points, now, spanMs, 0);
    const previousVolume = sumVolume(points, now, 2 * spanMs, spanMs);
    const fees = volume * feeRatio;
    const previousFees = previousVolume * feeRatio;
    const tvlChange = gaussian(random) * 0.025 * Math.sqrt(days);
    const previousTvl = seed.tvlUsd / (1 + tvlChange);
    const apr = (fees * 365) / days / seed.tvlUsd;
    const previousApr = (previousFees * 365) / days / previousTvl;
    const stats: IPoolWindowStats = {
      volumeUsd: volume.toFixed(2),
      feesUsd: fees.toFixed(2),
      apr: String(apr),
      tvlChange: String(tvlChange),
      volumeChange: change(volume, previousVolume),
      feesChange: change(fees, previousFees),
      // A rate changes by points: 34% after 33% is +1 point, not +3%
      aprChange: previousApr > 0 ? String(apr - previousApr) : undefined,
    };
    return [window, stats] as const;
  });
  return Object.fromEntries(entries) as Record<
    IPoolStatsWindow,
    IPoolWindowStats
  >;
}

function buildRangeBook({
  seed,
  pool,
  price,
  maxAgeDays,
}: {
  seed: IPoolsPoolSeed;
  pool: IPool;
  price: number;
  maxAgeDays: number;
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
  const book: IPoolsBookEntry[] = [];

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
    book.push({
      tokenId: String(100_000 + Math.floor(random() * 1_400_000)),
      owner: mockHex(`${seed.key}:owner:${book.length}`, 20),
      tickLower: entry.tickLower,
      tickUpper: entry.tickUpper,
      liquidity,
      valueUsd,
      ageDays: 1 + random() * (maxAgeDays - 1),
    });
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
    book,
  };
}

/**
 * A seed's TVL as the list counts it. With a token that has no trusted
 * price, the seed's own figure is the raw sum at the pool's price, and
 * `trustedSideUsd` is the part that can be believed.
 */
function getSeedTrackedTvlUsd(
  seed: IPoolsPoolSeed,
  token0: IPoolAsset,
  token1: IPoolAsset,
) {
  const trusted0 = !token0.hasUntrustedPrice;
  const trusted1 = !token1.hasUntrustedPrice;
  if (trusted0 && trusted1) {
    return seed.tvlUsd;
  }
  const trustedSideUsd = seed.trustedSideUsd ?? 0;
  const otherSideUsd = seed.tvlUsd - trustedSideUsd;
  return getTrackedTvlUsd({
    value0Usd: trusted0 ? trustedSideUsd : otherSideUsd,
    value1Usd: trusted1 ? trustedSideUsd : otherSideUsd,
    trusted0,
    trusted1,
  });
}

function buildPool(
  rawSeed: IPoolsPoolSeed,
  assets: IPoolAsset[],
  now: number,
): IBuiltPool {
  const [token0, token1] = sortPoolTokens(
    findAsset(assets, rawSeed.networkId, rawSeed.symbols[0]),
    findAsset(assets, rawSeed.networkId, rawSeed.symbols[1]),
  );
  // Everything built from here on (liquidity, stats, APR) uses the TVL the
  // list counts, so the pool reads the same on every screen
  const seed: IPoolsPoolSeed = {
    ...rawSeed,
    tvlUsd: getSeedTrackedTvlUsd(rawSeed, token0, token1),
  };
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
    isOffList: isBelowPoolListFloors({
      tvlUsd: seed.tvlUsd,
      volume24hUsd: seed.volume24hUsd,
      fees24hUsd,
    }),
    tvlUsd: String(seed.tvlUsd),
    volume24hUsd: String(seed.volume24hUsd),
    fees24hUsd: String(fees24hUsd),
    reserve0: '0',
    reserve1: '0',
    aprEstimateSupported: seed.aprEstimateSupported ?? true,
  };

  const ageRandom = createRandom(`${seed.key}:age`);
  const ageDays =
    seed.ageDays ??
    Math.round(
      POOL_AGE_DAYS.min + ageRandom() * (POOL_AGE_DAYS.max - POOL_AGE_DAYS.min),
    );
  const createdAt = now - ageDays * DAY_MS;
  const fullSeries = buildPriceSeries(seed, price, now);
  // A pool seeded as young has no prices or volume from before it existed
  const series =
    seed.ageDays === undefined
      ? fullSeries
      : fullSeries.filter((point) => point.time >= createdAt);
  const priceSeries = addVolumes(seed, series, now);
  const windows = buildWindowStats(seed, priceSeries, now);

  if (seed.version === 'v2') {
    const reserve0 = new BigNumber(seed.tvlUsd).div(2).div(token0.priceUsd);
    const reserve1 = new BigNumber(seed.tvlUsd).div(2).div(token1.priceUsd);
    pool.reserve0 = reserve0.toFixed(token0.decimals, BigNumber.ROUND_FLOOR);
    pool.reserve1 = reserve1.toFixed(token1.decimals, BigNumber.ROUND_FLOOR);
    pool.lpTotalSupply = reserve0.times(reserve1).sqrt().toFixed(18);
    return { pool, ticks: [], priceSeries, book: [], windows, createdAt };
  }

  const sqrtRatioX96 = priceToSqrtRatioX96({
    price,
    decimals0: token0.decimals,
    decimals1: token1.decimals,
  });
  pool.tickSpacing = TICK_SPACING_BY_FEE[seed.feeTier] ?? 60;
  pool.sqrtPriceX96 = sqrtRatioX96.toString();
  pool.currentTick = getTickAtSqrtRatio(sqrtRatioX96);

  const rangeBook = buildRangeBook({
    seed,
    pool,
    price,
    // Nobody can have held a range for longer than the pool has existed
    maxAgeDays:
      seed.ageDays === undefined
        ? BOOK_MAX_AGE_DAYS
        : Math.min(BOOK_MAX_AGE_DAYS, seed.ageDays),
  });
  pool.activeLiquidity = rangeBook.activeLiquidity.toString();
  pool.reserve0 = rangeBook.reserve0;
  pool.reserve1 = rangeBook.reserve1;
  return {
    pool,
    ticks: rangeBook.ticks,
    priceSeries,
    book: rangeBook.book,
    windows,
    createdAt,
  };
}

export type IPoolsMockCatalog = {
  assets: IPoolAsset[];
  pools: IPool[];
  ticksByPoolId: Record<string, IPoolTickLiquidityNet[]>;
  /** Daily closes of the last 30 days */
  priceHistoryByPoolId: Record<string, IPoolPricePoint[]>;
  /** The whole year, finer toward today; the price chart's ranges cut it */
  priceSeriesByPoolId: Record<string, IPoolPricePoint[]>;
  /** Range pools only: the positions their liquidity is made of */
  bookByPoolId: Record<string, IPoolsBookEntry[]>;
  windowStatsByPoolId: Record<
    string,
    Record<IPoolStatsWindow, IPoolWindowStats>
  >;
  createdAtByPoolId: Record<string, number>;
  poolIdBySeedKey: Record<string, string>;
};

export function buildMockCatalog(now: number): IPoolsMockCatalog {
  const assets = buildMockAssets();
  const catalog: IPoolsMockCatalog = {
    assets,
    pools: [],
    ticksByPoolId: {},
    priceHistoryByPoolId: {},
    priceSeriesByPoolId: {},
    bookByPoolId: {},
    windowStatsByPoolId: {},
    createdAtByPoolId: {},
    poolIdBySeedKey: {},
  };
  for (const seed of POOLS_POOL_SEEDS) {
    const built = buildPool(seed, assets, now);
    catalog.pools.push(built.pool);
    catalog.ticksByPoolId[built.pool.id] = built.ticks;
    catalog.priceSeriesByPoolId[built.pool.id] = built.priceSeries;
    catalog.bookByPoolId[built.pool.id] = built.book;
    catalog.windowStatsByPoolId[built.pool.id] = built.windows;
    catalog.createdAtByPoolId[built.pool.id] = built.createdAt;
    catalog.priceHistoryByPoolId[built.pool.id] = built.priceSeries.filter(
      (point) =>
        now - point.time < PRICE_HISTORY_DAYS * DAY_MS &&
        (now - point.time) % DAY_MS === 0,
    );
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
    const claimedRounds = Math.floor(seed.daysAgo / 14);
    const base = {
      poolId: pool.id,
      networkId: pool.networkId,
      owner: POOLS_DEMO_OWNER,
      uncollectedFees0: halfFees.div(price0).toFixed(pool.token0.decimals),
      uncollectedFees1: halfFees.div(price1).toFixed(pool.token1.decimals),
      // Claimed every two weeks or so, at about the rate it earns now
      collectedFees0: halfFees
        .times(claimedRounds)
        .div(price0)
        .toFixed(pool.token0.decimals),
      collectedFees1: halfFees
        .times(claimedRounds)
        .div(price1)
        .toFixed(pool.token1.decimals),
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
        collectedFees0: undefined,
        collectedFees1: undefined,
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
