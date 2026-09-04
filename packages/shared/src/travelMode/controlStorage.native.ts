import platformEnv from '../platformEnv';
import { createNativeSettingsSyncStorage } from '../storage/instance/nativeSyncStorageParts';
import { syncNativeStorageMMKV } from '../storage/nativeStorageMigrationModule';
import { EAppSyncStorageKeys } from '../storage/syncStorageKeys';

import type { ITravelModeControlStorage } from './types';

const key = EAppSyncStorageKeys.onekey_travel_mode_control_v1;
const rawControlStorage = createNativeSettingsSyncStorage();

const controlStorage: ITravelModeControlStorage = {
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
};

export default controlStorage;
