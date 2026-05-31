import { isPlainObject } from 'lodash';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import platformEnv from '../../platformEnv';
import resetUtils from '../../utils/resetUtils';

import coldStartCacheMMKVInstance, {
  getLegacyColdStartCacheMMKVInstance,
} from './coldStartCacheMMKVInstance';
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

function createColdStartCacheSyncStorage({
  primary,
  getLegacy,
}: {
  primary: ISyncStorage;
  getLegacy: () => ISyncStorage;
}): ISyncStorage {
  let legacy: ISyncStorage | undefined;
  let legacyTouched = false;

  const legacyStorage = () => {
    legacyTouched = true;
    legacy ??= getLegacy();
    return legacy;
  };

  const deleteLegacyKeyIfTouched = (key: EAppSyncStorageKeys) => {
    if (legacyTouched) {
      legacyStorage().delete(key);
    }
  };

  return {
    set(key, value) {
      primary.set(key, value);
      deleteLegacyKeyIfTouched(key);
    },
    setObject(key, value) {
      primary.setObject(key, value);
      deleteLegacyKeyIfTouched(key);
    },
    getObject<T>(key: EAppSyncStorageKeys): T | undefined {
      return primary.getObject<T>(key) ?? legacyStorage().getObject<T>(key);
    },
    getString(key) {
      return primary.getString(key) ?? legacyStorage().getString(key);
    },
    getNumber(key) {
      return primary.getNumber(key) ?? legacyStorage().getNumber(key);
    },
    getBoolean(key) {
      return primary.getBoolean(key) ?? legacyStorage().getBoolean(key);
    },
    delete(key) {
      primary.delete(key);
      legacyStorage().delete(key);
    },
    clearAll() {
      primary.clearAll();
      legacyStorage().clearAll();
    },
    getAllKeys() {
      return [
        ...new Set([...primary.getAllKeys(), ...legacyStorage().getAllKeys()]),
      ];
    },
  };
}

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

/** Cold-start cache storage (onekey-cold-start-cache MMKV instance).
 *  Native-only: on web/desktop/ext, react-native-mmkv falls back to
 *  localStorage, which can't match native MMKV's sync + capacity guarantees
 *  this cache depends on. Non-native platforms get a no-op stub so reads
 *  always miss and writes are discarded. */
export const coldStartCacheStorage = platformEnv.isNative
  ? createColdStartCacheSyncStorage({
      primary: createMMKVSyncStorage(coldStartCacheMMKVInstance),
      getLegacy: () =>
        createMMKVSyncStorage(getLegacyColdStartCacheMMKVInstance()),
    })
  : syncStorageExtBg;
