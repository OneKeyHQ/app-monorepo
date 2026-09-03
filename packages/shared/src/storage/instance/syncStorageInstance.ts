import platformEnv from '../../platformEnv';

import { createMMKVSyncStorage } from './createMMKVSyncStorage';
import {
  createNativeColdStartCacheStorage,
  createNativeSettingsSyncStorage,
} from './nativeSyncStorageParts';
import { createNonNativeColdStartCacheStorage } from './nonNativeColdStartStorage';

import type { IMMKVInstance, ISyncStorage } from './createMMKVSyncStorage';

export { createMMKVSyncStorage };
export type { ISyncStorage };

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

function createSettingsSyncStorage(): ISyncStorage {
  if (platformEnv.isExtensionBackgroundServiceWorker) {
    return syncStorageExtBg;
  }
  if (platformEnv.isNative) {
    return createNativeSettingsSyncStorage();
  }
  return createMMKVSyncStorage(
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./mmkvStorageInstance').default as IMMKVInstance,
    {
      checkResetting: true,
    },
  );
}

/** App settings. Native bg owns MMKV; native main uses a bootstrapped mirror. */
export const syncStorage = createSettingsSyncStorage();

/** Cold-start cache storage.
 *  Native bg: backed by `coldStartCacheMMKVInstance` (synchronous MMKV).
 *  Native main: synchronous in-memory mirror with serialized writes to bg.
 *  Web/Desktop: backed by an in-memory Map pre-warmed by hydrate.ts at
 *    boot, with debounced IndexedDB persistence (`onekey-cold-start-cache`).
 *    Synchronous reads/writes operate on the Map; IDB is the durability layer.
 *  Extension background service worker: no-op stub. */
function createColdStartCacheStorage(): ISyncStorage {
  if (platformEnv.isNative) {
    return createNativeColdStartCacheStorage();
  }
  if (platformEnv.isWeb || platformEnv.isDesktop) {
    return createNonNativeColdStartCacheStorage();
  }
  return syncStorageExtBg;
}

export const coldStartCacheStorage = createColdStartCacheStorage();
