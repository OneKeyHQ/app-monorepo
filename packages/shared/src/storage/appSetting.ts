import { MMKV } from 'react-native-mmkv';

import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';

export const appSetting = new MMKV({
  id: `onekey-app-setting`,
});

export enum AppSettingKey {
  rrt = 'rrt',
  perf_switch = 'perf_switch',
}

export interface AppStorage extends AsyncStorageStatic {
  setSetting: (key: AppSettingKey, value: boolean | string | number) => void;
  getSettingString: (key: AppSettingKey) => string | undefined;
  getSettingNumber: (key: AppSettingKey) => number | undefined;
  getSettingBoolean: (key: AppSettingKey) => boolean | undefined;
  deleteSetting: (key: AppSettingKey) => void;
  clearSetting: typeof appSetting.clearAll;
  getAllKeysOfSetting: typeof appSetting.getAllKeys;
}

export const buildAppStorageFactory = (
  appStorage: AsyncStorageStatic,
): AppStorage => {
  const storage = appStorage as AppStorage;
  storage.setSetting = appSetting.set.bind(appSetting);
  storage.getSettingString = appSetting.getString.bind(appSetting);
  storage.getSettingNumber = appSetting.getNumber.bind(appSetting);
  storage.getSettingBoolean = appSetting.getBoolean.bind(appSetting);
  storage.deleteSetting = appSetting.delete.bind(appSetting);
  storage.clearSetting = appSetting.clearAll.bind(appSetting);
  storage.getAllKeysOfSetting = appSetting.getAllKeys.bind(appSetting);
  return storage;
};
