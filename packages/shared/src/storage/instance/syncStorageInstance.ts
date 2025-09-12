import { isPlainObject } from 'lodash';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import platformEnv from '../../platformEnv';
import resetUtils from '../../utils/resetUtils';

import mmkvStorageInstance from './mmkvStorageInstance';

import type { EAppSyncStorageKeys } from '../syncStorageKeys';

const syncStorageWeb = {
  set(key: EAppSyncStorageKeys, value: boolean | string | number) {
    resetUtils.checkNotInResetting();
    mmkvStorageInstance.set(key, value);
  },
  setObject<T extends Record<string, any>>(key: EAppSyncStorageKeys, value: T) {
    resetUtils.checkNotInResetting();
    if (!isPlainObject(value)) {
      throw new OneKeyLocalError('value must be a plain object');
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

export type ISyncStorage = typeof syncStorageWeb;

const syncStorageExtBg: ISyncStorage = {
  set(_key: EAppSyncStorageKeys, _value: boolean | string | number): void {
    // do nothing
  },
  setObject<T extends Record<string, any>>(
    _key: EAppSyncStorageKeys,
    _value: T,
  ): void {
    // do nothing
  },
  getObject<T>(_key: EAppSyncStorageKeys): T | undefined {
    // do nothing
    return undefined;
  },
  getString(_key: EAppSyncStorageKeys): string | undefined {
    // do nothing
    return undefined;
  },
  getNumber(_key: EAppSyncStorageKeys): number | undefined {
    // do nothing
    return undefined;
  },
  getBoolean(_key: EAppSyncStorageKeys): boolean | undefined {
    // do nothing
    return undefined;
  },
  delete(_key: EAppSyncStorageKeys): void {
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
