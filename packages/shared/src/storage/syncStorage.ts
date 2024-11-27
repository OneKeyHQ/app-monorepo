import { isPlainObject } from 'lodash';

import appGlobals from '../appGlobals';
import platformEnv from '../platformEnv';
import dbPerfMonitor from '../utils/debug/dbPerfMonitor';
import resetUtils from '../utils/resetUtils';

import { createPrintMethod } from './createPrintMethod';
import { syncStorage } from './instance/syncStorageInstance';
import { EAppSyncStorageKeys } from './syncStorageKeys';

import type { ISyncStorage } from './instance/syncStorageInstance';
import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';

export { EAppSyncStorageKeys };

export interface IAppStorage extends AsyncStorageStatic {
  syncStorage: ISyncStorage;
}

export const buildAppStorageFactory = (
  appStorage: AsyncStorageStatic,
): IAppStorage => {
  const storage = appStorage as IAppStorage;

  const originalSetItem = storage.setItem;
  const originalGetItem = storage.getItem;
  const originalRemoveItem = storage.removeItem;

  const setItem: IAppStorage['setItem'] = (key, value, callback) => {
    resetUtils.checkNotInResetting();
    dbPerfMonitor.logAppStorageCall('setItem', key);
    return originalSetItem.call(storage, key, value, callback);
  };
  const getItem: IAppStorage['getItem'] = (key, callback) => {
    dbPerfMonitor.logAppStorageCall('getItem', key);
    return originalGetItem.call(storage, key, callback);
  };
  const removeItem: IAppStorage['removeItem'] = (key, callback) =>
    originalRemoveItem.call(storage, key, callback);

  storage.setItem = setItem;
  storage.getItem = getItem;
  storage.removeItem = removeItem;

  storage.syncStorage = syncStorage;

  appGlobals.$appStorage = storage;
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    // @ts-ignore
    appGlobals.$appStorage.print = createPrintMethod({ storage: appStorage });
  }

  return storage;
};
