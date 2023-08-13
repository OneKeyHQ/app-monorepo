import { MMKV } from 'react-native-mmkv';

import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';

export const appSetting = new MMKV({
  id: `onekey-app-setting`,
});

export interface AppStorage extends AsyncStorageStatic {
  setSetting: (key: string, value: boolean | string | number) => void;
  getSettingString: typeof appSetting.getString;
  getSettingNumber: typeof appSetting.getNumber;
  getSettingBoolean: typeof appSetting.getBoolean;
  deleteSetting: typeof appSetting.delete;
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
