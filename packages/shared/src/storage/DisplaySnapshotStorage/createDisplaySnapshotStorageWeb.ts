import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { IndexedDBPromised } from '@onekeyhq/shared/src/IndexedDBPromised';

import type {
  IDisplaySnapshotStorageBackend,
  IDisplaySnapshotStorageConfig,
} from './types';

const DATABASE_VERSION = 1;
const RECORD_STORE = 'records';

export async function createDisplaySnapshotStorageWebBackend(
  config: IDisplaySnapshotStorageConfig,
): Promise<IDisplaySnapshotStorageBackend> {
  const databaseName = `onekey-display-snapshot-${config.namespace}`;
  const database = new IndexedDBPromised<unknown>({
    name: databaseName,
    bucketName: databaseName,
    version: DATABASE_VERSION,
    upgrade: ({ nativeDB }) => {
      if (!nativeDB.objectStoreNames.contains(RECORD_STORE)) {
        nativeDB.createObjectStore(RECORD_STORE);
      }
    },
  });
  await database.open();

  return {
    async read(key) {
      return (await database.get(RECORD_STORE, key)) as string | undefined;
    },
    async readMany(keys) {
      const transaction = await database.createBucketTransaction(
        [RECORD_STORE],
        'readonly',
      );
      const store = transaction.objectStore(RECORD_STORE);
      const values = await Promise.all(keys.map((key) => store.get(key)));
      await transaction.done;
      const result = new Map<string, string>();
      keys.forEach((key, index) => {
        const value = values[index];
        if (typeof value === 'string') {
          result.set(key, value);
        }
      });
      return result;
    },
    async commit(input) {
      const transaction = await database.createBucketTransaction(
        [RECORD_STORE],
        'readwrite',
      );
      const store = transaction.objectStore(RECORD_STORE);
      if (input.expectedCommitMarker) {
        const current = await store.get(input.expectedCommitMarker.key);
        if (current !== input.expectedCommitMarker.value) {
          transaction.abort();
          throw new OneKeyLocalError(
            'Display snapshot commit marker changed before commit',
          );
        }
      }
      await Promise.all([
        ...input.entries.map(({ key, value }) => store.put(value, key)),
        store.put(input.commitMarker.value, input.commitMarker.key),
        ...(input.removeKeys ?? []).map((key) => store.delete(key)),
      ]);
      await transaction.done;
    },
    async remove(keys) {
      const transaction = await database.createBucketTransaction(
        [RECORD_STORE],
        'readwrite',
      );
      const store = transaction.objectStore(RECORD_STORE);
      await Promise.all(keys.map((key) => store.delete(key)));
      await transaction.done;
    },
    async clearNamespace() {
      const transaction = await database.createBucketTransaction(
        [RECORD_STORE],
        'readwrite',
      );
      const store = transaction.objectStore(RECORD_STORE);
      await store.clear();
      await transaction.done;
    },
    async compact() {
      // IndexedDB owns physical compaction; records are deleted in a transaction.
    },
  };
}
