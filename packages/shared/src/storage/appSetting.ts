import resetUtils from '../utils/resetUtils';

import mmkvStorageInstance from './instance/mmkvStorageInstance';

import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';

export const syncStorage = mmkvStorageInstance;

export enum EAppSettingKey {
  rrt = 'rrt',
  perf_switch = 'perf_switch',
  onekey_webembed_config = 'onekey_webembed_config',
}

export interface IAppStorage extends AsyncStorageStatic {
  syncStorage: typeof syncStorage;
  // TODO remove all settings, use storage.syncStorage instead
  setSetting: (key: EAppSettingKey, value: boolean | string | number) => void;
  getSettingString: (key: EAppSettingKey) => string | undefined;
  getSettingNumber: (key: EAppSettingKey) => number | undefined;
  getSettingBoolean: (key: EAppSettingKey) => boolean | undefined;
  deleteSetting: (key: EAppSettingKey) => void;
  clearSetting: typeof syncStorage.clearAll;
  getAllKeysOfSetting: typeof syncStorage.getAllKeys;
}

export const buildAppStorageFactory = (
  appStorage: AsyncStorageStatic,
): IAppStorage => {
  const storage = appStorage as IAppStorage;

  const originalSetItem = storage.setItem;
  const originalRemoveItem = storage.removeItem;

  const setItem: IAppStorage['setItem'] = (key, value, callback) => {
    resetUtils.checkNotInResetting();
    return originalSetItem.call(storage, key, value, callback);
  };
  const removeItem: IAppStorage['removeItem'] = (key, callback) => {
    resetUtils.checkNotInResetting();
    return originalRemoveItem.call(storage, key, callback);
  };

  storage.setItem = setItem;
  storage.removeItem = removeItem;

  // TODO remove all settings, use storage.syncStorage instead
  storage.syncStorage = syncStorage;
  storage.setSetting = syncStorage.set.bind(syncStorage);
  storage.getSettingString = syncStorage.getString.bind(syncStorage);
  storage.getSettingNumber = syncStorage.getNumber.bind(syncStorage);
  storage.getSettingBoolean = syncStorage.getBoolean.bind(syncStorage);
  storage.deleteSetting = syncStorage.delete.bind(syncStorage);
  storage.clearSetting = syncStorage.clearAll.bind(syncStorage);
  storage.getAllKeysOfSetting = syncStorage.getAllKeys.bind(syncStorage);
  return storage;
};
