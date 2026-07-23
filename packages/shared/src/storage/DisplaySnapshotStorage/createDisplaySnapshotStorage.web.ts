import { createDisplaySnapshotStorageCore } from './createDisplaySnapshotStorageCore';
import { createDisplaySnapshotStorageWebBackend } from './createDisplaySnapshotStorageWeb';

import type {
  IDisplaySnapshotStorage,
  IDisplaySnapshotStorageConfig,
} from './types';

export function createDisplaySnapshotStorage(
  config: IDisplaySnapshotStorageConfig,
): IDisplaySnapshotStorage {
  return createDisplaySnapshotStorageCore(config, () =>
    createDisplaySnapshotStorageWebBackend(config),
  );
}
