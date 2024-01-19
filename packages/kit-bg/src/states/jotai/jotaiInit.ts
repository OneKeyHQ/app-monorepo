import { isNil, isPlainObject } from 'lodash';

import type { IGlobalStatesSyncBroadcastParams } from '@onekeyhq/shared/src/background/backgroundUtils';

import { EAtomNames } from './atomNames';
import {
  buildJotaiStorageKey,
  globalJotaiStorageReadyHandler,
  onekeyJotaiStorage,
} from './jotaiStorage';
import { JotaiCrossAtom } from './utils/JotaiCrossAtom';
import { jotaiDefaultStore } from './utils/jotaiDefaultStore';

import type { IJotaiAtomSetWithoutProxy, IJotaiWritableAtomPro } from './types';

export async function jotaiUpdateFromUiByBgBroadcast(
  params: IGlobalStatesSyncBroadcastParams,
) {
  const allAtoms = await import('./atoms');
  // @ts-ignore
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const atomInfo = allAtoms[params.name] as JotaiCrossAtom<any>;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const atomObj = atomInfo.atom() as unknown as IJotaiWritableAtomPro<
    any,
    any,
    any
  >;
  await jotaiDefaultStore.set(atomObj, params);
}

export async function jotaiInitFromUi({
  states,
}: {
  states: Record<EAtomNames, any>;
}) {
  const allAtoms = await import('./atoms');
  await Promise.all(
    Object.entries(states).map(async ([key, value]) => {
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const atomInfo = allAtoms[key] as JotaiCrossAtom<any>;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const atomObj = atomInfo.atom() as unknown as IJotaiWritableAtomPro<
        any,
        any,
        any
      >;
      const data: IJotaiAtomSetWithoutProxy = {
        $$isForceSetAtomWithoutProxy: true,
        name: key,
        payload: value,
      };
      await jotaiDefaultStore.set(atomObj, data);
    }),
  );
  globalJotaiStorageReadyHandler.resolveReady(true);
}

export async function jotaiInit() {
  const allAtoms = await import('./atoms');
  const atoms: { [key: string]: JotaiCrossAtom<any> } = {};
  Object.entries(allAtoms).forEach(([key, value]) => {
    if (value instanceof JotaiCrossAtom && value.name) {
      atoms[key] = value;
    }
  });
  Object.entries(EAtomNames).forEach(([key, value]) => {
    if (key !== value) {
      throw new Error(`Atom names key value not matched: ${key}`);
    }
    if (!value.endsWith('Atom')) {
      throw new Error(`Atom name should be end with Atom: ${value}`);
    }
    if (!atoms[key]) {
      throw new Error(`Atom not defined: ${key}`);
    }
  });
  console.log('allAtoms : ', allAtoms, atoms, EAtomNames);

  await Promise.all(
    Object.entries(atoms).map(async ([key, value]) => {
      if (!value.name) {
        return;
      }
      if (key !== value.name) {
        throw new Error(
          `Atom name not matched with key: key=${key} name=${value.name}`,
        );
      }
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
    global.$$allAtoms = allAtoms;
  }

  return atoms;
}
