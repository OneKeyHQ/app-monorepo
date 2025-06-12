import { cloneDeep, isNil, isPlainObject } from 'lodash';

import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import localDb from '../../dbs/local/localDb';
import dbBackupTools from '../../services/ServiceDBBackup/dbBackupTools';

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
    // const isNotificationsPersistAtom =
    //   key === 'notificationsPersistAtom' && value === 'notificationsAtom';
    // if (isNotificationsPersistAtom) {
    //   return;
    // }
    throw new OneKeyLocalError(
      `Atom name not matched with key: key=${key} value=${value}`,
    );
  }
}

export async function jotaiInit() {
  console.log('jotaiInit wait localDb ready');
  await localDb.readyDb;
  console.log('jotaiInit wait localDb ready done');

  const allAtoms = await import('./atoms');
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
  // console.log('allAtoms : ', allAtoms, atoms, EAtomNames);

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

      let storageValue = await onekeyJotaiStorage.getItem(
        storageKey,
        undefined,
      );
      // save initValue to storage if storageValue is undefined
      if (isNil(storageValue)) {
        // initFrom backup
        if (
          isNil(storageValue) &&
          storageKey === buildJotaiStorageKey(EAtomNames.settingsPersistAtom) &&
          isPlainObject(initValue)
        ) {
          const backupedInstanceMeta =
            await dbBackupTools.getBackupedInstanceMeta();
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

  globalJotaiStorageReadyHandler.resolveReady(true);

  if (process.env.NODE_ENV !== 'production') {
    appGlobals.$$allAtoms = allAtoms;
  }

  return atoms;
}
