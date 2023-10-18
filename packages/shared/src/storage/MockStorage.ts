/* eslint-disable  @typescript-eslint/no-unused-vars */
import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';

// ExtensionUi redux-persist use MockStorage to do nothing
// redux-persist actual storage logic is running at Ext background
class MockStorage implements AsyncStorageStatic {
  setSetting() {}

  getSettingString() {
    return '';
  }

  getSettingNumber() {
    return 0;
  }

  getSettingBoolean() {
    return false;
  }

  deleteSetting() {}

  clearSetting() {}

  getAllKeysOfSetting() {
    return [];
  }

  getItem(): Promise<string | null> {
    return Promise.resolve(null);
  }

  setItem(): Promise<void> {
    return Promise.resolve(undefined);
  }

  removeItem(): Promise<void> {
    return Promise.resolve(undefined);
  }

  clear(callback?: (error?: Error) => void): Promise<void> {
    return Promise.resolve(undefined);
  }

  getAllKeys(
    callback?: (error?: Error, keys?: string[]) => void,
  ): Promise<string[]> {
    return Promise.resolve([]);
  }

  mergeItem(
    key: string,
    value: string,
    callback?: (error?: Error) => void,
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

export default MockStorage;
