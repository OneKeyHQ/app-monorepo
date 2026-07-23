import { createMMKV } from 'react-native-mmkv';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createDisplaySnapshotStorageCore } from './createDisplaySnapshotStorageCore';

import type {
  IDisplaySnapshotStorage,
  IDisplaySnapshotStorageBackend,
  IDisplaySnapshotStorageConfig,
} from './types';

function createNativeBackend(
  config: IDisplaySnapshotStorageConfig,
): IDisplaySnapshotStorageBackend {
  const storage = createMMKV({
    id: `onekey-display-snapshot-${config.namespace}`,
  });

  return {
    async read(key) {
      return storage.getString(key);
    },
    async readMany(keys) {
      const result = new Map<string, string>();
      keys.forEach((key) => {
        const value = storage.getString(key);
        if (value !== undefined) {
          result.set(key, value);
        }
      });
      return result;
    },
    async commit(input) {
      if (input.expectedCommitMarker) {
        const current = storage.getString(input.expectedCommitMarker.key);
        if (current !== input.expectedCommitMarker.value) {
          throw new OneKeyLocalError(
            'Display snapshot commit marker changed before commit',
          );
        }
      }
      input.entries.forEach(({ key, value }) => storage.set(key, value));
      // MMKV has no multi-key transaction. The marker is deliberately last so
      // readers never discover an incomplete generation after a process kill.
      storage.set(input.commitMarker.key, input.commitMarker.value);
      input.removeKeys?.forEach((key) => storage.remove(key));
    },
    async remove(keys) {
      keys.forEach((key) => storage.remove(key));
    },
    async clearNamespace() {
      storage.clearAll();
    },
    async compact() {
      // Removing MMKV keys does not shrink its mmap file. Call trim only from
      // an explicit lifecycle/idle boundary so compaction cannot block normal
      // snapshot reads and writes on the UI runtime.
      storage.trim();
    },
  };
}

export function createDisplaySnapshotStorage(
  config: IDisplaySnapshotStorageConfig,
): IDisplaySnapshotStorage {
  return createDisplaySnapshotStorageCore(config, async () =>
    createNativeBackend(config),
  );
}
