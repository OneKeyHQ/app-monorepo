import { swrCacheUtils } from '../../utils/swrCacheUtils';

import type { ISnapshotCacheSync } from './createSnapshotCacheSync';
import type { INamespacedSnapshotCacheConfig } from './types';

/**
 * Web / desktop: keep using the shared cold-start store.
 *
 * Splitting a namespace off into its own IndexedDB database buys little here
 * and costs an extra `open()` on the startup path — reads are served from the
 * in-memory map either way, and hydration already loads by key and by range.
 * The native build has its own file per namespace because the problems there
 * (one shared mmap, one bootstrap window, no compaction) are real.
 *
 * Keys are the caller's fully qualified SWR keys, so nothing about what is
 * already on disk changes.
 */
export function createNamespacedSnapshotCache<T>({
  keyPrefix,
  maxAgeMs,
}: INamespacedSnapshotCacheConfig): ISnapshotCacheSync<T> {
  return {
    get(key) {
      const cached = swrCacheUtils.getWithTimestamp<T>(key);
      if (!cached) {
        return undefined;
      }
      // The shared store has no age of its own, so the namespace's own limit
      // is applied on the way out — same contract as the native build.
      if (Date.now() - cached.updatedAt >= maxAgeMs) {
        return undefined;
      }
      return { data: cached.data, updatedAt: cached.updatedAt };
    },
    set(key, data) {
      swrCacheUtils.set<T>(key, data);
    },
    remove(key) {
      swrCacheUtils.remove(key);
    },
    // The shared store runs its own eviction, and it has no way to drop just
    // this namespace's expired keys without enumerating it.
    sweep() {},
    clear() {
      swrCacheUtils.removeByPrefix(keyPrefix);
    },
  };
}
