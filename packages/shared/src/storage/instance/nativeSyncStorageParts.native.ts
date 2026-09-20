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
import { isTravelModeMaskingSync } from '../travelModeMaskingGate';

import { createMMKVSyncStorage } from './createMMKVSyncStorage';

import type { IMMKVInstance, ISyncStorage } from './createMMKVSyncStorage';
import type {
  INativeSWRCachePatchIntent,
  INativeSyncStorageLocalMutation,
  INativeSyncStorageName,
} from '../nativeStorageTypes';

/** Settings are written by bg alone, so main gets the mirror it can post
 *  writes through; bg gets the file. */
function getNativeSettingsInstance(): IMMKVInstance {
  if (platformEnv.isNativeBackgroundThread) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./mmkvStorageInstance').default as IMMKVInstance;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createNativeSyncStorageMirror } =
    require('./nativeSyncStorageMirror') as typeof import('./nativeSyncStorageMirror');
  return createNativeSyncStorageMirror('settings');
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
    return (
      !isNativeSyncStorageMirrorBootstrapped() && !isTravelModeMaskingSync()
    );
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
  const mirrorBacked = createMMKVSyncStorage(getNativeSettingsInstance(), {
    checkResetting: true,
    onMutation: getNativeMutationHandler('settings'),
  });
  if (platformEnv.isNativeBackgroundThread) {
    return mirrorBacked;
  }
  return withPreBootstrapDirectReads(mirrorBacked, 'settings');
}

/** Cold-start cache storage, owned by whichever runtime is reading it.
 *
 *  Both runtimes work the file directly, with SWR entries routed through the
 *  physical-key persistence layer. Nothing here is a source of truth: every
 *  value is a cache that the app can rebuild, so it needs none of the
 *  single-writer guarantees the settings store relies on, and a mirror only
 *  bought main a copy it can now read itself.
 *
 *  Travel Mode is answered here rather than by bg, because bg is no longer in
 *  the path. While it is on the store is inert and its file is emptied. */
export function createNativeColdStartCacheStorage(): ISyncStorage {
  const instance = getDirectMMKVOrUndefined('coldStart');
  if (!instance) {
    return createInertColdStartStorage();
  }
  if (isTravelModeMaskingSync()) {
    try {
      instance.clearAll();
    } catch {
      // Best effort: an unreadable file is already telling nothing.
    }
    return createInertColdStartStorage();
  }
  const onMutation = getNativeMutationHandler('coldStart');
  const {
    getNativeSWRCachePersistence,
    isNativeSWRCachePhysicalKey,
    SWR_CACHE_BOOTSTRAP_KEY_PREFIXES,
    NATIVE_SWR_CACHE_BOOTSTRAP_MAX_ENTRIES,
    NATIVE_SWR_CACHE_BOOTSTRAP_MAX_SERIALIZED_CHARS,
    // eslint-disable-next-line @typescript-eslint/no-require-imports
  } =
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
    // Declaring this is what keeps `swrCacheUtils` on the per-entry path:
    // without it every flush reads and re-serializes the whole store.
    readSWRCacheEntries: () =>
      persistence.readBootstrapEntries({
        keyPrefixes: SWR_CACHE_BOOTSTRAP_KEY_PREFIXES,
        maxEntries: NATIVE_SWR_CACHE_BOOTSTRAP_MAX_ENTRIES,
        maxSerializedChars: NATIVE_SWR_CACHE_BOOTSTRAP_MAX_SERIALIZED_CHARS,
      }),
    // Nothing to report: the runtime holding this store is also its only
    // writer, and it already knows about its own patches. The one writer in
    // the other runtime is the clear that precedes an app restart.
    subscribeSWRCacheEntries: () => () => undefined,
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

/** What the cold-start cache looks like while Travel Mode is on: present,
 *  answering nothing, keeping nothing. The SWR entry methods are absent on
 *  purpose — `swrCacheUtils` checks for them and falls back to the whole-store
 *  path, which this instance also drops. */
function createInertColdStartStorage(): ISyncStorage {
  return createMMKVSyncStorage({
    getString: () => undefined,
    getNumber: () => undefined,
    getBoolean: () => undefined,
    set: () => undefined,
    remove: () => undefined,
    clearAll: () => undefined,
    getAllKeys: () => [],
  });
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
