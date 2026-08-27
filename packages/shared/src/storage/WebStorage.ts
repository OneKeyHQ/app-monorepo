/* eslint-disable  @typescript-eslint/no-unused-vars */
// import localforage from 'localforage';

import { SystemDiskFullError } from '../errors';
import errorUtils from '../errors/utils/errorUtils';
import { EAppEventBusNames, appEventBus } from '../eventBus/appEventBus';
import { IndexedDBPromised } from '../IndexedDBPromised';
import platformEnv from '../platformEnv';
import storageChecker from '../storageChecker/storageChecker';
import resetUtils from '../utils/resetUtils';

import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';
import type {
  Callback,
  CallbackWithResult,
  KeyValuePair,
  MultiCallback,
  MultiGetCallback,
} from '@react-native-async-storage/async-storage/lib/typescript/types';

const LEGACY_STORAGE_DB_NAME = 'OneKeyStorage';

async function doesLegacyStorageDbExist(): Promise<boolean | undefined> {
  try {
    const databases = await globalThis.indexedDB?.databases?.();
    if (!databases) {
      return undefined;
    }
    return databases.some(
      (database) => database.name === LEGACY_STORAGE_DB_NAME,
    );
  } catch {
    return undefined;
  }
}

async function createLegacyStorage(): Promise<AsyncStorageStatic> {
  const { default: WebStorageLegacy } = await import('./WebStorageLegacy');
  return new WebStorageLegacy();
}

// localforage.config({
//   name: 'OneKeyStorage',
// });

if (process.env.NODE_ENV !== 'production') {
  // appGlobals.$$localforage = localforage;
}

export enum EWebStorageKeyPrefix {
  AppStorage = 'app_storage_v5:',
  SimpleDB = 'simple_db_v5:',
  GlobalStates = 'g_states_v5:',
}

async function migrateFromLegacyStorage({
  indexed,
  legacyKeyPrefix,
  tableName,
}: {
  indexed: IndexedDBPromised;
  legacyKeyPrefix: EWebStorageKeyPrefix;
  tableName: string;
}) {
  if (!legacyKeyPrefix) {
    return;
  }
  if (legacyKeyPrefix === EWebStorageKeyPrefix.AppStorage) {
    return;
  }
  const allKeys = await indexed.getAllKeys(tableName);
  if (allKeys.length > 0) {
    console.log(
      `WebStorage==>migrateFromLegacyStorage skip: already migrated - ${indexed?.name}`,
    );
    errorUtils.logCurrentCallStack();
    return;
  }
  // export default new WebStorage();
  const legacyStorageDbExists = await doesLegacyStorageDbExist();
  if (legacyStorageDbExists === false) {
    return;
  }
  const legacyStorage = await createLegacyStorage();
  const keys = await legacyStorage.getAllKeys(undefined);
  for (const key of keys) {
    if (
      legacyKeyPrefix === EWebStorageKeyPrefix.SimpleDB &&
      key.startsWith(legacyKeyPrefix)
    ) {
      // debugger;
    }
    if (key.startsWith(legacyKeyPrefix)) {
      const value = await legacyStorage.getItem(key, undefined);
      if (value) {
        try {
          await indexed.put(tableName, value, key);
        } catch (error) {
          console.error(
            'migrateFromLegacyStorage put ERROR: ',
            (error as Error | undefined)?.message,
          );
          try {
            await indexed.add(tableName, value, key);
          } catch (error2) {
            // The transaction was aborted, so the request cannot be fulfilled.
            // Internal error opening backing store for indexedDB.open.
            // Encountered disk full while committing transaction.
            // QuotaExceededError: Encountered full disk while opening backing store for indexedDB.open.
            console.error(
              'migrateFromLegacyStorage add ERROR: ',
              (error2 as Error | undefined)?.message,
            );
          }
        }
      }
    }
  }
}

class WebStorage implements AsyncStorageStatic {
  constructor({
    dbName,
    bucketName,
    tableName,
    legacyKeyPrefix,
  }: {
    dbName: string;
    bucketName: string;
    tableName: string;
    legacyKeyPrefix: EWebStorageKeyPrefix;
  }) {
    this.tableName = tableName;
    // eslint-disable-next-line no-async-promise-executor
    this.initIndexed = async () => {
      const indexed = new IndexedDBPromised({
        name: dbName,
        bucketName,
        version: undefined as unknown as number,
        upgrade: (db) => {
          if (!db.nativeDB.objectStoreNames.contains(this.tableName)) {
            db.nativeDB.createObjectStore(this.tableName);
          }
        },
      });
      await indexed.open();
      try {
        await migrateFromLegacyStorage({
          indexed,
          legacyKeyPrefix,
          tableName,
        });
      } catch (error) {
        // `getIndexed` drops the cached promise on failure so init can retry;
        // without this close every failed attempt would leak the connection
        // opened above and block later `versionchange` upgrades.
        indexed.close();
        throw error;
      }
      return indexed;
    };
  }

  private initIndexed: () => Promise<IndexedDBPromised>;

  private indexedPromise: Promise<IndexedDBPromised> | undefined;

  /**
   * Retryable initialization.
   *
   * This used to be a `new Promise(async (resolve) => ...)` with no rejection
   * path, so a failed `open()` — which is exactly what a full backing store
   * produces at startup — left the promise pending forever and hung every
   * later read and write. Freeing space could then never reach the reopening
   * logic, and only restarting the runtime recovered. Caching the promise and
   * dropping it on failure keeps the single-flight behavior while letting the
   * next call try again.
   */
  private getIndexed(): Promise<IndexedDBPromised> {
    if (!this.indexedPromise) {
      this.indexedPromise = this.initIndexed().catch((error) => {
        this.indexedPromise = undefined;
        throw error;
      });
    }
    return this.indexedPromise;
  }

  tableName: string;

  get indexed(): Promise<IndexedDBPromised> {
    return this.getIndexed();
  }

  // localforage = localforage;

  // Diagnostic payload only: never the stored values. WebStorage carries
  // application and global state, and a storage incident produces a burst of
  // blocked writes — logging their contents would spray persisted data into
  // developer consoles and log collection exactly when it is least wanted.
  checkDiskFull(payload?: {
    method: string;
    key?: string;
    itemCount?: number;
  }) {
    if (platformEnv.isWebDappMode) {
      return;
    }
    if (resetUtils.getIsResetting()) {
      return;
    }
    if (globalThis.$onekeySystemDiskIsFull) {
      console.error('WebStorage==>checkDiskFull ', payload);
    }
    // Delegate rather than re-implement: `checkIfDiskIsFullSync` forwards the
    // measured quota to the warning dialog AND schedules the re-measurement
    // that lets a retry succeed once the user frees space. Throwing here
    // directly would leave this path — the main app-storage write path —
    // unable to ever observe recovery.
    storageChecker.checkIfDiskIsFullSync();
  }

  isIndexedDB() {
    return true;
    // return localforage.driver() === localforage.INDEXEDDB;
  }

  async clear(callback: Callback | undefined): Promise<void> {
    const indexed = await this.indexed;
    await indexed.clear(this.tableName);
    // await localforage.clear();
    return Promise.resolve(undefined);
  }

  async getAllKeys(
    callback: CallbackWithResult<readonly string[]> | undefined,
  ): Promise<readonly string[]> {
    const indexed = await this.indexed;
    return indexed.getAllKeys(this.tableName) as unknown as readonly string[];
    // return localforage.keys();
  }

  async getAllEntries(): Promise<Map<string, any>> {
    const indexed = await this.indexed;
    return indexed.getAllEntries(this.tableName);
  }

  async getItem(
    key: string,
    callback: CallbackWithResult<string> | undefined,
  ): Promise<string | null> {
    const indexed = await this.indexed;
    try {
      // const result = (await localforage.getItem(key, callback)) ?? null;
      // return result;
      const result = (await indexed.get(this.tableName, key)) ?? null;
      return result as unknown as string | null;
    } catch (error) {
      console.error(
        'WebStorageError getItem ERROR: ',
        (error as Error | undefined)?.message,
      );
      throw error;
    }
  }

  async setItem(
    key: string,
    value: string,
    callback: Callback | undefined,
  ): Promise<void> {
    this.checkDiskFull({ method: 'setItem', key });

    const indexed = await this.indexed;
    try {
      await indexed.put(this.tableName, value, key);
      // await localforage.setItem(key, value, callback);
      return await Promise.resolve(undefined);
    } catch (error) {
      try {
        await indexed.add(this.tableName, value, key);
      } catch (error2) {
        // The transaction was aborted, so the request cannot be fulfilled.
        // Internal error opening backing store for indexedDB.open.
        // Encountered disk full while committing transaction.
        // QuotaExceededError: Encountered full disk while opening backing store for indexedDB.open.
        console.error(
          'WebStorageError setItem ERROR: ',
          [
            (error as Error | undefined)?.message,
            (error2 as Error | undefined)?.message,
          ]
            .filter(Boolean)
            .join(','),
        );
        throw error2;
      }
    }
  }

  async removeItem(key: string, callback: Callback | undefined): Promise<void> {
    const indexed = await this.indexed;
    await indexed.delete(this.tableName, key);
    // await localforage.removeItem(key, callback);
    return Promise.resolve(undefined);
  }

  // ----------------------------------------------

  async flushGetRequests(): Promise<void> {
    // localforage.flush
    const indexed = await this.indexed;
  }

  async mergeItem(
    key: string,
    value: string,
    callback: Callback | undefined,
  ): Promise<void> {
    this.checkDiskFull({ method: 'mergeItem', key });

    const indexed = await this.indexed;

    // localforage.merge

    return this.setItem(key, value, callback);
  }

  async multiGet(
    keys: readonly string[],
    callback: MultiGetCallback | undefined,
  ): Promise<readonly KeyValuePair[]> {
    const indexed = await this.indexed;

    // localforage.get

    const list = keys.map(async (key) => {
      const value = await this.getItem(key, undefined);
      const pair: KeyValuePair = [key, value ?? null];
      return pair;
    });
    return Promise.all(list);
  }

  async multiMerge(
    keyValuePairs: readonly (readonly [string, string])[],
    callback: MultiCallback | undefined,
  ): Promise<void> {
    this.checkDiskFull({
      method: 'multiMerge',
      itemCount: keyValuePairs.length,
    });

    const indexed = await this.indexed;

    const list = keyValuePairs.map((pair) =>
      this.mergeItem(pair[0], pair[1], undefined),
    );
    await Promise.all(list);
    return Promise.resolve(undefined);
  }

  async multiRemove(
    keys: readonly string[],
    callback: MultiCallback | undefined,
  ): Promise<void> {
    const indexed = await this.indexed;

    const list = keys.map((key) => this.removeItem(key, undefined));
    await Promise.all(list);
    return Promise.resolve(undefined);
  }

  async multiSet(
    keyValuePairs: readonly (readonly [string, string])[],
    callback: MultiCallback | undefined,
  ): Promise<void> {
    this.checkDiskFull({
      method: 'multiSet',
      itemCount: keyValuePairs.length,
    });

    const indexed = await this.indexed;

    const list = keyValuePairs.map((pair) =>
      this.setItem(pair[0], pair[1], undefined),
    );
    await Promise.all(list);
    return Promise.resolve(undefined);
  }
}

export default WebStorage;
