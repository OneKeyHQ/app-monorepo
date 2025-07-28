/* eslint-disable @typescript-eslint/no-unused-vars */
import type {
  IPrimeServerUserInfo,
  IPrimeUserInfo,
} from '@onekeyhq/shared/types/prime/primeTypes';

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
    isEnablePrime: undefined,
    isEnableSandboxPay: undefined,
    email: undefined,
    displayEmail: undefined,
    privyUserId: undefined,
    primeSubscription: undefined,
    subscriptionManageUrl: undefined,
  },
});

export type IPrimeCloudSyncPersistAtomData = {
  isCloudSyncEnabled: boolean;
  lastSyncTime?: number;
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
  isVerifyMasterPassword?: boolean;
  isChangeMasterPassword?: boolean;
  serverUserInfo?: IPrimeServerUserInfo;
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

export enum EPrimeTransferStatus {
  init = 'init',
  paired = 'paired',
  transferring = 'transferring',
}
export type IPrimeTransferAtomData = {
  shouldPreventExit: boolean;
  websocketConnected: boolean;
  websocketError: string | undefined;
  websocketEndpointUpdatedAt: number | undefined;
  status: EPrimeTransferStatus;
  pairedRoomId: string | undefined;
  myCreatedRoomId: string | undefined;
  myUserId: string | undefined;
  transferDirection:
    | {
        fromUserId: string | undefined;
        toUserId: string | undefined;
        randomNumber: string | undefined;
      }
    | undefined;
  importProgress?: {
    total: number;
    current: number;
    isImporting: boolean;
    stats?: {
      errorsInfo: {
        category: string;
        walletId: string;
        accountId: string;
        networkInfo: string;
        error: string;
      }[];
      progressTotal: number;
      progressCurrent: number;
    };
  };
};
export const { target: primeTransferAtom, use: usePrimeTransferAtom } =
  globalAtom<IPrimeTransferAtomData>({
    name: EAtomNames.primeTransferAtom,
    initialValue: {
      shouldPreventExit: false,
      websocketConnected: false,
      websocketError: undefined,
      websocketEndpointUpdatedAt: undefined,
      status: EPrimeTransferStatus.init,
      pairedRoomId: undefined,
      myCreatedRoomId: undefined,
      myUserId: undefined,
      transferDirection: undefined,
      importProgress: undefined,
    },
  });
