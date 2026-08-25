import { isPlainObject } from 'lodash';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import platformEnv from '../../platformEnv';
import resetUtils from '../../utils/resetUtils';
import { EAppSyncStorageKeys } from '../syncStorageKeys';

import type {
  INativeSWRCachePatchIntent,
  INativeSyncStorageLocalMutation,
  INativeSyncStorageName,
} from '../nativeStorageTypes';

// ---- MMKV instance interface (subset used by wrapper) ---- cspell:ignore IMMKV

type IMMKVInstance = {
  getString(key: string): string | undefined;
  getNumber(key: string): number | undefined;
  getBoolean(key: string): boolean | undefined;
  set(key: string, value: string | number | boolean): unknown;
  remove(key: string): unknown;
  clearAll(): unknown;
  getAllKeys(): string[];
  applySWRCachePatch?: (patch: INativeSWRCachePatchIntent) => unknown;
};

function normalizeMutationAcknowledgement(
  value: unknown,
): Promise<void> | undefined {
  if (
    value &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  ) {
    return Promise.resolve(value as PromiseLike<unknown>).then(() => undefined);
  }
  return undefined;
}

// ---- Factory: create ISyncStorage wrapper from any MMKV instance ----

export function createMMKVSyncStorage(
  mmkv: IMMKVInstance,
  options?: {
    checkResetting?: boolean;
    onMutation?: (mutation: INativeSyncStorageLocalMutation) => void;
  },
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
    const normalizedValue = value === undefined || value === null ? '' : value;
    const acknowledgement = normalizeMutationAcknowledgement(
      mmkv.set(key, normalizedValue),
    );
    options?.onMutation?.({ operation: 'set', key, value: normalizedValue });
    return acknowledgement;
  }

  const storage = {
    set(key: EAppSyncStorageKeys, value: boolean | string | number) {
      return safeSet(key, value);
    },
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
      const acknowledgement = normalizeMutationAcknowledgement(
        mmkv.remove(key),
      );
      options?.onMutation?.({ operation: 'remove', key });
      return acknowledgement;
    },
    clearAll() {
      const acknowledgement = normalizeMutationAcknowledgement(mmkv.clearAll());
      options?.onMutation?.({ operation: 'clear' });
      return acknowledgement;
    },
    getAllKeys() {
      return mmkv.getAllKeys();
    },
  };
  return {
    ...storage,
    ...(mmkv.applySWRCachePatch
      ? { applySWRCachePatch: mmkv.applySWRCachePatch }
      : {}),
  } as typeof storage & {
    applySWRCachePatch?: (
      patch: INativeSWRCachePatchIntent,
    ) => void | Promise<void>;
  };
}

export type ISyncStorage = ReturnType<typeof createMMKVSyncStorage>;

function getNativeStorageInstance(
  store: 'settings' | 'coldStart',
): IMMKVInstance {
  if (platformEnv.isNativeBackgroundThread) {
    if (store === 'settings') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('./mmkvStorageInstance').default as IMMKVInstance;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./coldStartCacheMMKVInstance').default as IMMKVInstance;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createNativeSyncStorageMirror } =
    require('./nativeSyncStorageMirror') as typeof import('./nativeSyncStorageMirror');
  return createNativeSyncStorageMirror(store);
}

function getNativeMutationHandler(store: INativeSyncStorageName) {
  if (!platformEnv.isNativeBackgroundThread) {
    return undefined;
  }
  return (mutation: INativeSyncStorageLocalMutation) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { broadcastNativeSyncStorageMutation } =
      require('../nativeSyncStorageBroadcast') as typeof import('../nativeSyncStorageBroadcast');
    if (mutation.operation === 'set') {
      broadcastNativeSyncStorageMutation({
        store,
        operation: 'set',
        key: mutation.key,
        value: mutation.value,
      });
    } else if (mutation.operation === 'remove') {
      broadcastNativeSyncStorageMutation({
        store,
        operation: 'remove',
        key: mutation.key,
      });
    } else if (mutation.operation === 'patchSWR') {
      if (store !== 'coldStart') {
        throw new OneKeyLocalError(
          'SWR cache patches are restricted to cold-start storage',
        );
      }
      broadcastNativeSyncStorageMutation({
        store: 'coldStart',
        operation: 'patchSWR',
        entries: mutation.entries,
      });
    } else {
      broadcastNativeSyncStorageMutation({ store, operation: 'clear' });
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { scheduleNativeStorageMMKVSync } =
      require('../nativeStorageMigrationModule') as typeof import('../nativeStorageMigrationModule');
    scheduleNativeStorageMMKVSync(
      store === 'settings' ? 'onekey-app-setting' : 'onekey-cold-start-cache',
    );
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

/** App settings. Native bg owns MMKV; native main uses a bootstrapped mirror. */
export const syncStorage = platformEnv.isExtensionBackgroundServiceWorker
  ? syncStorageExtBg
  : createMMKVSyncStorage(
      platformEnv.isNative
        ? getNativeStorageInstance('settings')
        : // eslint-disable-next-line @typescript-eslint/no-require-imports
          (require('./mmkvStorageInstance').default as IMMKVInstance),
      {
        checkResetting: true,
        onMutation: getNativeMutationHandler('settings'),
      },
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
    const instance = getNativeStorageInstance('coldStart');
    const onMutation = getNativeMutationHandler('coldStart');
    if (platformEnv.isNativeBackgroundThread) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getNativeSWRCachePersistence, isNativeSWRCachePhysicalKey } =
        require('../nativeSWRCachePersistence') as typeof import('../nativeSWRCachePersistence');
      const persistence = getNativeSWRCachePersistence(instance);
      const base = createMMKVSyncStorage(instance, {
        onMutation,
      });
      const swrKey = EAppSyncStorageKeys.onekey_swr_cache;
      const publishSWRPatch = (patch: INativeSWRCachePatchIntent) => {
        const entries = persistence.applyPatch(patch);
        onMutation?.({ operation: 'patchSWR', entries });
      };
      return {
        ...base,
        applySWRCachePatch: publishSWRPatch,
        set(key, value) {
          if (key === swrKey) {
            if (typeof value !== 'string') {
              throw new OneKeyLocalError(
                'Native SWR cache value must be serialized',
              );
            }
            const entries = persistence.replaceSerialized(value);
            onMutation?.({ operation: 'patchSWR', entries });
            return;
          }
          return base.set(key, value);
        },
        setObject<T extends Record<string, any>>(
          key: EAppSyncStorageKeys,
          value: T,
        ) {
          if (key === swrKey) {
            const entries = persistence.replaceSerialized(
              JSON.stringify(value),
            );
            onMutation?.({ operation: 'patchSWR', entries });
            return;
          }
          return base.setObject(key, value);
        },
        getString(key) {
          return key === swrKey
            ? persistence.readSerialized()
            : base.getString(key);
        },
        getObject<T>(key: EAppSyncStorageKeys): T | undefined {
          if (key !== swrKey) {
            return base.getObject<T>(key);
          }
          try {
            return JSON.parse(persistence.readSerialized()) as T;
          } catch {
            return undefined;
          }
        },
        delete(key) {
          if (key === swrKey) {
            const entries = persistence.replaceSerialized('{}');
            onMutation?.({ operation: 'patchSWR', entries });
            return;
          }
          return base.delete(key);
        },
        clearAll() {
          const acknowledgement = base.clearAll();
          persistence.invalidate();
          return acknowledgement;
        },
        getAllKeys() {
          const keys = instance
            .getAllKeys()
            .filter((key) => !isNativeSWRCachePhysicalKey(key));
          if (!keys.includes(swrKey)) {
            keys.push(swrKey);
          }
          return keys;
        },
      };
    }
    return createMMKVSyncStorage(instance, {
      onMutation,
    });
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
