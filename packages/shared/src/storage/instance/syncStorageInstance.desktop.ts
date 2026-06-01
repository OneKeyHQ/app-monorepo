// Desktop renderer syncStorage — uses synchronous IPC to main process
// where data is persisted via electron-store.
// The IPC bridge is exposed by preload.ts as globalThis.$mmkvSync.

import { isPlainObject } from 'lodash';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import resetUtils from '../../utils/resetUtils';

import type { ISyncStorage } from './syncStorageInstance';
import type { EAppSyncStorageKeys } from '../syncStorageKeys';

function ipc(id: string, method: string, key?: string, value?: unknown): any {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call
  return (globalThis as any).$mmkvSync({ method, id, key, value });
}

function createDesktopSyncStorage({
  id,
  checkResetting,
}: {
  id: string;
  checkResetting?: boolean;
}): ISyncStorage {
  const maybeCheckResetting = () => {
    if (checkResetting) {
      resetUtils.checkNotInResetting();
    }
  };

  return {
    set(key: EAppSyncStorageKeys, value: boolean | string | number) {
      maybeCheckResetting();
      ipc(id, 'set', key, value);
    },
    setObject<T extends Record<string, any>>(
      key: EAppSyncStorageKeys,
      value: T,
    ) {
      maybeCheckResetting();
      if (!isPlainObject(value)) {
        throw new OneKeyLocalError('value must be a plain object');
      }
      ipc(id, 'set', key, JSON.stringify(value));
    },
    getObject<T>(key: EAppSyncStorageKeys): T | undefined {
      try {
        const value = ipc(id, 'getString', key) as string | undefined;
        if (!value) {
          return undefined;
        }
        return JSON.parse(value) as T;
      } catch (_e) {
        return undefined;
      }
    },
    getString(key: EAppSyncStorageKeys) {
      return ipc(id, 'getString', key) as string | undefined;
    },
    getNumber(key: EAppSyncStorageKeys) {
      return ipc(id, 'getNumber', key) as number | undefined;
    },
    getBoolean(key: EAppSyncStorageKeys) {
      return ipc(id, 'getBoolean', key) as boolean | undefined;
    },
    delete(key: EAppSyncStorageKeys) {
      ipc(id, 'remove', key);
    },
    clearAll() {
      ipc(id, 'clearAll');
    },
    getAllKeys() {
      return (ipc(id, 'getAllKeys') as string[]) || [];
    },
  };
}

const syncStorageDesktop = createDesktopSyncStorage({
  id: 'onekey-app-setting',
  checkResetting: true,
});

const coldStartCacheStorageDesktop = createDesktopSyncStorage({
  id: 'onekey-cold-start-cache',
});

export {
  coldStartCacheStorageDesktop as coldStartCacheStorage,
  syncStorageDesktop as syncStorage,
};
export type { ISyncStorage };
