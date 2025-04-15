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
    isLoggedInOnServer: false,
    email: undefined,
    displayEmail: undefined,
    privyUserId: undefined,
    primeSubscription: undefined,
    subscriptionManageUrl: undefined,
  },
});

export type IPrimeCloudSyncPersistAtomData = {
  isCloudSyncEnabled: boolean;
};
export const {
  target: primeCloudSyncPersistAtom,
  use: usePrimeCloudSyncPersistAtom,
} = globalAtom<IPrimeCloudSyncPersistAtomData>({
  name: EAtomNames.primeCloudSyncPersistAtom,
  persist: true,
  initialValue: {
    isCloudSyncEnabled: false,
  },
});

export type IPrimeMasterPasswordPersistAtomData = {
  // masterPasswordHash: string; // never save in local storage, just in memory only
  // encryptedMasterPassword: string; // never save encrypted master password in local storage
  masterPasswordUUID: string; // pwdHash
  encryptedSecurityPasswordR1: string;
};
export const {
  target: primeMasterPasswordPersistAtom,
  use: usePrimeMasterPasswordPersistAtom,
} = globalAtom<IPrimeMasterPasswordPersistAtomData>({
  name: EAtomNames.primeMasterPasswordPersistAtom,
  persist: true,
  initialValue: {
    masterPasswordUUID: '',
    encryptedSecurityPasswordR1: '',
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
  promiseId: number;
  isRegister?: boolean;
  email: string;
};

export type IPrimeLoginDialogAtomEmailCodeData = {
  promiseId: number;
  email: string;
  verifyUUID: string;
};
export type IForgetMasterPasswordDialogData = {
  promiseId: number;
};
export type IPrimeLoginDialogAtomData = {
  promptPrimeLoginEmailDialog: number | undefined; // number is promiseId
  promptPrimeLoginPasswordDialog: IPrimeLoginDialogAtomPasswordData | undefined;
  promptPrimeLoginEmailCodeDialog:
    | IPrimeLoginDialogAtomEmailCodeData
    | undefined;
  promptForgetMasterPasswordDialog: IForgetMasterPasswordDialogData | undefined;
};
export type IPrimeLoginDialogKeys = keyof IPrimeLoginDialogAtomData;
export const { target: primeLoginDialogAtom, use: usePrimeLoginDialogAtom } =
  globalAtom<IPrimeLoginDialogAtomData>({
    name: EAtomNames.primeLoginDialogAtom,
    initialValue: {
      promptPrimeLoginEmailDialog: undefined,
      promptPrimeLoginPasswordDialog: undefined,
      promptPrimeLoginEmailCodeDialog: undefined,
      promptForgetMasterPasswordDialog: undefined,
    },
  });
