import mmkvDevSettingStorageInstance from './mmkvDevSettingStorageInstance';

import type { EDevSettingSyncStorageKeys } from '../syncStorageKeys';

const devSettingSyncStorageWeb = {
  set(key: EDevSettingSyncStorageKeys, value: boolean | string | number) {
    mmkvDevSettingStorageInstance.set(key, value);
  },
  getBoolean(key: EDevSettingSyncStorageKeys) {
    return mmkvDevSettingStorageInstance.getBoolean(key);
  },
  delete(key: EDevSettingSyncStorageKeys) {
    mmkvDevSettingStorageInstance.remove(key);
  },
  clearAll() {
    mmkvDevSettingStorageInstance.clearAll();
  },
};

export type IDevSettingSyncStorage = typeof devSettingSyncStorageWeb;
export const devSettingSyncStorage = devSettingSyncStorageWeb;
