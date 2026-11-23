import type {
  IPool,
  IPoolListItem,
  IPoolProtocol,
  IPoolProtocolVersion,
  IPoolStatsWindow,
} from '@onekeyhq/shared/types/pools';

import { isStockPool } from './poolsFormat';

// List filters from doc §2.3: network, protocol, pool type and fee tier, plus
// search by symbol or address.

/** One per pool, from its two tokens; the first rule that fits wins */
export type IPoolPairType = 'rwa' | 'stablecoins' | 'bluechips' | 'altcoins';

/** Revert's list types we have data for, next to the pair types */
export type IPoolsCategory = 'trending' | 'new' | IPoolPairType;

/** The order the type options show in, Revert's first */
export const POOL_CATEGORIES: IPoolsCategory[] = [
  'trending',
  'new',
  'rwa',
  'stablecoins',
  'bluechips',
  'altcoins',
];

/** Protocol and version as one option: Uniswap V3 is `uniswap-v3` */
export type IPoolProtocolKey = `${IPoolProtocol}-${IPoolProtocolVersion}`;

export const POOL_PROTOCOL_OPTIONS: {
  key: IPoolProtocolKey;
  protocol: IPoolProtocol;
  version: IPoolProtocolVersion;
}[] = [
  { key: 'uniswap-v2', protocol: 'uniswap', version: 'v2' },
  { key: 'uniswap-v3', protocol: 'uniswap', version: 'v3' },
  { key: 'uniswap-v4', protocol: 'uniswap', version: 'v4' },
];

export function getPoolProtocolKey(
  pool: Pick<IPool, 'protocol' | 'version'>,
): IPoolProtocolKey {
  return `${pool.protocol}-${pool.version}`;
}

/** A tier in hundredths of a bip, or the pools whose hook sets the fee */
export type IPoolsFeeOption = number | 'dynamic';

export const POOL_FEE_OPTIONS: IPoolsFeeOption[] = [
  100,
  500,
  3000,
  10_000,
  'dynamic',
];

function getPoolFeeOption(pool: IPool): IPoolsFeeOption {
  return pool.isDynamicFee ? 'dynamic' : pool.feeTier;
}

export type IPoolsFilter = {
  /** Absent: every type */
  category?: IPoolsCategory;
  protocols: IPoolProtocolKey[];
  feeTiers: IPoolsFeeOption[];
};

export const EMPTY_POOLS_FILTER: IPoolsFilter = {
  protocols: [],
  feeTiers: [],
};

/**
 * RWA and Stablecoins as Revert defines them: a tokenized real-world asset
 * on at least one side, a USD stablecoin on both. Blue chips pair majors
 * (or a major and a stablecoin); any other token makes an altcoin pool.
 */
export function getPoolPairType(pool: IPool): IPoolPairType {
  if (isStockPool(pool)) {
    return 'rwa';
  }
  const tokens = [pool.token0, pool.token1];
  if (tokens.every((token) => token.category === 'stablecoin')) {
    return 'stablecoins';
  }
  if (
    tokens.every(
      (token) =>
        token.category === 'bluechip' || token.category === 'stablecoin',
    )
  ) {
    return 'bluechips';
  }
  return 'altcoins';
}

const DAY_MS = 24 * 60 * 60 * 1000;
// Revert counts $1M of volume in the period as trending; most of our pools
// clear that, so the volume must also be up on the period before
export const TRENDING_MIN_VOLUME_USD = 1_000_000;
export const TRENDING_MIN_VOLUME_GROWTH = 0.2;
// Revert's cutoff for New pools
export const NEW_POOL_MAX_AGE_DAYS = 14;

/** What the list's period and clock mean for Trending and New pools */
export type IPoolsListContext = {
  period: IPoolStatsWindow;
  now: number;
};

export function isPoolInCategory(
  pool: IPoolListItem,
  category: IPoolsCategory,
  { period, now }: IPoolsListContext,
) {
  if (category === 'trending') {
    const stats = pool.windows[period];
    return (
      Number(stats.volumeUsd) >= TRENDING_MIN_VOLUME_USD &&
      Number(stats.volumeChange ?? 0) >= TRENDING_MIN_VOLUME_GROWTH
    );
  }
  if (category === 'new') {
    return now - pool.createdAt <= NEW_POOL_MAX_AGE_DAYS * DAY_MS;
  }
  return getPoolPairType(pool) === category;
}

/** Filters other than network and type, for the badge on the button */
export function countExtraFilters(filter: IPoolsFilter) {
  return filter.protocols.length + filter.feeTiers.length;
}

/** What the Filters button counts; the type only where it lives there */
export function countPanelFilters(
  filter: IPoolsFilter,
  { withCategory }: { withCategory: boolean },
) {
  return countExtraFilters(filter) + (withCategory && filter.category ? 1 : 0);
}

function matchesTerm(pool: IPoolListItem, term: string) {
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

/**
 * The search as a pool address (40 hex digits) or V4 pool ID (64): the one
 * way to find a pool that trades too little for the list
 */
export function getPoolKeySearch(search: string) {
  const term = search.trim().toLowerCase();
  return /^0x(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(term) ? term : undefined;
}

/** The list, plus searched pools it leaves out as under its floors */
export function withSearchedPools(
  pools: IPoolListItem[] | undefined,
  searched: IPoolListItem[] | undefined,
) {
  if (!pools || !searched?.length) {
    return pools;
  }
  const ids = new Set(pools.map((pool) => pool.id));
  return [...pools, ...searched.filter((pool) => !ids.has(pool.id))];
}

type IPoolsFilterGroup = 'category' | 'protocols' | 'feeTiers';

/** The Filters picks, leaving out one group when counting its options */
function matchesFilter(
  pool: IPoolListItem,
  filter: IPoolsFilter,
  context: IPoolsListContext,
  skip?: IPoolsFilterGroup,
) {
  return (
    (skip === 'category' ||
      !filter.category ||
      isPoolInCategory(pool, filter.category, context)) &&
    (skip === 'protocols' ||
      !filter.protocols.length ||
      filter.protocols.includes(getPoolProtocolKey(pool))) &&
    (skip === 'feeTiers' ||
      !filter.feeTiers.length ||
      filter.feeTiers.includes(getPoolFeeOption(pool)))
  );
}

/** Network, search and an id list: what the list holds before Filters */
export function scopePools({
  pools,
  networkIds,
  search,
  onlyIds,
}: {
  pools: IPoolListItem[];
  networkIds: string[];
  search: string;
  /** Keeps these pools only, e.g. the starred ones */
  onlyIds?: ReadonlySet<string>;
}) {
  const networks = new Set(networkIds);
  // "tsla usdg" and "TSLA/USDG" both find the pair
  const terms = search
    .trim()
    .toLowerCase()
    .split(/[\s/]+/u)
    .filter(Boolean);
  return pools.filter(
    (pool) =>
      (!onlyIds || onlyIds.has(pool.id)) &&
      (!networks.size || networks.has(pool.networkId)) &&
      terms.every((term) => matchesTerm(pool, term)),
  );
}

export function filterPools({
  pools,
  filter,
  networkIds,
  search,
  onlyIds,
  period = '1D',
  now = Date.now(),
}: {
  pools: IPoolListItem[];
  filter: IPoolsFilter;
  networkIds: string[];
  search: string;
  /** Keeps these pools only, e.g. the starred ones */
  onlyIds?: ReadonlySet<string>;
  /** The window Trending reads */
  period?: IPoolStatsWindow;
  now?: number;
}) {
  return scopePools({ pools, networkIds, search, onlyIds }).filter((pool) =>
    matchesFilter(pool, filter, { period, now }),
  );
}

/**
 * Pools each option would leave, the other picks as they are: zero greys
 * the option out
 */
export type IPoolsOptionCounts = {
  category: Record<IPoolsCategory, number>;
  protocols: Record<IPoolProtocolKey, number>;
  /** Keyed by `String(option)` */
  feeTiers: Record<string, number>;
};

export function getPoolsOptionCounts({
  pools,
  filter,
  period = '1D',
  now = Date.now(),
}: {
  /** The list before Filters, from scopePools */
  pools: IPoolListItem[];
  filter: IPoolsFilter;
  period?: IPoolStatsWindow;
  now?: number;
}): IPoolsOptionCounts {
  const context = { period, now };
  const count = (
    group: IPoolsFilterGroup,
    test: (pool: IPoolListItem) => boolean,
  ) =>
    pools.filter(
      (pool) => matchesFilter(pool, filter, context, group) && test(pool),
    ).length;
  return {
    category: Object.fromEntries(
      POOL_CATEGORIES.map((category) => [
        category,
        count('category', (pool) => isPoolInCategory(pool, category, context)),
      ]),
    ) as Record<IPoolsCategory, number>,
    protocols: Object.fromEntries(
      POOL_PROTOCOL_OPTIONS.map(({ key }) => [
        key,
        count('protocols', (pool) => getPoolProtocolKey(pool) === key),
      ]),
    ) as Record<IPoolProtocolKey, number>,
    feeTiers: Object.fromEntries(
      POOL_FEE_OPTIONS.map((option) => [
        String(option),
        count('feeTiers', (pool) => getPoolFeeOption(pool) === option),
      ]),
    ),
  };
}

export type IPoolsSortKey = 'tvl' | 'volume' | 'fees' | 'apr';

/** A list value over the chosen window; TVL is the current one */
export function getPoolSortValue(
  pool: IPoolListItem,
  key: IPoolsSortKey,
  period: IPoolStatsWindow,
) {
  const stats = pool.windows[period];
  if (key === 'volume') {
    return Number(stats.volumeUsd);
  }
  if (key === 'fees') {
    return Number(stats.feesUsd);
  }
  if (key === 'apr') {
    return Number(stats.apr ?? 0);
  }
  return Number(pool.tvlUsd);
}

export function sortPools(
  pools: IPoolListItem[],
  key: IPoolsSortKey,
  direction: 'asc' | 'desc',
  period: IPoolStatsWindow,
) {
  return pools.toSorted((a, b) => {
    const diff =
      getPoolSortValue(a, key, period) - getPoolSortValue(b, key, period);
    return direction === 'asc' ? diff : -diff;
  });
}

export function getPoolNetworkCounts(pools: IPoolListItem[]) {
  const counts: Record<string, number> = {};
  for (const pool of pools) {
    counts[pool.networkId] = (counts[pool.networkId] ?? 0) + 1;
  }
  return counts;
}
