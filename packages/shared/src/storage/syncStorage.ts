import { isPlainObject } from 'lodash';

import platformEnv from '../platformEnv';
import resetUtils from '../utils/resetUtils';

import mmkvStorageInstance from './instance/mmkvStorageInstance';

import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';

// sync storage does not support extension background, don't use it in production, but only for development
export enum EAppSyncStorageKeys {
  rrt = 'rrt',
  perf_switch = 'perf_switch',
  onekey_webembed_config = 'onekey_webembed_config',
  onekey_disable_bg_api_serializable_checking = 'onekey_disable_bg_api_serializable_checking',
  onekey_perf_timer_log_config = 'onekey_perf_timer_log_config',
}

const syncStorageWeb = {
  set(key: EAppSyncStorageKeys, value: boolean | string | number) {

    resetUtils.checkNotInResetting();
    mmkvStorageInstance.set(key, value);
  },
  setObject<T extends Record<string, any>>(key: EAppSyncStorageKeys, value: T) {
    resetUtils.checkNotInResetting();
    if (!isPlainObject(value)) {
      throw new Error('value must be a plain object');
    }
    mmkvStorageInstance.set(key, JSON.stringify(value));
  },
  getObject<T>(key: EAppSyncStorageKeys): T | undefined {
    try {
      const value = mmkvStorageInstance.getString(key);
      if (!value) {
        return undefined;
      }
      return JSON.parse(value) as T;
    } catch (e) {
      return undefined;
    }
  },
  getString(key: EAppSyncStorageKeys) {
    return mmkvStorageInstance.getString(key);
  },
  getNumber(key: EAppSyncStorageKeys) {
    return mmkvStorageInstance.getNumber(key);
  },
  getBoolean(key: EAppSyncStorageKeys) {
    return mmkvStorageInstance.getBoolean(key);
  },
  delete(key: EAppSyncStorageKeys) {
    mmkvStorageInstance.delete(key);
  },
  clearAll() {
    mmkvStorageInstance.clearAll();
  },
  getAllKeys() {
    return mmkvStorageInstance.getAllKeys();
  },
};

const syncStorageExtBg: typeof syncStorageWeb = {
  set(key: EAppSyncStorageKeys, value: boolean | string | number): void {
    // do nothing
  },
  setObject<T extends Record<string, any>>(
    key: EAppSyncStorageKeys,
    value: T,
  ): void {
    // do nothing
  },
  getObject<T>(key: EAppSyncStorageKeys): T | undefined {
    // do nothing
    return undefined;
  },
  getString(key: EAppSyncStorageKeys): string | undefined {
    // do nothing
    return undefined;
  },
  getNumber(key: EAppSyncStorageKeys): number | undefined {
    // do nothing
    return undefined;
  },
  getBoolean(key: EAppSyncStorageKeys): boolean | undefined {
    // do nothing
    return undefined;
  },
  delete(key: EAppSyncStorageKeys): void {
    // do nothing
  },
  clearAll(): void {
    // do nothing
  },
  getAllKeys(): string[] {
    // do nothing
    return [];
  },
};

// eslint-disable-next-line import/no-named-as-default-member
export const syncStorage = platformEnv.isExtensionBackgroundServiceWorker
  ? syncStorageExtBg
  : syncStorageWeb;

export interface IAppStorage extends AsyncStorageStatic {
  syncStorage: typeof syncStorageWeb;
}

export const buildAppStorageFactory = (
  appStorage: AsyncStorageStatic,
): IAppStorage => {
  const storage = appStorage as IAppStorage;

  const originalSetItem = storage.setItem;
  const originalRemoveItem = storage.removeItem;

  const setItem: IAppStorage['setItem'] = (key, value, callback) => {
    resetUtils.checkNotInResetting();
    return originalSetItem.call(storage, key, value, callback);
  };
  const removeItem: IAppStorage['removeItem'] = (key, callback) =>
    originalRemoveItem.call(storage, key, callback);

  storage.setItem = setItem;
  storage.removeItem = removeItem;

  storage.syncStorage = syncStorage;
  return storage;
};
