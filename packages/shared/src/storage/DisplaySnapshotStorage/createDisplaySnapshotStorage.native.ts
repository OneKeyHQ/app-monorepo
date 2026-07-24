import { createMMKV } from 'react-native-mmkv';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  validateDisplaySnapshotCommit,
  validateDisplaySnapshotKey,
  validateDisplaySnapshotKeys,
  validateDisplaySnapshotStorageConfig,
  validateDisplaySnapshotValue,
} from './displaySnapshotStorageValidation';

import type {
  IDisplaySnapshotStorageConfig,
  IDisplaySnapshotStorageSync,
} from './types';

export function createDisplaySnapshotStorage(
  config: IDisplaySnapshotStorageConfig,
): IDisplaySnapshotStorageSync {
  validateDisplaySnapshotStorageConfig(config);
  let storage: ReturnType<typeof createMMKV> | undefined;
  const getStorage = () => {
    storage ??= createMMKV({
      id: `onekey-display-snapshot-${config.namespace}`,
    });
    return storage;
  };

  return {
    read(key) {
      validateDisplaySnapshotKey(key);
      const value = getStorage().getString(key);
      if (value !== undefined) {
        validateDisplaySnapshotValue(value, config);
      }
      return value;
    },
    readMany(keys) {
      validateDisplaySnapshotKeys(keys, config);
      const result = new Map<string, string>();
      keys.forEach((key) => {
        const value = getStorage().getString(key);
        if (value !== undefined) {
          validateDisplaySnapshotValue(value, config);
          result.set(key, value);
        }
      });
      return result;
    },
    commit(input) {
      validateDisplaySnapshotCommit(input, config);
      if (input.expectedCommitMarker) {
        const current = getStorage().getString(input.expectedCommitMarker.key);
        if (current !== input.expectedCommitMarker.value) {
          throw new OneKeyLocalError(
            'Display snapshot commit marker changed before commit',
          );
        }
      }
      input.entries.forEach(({ key, value }) => getStorage().set(key, value));
      // MMKV has no multi-key transaction. The marker is deliberately last so
      // readers never discover an incomplete generation after a process kill.
      getStorage().set(input.commitMarker.key, input.commitMarker.value);
      input.removeKeys?.forEach((key) => getStorage().remove(key));
    },
    remove(keys) {
      validateDisplaySnapshotKeys(keys, {
        ...config,
        maxReadBatchSize: Number.MAX_SAFE_INTEGER,
      });
      keys.forEach((key) => getStorage().remove(key));
    },
    clearNamespace() {
      getStorage().clearAll();
    },
    compact() {
      // Removing MMKV keys does not shrink its mmap file. Call trim only from
      // an explicit lifecycle/idle boundary so compaction cannot block normal
      // snapshot reads and writes on the UI runtime.
      getStorage().trim();
    },
  };
}
