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

if (process.env.NODE_ENV !== 'production') {
  global.$$localforage = localforage;
}

class WebStorage implements AsyncStorageStatic {
  mutex = new Semaphore(1);

  isMigrated = false;

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
    const result = (await localforage.getItem(key, callback)) ?? null;
    return result;
  }

  async setItem(
    key: string,
    value: string,
    callback: Callback | undefined,
  ): Promise<void> {
    await localforage.setItem(key, value, callback);
    return Promise.resolve(undefined);
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
    const list = keyValuePairs.map((pair) =>
      this.setItem(pair[0], pair[1], undefined),
    );
    await Promise.all(list);
    return Promise.resolve(undefined);
  }
}

export default WebStorage;
