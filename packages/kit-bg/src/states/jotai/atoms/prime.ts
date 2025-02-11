/* eslint-disable @typescript-eslint/no-unused-vars */
import type { IPrimeUserInfo } from '@onekeyhq/shared/types/prime/primeTypes';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

export type IPrimePersistAtomData = IPrimeUserInfo;
export const {
  target: primePersistAtom, // persist
  use: usePrimePersistAtom,
} = globalAtom<IPrimePersistAtomData>({
  name: EAtomNames.primePersistAtom,
  persist: true,
  initialValue: {
    isLoggedIn: false,
    email: undefined,
    privyUserId: undefined,
    primeSubscription: undefined,
    subscriptionManageUrl: undefined,
  },
});

export type IPrimeInitAtomData = {
  isReady: boolean;
};
export const { target: primeInitAtom, use: usePrimeInitAtom } =
  globalAtom<IPrimeInitAtomData>({
    name: EAtomNames.primeInitAtom,
    initialValue: {
      isReady: false,
    },
  });

export type IPrimeLoginDialogAtomPasswordData = {
  isRegister?: boolean;
  email: string;
  promiseId: number;
};

export type IPrimeLoginDialogAtomEmailCodeData = {
  email: string;
  verifyUUID: string;
  promiseId: number;
};
export type IPrimeLoginDialogAtomData = {
  promptPrimeLoginEmailDialog: number | undefined;
  promptPrimeLoginPasswordDialog: IPrimeLoginDialogAtomPasswordData | undefined;
  promptPrimeLoginEmailCodeDialog:
    | IPrimeLoginDialogAtomEmailCodeData
    | undefined;
};
export type IPrimeLoginDialogKeys = keyof IPrimeLoginDialogAtomData;
export const { target: primeLoginDialogAtom, use: usePrimeLoginDialogAtom } =
  globalAtom<IPrimeLoginDialogAtomData>({
    name: EAtomNames.primeLoginDialogAtom,
    initialValue: {
      promptPrimeLoginEmailDialog: undefined,
      promptPrimeLoginPasswordDialog: undefined,
      promptPrimeLoginEmailCodeDialog: undefined,
    },
  });
