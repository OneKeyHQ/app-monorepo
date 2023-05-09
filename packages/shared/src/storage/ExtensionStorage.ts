/* eslint-disable @typescript-eslint/no-unused-vars */

// copy from:
//    node_modules/@react-native-async-storage/async-storage/types/index.d.ts
import platformEnv, { isManifestV3 } from '../platformEnv';

import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';

export interface IAsyncStorageLegacy {
  /**
   * Fetches key and passes the result to callback, along with an Error if there is any.
   */
  getItem(
    key: string,
    callback?: (error?: Error | null, result?: string | null) => void,
  ): Promise<string | null>;

  /**
   * Sets value for key and calls callback on completion, along with an Error if there is any
   */
  setItem(
    key: string,
    value: string,
    callback?: (error?: Error | null) => void,
  ): Promise<void>;

  removeItem(
    key: string,
    callback?: (error?: Error | null) => void,
  ): Promise<void>;

  /**
   * Merges existing value with input value, assuming they are stringified json. Returns a Promise object.
   * Not supported by all native implementation
   */
  mergeItem(
    key: string,
    value: string,
    callback?: (error?: Error | null) => void,
  ): Promise<void>;

  /**
   * Erases all AsyncStorage for all clients, libraries, etc. You probably don't want to call this.
   * Use removeItem or multiRemove to clear only your own keys instead.
   */
  clear(callback?: (error?: Error | null) => void): Promise<void>;

  /**
   * Gets all keys known to the app, for all callers, libraries, etc
   */
  getAllKeys(
    callback?: (error?: Error | null, keys?: string[]) => void,
  ): Promise<string[]>;

  /**
   * multiGet invokes callback with an array of key-value pair arrays that matches the input format of multiSet
   */
  multiGet(
    keys: readonly string[],
    callback?: (errors?: Error[], result?: [string, string | null][]) => void,
  ): Promise<[string, string | null][]>;

  /**
   * multiSet and multiMerge take arrays of key-value array pairs that match the output of multiGet,
   *
   * multiSet([['k1', 'val1'], ['k2', 'val2']], cb);
   */
  multiSet(
    keyValuePairs: string[][],
    callback?: (errors?: Error[]) => void,
  ): Promise<void>;

  /**
   * Delete all the keys in the keys array.
   */
  multiRemove(
    keys: string[],
    callback?: (errors?: Error[]) => void,
  ): Promise<void>;

  /**
   * Merges existing values with input values, assuming they are stringified json.
   * Returns a Promise object.
   *
   * Not supported by all native implementations.
   */
  multiMerge(
    keyValuePairs: string[][],
    callback?: (errors?: Error[]) => void,
  ): Promise<void>;
}

class ExtensionStorage implements AsyncStorageStatic {
  browserApi: typeof chrome =
    platformEnv.isExtFirefox || !isManifestV3 ? global.browser : global.chrome;

  _checkOffscreen() {
    if (platformEnv.isExtensionOffscreen) {
      throw new Error('ExtensionStorage is not supported in offscreen page.');
    }
  }

  async getItem(key: string) {
    this._checkOffscreen();
    const data = (await this.browserApi.storage.local.get(key)) ?? {};
    const value = data[key] as string;
    return value;
  }

  async setItem(key: string, value: string) {
    this._checkOffscreen();
    return this.browserApi.storage.local.set({
      [key]: value,
    });
  }

  async removeItem(key: string) {
    this._checkOffscreen();
    return this.browserApi.storage.local.remove(key);
  }

  clear(callback?: (error?: Error | null) => void): Promise<void> {
    return Promise.resolve(undefined);
  }

  getAllKeys(
    callback?: (error?: Error | null, keys?: string[]) => void,
  ): Promise<string[]> {
    return Promise.resolve([]);
  }

  mergeItem(
    key: string,
    value: string,
    callback?: (error?: Error | null) => void,
  ): Promise<void> {
    return Promise.resolve(undefined);
  }

  multiGet(
    keys: readonly string[],
    callback?: (errors?: Error[], result?: [string, string | null][]) => void,
  ): Promise<[string, string | null][]> {
    return Promise.resolve([]);
  }

  multiMerge(
    keyValuePairs: string[][],
    callback?: (errors?: Error[]) => void,
  ): Promise<void> {
    return Promise.resolve(undefined);
  }

  // multiRemove(
  //   keys: string[],
  //   callback?: (errors?: Error[]) => void,
  // )
  multiRemove(): Promise<void> {
    return Promise.resolve(undefined);
  }

  multiSet(
    keyValuePairs: string[][],
    callback?: (errors?: Error[]) => void,
  ): Promise<void> {
    return Promise.resolve(undefined);
  }

  flushGetRequests() {
    return Promise.resolve(undefined);
  }
}

export default ExtensionStorage;
