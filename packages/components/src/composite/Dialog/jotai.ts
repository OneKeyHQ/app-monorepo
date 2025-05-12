import { atom, getDefaultStore, useAtom } from 'jotai';

import type { IDialogInstance } from './type';

export const dialogInstancesAtom = atom<IDialogInstance[]>([]);

export const useDialogInstances = () => {
  return useAtom(dialogInstancesAtom);
};

export function addDialogInstance(instance: IDialogInstance) {
  const store = getDefaultStore();
  store.set(dialogInstancesAtom, (prev) => [...prev, instance]);
}

export function removeDialogInstance(instance: IDialogInstance) {
  const store = getDefaultStore();
  store.set(dialogInstancesAtom, (prev) => prev.filter((d) => d !== instance));
}
