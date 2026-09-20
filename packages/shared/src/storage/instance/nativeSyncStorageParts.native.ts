/**
 * Native-only assembly of the sync-storage runtime pieces.
 *
 * This file is resolved ONLY on iOS/Android (`.native.ts`). Web, desktop and
 * extension builds resolve the sibling `nativeSyncStorageParts.ts` stub, which
 * keeps the native mirror / broadcast / MMKV-sync module chains (and their
 * `react-native` imports) out of non-native startup graphs.
 */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import platformEnv from '../../platformEnv';
import { EAppSyncStorageKeys } from '../syncStorageKeys';

import { createMMKVSyncStorage } from './createMMKVSyncStorage';

import type { IMMKVInstance, ISyncStorage } from './createMMKVSyncStorage';
import type {
  INativeSWRCachePatchIntent,
  INativeSyncStorageLocalMutation,
  INativeSyncStorageName,
} from '../nativeStorageTypes';

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

/** The store's own file, for main's pre-bootstrap read path. `undefined`
 *  when it cannot be opened, which leaves the mirror as the only source. */
function getDirectMMKVOrUndefined(
  store: INativeSyncStorageName,
): IMMKVInstance | undefined {
  try {
    if (store === 'settings') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('./mmkvStorageInstance').default as IMMKVInstance;
    }
    if (store === 'devSettings') {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('./mmkvDevSettingStorageInstance')
        .default as IMMKVInstance;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./coldStartCacheMMKVInstance').default as IMMKVInstance;
  } catch {
    return undefined;
  }
}

/**
 * Travel Mode, resolved on first read rather than while the factories run:
 * the travel-mode module imports this one, so touching it any earlier would
 * recurse. Unreachable counts as masked, so a failure here costs the fast
 * path rather than the guarantee.
 */
let travelModeMaskingRef: { isMaskingDataSync: () => boolean } | undefined;
function isTravelModeMasking(): boolean {
  try {
    if (!travelModeMaskingRef) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      travelModeMaskingRef = (
        require('../../travelMode') as typeof import('../../travelMode')
      ).travelModeManager;
    }
    return travelModeMaskingRef?.isMaskingDataSync() ?? true;
  } catch {
    return true;
  }
}

/**
 * Main's read path for a bg-owned store.
 *
 * The mirror answers nothing until bg replies to the bootstrap request, so
 * until then reads come from the file itself — that window is the whole cold
 * start. Once the mirror is primed it is authoritative and the file is not
 * consulted again: the mirror carries this runtime's own pending writes and
 * deletions, which the file has not seen.
 *
 * Writes are untouched and still go through the mirror, so bg remains the
 * only writer. Masking is bg's job, so while Travel Mode is on the fast path
 * steps aside and every read waits for the mirror bg fills.
 */
function withPreBootstrapDirectReads(
  mirrorBacked: ISyncStorage,
  store: INativeSyncStorageName,
): ISyncStorage {
  const directInstance = getDirectMMKVOrUndefined(store);
  if (!directInstance) {
    return mirrorBacked;
  }
  const direct = createMMKVSyncStorage(directInstance);
  const shouldReadDirect = () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { isNativeSyncStorageMirrorBootstrapped } =
      require('./nativeSyncStorageMirror') as typeof import('./nativeSyncStorageMirror');
    return !isNativeSyncStorageMirrorBootstrapped() && !isTravelModeMasking();
  };
  function readThrough<T>(
    readDirect: () => T | undefined,
    readMirror: () => T | undefined,
  ): T | undefined {
    if (!shouldReadDirect()) {
      return readMirror();
    }
    try {
      const value = readDirect();
      if (value !== undefined) {
        return value;
      }
    } catch {
      // An unreadable file is a miss, not a failure.
    }
    return readMirror();
  }
  return {
    ...mirrorBacked,
    getString: (key) =>
      readThrough(
        () => direct.getString(key),
        () => mirrorBacked.getString(key),
      ),
    getNumber: (key) =>
      readThrough(
        () => direct.getNumber(key),
        () => mirrorBacked.getNumber(key),
      ),
    getBoolean: (key) =>
      readThrough(
        () => direct.getBoolean(key),
        () => mirrorBacked.getBoolean(key),
      ),
    getObject: <T>(key: EAppSyncStorageKeys) =>
      readThrough<T>(
        () => direct.getObject<T>(key),
        () => mirrorBacked.getObject<T>(key),
      ),
  };
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

/** App settings storage. Native bg owns MMKV; native main uses a mirror. */
export function createNativeSettingsSyncStorage(): ISyncStorage {
  const mirrorBacked = createMMKVSyncStorage(
    getNativeStorageInstance('settings'),
    {
      checkResetting: true,
      onMutation: getNativeMutationHandler('settings'),
    },
  );
  if (platformEnv.isNativeBackgroundThread) {
    return mirrorBacked;
  }
  return withPreBootstrapDirectReads(mirrorBacked, 'settings');
}

/** Cold-start cache storage.
 *  Native bg: backed by `coldStartCacheMMKVInstance` (synchronous MMKV) with
 *    SWR cache entries routed through the physical-key persistence layer.
 *  Native main: synchronous in-memory mirror with serialized writes to bg. */
export function createNativeColdStartCacheStorage(): ISyncStorage {
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
          const entries = persistence.replaceSerialized(JSON.stringify(value));
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
  return withPreBootstrapDirectReads(
    createMMKVSyncStorage(instance, { onMutation }),
    'coldStart',
  );
}

/** Dev-settings storage owner for the native main runtime (mirror-backed). */
export function createNativeDevSettingStorageMirror() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createNativeSyncStorageMirror } =
    require('./nativeSyncStorageMirror') as typeof import('./nativeSyncStorageMirror');
  return createNativeSyncStorageMirror('devSettings');
}

/** Broadcast a bg-owned dev-settings mutation to the main runtime mirror. */
export function broadcastNativeDevSettingMutation(
  mutation: INativeSyncStorageLocalMutation,
) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { broadcastNativeSyncStorageMutation } =
    require('../nativeSyncStorageBroadcast') as typeof import('../nativeSyncStorageBroadcast');
  if (mutation.operation === 'set') {
    broadcastNativeSyncStorageMutation({
      store: 'devSettings',
      operation: 'set',
      key: mutation.key,
      value: mutation.value,
    });
  } else if (mutation.operation === 'remove') {
    broadcastNativeSyncStorageMutation({
      store: 'devSettings',
      operation: 'remove',
      key: mutation.key,
    });
  } else {
    broadcastNativeSyncStorageMutation({
      store: 'devSettings',
      operation: 'clear',
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { scheduleNativeStorageMMKVSync } =
    require('../nativeStorageMigrationModule') as typeof import('../nativeStorageMigrationModule');
  scheduleNativeStorageMMKVSync('onekey-app-dev-setting');
}
