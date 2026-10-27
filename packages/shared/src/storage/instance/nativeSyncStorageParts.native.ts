/**
 * Native-only assembly of the sync-storage runtime pieces.
 *
 * This file is resolved ONLY on iOS/Android (`.native.ts`). Web, desktop and
 * extension builds resolve the sibling `nativeSyncStorageParts.ts` stub, which
 * keeps the native mirror / broadcast / MMKV-sync module chains (and their
 * `react-native` imports) out of non-native startup graphs.
 */
import platformEnv from '../../platformEnv';
import { isTravelModeMaskingSync } from '../travelModeMaskingGate';

import { createMMKVSyncStorage } from './createMMKVSyncStorage';

import type { IMMKVInstance, ISyncStorage } from './createMMKVSyncStorage';
import type {
  INativeSyncStorageLocalMutation,
  INativeSyncStorageName,
} from '../nativeStorageTypes';
import type { EAppSyncStorageKeys } from '../syncStorageKeys';

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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('./mmkvDevSettingStorageInstance').default as IMMKVInstance;
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
    } else {
      broadcastNativeSyncStorageMutation({ store, operation: 'clear' });
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { scheduleNativeStorageMMKVSync } =
      require('../nativeStorageMigrationModule') as typeof import('../nativeStorageMigrationModule');
    scheduleNativeStorageMMKVSync(
      store === 'settings' ? 'onekey-app-setting' : 'onekey-app-dev-setting',
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
