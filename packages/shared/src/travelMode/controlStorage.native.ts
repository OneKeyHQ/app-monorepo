import { OneKeyLocalError } from '../errors';
import { getBackgroundThreadSharedStore } from '../modules3rdParty/react-native-background-thread/sharedStore';
import platformEnv from '../platformEnv';
import { createNativeSettingsSyncStorage } from '../storage/instance/nativeSyncStorageParts';
import { syncNativeStorageMMKV } from '../storage/nativeStorageMigrationModule';
import { EAppSyncStorageKeys } from '../storage/syncStorageKeys';

import type { ITravelModeControlStorage } from './types';

const key = EAppSyncStorageKeys.onekey_travel_mode_control_v1;
const runtimeGenerationKey = 'onekey_travel_mode_runtime_generation_v1';
const rawControlStorage = createNativeSettingsSyncStorage();

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
  getItemSync: platformEnv.isNativeBackgroundThread
    ? () => rawControlStorage.getString(key)
    : undefined,
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
