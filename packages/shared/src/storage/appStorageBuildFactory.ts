import appGlobals from '../appGlobals';
import dbPerfMonitor from '../utils/debug/dbPerfMonitor';
import resetUtils from '../utils/resetUtils';

import { createPrintMethod } from './createPrintMethod';
import secureStorageInstance from './instance/secureStorageInstance';
import { syncStorage } from './instance/syncStorageInstance';

import type { AsyncStorageStatic, IAppStorage } from './appStorageTypes';

export const buildAppStorageFactory = (
  appStorage: AsyncStorageStatic,
): IAppStorage => {
  const storage = appStorage as IAppStorage;

  const originalSetItem = storage.setItem;
  const originalGetItem = storage.getItem;
  const originalRemoveItem = storage.removeItem;
  const originalMergeItem = storage.mergeItem;
  const originalMultiRemove = storage.multiRemove;
  const originalMultiSet = storage.multiSet;
  const originalMultiMerge = storage.multiMerge;

  const runGuardedMutation = ({
    execute,
    onError,
    onSuccess,
  }: {
    execute: () => Promise<void>;
    onError: (error: unknown) => void;
    onSuccess: () => void;
  }) => {
    try {
      resetUtils.checkNotInResetting();
    } catch (error) {
      onError(error);
      throw error;
    }
    let originalMutation: Promise<void>;
    try {
      originalMutation = execute();
    } catch (error) {
      onError(error);
      throw error;
    }
    // Mutations admitted before Reset App are part of the reversible PREPARE
    // phase and are drained before any storage clear. Let them complete: a
    // generation rollback here would delete valid data if another foreground
    // fails to prepare and the reset is resumed.
    const guardedMutation = originalMutation.then(
      () => onSuccess(),
      (error: unknown) => {
        onError(error);
        throw error;
      },
    );
    return resetUtils.trackResetSensitiveTask(guardedMutation);
  };

  const setItem: IAppStorage['setItem'] = (key, value, callback) => {
    dbPerfMonitor.logAppStorageCall('setItem', key);
    // ensureRunOnBackground();
    return runGuardedMutation({
      execute: () => originalSetItem.call(storage, key, value),
      onError: (error) => callback?.(error as Error),
      onSuccess: () => callback?.(null),
    });
  };
  const getItem: IAppStorage['getItem'] = (key, callback) => {
    dbPerfMonitor.logAppStorageCall('getItem', key);
    // ensureRunOnBackground();
    return originalGetItem.call(storage, key, callback);
  };
  const removeItem: IAppStorage['removeItem'] = (key, callback) => {
    return runGuardedMutation({
      execute: () => originalRemoveItem.call(storage, key),
      onError: (error) => callback?.(error as Error),
      onSuccess: () => callback?.(null),
    });
  };
  const mergeItem: IAppStorage['mergeItem'] = (key, value, callback) => {
    return runGuardedMutation({
      execute: () => originalMergeItem.call(storage, key, value),
      onError: (error) => callback?.(error as Error),
      onSuccess: () => callback?.(null),
    });
  };
  const multiSet: IAppStorage['multiSet'] = (keyValuePairs, callback) => {
    return runGuardedMutation({
      execute: () => originalMultiSet.call(storage, keyValuePairs),
      onError: (error) => callback?.([error as Error]),
      onSuccess: () => callback?.(null),
    });
  };
  const multiRemove: IAppStorage['multiRemove'] = (keys, callback) => {
    return runGuardedMutation({
      execute: () => originalMultiRemove.call(storage, keys),
      onError: (error) => callback?.([error as Error]),
      onSuccess: () => callback?.(null),
    });
  };
  const multiMerge: IAppStorage['multiMerge'] = (keyValuePairs, callback) => {
    return runGuardedMutation({
      execute: () => originalMultiMerge.call(storage, keyValuePairs),
      onError: (error) => callback?.([error as Error]),
      onSuccess: () => callback?.(null),
    });
  };

  storage.setItem = setItem;
  storage.getItem = getItem;
  storage.removeItem = removeItem;
  storage.mergeItem = mergeItem;
  storage.multiRemove = multiRemove;
  storage.multiSet = multiSet;
  storage.multiMerge = multiMerge;

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
