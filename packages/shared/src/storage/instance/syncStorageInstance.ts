import { isPlainObject } from 'lodash';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import platformEnv from '../../platformEnv';
import resetUtils from '../../utils/resetUtils';

import coldStartCacheMMKVInstance from './coldStartCacheMMKVInstance';
import mmkvStorageInstance from './mmkvStorageInstance';

import type { EAppSyncStorageKeys } from '../syncStorageKeys';

// ---- MMKV instance interface (subset used by wrapper) ---- cspell:ignore IMMKV

type IMMKVInstance = {
  getString(key: string): string | undefined;
  getNumber(key: string): number | undefined;
  getBoolean(key: string): boolean | undefined;
  set(key: string, value: string | number | boolean): void;
  remove(key: string): void;
  clearAll(): void;
  getAllKeys(): string[];
};

// ---- Factory: create ISyncStorage wrapper from any MMKV instance ----

export function createMMKVSyncStorage(
  mmkv: IMMKVInstance,
  options?: { checkResetting?: boolean },
) {
  const checkResetting = options?.checkResetting ?? false;

  /**
   * Safe MMKV set — guards against undefined/null values that crash MMKV.
   * undefined/null → writes empty string (key preserved, value cleared).
   */
  function safeSet(
    key: string,
    value: string | number | boolean | undefined | null,
  ) {
    if (checkResetting) {
      resetUtils.checkNotInResetting();
    }
    if (value === undefined || value === null) {
      mmkv.set(key, '');
      return;
    }
    mmkv.set(key, value);
  }

  return {
    set(key: EAppSyncStorageKeys, value: boolean | string | number) {
      safeSet(key, value);
    },
    setObject<T extends Record<string, any>>(
      key: EAppSyncStorageKeys,
      value: T,
    ) {
      if (!isPlainObject(value)) {
        throw new OneKeyLocalError('value must be a plain object');
      }
      safeSet(key, JSON.stringify(value));
    },
    getObject<T>(key: EAppSyncStorageKeys): T | undefined {
      try {
        const raw = mmkv.getString(key);
        if (!raw) return undefined;
        return JSON.parse(raw) as T;
      } catch {
        return undefined;
      }
    },
    getString(key: EAppSyncStorageKeys) {
      return mmkv.getString(key);
    },
    getNumber(key: EAppSyncStorageKeys) {
      return mmkv.getNumber(key);
    },
    getBoolean(key: EAppSyncStorageKeys) {
      return mmkv.getBoolean(key);
    },
    delete(key: EAppSyncStorageKeys) {
      mmkv.remove(key);
    },
    clearAll() {
      mmkv.clearAll();
    },
    getAllKeys() {
      return mmkv.getAllKeys();
    },
  };
}

export type ISyncStorage = ReturnType<typeof createMMKVSyncStorage>;

// ---- No-op stub for extension background service worker ----

const syncStorageExtBg: ISyncStorage = {
  set() {},
  setObject() {},
  getObject() {
    return undefined;
  },
  getString() {
    return undefined;
  },
  getNumber() {
    return undefined;
  },
  getBoolean() {
    return undefined;
  },
  delete() {},
  clearAll() {},
  getAllKeys() {
    return [];
  },
};

// ---- Exports ----

/** App settings storage (onekey-app-setting MMKV instance) */
export const syncStorage = platformEnv.isExtensionBackgroundServiceWorker
  ? syncStorageExtBg
  : createMMKVSyncStorage(mmkvStorageInstance, { checkResetting: true });

/** Cold-start cache storage.
 *  Native: backed by `coldStartCacheMMKVInstance` (synchronous MMKV).
 *  Web/Desktop: backed by an in-memory Map pre-warmed by hydrate.ts at
 *    boot, with debounced IndexedDB persistence (`onekey-cold-start-cache`).
 *    Synchronous reads/writes operate on the Map; IDB is the durability layer.
 *  Extension background service worker: no-op stub. */
function createColdStartCacheStorage(): ISyncStorage {
  if (platformEnv.isNative) {
    return createMMKVSyncStorage(coldStartCacheMMKVInstance);
  }
  if (platformEnv.isWeb || platformEnv.isDesktop) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createWebColdStartStorage } =
      require('./webColdStartStorage') as typeof import('./webColdStartStorage');
    return createWebColdStartStorage();
  }
  return syncStorageExtBg;
}

export const coldStartCacheStorage = createColdStartCacheStorage();
