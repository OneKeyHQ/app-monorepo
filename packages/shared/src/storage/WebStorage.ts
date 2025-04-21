/* eslint-disable  @typescript-eslint/no-unused-vars */
import localforage from 'localforage';

import appGlobals from '../appGlobals';
import { EAppEventBusNames, appEventBus } from '../eventBus/appEventBus';

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

if (process.env.NODE_ENV !== 'production') {
  appGlobals.$$localforage = localforage;
}
class WebStorage implements AsyncStorageStatic {
  isMigrated = false;

  localforage = localforage;

  checkDiskFull() {
    if (globalThis.$onekeySystemDiskIsFull) {
      appEventBus.emit(EAppEventBusNames.ShowSystemDiskFullWarning, undefined);
      // TODO use custom Error
      throw new Error('System Disk is full');
    }
  }

  isIndexedDB() {
    return localforage.driver() === localforage.INDEXEDDB;
  }

  async clear(callback: Callback | undefined): Promise<void> {
    await localforage.clear();
    return Promise.resolve(undefined);
  }

  async getAllKeys(
    callback: CallbackWithResult<readonly string[]> | undefined,
  ): Promise<readonly string[]> {
    return localforage.keys();
  }

  async getItem(
    key: string,
    callback: CallbackWithResult<string> | undefined,
  ): Promise<string | null> {
    try {
      const result = (await localforage.getItem(key, callback)) ?? null;
      return result;
    } catch (error) {
      console.error(
        'WebStorageError getItem: ',
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
    this.checkDiskFull();

    // TODO try catch
    try {
      await localforage.setItem(key, value, callback);
      return await Promise.resolve(undefined);
    } catch (error) {
      // The transaction was aborted, so the request cannot be fulfilled.
      // Internal error opening backing store for indexedDB.open.
      // Encountered disk full while committing transaction.
      // QuotaExceededError: Encountered full disk while opening backing store for indexedDB.open.
      console.error(
        'WebStorageError setItem: ',
        (error as Error | undefined)?.message,
      );
      throw error;
    }
  }

  async removeItem(key: string, callback: Callback | undefined): Promise<void> {
    await localforage.removeItem(key, callback);
    return Promise.resolve(undefined);
  }

  // ----------------------------------------------

  async flushGetRequests(): Promise<void> {
    // localforage.flush
  }

  async mergeItem(
    key: string,
    value: string,
    callback: Callback | undefined,
  ): Promise<void> {
    this.checkDiskFull();

    // localforage.merge

    return this.setItem(key, value, callback);
  }

  async multiGet(
    keys: readonly string[],
    callback: MultiGetCallback | undefined,
  ): Promise<readonly KeyValuePair[]> {
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
    this.checkDiskFull();

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
    const list = keys.map((key) => this.removeItem(key, undefined));
    await Promise.all(list);
    return Promise.resolve(undefined);
  }

  async multiSet(
    keyValuePairs: [string, string][],
    callback: MultiCallback | undefined,
  ): Promise<void> {
    this.checkDiskFull();

    const list = keyValuePairs.map((pair) =>
      this.setItem(pair[0], pair[1], undefined),
    );
    await Promise.all(list);
    return Promise.resolve(undefined);
  }
}

export default WebStorage;
