import { createDisplaySnapshotStorageSyncCore } from '../DisplaySnapshotStorage/createDisplaySnapshotStorageCore';
import { createWebUiSnapshotSyncBackend } from '../DisplaySnapshotStorage/webUiSnapshotStore';

import { createSnapshotCacheSync } from './createSnapshotCacheSync';

import type { ISnapshotCacheSync } from './createSnapshotCacheSync';
import type { INamespacedSnapshotCacheConfig } from './types';

const DEFAULT_MAX_RECORD_BYTES = 256 * 1024;
// Reads are by exact key; a batch only ever covers one screen's worth.
const MAX_READ_BATCH_SIZE = 32;

/**
 * Web / desktop: one shared IndexedDB database, one key space per namespace.
 *
 * A namespace gets the same contract as on native — its own manifest, its own
 * age and count limits, reads by exact key — without the extra `open()` that
 * a database per namespace would put on the startup path. Splitting the
 * physical store is worth it where one shared mmap is the problem, which is
 * the native build, not here.
 */
export function createNamespacedSnapshotCache<T>({
  namespace,
  maxAgeMs,
  maxEntries,
  maxRecordBytes = DEFAULT_MAX_RECORD_BYTES,
}: INamespacedSnapshotCacheConfig): ISnapshotCacheSync<T> {
  return createSnapshotCacheSync<T>({
    storage: createDisplaySnapshotStorageSyncCore(
      { namespace, maxRecordBytes, maxReadBatchSize: MAX_READ_BATCH_SIZE },
      () => createWebUiSnapshotSyncBackend(namespace),
    ),
    retention: { maxAgeMs, maxEntries },
  });
}
