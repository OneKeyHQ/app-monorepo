import resetUtils from '../utils/resetUtils';

import mmkvStorageInstance from './instance/mmkvStorageInstance';

import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';

export const appSetting = mmkvStorageInstance;

export enum EAppSettingKey {
  rrt = 'rrt',
  perf_switch = 'perf_switch',
  onekey_webembed_config = 'onekey_webembed_config',
}

export interface IAppStorage extends AsyncStorageStatic {
  setSetting: (key: EAppSettingKey, value: boolean | string | number) => void;
  getSettingString: (key: EAppSettingKey) => string | undefined;
  getSettingNumber: (key: EAppSettingKey) => number | undefined;
  getSettingBoolean: (key: EAppSettingKey) => boolean | undefined;
  deleteSetting: (key: EAppSettingKey) => void;
  clearSetting: typeof appSetting.clearAll;
  getAllKeysOfSetting: typeof appSetting.getAllKeys;
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

  storage.setSetting = appSetting.set.bind(appSetting);
  storage.getSettingString = appSetting.getString.bind(appSetting);
  storage.getSettingNumber = appSetting.getNumber.bind(appSetting);
  storage.getSettingBoolean = appSetting.getBoolean.bind(appSetting);
  storage.deleteSetting = appSetting.delete.bind(appSetting);
  storage.clearSetting = appSetting.clearAll.bind(appSetting);
  storage.getAllKeysOfSetting = appSetting.getAllKeys.bind(appSetting);
  return storage;
};
