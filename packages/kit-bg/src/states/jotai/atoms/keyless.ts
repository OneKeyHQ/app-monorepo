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

export type IKeylessPinConfirmStatusAtomData = {
  socialUserIdHash: string | undefined;
  socialProvider: string | undefined;
  needRemind: boolean | undefined;
  remindTime: number | undefined;
  confirmedCount: number | undefined;
};

export const {
  target: keylessPinConfirmStatusAtom,
  use: useKeylessPinConfirmStatusAtom,
} = globalAtom<IKeylessPinConfirmStatusAtomData>({
  name: EAtomNames.keylessPinConfirmStatusAtom,
  initialValue: {
    socialUserIdHash: undefined,
    socialProvider: undefined,
    needRemind: undefined,
    remindTime: undefined,
    confirmedCount: undefined,
  },
});
