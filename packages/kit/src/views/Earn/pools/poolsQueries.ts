import { useCallback, useContext, useEffect, useRef, useState } from 'react';

import { NavigationContext } from '@react-navigation/core';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IPool,
  IPoolDetail,
  IPoolListItem,
  IPoolPricePoint,
  IPoolPriceRange,
  IPoolTopPositionsPage,
  IPoolTopPositionsSortKey,
  IPoolsPortfolio,
  IPoolsWallet,
} from '@onekeyhq/shared/types/pools';

import { onPoolsDataChanged } from './poolsDemoEvents';

// A small cache in front of ServicePools for what an opened pool shows. A row
// can render the moment it opens from data already on screen, opening it
// again or opening its page is instant, and a hovered row loads before the
// click. UI runtime only; each runtime keeps its own copy.

type IEntry = {
  value?: unknown;
  promise?: Promise<unknown>;
  fetchedAt: number;
};

const DEFAULT_TTL_MS = 60_000;
const entries = new Map<string, IEntry>();
const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  listeners.get(key)?.forEach((listener) => listener());
}

export type IPoolsQuery<T> = {
  key: string;
  fetch: () => Promise<T>;
  ttlMs?: number;
};

function isFresh(entry: IEntry | undefined, ttlMs: number) {
  return (
    entry !== undefined &&
    'value' in entry &&
    Date.now() - entry.fetchedAt < ttlMs
  );
}

export function peekPoolsQuery<T>(query: IPoolsQuery<T>): T | undefined {
  return entries.get(query.key)?.value as T | undefined;
}

/** One request per key at a time; a fresh cached value skips the request */
export function fetchPoolsQuery<T>(
  query: IPoolsQuery<T>,
  { force = false }: { force?: boolean } = {},
): Promise<T> {
  const ttlMs = query.ttlMs ?? DEFAULT_TTL_MS;
  const entry = entries.get(query.key);
  if (!force && isFresh(entry, ttlMs)) {
    return Promise.resolve(entry?.value as T);
  }
  if (entry?.promise) {
    return entry.promise as Promise<T>;
  }
  const promise = query
    .fetch()
    .then((value) => {
      entries.set(query.key, { value, fetchedAt: Date.now() });
      notify(query.key);
      return value;
    })
    .catch((error: unknown) => {
      const current = entries.get(query.key);
      if (current) {
        delete current.promise;
      }
      throw error;
    });
  entries.set(query.key, {
    ...entry,
    fetchedAt: entry?.fetchedAt ?? 0,
    promise,
  });
  return promise;
}

export function prefetchPoolsQuery<T>(query: IPoolsQuery<T>) {
  fetchPoolsQuery(query).catch(() => undefined);
}

/** Drops cached values whose key starts with the prefix */
export function invalidatePoolsQueries(prefix = '') {
  Array.from(entries.keys())
    .filter((key) => key.startsWith(prefix))
    .forEach((key) => {
      entries.delete(key);
      notify(key);
    });
}

// Positions, balances and tasks change with the demo; pool data does not
onPoolsDataChanged(() => {
  invalidatePoolsQueries('wallet:');
  invalidatePoolsQueries('portfolio');
});

/**
 * The cached value straight away, then a refetch when it is stale. Keys can
 * change (a new chart period) and the last value stays up until the new one
 * lands, unless `keepPrevious` is false. No query gives no value.
 * `refreshOnFocus` loads again when the screen comes back, e.g. balances
 * after a transaction.
 */
export function usePoolsQuery<T>(
  query: IPoolsQuery<T> | undefined,
  {
    keepPrevious = true,
    refreshOnFocus = false,
  }: { keepPrevious?: boolean; refreshOnFocus?: boolean } = {},
) {
  // Optional: badges also render in dialogs, outside any screen
  const navigation = useContext(NavigationContext);
  const key = query?.key;
  const queryRef = useRef(query);
  queryRef.current = query;
  const [state, setState] = useState<{ key?: string; value?: T }>(() => ({
    key,
    value: query ? peekPoolsQuery(query) : undefined,
  }));
  const [isLoading, setIsLoading] = useState(false);
  // The key whose last request failed, so a bad link can say so
  const [errorKey, setErrorKey] = useState<string>();

  const load = useCallback((force: boolean) => {
    const current = queryRef.current;
    if (!current) {
      return;
    }
    const cached = peekPoolsQuery(current);
    if (cached !== undefined) {
      setState({ key: current.key, value: cached });
    }
    if (
      !force &&
      isFresh(entries.get(current.key), current.ttlMs ?? DEFAULT_TTL_MS)
    ) {
      return;
    }
    setIsLoading(true);
    fetchPoolsQuery(current, { force })
      .then((value) => {
        if (queryRef.current?.key === current.key) {
          setState({ key: current.key, value });
          setErrorKey(undefined);
        }
      })
      .catch(() => {
        if (queryRef.current?.key === current.key) {
          setErrorKey(current.key);
        }
      })
      .finally(() => {
        if (queryRef.current?.key === current.key) {
          setIsLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    if (!key) {
      return undefined;
    }
    load(false);
    const listener = () => load(false);
    const set = listeners.get(key) ?? new Set();
    set.add(listener);
    listeners.set(key, set);
    return () => {
      set.delete(listener);
    };
  }, [key, load]);

  useEffect(() => {
    if (!refreshOnFocus || !navigation) {
      return undefined;
    }
    return navigation.addListener('focus', () => load(true));
  }, [load, navigation, refreshOnFocus]);

  const refresh = useCallback(() => load(true), [load]);
  let value = state.value;
  if (!query) {
    // Switched off: a cleared search must not keep showing its last result
    value = undefined;
  } else if (state.key !== key) {
    const cached = peekPoolsQuery(query);
    value = cached ?? (keepPrevious ? state.value : undefined);
  }
  return {
    result: value,
    isLoading,
    isError: key !== undefined && errorKey === key,
    refresh,
  };
}

// The queries an opened pool runs

export const PoolsQueries = {
  list: (): IPoolsQuery<IPoolListItem[]> => ({
    key: 'list',
    fetch: () => backgroundApiProxy.servicePools.getPoolList(),
  }),
  /** A searched pool address or V4 pool ID, also off the list */
  byKey: (poolKey: string): IPoolsQuery<IPoolListItem[]> => ({
    key: `byKey:${poolKey}`,
    fetch: () => backgroundApiProxy.servicePools.findPoolsByKey({ poolKey }),
  }),
  detail: (poolId: string): IPoolsQuery<IPoolDetail> => ({
    key: `detail:${poolId}`,
    fetch: () => backgroundApiProxy.servicePools.getPoolDetail({ poolId }),
  }),
  history: (
    poolId: string,
    range: IPoolPriceRange,
  ): IPoolsQuery<IPoolPricePoint[]> => ({
    key: `history:${poolId}:${range}`,
    fetch: () =>
      backgroundApiProxy.servicePools.getPoolPriceHistory({ poolId, range }),
  }),
  topPositions: (
    poolId: string,
    limit: number,
    sortBy: IPoolTopPositionsSortKey = 'apr',
  ): IPoolsQuery<IPoolTopPositionsPage> => ({
    key: `top:${poolId}:${sortBy}:${limit}`,
    fetch: () =>
      backgroundApiProxy.servicePools.getPoolTopPositions({
        poolId,
        limit,
        sortBy,
      }),
  }),
  // Change with every transaction, so they go stale fast
  wallet: (networkId: string): IPoolsQuery<IPoolsWallet> => ({
    key: `wallet:${networkId}`,
    ttlMs: 10_000,
    fetch: () => backgroundApiProxy.servicePools.getWallet({ networkId }),
  }),
  portfolio: (): IPoolsQuery<IPoolsPortfolio> => ({
    key: 'portfolio',
    ttlMs: 10_000,
    fetch: () => backgroundApiProxy.servicePools.getPortfolio(),
  }),
  networkName: (networkId: string): IPoolsQuery<string> => ({
    key: `network:${networkId}`,
    ttlMs: 24 * 60 * 60 * 1000,
    fetch: async () =>
      (await backgroundApiProxy.serviceNetwork.getNetworkSafe({ networkId }))
        ?.name ?? '',
  }),
};

export const DEFAULT_PRICE_RANGE: IPoolPriceRange = '1M';
export const TOP_POSITIONS_PAGE_SIZE = 5;

/** What an opened pool shows first; called on hover and when it opens */
export function prefetchPoolOverview(
  pool: Pick<IPool, 'id' | 'networkId' | 'capabilities'>,
) {
  prefetchPoolsQuery(PoolsQueries.detail(pool.id));
  prefetchPoolsQuery(PoolsQueries.history(pool.id, DEFAULT_PRICE_RANGE));
  prefetchPoolsQuery(PoolsQueries.wallet(pool.networkId));
  if (pool.capabilities.priceRange) {
    prefetchPoolsQuery(
      PoolsQueries.topPositions(pool.id, TOP_POSITIONS_PAGE_SIZE),
    );
  }
}
