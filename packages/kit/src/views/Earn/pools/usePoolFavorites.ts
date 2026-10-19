import { useCallback, useEffect, useSyncExternalStore } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

// Starred pools (proposal). One store per UI runtime, so the list, an opened
// row and the pool page agree; ServicePools keeps the saved copy.

const EMPTY = new Set<string>();
let favoriteIds: ReadonlySet<string> | undefined;
let loading: Promise<void> | undefined;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function setFavoriteIds(ids: Iterable<string>) {
  favoriteIds = new Set(ids);
  emit();
}

function load() {
  if (!loading) {
    loading = backgroundApiProxy.servicePools
      .getFavoritePoolIds()
      .then(setFavoriteIds)
      .catch(() => {
        loading = undefined;
      });
  }
  return loading;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return favoriteIds ?? EMPTY;
}

export function usePoolFavorites() {
  const ids = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    void load();
  }, []);

  const toggleFavorite = useCallback(async (poolId: string) => {
    const previous = getSnapshot();
    const favorite = !previous.has(poolId);
    const next = new Set(previous);
    if (favorite) {
      next.add(poolId);
    } else {
      next.delete(poolId);
    }
    // The star flips at once; the saved list replaces it when it lands
    setFavoriteIds(next);
    try {
      setFavoriteIds(
        await backgroundApiProxy.servicePools.setPoolFavorite({
          poolId,
          favorite,
        }),
      );
    } catch {
      setFavoriteIds(previous);
    }
  }, []);

  return {
    favoriteIds: ids,
    isLoaded: favoriteIds !== undefined,
    toggleFavorite,
  };
}
