import { atom, useAtom } from 'jotai';

import type { UseFormReturn } from 'react-hook-form';

export const formInstancesAtom = atom<UseFormReturn<any>[]>([]);

export const useFormInstances = () => {
  return useAtom(formInstancesAtom);
};
