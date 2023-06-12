/* eslint-disable @typescript-eslint/no-unused-vars */

// copy from:
//    node_modules/@react-native-async-storage/async-storage/types/index.d.ts
import platformEnv, { isManifestV3 } from '../platformEnv';

import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';

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

  async clear(callback?: (error?: Error | null) => void): Promise<void> {
    this._checkOffscreen();
    await this.browserApi.storage.local.clear();
  }

  async getAllKeys(
    callback?: (error?: Error | null, keys?: string[]) => void,
  ): Promise<string[]> {
    this._checkOffscreen();
    const data = (await this.browserApi.storage.local.get()) ?? {};
    return Object.keys(data);
  }

  // ----------------------------------------------

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
