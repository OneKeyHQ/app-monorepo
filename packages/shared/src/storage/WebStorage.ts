/* eslint-disable  @typescript-eslint/no-unused-vars */
// import localforage from 'localforage';

import { SystemDiskFullError } from '../errors';
import errorUtils from '../errors/utils/errorUtils';
import { EAppEventBusNames, appEventBus } from '../eventBus/appEventBus';
import { IndexedDBPromised } from '../IndexedDBPromised';

import WebStorageLegacy from './WebStorageLegacy';

import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';
import type {
  Callback,
  CallbackWithResult,
  KeyValuePair,
  MultiCallback,
  MultiGetCallback,
} from '@react-native-async-storage/async-storage/lib/typescript/types';

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
  const legacyStorage = new WebStorageLegacy();
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
    this.indexed = new Promise(async (resolve) => {
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
      await migrateFromLegacyStorage({
        indexed,
        legacyKeyPrefix,
        tableName,
      });
      resolve(indexed);
    });
  }

  tableName: string;

  indexed: Promise<IndexedDBPromised>;

  // localforage = localforage;

  checkDiskFull(payload?: any) {
    if (globalThis.$onekeySystemDiskIsFull) {
      appEventBus.emit(EAppEventBusNames.ShowSystemDiskFullWarning, undefined);
      console.error('WebStorage==>checkDiskFull ', payload);
      throw new SystemDiskFullError();
    }
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
    this.checkDiskFull({ method: 'setItem', key, value });

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
    this.checkDiskFull({ method: 'mergeItem', key, value });

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
    this.checkDiskFull({ method: 'multiMerge', keyValuePairs });

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
    this.checkDiskFull({ method: 'multiSet', keyValuePairs });

    const indexed = await this.indexed;

    const list = keyValuePairs.map((pair) =>
      this.setItem(pair[0], pair[1], undefined),
    );
    await Promise.all(list);
    return Promise.resolve(undefined);
  }
}

export default WebStorage;
