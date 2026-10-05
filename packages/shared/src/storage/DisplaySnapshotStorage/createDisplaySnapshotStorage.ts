import { createDisplaySnapshotStorageCore } from './createDisplaySnapshotStorageCore';
import { createDisplaySnapshotStorageIndexedDBBackend } from './createDisplaySnapshotStorageIndexedDB';

import type {
  IDisplaySnapshotStorage,
  IDisplaySnapshotStorageConfig,
} from './types';

export function createDisplaySnapshotStorage(
  config: IDisplaySnapshotStorageConfig,
): IDisplaySnapshotStorage {
  return createDisplaySnapshotStorageCore(config, () =>
    createDisplaySnapshotStorageIndexedDBBackend(config),
  );
}
