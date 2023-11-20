import { MMKV } from 'react-native-mmkv';

import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';

export const appSetting = new MMKV({
  id: `onekey-app-setting`,
});

export enum EAppSettingKey {
  rrt = 'rrt',
  perf_switch = 'perf_switch',
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
  storage.setSetting = appSetting.set.bind(appSetting);
  storage.getSettingString = appSetting.getString.bind(appSetting);
  storage.getSettingNumber = appSetting.getNumber.bind(appSetting);
  storage.getSettingBoolean = appSetting.getBoolean.bind(appSetting);
  storage.deleteSetting = appSetting.delete.bind(appSetting);
  storage.clearSetting = appSetting.clearAll.bind(appSetting);
  storage.getAllKeysOfSetting = appSetting.getAllKeys.bind(appSetting);
  return storage;
};
