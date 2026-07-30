import {
  validateDisplaySnapshotCommit,
  validateDisplaySnapshotKey,
  validateDisplaySnapshotKeys,
  validateDisplaySnapshotStorageConfig,
  validateDisplaySnapshotValue,
} from './displaySnapshotStorageValidation';

import type {
  IDisplaySnapshotStorage,
  IDisplaySnapshotStorageBackend,
  IDisplaySnapshotStorageConfig,
  IDisplaySnapshotStorageSync,
  IDisplaySnapshotStorageSyncBackend,
} from './types';

/**
 * Display Snapshot Storage V2
 *
 * This storage is only for non-sensitive, re-creatable UI snapshots. It is
 * not a source of truth and its contents may be missing, stale, corrupted,
 * or deleted at any time.
 *
 * Snapshot payloads must be page-scoped, explicitly serialized through a
 * size-bounded codec, and loaded by exact key. Implementations intentionally
 * expose no enumeration API so a cold start cannot preload every record into
 * JavaScript memory.
 */
export function createDisplaySnapshotStorageCore(
  config: IDisplaySnapshotStorageConfig,
  loadBackend: () => Promise<IDisplaySnapshotStorageBackend>,
): IDisplaySnapshotStorage {
  validateDisplaySnapshotStorageConfig(config);
  let backendPromise: Promise<IDisplaySnapshotStorageBackend> | undefined;
  let mutationTail: Promise<void> = Promise.resolve();

  const getBackend = () => {
    if (!backendPromise) {
      backendPromise = loadBackend().catch((error) => {
        backendPromise = undefined;
        throw error;
      });
    }
    return backendPromise;
  };

  const enqueueMutation = (operation: () => Promise<void>): Promise<void> => {
    const next = mutationTail.catch(() => undefined).then(operation);
    mutationTail = next;
    return next;
  };

  return {
    async read(key) {
      validateDisplaySnapshotKey(key);
      const value = await (await getBackend()).read(key);
      if (value !== undefined) {
        validateDisplaySnapshotValue(value, config);
      }
      return value;
    },
    async readMany(keys) {
      validateDisplaySnapshotKeys(keys, config);
      const values = await (await getBackend()).readMany(keys);
      values.forEach((value, key) => {
        validateDisplaySnapshotKey(key);
        validateDisplaySnapshotValue(value, config);
      });
      return values;
    },
    async commit(input) {
      validateDisplaySnapshotCommit(input, config);
      await enqueueMutation(async () => {
        await (await getBackend()).commit(input);
      });
    },
    async remove(keys) {
      validateDisplaySnapshotKeys(keys, {
        ...config,
        maxReadBatchSize: Number.MAX_SAFE_INTEGER,
      });
      await enqueueMutation(async () => {
        await (await getBackend()).remove(keys);
      });
    },
    async clearNamespace() {
      await enqueueMutation(async () => {
        await (await getBackend()).clearNamespace();
      });
    },
    async compact() {
      await enqueueMutation(async () => {
        await (await getBackend()).compact();
      });
    },
  };
}

export function createDisplaySnapshotStorageSyncCore(
  config: IDisplaySnapshotStorageConfig,
  loadBackend: () => IDisplaySnapshotStorageSyncBackend,
): IDisplaySnapshotStorageSync {
  validateDisplaySnapshotStorageConfig(config);
  let backend: IDisplaySnapshotStorageSyncBackend | undefined;
  const getBackend = () => {
    backend ??= loadBackend();
    return backend;
  };

  return {
    read(key) {
      validateDisplaySnapshotKey(key);
      const value = getBackend().read(key);
      if (value !== undefined) {
        validateDisplaySnapshotValue(value, config);
      }
      return value;
    },
    readMany(keys) {
      validateDisplaySnapshotKeys(keys, config);
      const values = getBackend().readMany(keys);
      values.forEach((value, key) => {
        validateDisplaySnapshotKey(key);
        validateDisplaySnapshotValue(value, config);
      });
      return values;
    },
    commit(input) {
      validateDisplaySnapshotCommit(input, config);
      getBackend().commit(input);
    },
    remove(keys) {
      validateDisplaySnapshotKeys(keys, {
        ...config,
        maxReadBatchSize: Number.MAX_SAFE_INTEGER,
      });
      getBackend().remove(keys);
    },
    clearNamespace() {
      getBackend().clearNamespace();
    },
    compact() {
      getBackend().compact();
    },
  };
}
