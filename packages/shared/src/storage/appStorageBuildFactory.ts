import appGlobals from '../appGlobals';
import { travelModeManager } from '../travelMode';
import dbPerfMonitor from '../utils/debug/dbPerfMonitor';
import resetUtils from '../utils/resetUtils';

import { createPrintMethod } from './createPrintMethod';
import secureStorageInstance from './instance/secureStorageInstance';
import { syncStorage } from './instance/syncStorageInstance';

import type {
  AsyncStorageStatic,
  IAppStorage,
  IAsyncStorageKeyValuePair,
} from './appStorageTypes';

export const buildAppStorageFactory = (
  appStorage: AsyncStorageStatic,
): IAppStorage => {
  const storage = appStorage as IAppStorage;

  const originalSetItem = storage.setItem;
  const originalGetItem = storage.getItem;
  const originalRemoveItem = storage.removeItem;
  const originalMergeItem = storage.mergeItem;
  const originalClear = storage.clear;
  const originalGetAllKeys = storage.getAllKeys;
  const originalMultiGet = storage.multiGet;
  const originalMultiSet = storage.multiSet;
  const originalMultiRemove = storage.multiRemove;
  const originalMultiMerge = storage.multiMerge;

  const setItem: IAppStorage['setItem'] = async (key, value, callback) => {
    dbPerfMonitor.logAppStorageCall('setItem', key);
    return travelModeManager.getRuntimeEnvironmentSync().persistence.run({
      operation: () => {
        resetUtils.checkNotInResetting();
        return originalSetItem.call(storage, key, value, callback);
      },
      onBlocked: () => callback?.(null),
    });
  };
  const getItem: IAppStorage['getItem'] = async (key, callback) => {
    dbPerfMonitor.logAppStorageCall('getItem', key);
    return travelModeManager.getRuntimeEnvironmentSync().persistence.run({
      operation: () => originalGetItem.call(storage, key, callback),
      onBlocked: () => {
        callback?.(null, null);
        return null;
      },
    });
  };
  const removeItem: IAppStorage['removeItem'] = async (key, callback) => {
    return travelModeManager.getRuntimeEnvironmentSync().persistence.run({
      operation: () => originalRemoveItem.call(storage, key, callback),
      onBlocked: () => callback?.(null),
    });
  };

  storage.mergeItem = async (key, value, callback) => {
    return travelModeManager.getRuntimeEnvironmentSync().persistence.run({
      operation: () => originalMergeItem.call(storage, key, value, callback),
      onBlocked: () => callback?.(null),
    });
  };
  storage.clear = async (callback) => {
    return travelModeManager.getRuntimeEnvironmentSync().persistence.run({
      operation: () => originalClear.call(storage, callback),
      onBlocked: () => callback?.(null),
    });
  };
  storage.getAllKeys = async (callback) => {
    return travelModeManager.getRuntimeEnvironmentSync().persistence.run({
      operation: () => originalGetAllKeys.call(storage, callback),
      onBlocked: () => {
        callback?.(null, []);
        return [];
      },
    });
  };
  storage.multiGet = async (keys, callback) => {
    return travelModeManager.getRuntimeEnvironmentSync().persistence.run({
      operation: () => originalMultiGet.call(storage, keys, callback),
      onBlocked: () => {
        const result = keys.map<IAsyncStorageKeyValuePair>((key) => [
          key,
          null,
        ]);
        callback?.(null, result);
        return result;
      },
    });
  };
  storage.multiSet = async (keyValuePairs, callback) => {
    return travelModeManager.getRuntimeEnvironmentSync().persistence.run({
      operation: () => originalMultiSet.call(storage, keyValuePairs, callback),
      onBlocked: () => callback?.(null),
    });
  };
  storage.multiRemove = async (keys, callback) => {
    return travelModeManager.getRuntimeEnvironmentSync().persistence.run({
      operation: () => originalMultiRemove.call(storage, keys, callback),
      onBlocked: () => callback?.(null),
    });
  };
  storage.multiMerge = async (keyValuePairs, callback) => {
    return travelModeManager.getRuntimeEnvironmentSync().persistence.run({
      operation: () =>
        originalMultiMerge.call(storage, keyValuePairs, callback),
      onBlocked: () => callback?.(null),
    });
  };

  storage.setItem = setItem;
  storage.getItem = getItem;
  storage.removeItem = removeItem;

  storage.syncStorage = syncStorage;
  storage.secureStorage = secureStorageInstance;

  appGlobals.$appStorage = storage;
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    appGlobals.$appStorage.print = createPrintMethod({ storage: appStorage });
  }

  return storage;
};
