import { isPlainObject } from 'lodash';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import resetUtils from '../../utils/resetUtils';

import mmkvStorageInstance from './mmkvStorageInstance';
import { createWebColdStartStorage } from './webColdStartStorage';

// cspell:ignore IMMKV
import type { IMMKVInstance, ISyncStorage } from './createMMKVSyncStorage';
import type { EAppSyncStorageKeys } from '../syncStorageKeys';

export { createMMKVSyncStorage } from './createMMKVSyncStorage';
export type { ISyncStorage };

function createWebSettingsSyncStorage(mmkv: IMMKVInstance): ISyncStorage {
  function safeSet(
    key: EAppSyncStorageKeys,
    value: string | number | boolean | undefined | null,
  ) {
    resetUtils.checkNotInResetting();
    mmkv.set(key, value === undefined || value === null ? '' : value);
    return undefined;
  }

  return {
    set: safeSet,
    setObject<T extends Record<string, any>>(
      key: EAppSyncStorageKeys,
      value: T,
    ) {
      if (!isPlainObject(value)) {
        throw new OneKeyLocalError('value must be a plain object');
      }
      return safeSet(key, JSON.stringify(value));
    },
    getObject<T>(key: EAppSyncStorageKeys): T | undefined {
      try {
        const raw = mmkv.getString(key);
        return raw ? (JSON.parse(raw) as T) : undefined;
      } catch {
        return undefined;
      }
    },
    getString: (key) => mmkv.getString(key),
    getNumber: (key) => mmkv.getNumber(key),
    getBoolean: (key) => mmkv.getBoolean(key),
    delete(key) {
      mmkv.remove(key);
      return undefined;
    },
    clearAll() {
      mmkv.clearAll();
      return undefined;
    },
    getAllKeys: () => mmkv.getAllKeys(),
  };
}

export const syncStorage = createWebSettingsSyncStorage(mmkvStorageInstance);
export const coldStartCacheStorage = createWebColdStartStorage();
