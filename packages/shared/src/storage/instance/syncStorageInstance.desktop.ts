// Desktop renderer syncStorage — uses synchronous IPC to main process
// where data is persisted via electron-store.
// The IPC bridge is exposed by preload.ts as globalThis.$mmkvSync.

import { isPlainObject } from 'lodash';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import resetUtils from '../../utils/resetUtils';

import {
  COLD_START_CACHE_STORAGE_ID,
  LEGACY_COLD_START_CACHE_STORAGE_ID,
} from './coldStartCacheStorageConfig';

import type { ISyncStorage } from './syncStorageInstance';
import type { EAppSyncStorageKeys } from '../syncStorageKeys';

function ipc(id: string, method: string, key?: string, value?: unknown): any {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
  return (globalThis as any).$mmkvSync({ method, id, key, value });
}

function createDesktopSyncStorage({
  id,
  checkResetting,
}: {
  id: string;
  checkResetting?: boolean;
}): ISyncStorage {
  const maybeCheckResetting = () => {
    if (checkResetting) {
      resetUtils.checkNotInResetting();
    }
  };

  return {
    set(key: EAppSyncStorageKeys, value: boolean | string | number) {
      maybeCheckResetting();
      ipc(id, 'set', key, value);
    },
    setObject<T extends Record<string, any>>(
      key: EAppSyncStorageKeys,
      value: T,
    ) {
      maybeCheckResetting();
      if (!isPlainObject(value)) {
        throw new OneKeyLocalError('value must be a plain object');
      }
      ipc(id, 'set', key, JSON.stringify(value));
    },
    getObject<T>(key: EAppSyncStorageKeys): T | undefined {
      try {
        const value = ipc(id, 'getString', key) as string | undefined;
        if (!value) {
          return undefined;
        }
        return JSON.parse(value) as T;
      } catch (_e) {
        return undefined;
      }
    },
    getString(key: EAppSyncStorageKeys) {
      return ipc(id, 'getString', key) as string | undefined;
    },
    getNumber(key: EAppSyncStorageKeys) {
      return ipc(id, 'getNumber', key) as number | undefined;
    },
    getBoolean(key: EAppSyncStorageKeys) {
      return ipc(id, 'getBoolean', key) as boolean | undefined;
    },
    delete(key: EAppSyncStorageKeys) {
      ipc(id, 'remove', key);
    },
    clearAll() {
      ipc(id, 'clearAll');
    },
    getAllKeys() {
      return (ipc(id, 'getAllKeys') as string[]) || [];
    },
  };
}

const syncStorageDesktop = createDesktopSyncStorage({
  id: 'onekey-app-setting',
  checkResetting: true,
});

const coldStartCacheStorageDesktop = createDesktopSyncStorage({
  id: COLD_START_CACHE_STORAGE_ID,
});

const legacyColdStartCacheStorageDesktop = createDesktopSyncStorage({
  id: LEGACY_COLD_START_CACHE_STORAGE_ID,
});

const coldStartCacheStorageDesktopWithLegacyFallback: ISyncStorage = {
  set(key, value) {
    coldStartCacheStorageDesktop.set(key, value);
    legacyColdStartCacheStorageDesktop.delete(key);
  },
  setObject(key, value) {
    coldStartCacheStorageDesktop.setObject(key, value);
    legacyColdStartCacheStorageDesktop.delete(key);
  },
  getObject<T>(key: EAppSyncStorageKeys): T | undefined {
    return (
      coldStartCacheStorageDesktop.getObject<T>(key) ??
      legacyColdStartCacheStorageDesktop.getObject<T>(key)
    );
  },
  getString(key) {
    return (
      coldStartCacheStorageDesktop.getString(key) ??
      legacyColdStartCacheStorageDesktop.getString(key)
    );
  },
  getNumber(key) {
    return (
      coldStartCacheStorageDesktop.getNumber(key) ??
      legacyColdStartCacheStorageDesktop.getNumber(key)
    );
  },
  getBoolean(key) {
    return (
      coldStartCacheStorageDesktop.getBoolean(key) ??
      legacyColdStartCacheStorageDesktop.getBoolean(key)
    );
  },
  delete(key) {
    coldStartCacheStorageDesktop.delete(key);
    legacyColdStartCacheStorageDesktop.delete(key);
  },
  clearAll() {
    coldStartCacheStorageDesktop.clearAll();
    legacyColdStartCacheStorageDesktop.clearAll();
  },
  getAllKeys() {
    return [
      ...new Set([
        ...coldStartCacheStorageDesktop.getAllKeys(),
        ...legacyColdStartCacheStorageDesktop.getAllKeys(),
      ]),
    ];
  },
};

export {
  coldStartCacheStorageDesktopWithLegacyFallback as coldStartCacheStorage,
  syncStorageDesktop as syncStorage,
};
export type { ISyncStorage };
