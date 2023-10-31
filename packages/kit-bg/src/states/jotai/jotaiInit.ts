import { EAtomNames } from './atomNames';
import {
  buildJotaiStorageKey,
  globalJotaiStorageReadyHandler,
  onekeyJotaiStorage,
} from './jotaiStorage';
import { CrossAtom, jotaiDefaultStore } from './utils';

import type { IWritableAtomPro } from './types';

export async function jotaiInit() {
  const allAtoms = await import('./atoms');
  let namesLength = 0;
  const atoms: { [key: string]: CrossAtom<any> } = {};
  Object.entries(allAtoms).forEach(([key, value]) => {
    if (value instanceof CrossAtom) {
      atoms[key] = value;
    }
  });
  Object.entries(EAtomNames).forEach(([key, value]) => {
    namesLength += 1;
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
      const skey = buildJotaiStorageKey(value.name);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const atomObj = value.atom() as unknown as IWritableAtomPro<
        any,
        any,
        any
      >;
      const initValue = atomObj.initialValue;

      if (!atomObj.persist) {
        return;
      }

      const storageValue = await onekeyJotaiStorage.getItem(skey, initValue);
      const currentValue = await jotaiDefaultStore.get(atomObj);
      if (currentValue !== storageValue) {
        await jotaiDefaultStore.set(atomObj, storageValue);
      }
    }),
  );

  globalJotaiStorageReadyHandler.resolveReady(true);
}
