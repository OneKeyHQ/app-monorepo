import { OneKeyLocalError } from '../errors';
import { getBackgroundThreadSharedStore } from '../modules3rdParty/react-native-background-thread/sharedStore';
import platformEnv from '../platformEnv';
import { createNativeSettingsSyncStorage } from '../storage/instance/nativeSyncStorageParts';
import { syncNativeStorageMMKV } from '../storage/nativeStorageMigrationModule';
import { EAppSyncStorageKeys } from '../storage/syncStorageKeys';

import type { ITravelModeControlStorage } from './types';
import type { IMMKVInstance } from '../storage/instance/createMMKVSyncStorage';

const key = EAppSyncStorageKeys.onekey_travel_mode_control_v1;
const runtimeGenerationKey = 'onekey_travel_mode_runtime_generation_v1';
const rawControlStorage = createNativeSettingsSyncStorage();

/** The settings file itself, for main's read-only path. Resolved lazily so
 *  requiring this module costs nothing in a runtime that never asks. */
function getDirectSettingsMMKV() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../storage/instance/mmkvStorageInstance')
    .default as IMMKVInstance;
}

const controlStorage: ITravelModeControlStorage = {
  getRuntimeGenerationSync() {
    const sharedStore = getBackgroundThreadSharedStore();
    if (!sharedStore) {
      return undefined;
    }
    const value = sharedStore.get(runtimeGenerationKey) ?? 0;
    if (
      typeof value !== 'number' ||
      !Number.isSafeInteger(value) ||
      value < 0
    ) {
      throw new OneKeyLocalError('Travel Mode runtime generation is invalid');
    }
    return value;
  },
  // Answerable in both runtimes. Main reads the settings file directly rather
  // than through its mirror: whether Travel Mode is on has to be known before
  // anything reads a cache, and the mirror is exactly the wait that answer
  // exists to skip. Reads only — bg still owns every write to this store.
  //
  // A throw here is deliberate: the manager's constructor catches it and
  // leaves the profile at its masked default, so an unreadable record fails
  // closed rather than reporting Travel Mode off.
  getItemSync: () =>
    platformEnv.isNativeBackgroundThread
      ? rawControlStorage.getString(key)
      : getDirectSettingsMMKV().getString(key),
  async getItem() {
    if (platformEnv.isNativeMainThread) {
      const { bootstrapNativeSyncStorageMirrors } =
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('../storage/instance/nativeSyncStorageMirror') as typeof import('../storage/instance/nativeSyncStorageMirror');
      await bootstrapNativeSyncStorageMirrors();
    }
    return rawControlStorage.getString(key);
  },
  async removeItem() {
    await rawControlStorage.delete(key);
    await syncNativeStorageMMKV('onekey-app-setting');
  },
  async setItem(value) {
    await rawControlStorage.set(key, value);
    await syncNativeStorageMMKV('onekey-app-setting');
  },
  setRuntimeGenerationSync: platformEnv.isNativeBackgroundThread
    ? (generation) => {
        const sharedStore = getBackgroundThreadSharedStore();
        if (!sharedStore) {
          throw new OneKeyLocalError('Travel Mode runtime gate is unavailable');
        }
        sharedStore.set(runtimeGenerationKey, generation);
      }
    : undefined,
};

export default controlStorage;
