/* eslint-disable  @typescript-eslint/no-unused-vars */
import { Semaphore } from 'async-mutex';
import localforage from 'localforage';

import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';
import type {
  Callback,
  CallbackWithResult,
  KeyValuePair,
  MultiCallback,
  MultiGetCallback,
} from '@react-native-async-storage/async-storage/lib/typescript/types';

localforage.config({
  name: 'OneKeyStorage',
});

const IS_MIGRATED_KEY = '$$ONEKEY_MIGRATED_TO_INDEXED_DB';
const REDUX_PERSIST_KEY = 'persist:ONEKEY_WALLET';

if (process.env.NODE_ENV !== 'production') {
  global.$$localforage = localforage;
}

class WebStorage implements AsyncStorageStatic {
  constructor() {
    this.migrateFromLocalStorage();
  }

  mutex = new Semaphore(1);

  isMigrated = false;

  // migrate legacy data from localStorage to indexedDB
  async migrateFromLocalStorage(): Promise<boolean> {
    return this.mutex.runExclusive(async () => {
      if (this.isMigrated) {
        this.isMigrated = true;
        return true;
      }
      if (typeof window !== 'undefined' && window.localStorage) {
        await localforage.ready();

        console.log(
          'appStorage/webStorage --- migrateFromLocalStorage >>>> ',
          localforage.driver(),
          localforage.LOCALSTORAGE,
        );
        /*
        localforage.INDEXEDDB="asyncStorage"
        localforage.WEBSQL="webSQLStorage"
        localforage.LOCALSTORAGE="localStorageWrapper"
         */
        if (localforage.driver() === localforage.LOCALSTORAGE) {
          this.isMigrated = true;
          return true;
        }
        if (window.localStorage.getItem(IS_MIGRATED_KEY)) {
          this.isMigrated = true;
          return true;
        }
        if (await localforage.getItem(REDUX_PERSIST_KEY)) {
          this.isMigrated = true;
          return true;
        }
        if (localforage.driver() === localforage.LOCALSTORAGE) {
          this.isMigrated = true;
          return true;
        }
        const list = Object.entries(window.localStorage).map(([k, v]) =>
          localforage.setItem(k, v),
        );
        await Promise.all(list);
        window.localStorage.setItem(IS_MIGRATED_KEY, Date.now().toString(10));
      }
      this.isMigrated = true;
      return true;
    });
  }

  async clear(callback: Callback | undefined): Promise<void> {
    await this.migrateFromLocalStorage();

    await localforage.clear();
    return Promise.resolve(undefined);
  }

  async getAllKeys(
    callback: CallbackWithResult<readonly string[]> | undefined,
  ): Promise<readonly string[]> {
    await this.migrateFromLocalStorage();

    return localforage.keys();
  }

  async getItem(
    key: string,
    callback: CallbackWithResult<string> | undefined,
  ): Promise<string | null> {
    await this.migrateFromLocalStorage();

    const result = (await localforage.getItem(key, callback)) ?? null;
    return result;
  }

  async setItem(
    key: string,
    value: string,
    callback: Callback | undefined,
  ): Promise<void> {
    await this.migrateFromLocalStorage();

    await localforage.setItem(key, value, callback);
    return Promise.resolve(undefined);
  }

  async removeItem(key: string, callback: Callback | undefined): Promise<void> {
    await this.migrateFromLocalStorage();

    await localforage.removeItem(key, callback);
    return Promise.resolve(undefined);
  }

  // ----------------------------------------------

  async flushGetRequests(): Promise<void> {
    // localforage.flush
    await this.migrateFromLocalStorage();
  }

  async mergeItem(
    key: string,
    value: string,
    callback: Callback | undefined,
  ): Promise<void> {
    await this.migrateFromLocalStorage();
    // localforage.merge

    return this.setItem(key, value, callback);
  }

  async multiGet(
    keys: readonly string[],
    callback: MultiGetCallback | undefined,
  ): Promise<readonly KeyValuePair[]> {
    await this.migrateFromLocalStorage();
    // localforage.get

    const list = keys.map(async (key) => {
      const value = await this.getItem(key, undefined);
      const pair: KeyValuePair = [key, value ?? null];
      return pair;
    });
    return Promise.all(list);
  }

  async multiMerge(
    keyValuePairs: [string, string][],
    callback: MultiCallback | undefined,
  ): Promise<void> {
    await this.migrateFromLocalStorage();

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
    await this.migrateFromLocalStorage();

    const list = keys.map((key) => this.removeItem(key, undefined));
    await Promise.all(list);
    return Promise.resolve(undefined);
  }

  async multiSet(
    keyValuePairs: [string, string][],
    callback: MultiCallback | undefined,
  ): Promise<void> {
    await this.migrateFromLocalStorage();

    const list = keyValuePairs.map((pair) =>
      this.setItem(pair[0], pair[1], undefined),
    );
    await Promise.all(list);
    return Promise.resolve(undefined);
  }
}

export default WebStorage;
