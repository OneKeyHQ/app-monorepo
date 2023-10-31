import { EAtomNames } from './atomNames';
import {
  buildJotaiStorageKey,
  globalJotaiStorageReadyHandler,
  onekeyJotaiStorage,
} from './jotaiStorage';
import { CrossAtom, jotaiDefaultStore } from './utils';

import type { WritableAtom } from 'jotai';

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
      const atomObj = value.atom() as WritableAtom<any, any, any>;
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
      const initValue = atomObj.initialValue;
      const v = await onekeyJotaiStorage.getItem(skey, initValue);
      await jotaiDefaultStore.set(atomObj, v);
    }),
  );

  globalJotaiStorageReadyHandler.resolveReady(true);
}
