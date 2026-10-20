import type {
  IPool,
  IPoolListItem,
  IPoolProtocolVersion,
  IPoolStatsWindow,
} from '@onekeyhq/shared/types/pools';

import { isStockPool } from './poolsFormat';

// List filters from doc §2.3: network, protocol version, asset category and
// fee tier, plus search by symbol or address.

/** The asset categories of Revert's list that our pools fill */
export type IPoolsCategory = 'rwa' | 'stablecoins';

export type IPoolsFilter = {
  /** Absent: every category */
  category?: IPoolsCategory;
  versions: IPoolProtocolVersion[];
  feeTiers: number[];
};

export const EMPTY_POOLS_FILTER: IPoolsFilter = {
  versions: [],
  feeTiers: [],
};

/**
 * Revert's definitions: RWA has a tokenized real-world asset on at least one
 * side (our stock and ETF tokens), Stablecoins a USD stablecoin on both
 */
export function isPoolInCategory(pool: IPool, category: IPoolsCategory) {
  if (category === 'stablecoins') {
    return (
      pool.token0.category === 'stablecoin' &&
      pool.token1.category === 'stablecoin'
    );
  }
  return isStockPool(pool);
}

export const POOL_VERSIONS: IPoolProtocolVersion[] = ['v2', 'v3', 'v4'];

export const POOL_FEE_TIERS = [100, 500, 3000, 10_000];

/** Filters other than network and category, for the badge on the button */
export function countExtraFilters(filter: IPoolsFilter) {
  return filter.versions.length + filter.feeTiers.length;
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
 * way to find a pool that is not on the list
 */
export function getPoolKeySearch(search: string) {
  const term = search.trim().toLowerCase();
  return /^0x(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(term) ? term : undefined;
}

/** The list, plus searched pools it leaves out because they are unlisted */
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

export function filterPools({
  pools,
  filter,
  networkIds,
  search,
  onlyIds,
}: {
  pools: IPoolListItem[];
  filter: IPoolsFilter;
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
      (!filter.category || isPoolInCategory(pool, filter.category)) &&
      (!filter.versions.length || filter.versions.includes(pool.version)) &&
      // A dynamic-fee pool has no fixed tier, so a tier filter skips it
      (!filter.feeTiers.length ||
        (!pool.isDynamicFee && filter.feeTiers.includes(pool.feeTier))) &&
      terms.every((term) => matchesTerm(pool, term)),
  );
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
