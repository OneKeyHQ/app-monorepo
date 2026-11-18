import { createDisplaySnapshotStorage } from '../DisplaySnapshotStorage/createDisplaySnapshotStorage.native';

import { SNAPSHOT_CACHE_NAMESPACES } from './snapshotCacheNamespaces';

/**
 * Native: a file per namespace, so each declared one is opened and emptied —
 * including the namespaces this session never read, which is the point.
 */
export function clearAllSnapshotCaches(): Promise<void> {
  SNAPSHOT_CACHE_NAMESPACES.forEach((namespace) => {
    try {
      createDisplaySnapshotStorage({
        namespace,
        maxRecordBytes: 1,
        maxReadBatchSize: 1,
      }).clearNamespace();
    } catch {
      // A namespace that will not open holds nothing readable anyway.
    }
  });
  return Promise.resolve();
}
