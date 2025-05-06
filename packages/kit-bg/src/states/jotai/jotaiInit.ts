import { isNil, isPlainObject } from 'lodash';

import appGlobals from '@onekeyhq/shared/src/appGlobals';

import localDb from '../../dbs/local/localDb';

import { EAtomNames } from './atomNames';
import {
  buildJotaiStorageKey,
  globalJotaiStorageReadyHandler,
  onekeyJotaiStorage,
} from './jotaiStorage';
import { JotaiCrossAtom } from './utils/JotaiCrossAtom';
import { jotaiDefaultStore } from './utils/jotaiDefaultStore';

import type { IJotaiWritableAtomPro } from './types';

function checkAtomNameMatched(key: string, value: string) {
  if (key !== value) {
    // const isNotificationsPersistAtom =
    //   key === 'notificationsPersistAtom' && value === 'notificationsAtom';
    // if (isNotificationsPersistAtom) {
    //   return;
    // }
    throw new Error(
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
      throw new Error(`Atom name should be end with Atom: ${value}`);
    }
    if (!atoms[key]) {
      throw new Error(`Atom not defined: ${key}`);
    }
  });
  // console.log('allAtoms : ', allAtoms, atoms, EAtomNames);

  await Promise.all(
    Object.entries(atoms).map(async ([key, value]) => {
      if (!value.name) {
        return;
      }
      checkAtomNameMatched(key, value.name);
      const storageKey = buildJotaiStorageKey(value.name);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const atomObj = value.atom() as unknown as IJotaiWritableAtomPro<
        any,
        any,
        any
      >;
      const initValue = atomObj.initialValue;

      if (!atomObj.persist) {
        return;
      }

      let storageValue = await onekeyJotaiStorage.getItem(
        storageKey,
        undefined,
      );
      // save initValue to storage if storageValue is undefined
      if (isNil(storageValue)) {
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
