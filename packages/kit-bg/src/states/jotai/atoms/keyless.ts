import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type IKeylessDialogAtomData = {
  promptKeylessAuthPackDialog: number | undefined; // number is promiseId
};

export type IKeylessDialogKeys = keyof IKeylessDialogAtomData;

export const { target: keylessDialogAtom, use: useKeylessDialogAtom } =
  globalAtom<IKeylessDialogAtomData>({
    name: EAtomNames.keylessDialogAtom,
    initialValue: {
      promptKeylessAuthPackDialog: undefined,
    },
  });
