import platformEnv from '../../platformEnv';
import { travelModeManager } from '../../travelMode';

import { createMMKVSyncStorage } from './createMMKVSyncStorage';
import {
  createNativeColdStartCacheStorage,
  createNativeSettingsSyncStorage,
} from './nativeSyncStorageParts';
import { createNonNativeColdStartCacheStorage } from './nonNativeColdStartStorage';

import type { IMMKVInstance, ISyncStorage } from './createMMKVSyncStorage';

export { createMMKVSyncStorage };
export type { ISyncStorage };

function createRuntimeSelectedSyncStorage(
  createRealStorage: () => ISyncStorage,
): ISyncStorage {
  let realStorage: ISyncStorage | undefined;
  const getRealStorage = () => {
    realStorage ??= createRealStorage();
    return realStorage;
  };
  const runSync = <T>({
    operation,
    onBlocked,
  }: {
    operation: (storage: ISyncStorage) => T;
    onBlocked: () => T;
  }): T =>
    travelModeManager.getRuntimeEnvironmentSync().persistence.runSync({
      operation: () => operation(getRealStorage()),
      onBlocked,
    });

  return {
    set(key, value) {
      return runSync({
        operation: (storage) => storage.set(key, value),
        onBlocked: () => undefined,
      });
    },
    setObject(key, value) {
      return runSync({
        operation: (storage) => storage.setObject(key, value),
        onBlocked: () => undefined,
      });
    },
    getObject(key) {
      return runSync({
        operation: (storage) => storage.getObject(key),
        onBlocked: () => undefined,
      });
    },
    getString(key) {
      return runSync({
        operation: (storage) => storage.getString(key),
        onBlocked: () => undefined,
      });
    },
    getNumber(key) {
      return runSync({
        operation: (storage) => storage.getNumber(key),
        onBlocked: () => undefined,
      });
    },
    getBoolean(key) {
      return runSync({
        operation: (storage) => storage.getBoolean(key),
        onBlocked: () => undefined,
      });
    },
    delete(key) {
      return runSync({
        operation: (storage) => storage.delete(key),
        onBlocked: () => undefined,
      });
    },
    clearAll() {
      return runSync({
        operation: (storage) => storage.clearAll(),
        onBlocked: () => undefined,
      });
    },
    getAllKeys() {
      return runSync({
        operation: (storage) => storage.getAllKeys(),
        onBlocked: () => [],
      });
    },
    applySWRCachePatch(patch) {
      return runSync({
        operation: (storage) => storage.applySWRCachePatch?.(patch),
        onBlocked: () => undefined,
      });
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
export const syncStorage = createRuntimeSelectedSyncStorage(
  createSettingsSyncStorage,
);

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

export const coldStartCacheStorage = createRuntimeSelectedSyncStorage(
  createColdStartCacheStorage,
);
