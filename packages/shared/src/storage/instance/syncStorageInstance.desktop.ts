// Desktop renderer syncStorage — uses synchronous IPC to main process
// where data is persisted via electron-store.
// The IPC bridge is exposed by preload.ts as globalThis.$mmkvSync.

import { isPlainObject } from 'lodash';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import resetUtils from '../../utils/resetUtils';

import type { ISyncStorage } from './syncStorageInstance';
import type { EAppSyncStorageKeys } from '../syncStorageKeys';

const MMKV_ID = 'onekey-app-setting';

function ipc(method: string, key?: string, value?: unknown): any {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
  return (globalThis as any).$mmkvSync({ method, id: MMKV_ID, key, value });
}

const syncStorageDesktop: ISyncStorage = {
  set(key: EAppSyncStorageKeys, value: boolean | string | number) {
    resetUtils.checkNotInResetting();
    ipc('set', key, value);
  },
  setObject<T extends Record<string, any>>(key: EAppSyncStorageKeys, value: T) {
    resetUtils.checkNotInResetting();
    if (!isPlainObject(value)) {
      throw new OneKeyLocalError('value must be a plain object');
    }
    ipc('set', key, JSON.stringify(value));
  },
  getObject<T>(key: EAppSyncStorageKeys): T | undefined {
    try {
      const value = ipc('getString', key) as string | undefined;
      if (!value) {
        return undefined;
      }
      return JSON.parse(value) as T;
    } catch (_e) {
      return undefined;
    }
  },
  getString(key: EAppSyncStorageKeys) {
    return ipc('getString', key) as string | undefined;
  },
  getNumber(key: EAppSyncStorageKeys) {
    return ipc('getNumber', key) as number | undefined;
  },
  getBoolean(key: EAppSyncStorageKeys) {
    return ipc('getBoolean', key) as boolean | undefined;
  },
  delete(key: EAppSyncStorageKeys) {
    ipc('remove', key);
  },
  clearAll() {
    ipc('clearAll');
  },
  getAllKeys() {
    return (ipc('getAllKeys') as string[]) || [];
  },
};

export { syncStorageDesktop as syncStorage };
export type { ISyncStorage };
