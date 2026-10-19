import type {
  IPoolListItem,
  IPoolProtocolVersion,
} from '@onekeyhq/shared/types/pools';

import { isStockPool } from './poolsFormat';

// List filters from doc §2.3: network, protocol version, asset category and
// fee tier, plus search by symbol or address.

export type IPoolsFilter = {
  stocksOnly: boolean;
  versions: IPoolProtocolVersion[];
  feeTiers: number[];
};

export const EMPTY_POOLS_FILTER: IPoolsFilter = {
  stocksOnly: false,
  versions: [],
  feeTiers: [],
};

export const POOL_VERSIONS: IPoolProtocolVersion[] = ['v2', 'v3', 'v4'];

export const POOL_FEE_TIERS = [100, 500, 3000, 10_000];

/** Filters other than network and category, for the badge on the button */
export function countExtraFilters(filter: IPoolsFilter) {
  return filter.versions.length + filter.feeTiers.length;
}

function matchesTerm(pool: IPoolListItem, term: string) {
  return [pool.token0, pool.token1].some(
    (token) =>
      token.symbol.toLowerCase().includes(term) ||
      token.name.toLowerCase().includes(term) ||
      (term.startsWith('0x') && token.address === term),
  );
}

export function filterPools({
  pools,
  filter,
  networkIds,
  search,
}: {
  pools: IPoolListItem[];
  filter: IPoolsFilter;
  networkIds: string[];
  search: string;
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
      (!networks.size || networks.has(pool.networkId)) &&
      (!filter.stocksOnly || isStockPool(pool)) &&
      (!filter.versions.length || filter.versions.includes(pool.version)) &&
      // A dynamic-fee pool has no fixed tier, so a tier filter skips it
      (!filter.feeTiers.length ||
        (!pool.isDynamicFee && filter.feeTiers.includes(pool.feeTier))) &&
      terms.every((term) => matchesTerm(pool, term)),
  );
}

export function getPoolNetworkCounts(pools: IPoolListItem[]) {
  const counts: Record<string, number> = {};
  for (const pool of pools) {
    counts[pool.networkId] = (counts[pool.networkId] ?? 0) + 1;
  }
  return counts;
}
