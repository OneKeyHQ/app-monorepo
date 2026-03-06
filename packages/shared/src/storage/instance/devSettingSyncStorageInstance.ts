import platformEnv from '../../platformEnv';

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

const devSettingSyncStorageExtBg: IDevSettingSyncStorage = {
  set(
    _key: EDevSettingSyncStorageKeys,
    _value: boolean | string | number,
  ): void {
    // do nothing
  },
  getBoolean(_key: EDevSettingSyncStorageKeys): boolean | undefined {
    // do nothing
    return undefined;
  },
  delete(_key: EDevSettingSyncStorageKeys): void {
    // do nothing
  },
  clearAll(): void {
    // do nothing
  },
};

// eslint-disable-next-line import/no-named-as-default-member
export const devSettingSyncStorage =
  platformEnv.isExtensionBackgroundServiceWorker
    ? devSettingSyncStorageExtBg
    : devSettingSyncStorageWeb;
