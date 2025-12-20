import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import { ELockDuration } from '@onekeyhq/shared/src/consts/appAutoLockConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { isNeverLockDuration } from '@onekeyhq/shared/src/utils/passwordUtils';
import { isSupportWebAuth } from '@onekeyhq/shared/src/webAuth';
import {
  EPasswordMode,
  EPasswordVerifyStatus,
} from '@onekeyhq/shared/types/password';
import type { EPasswordPromptType } from '@onekeyhq/shared/types/password';

import { biologyAuthUtils } from '../../../services/ServicePassword/biologyAuthUtils';
import { EAtomNames } from '../atomNames';
import { globalAtom, globalAtomComputed } from '../utils';

import { settingsPersistAtom } from './settings';
import { v4migrationAtom } from './v4migration';

import type { AuthenticationType } from 'expo-local-authentication';

export type IPasswordAtom = {
  unLock: boolean;
  // Is the application not locked manually by the user
  passwordVerifyStatus: {
    value: EPasswordVerifyStatus;
    message?: string;
  };
};
export const { target: passwordAtom, use: usePasswordAtom } =
  globalAtom<IPasswordAtom>({
    persist: false,
    name: EAtomNames.passwordAtom,
    initialValue: {
      unLock: false,
      passwordVerifyStatus: { value: EPasswordVerifyStatus.DEFAULT },
    },
  });

// this atom is used to trigger password prompt not add other state
export type IPasswordPromptPromiseTriggerAtom = {
  passwordPromptPromiseTriggerData:
    | {
        idNumber: number;
        type: EPasswordPromptType;
        dialogProps?: IDialogShowProps;
      }
    | undefined;
};
export const {
  target: passwordPromptPromiseTriggerAtom,
  use: usePasswordPromptPromiseTriggerAtom,
} = globalAtom<IPasswordPromptPromiseTriggerAtom>({
  persist: false,
  name: EAtomNames.passwordPromptPromiseTriggerAtom,
  initialValue: {
    passwordPromptPromiseTriggerData: undefined,
  },
});

export type IPasswordPersistAtom = {
  isPasswordSet: boolean;
  webAuthCredentialId: string;
  appLockDuration: number; // ELockDuration
  enableSystemIdleLock: boolean;
  passwordMode: EPasswordMode;
  enablePasswordErrorProtection: boolean;
  passwordErrorAttempts: number;
  passwordErrorProtectionTime: number;
  manualLocking: boolean;
};
export const passwordAtomInitialValue: IPasswordPersistAtom = {
  isPasswordSet: false,
  webAuthCredentialId: '',
  appLockDuration: Number(ELockDuration.Never),
  manualLocking: false,
  enableSystemIdleLock: true,
  passwordMode: EPasswordMode.PASSWORD,
  enablePasswordErrorProtection: false,
  passwordErrorAttempts: 0,
  passwordErrorProtectionTime: 0,
};
export const { target: passwordPersistAtom, use: usePasswordPersistAtom } =
  globalAtom<IPasswordPersistAtom>({
    persist: true,
    name: EAtomNames.passwordPersistAtom,
    initialValue: passwordAtomInitialValue,
  });

export const { target: passwordModeAtom, use: usePasswordModeAtom } =
  globalAtomComputed<EPasswordMode>((get) => {
    const { passwordMode, isPasswordSet } = get(passwordPersistAtom.atom());
    if (platformEnv.isNative && !isPasswordSet) {
      return EPasswordMode.PASSCODE;
    }
    return passwordMode;
  });

export const { target: systemIdleLockSupport, use: useSystemIdleLockSupport } =
  globalAtomComputed<Promise<boolean | undefined>>(async (get) => {
    const platformSupport = platformEnv.isExtension || platformEnv.isDesktop;
    const { appLockDuration } = get(passwordPersistAtom.atom());
    return (
      platformSupport &&
      !isNeverLockDuration(appLockDuration) &&
      appLockDuration !== Number(ELockDuration.Always)
    );
  });

export const {
  target: passwordWebAuthInfoAtom,
  use: usePasswordWebAuthInfoAtom,
} = globalAtomComputed<
  Promise<{
    isSupport: boolean;
    isEnable: boolean;
  }>
>(async (get) => {
  // TODO: remove webAuth in Native App
  // handling webAuthCredentialId in suspense causes the parent container to re-render and flicker.
  if (platformEnv.isNative) {
    return {
      isSupport: false,
      isEnable: false,
    };
  }
  const { webAuthCredentialId } = get(passwordPersistAtom.atom());
  const isSupport = await isSupportWebAuth();
  const isEnable = isSupport && webAuthCredentialId?.length > 0;
  return { isSupport, isEnable };
});

export const {
  target: passwordBiologyAuthInfoAtom,
  use: usePasswordBiologyAuthInfoAtom,
} = globalAtomComputed<
  Promise<{
    authType: AuthenticationType[];
    isSupport: boolean;
    isEnable: boolean;
  }>
>(async (get) => {
  const authType = await biologyAuthUtils.getBiologyAuthType();
  const isSupport = await biologyAuthUtils.isSupportBiologyAuth();
  const isEnable =
    isSupport && get(settingsPersistAtom.atom()).isBiologyAuthSwitchOn;
  return { authType, isSupport, isEnable };
});

export const { target: appIsLocked, use: useAppIsLockedAtom } =
  globalAtomComputed<boolean>((get) => {
    const { isMigrationModalOpen, isProcessing } = get(v4migrationAtom.atom());
    if (isMigrationModalOpen || isProcessing) {
      return false;
    }
    const { isPasswordSet, appLockDuration, manualLocking } = get(
      passwordPersistAtom.atom(),
    );
    if (isPasswordSet) {
      if (manualLocking) {
        return true;
      }

      const isNeverLock = isNeverLockDuration(appLockDuration);

      if (isNeverLock) {
        return false;
      }

      const { unLock } = get(passwordAtom.atom());
      let usedUnlock = unLock;
      if (isMigrationModalOpen) {
        usedUnlock = true;
      }

      return !usedUnlock;
    }
    return false;
  });
