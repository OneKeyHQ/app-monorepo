import { cloneDeep, isNil, isPlainObject } from 'lodash';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

// Side-effect import: starts localDb IndexedDB initialization in background
// localDb is NOT needed for jotai atom reads (they use separate OneKeyGlobalStates IndexedDB)
import '../../dbs/local/localDb';

import { EAtomNames } from './atomNames';
import {
  buildJotaiStorageKey,
  globalJotaiStorageReadyHandler,
  onekeyJotaiStorage,
} from './jotaiStorage';
import { JotaiCrossAtom } from './utils/JotaiCrossAtom';
import { jotaiDefaultStore } from './utils/jotaiDefaultStore';

import type { ISettingsPersistAtom } from './atoms/settings';
import type { IJotaiWritableAtomPro } from './types';

function checkAtomNameMatched(key: string, value: string) {
  if (key !== value) {
    throw new OneKeyLocalError(
      `Atom name not matched with key: key=${key} value=${value}`,
    );
  }
}

// Preload all atom storage values from IndexedDB in parallel
async function preloadAtomStorageValues() {
  const storageMap = new Map<string, any>();
  await Promise.all(
    Object.values(EAtomNames).map(async (name) => {
      const key = buildJotaiStorageKey(name);
      const value = await onekeyJotaiStorage.getItem(key, undefined);
      storageMap.set(key, value);
    }),
  );
  return storageMap;
}

export async function jotaiInit() {
  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[LANDING_DEBUG] jotaiInit start, +${(performance.now() - ((globalThis as any).$$debugT0 ?? 0)).toFixed(1)}ms`,
    );
  }

  // Parallelize: import atoms + preload all storage values at the same time
  const [allAtoms, preloadedStorage] = await Promise.all([
    import('./atoms'),
    preloadAtomStorageValues(),
  ]);

  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[LANDING_DEBUG] jotaiInit atoms imported & storage preloaded, +${(performance.now() - ((globalThis as any).$$debugT0 ?? 0)).toFixed(1)}ms`,
    );
  }

  const atoms: { [key: string]: JotaiCrossAtom<any> } = {};
  Object.entries(allAtoms).forEach(([key, value]) => {
    if (value instanceof JotaiCrossAtom && value.name) {
      atoms[key] = value;
    }
  });
  Object.entries(EAtomNames).forEach(([key, value]) => {
    checkAtomNameMatched(key, value);
    if (!value.endsWith('Atom')) {
      throw new OneKeyLocalError(`Atom name should be end with Atom: ${value}`);
    }
    if (!atoms[key]) {
      throw new OneKeyLocalError(`Atom not defined: ${key}`);
    }
  });

  await Promise.all(
    Object.entries(atoms).map(async ([key, value]) => {
      if (!value.name) {
        return;
      }
      checkAtomNameMatched(key, value.name);
      const storageKey = buildJotaiStorageKey(value.name as EAtomNames);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const atomObj = value.atom() as unknown as IJotaiWritableAtomPro<
        any,
        any,
        any
      >;
      let initValue = atomObj.initialValue;

      if (!atomObj.persist) {
        return;
      }

      // Use preloaded storage value instead of individual reads
      let storageValue = preloadedStorage.get(storageKey);
      // save initValue to storage if storageValue is undefined
      if (isNil(storageValue)) {
        // initFrom backup (only for settingsPersistAtom on first launch)
        if (
          isNil(storageValue) &&
          storageKey === buildJotaiStorageKey(EAtomNames.settingsPersistAtom) &&
          isPlainObject(initValue)
        ) {
          // Lazy import dbBackupTools — only needed on first launch
          const { default: dbBackupToolsLazy } =
            await import('../../services/ServiceDBBackup/dbBackupTools');
          const backupedInstanceMeta =
            await dbBackupToolsLazy.getBackupedInstanceMeta();
          if (backupedInstanceMeta) {
            const initValueToUpdate = cloneDeep(
              initValue || {},
            ) as ISettingsPersistAtom;

            if (backupedInstanceMeta.instanceId) {
              initValueToUpdate.instanceId = backupedInstanceMeta.instanceId;
            }

            if (backupedInstanceMeta.sensitiveEncodeKey) {
              initValueToUpdate.sensitiveEncodeKey =
                backupedInstanceMeta.sensitiveEncodeKey;
            }

            if (!initValueToUpdate.instanceIdBackup) {
              initValueToUpdate.instanceIdBackup = {
                v4MigratedInstanceId: undefined,
                v5InitializedInstanceId: undefined,
              };
            }

            if (backupedInstanceMeta.instanceIdBackup?.v4MigratedInstanceId) {
              initValueToUpdate.instanceIdBackup.v4MigratedInstanceId =
                backupedInstanceMeta.instanceIdBackup.v4MigratedInstanceId;
            }

            if (
              backupedInstanceMeta.instanceIdBackup?.v5InitializedInstanceId
            ) {
              initValueToUpdate.instanceIdBackup.v5InitializedInstanceId =
                backupedInstanceMeta.instanceIdBackup.v5InitializedInstanceId;
            }

            initValue = Object.freeze(initValueToUpdate);
          }
        }

        await onekeyJotaiStorage.setItem(storageKey, initValue);
        storageValue = await onekeyJotaiStorage.getItem(storageKey, initValue);
      }
      const currentValue = await jotaiDefaultStore.get(atomObj);
      if (currentValue !== storageValue) {
        await jotaiDefaultStore.set(
          atomObj,
          isPlainObject(storageValue) && isPlainObject(initValue)
            ? {
                ...initValue,
                ...storageValue,
              }
            : storageValue,
        );
      }
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[LANDING_DEBUG] jotaiInit done, +${(performance.now() - ((globalThis as any).$$debugT0 ?? 0)).toFixed(1)}ms`,
    );
  }

  globalJotaiStorageReadyHandler.resolveReady(true);

  if (process.env.NODE_ENV !== 'production') {
    appGlobals.$$allAtoms = allAtoms;
  }

  return atoms;
}
