// The native module by name, not through the barrel: the barrel's entry is
// the IndexedDB build, and only this one returns the synchronous storage.
import { createDisplaySnapshotStorage } from '../DisplaySnapshotStorage/createDisplaySnapshotStorage.native';
import { isTravelModeMaskingSync } from '../travelModeMaskingGate';

import { createSnapshotCacheSync } from './createSnapshotCacheSync';

import type { ISnapshotCacheSync } from './createSnapshotCacheSync';
import type { INamespacedSnapshotCacheConfig } from './types';

const DEFAULT_MAX_RECORD_BYTES = 256 * 1024;
// Reads are by exact key; a batch only ever covers one screen's worth.
const MAX_READ_BATCH_SIZE = 32;

/**
 * Native: one MMKV file per namespace.
 *
 * Everything the shared cold-start file forces on a namespace goes away with
 * it — the 100-entry bootstrap window every namespace competes for, the
 * global oldest-write-first eviction across unrelated features, and the
 * absence of any compaction. In exchange a read has to name its key, which is
 * what keeps a namespace from costing anything at startup.
 *
 * The backing store is created on first use, so declaring a cache is free.
 */
export function createNamespacedSnapshotCache<T>({
  namespace,
  maxAgeMs,
  maxEntries,
  maxRecordBytes = DEFAULT_MAX_RECORD_BYTES,
}: INamespacedSnapshotCacheConfig): ISnapshotCacheSync<T> {
  const storage = createDisplaySnapshotStorage({
    namespace,
    maxRecordBytes,
    maxReadBatchSize: MAX_READ_BATCH_SIZE,
  });
  // Travel Mode: this namespace does not exist for the length of the launch.
  // A cache declared here is a module-level const, so reaching this line is
  // the app saying it intends to use the namespace — which is also the moment
  // to drop whatever the previous launch left in it. Reads and writes are
  // dropped rather than gated per call because the profile cannot change
  // without both runtimes restarting.
  if (isTravelModeMaskingSync()) {
    try {
      storage.clearNamespace();
    } catch {
      // Best effort: a namespace that will not open holds nothing readable.
    }
    return createInertSnapshotCache<T>();
  }
  return createSnapshotCacheSync<T>({
    storage,
    retention: { maxAgeMs, maxEntries },
  });
}

function createInertSnapshotCache<T>(): ISnapshotCacheSync<T> {
  return {
    get: () => undefined,
    set: () => undefined,
    setMany: () => undefined,
    remove: () => undefined,
    touch: () => undefined,
    keys: () => [],
    sweep: () => undefined,
    clear: () => undefined,
  };
}
