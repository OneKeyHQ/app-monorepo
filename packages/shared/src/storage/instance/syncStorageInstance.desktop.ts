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

export { syncStorageDesktop as syncStorage };
export type { ISyncStorage };

// Cold-start cache storage on desktop renderer: backed by the same IDB +
// in-memory map pipeline as web (see webColdStartStorage). Desktop renderer
// is Chromium, so the IDB layer that hydrate.ts pre-warms at boot works
// identically. Mirrors the export shape of syncStorageInstance.ts.
//
// Do NOT replace this with a sync-IPC electron-store implementation: every
// .getString / .setObject would synchronously block the renderer waiting on
// the main process. Under boot-time contention (many concurrent IPC
// callers, main process busy with own init), that path freezes the
// renderer thread. The IDB+Map approach below is fully synchronous for
// reads (Map is pre-warmed by hydrate.ts) and asynchronous for IDB
// persistence (debounced flush on writes).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createWebColdStartStorage } =
  require('./webColdStartStorage') as typeof import('./webColdStartStorage');

export const coldStartCacheStorage = createWebColdStartStorage();
