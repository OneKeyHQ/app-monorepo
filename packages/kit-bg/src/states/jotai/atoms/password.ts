import { ELockDuration } from '@onekeyhq/shared/src/consts/appAutoLockConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { isSupportWebAuth } from '@onekeyhq/shared/src/webAuth';

import { biologyAuthUtils } from '../../../services/ServicePassword/biologyAuthUtils';
import { EAtomNames } from '../atomNames';
import { globalAtom, globalAtomComputed } from '../utils';

import { settingsPersistAtom } from './settings';
import { v4migrationAtom } from './v4migration';

import type { EPasswordPromptType } from '../../../services/ServicePassword/types';
import type { AuthenticationType } from 'expo-local-authentication';

export type IPasswordAtom = {
  unLock: boolean;
};
export const { target: passwordAtom, use: usePasswordAtom } =
  globalAtom<IPasswordAtom>({
    persist: false,
    name: EAtomNames.passwordAtom,
    initialValue: {
      unLock: false,
    },
  });

// this atom is used to trigger password prompt not add other state
export type IPasswordPromptPromiseTriggerAtom = {
  passwordPromptPromiseTriggerData:
    | {
        idNumber: number;
        type: EPasswordPromptType;
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
  // Is the application not locked manually by the user
  manualLocking: boolean;
  appLockDuration: number;
  enableSystemIdleLock: boolean;
};
export const passwordAtomInitialValue: IPasswordPersistAtom = {
  isPasswordSet: false,
  webAuthCredentialId: '',
  manualLocking: false,
  appLockDuration: 240,
  enableSystemIdleLock: false,
};
export const { target: passwordPersistAtom, use: usePasswordPersistAtom } =
  globalAtom<IPasswordPersistAtom>({
    persist: true,
    name: EAtomNames.passwordPersistAtom,
    initialValue: passwordAtomInitialValue,
  });

export const { target: systemIdleLockSupport, use: useSystemIdleLockSupport } =
  globalAtomComputed<Promise<boolean | undefined>>(async (get) => {
    const platformSupport = platformEnv.isExtension || platformEnv.isDesktop;
    const { appLockDuration } = get(passwordPersistAtom.atom());
    return (
      platformSupport &&
      appLockDuration !== Number(ELockDuration.Never) &&
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
    const { isPasswordSet, manualLocking, appLockDuration } = get(
      passwordPersistAtom.atom(),
    );
    if (isPasswordSet) {
      if (manualLocking) {
        return true;
      }
      const { unLock } = get(passwordAtom.atom());
      let usedUnlock = unLock;
      if (isMigrationModalOpen) {
        usedUnlock = true;
      }
      if (platformEnv.isWeb || platformEnv.isDev) {
        return !usedUnlock && String(appLockDuration) !== ELockDuration.Never;
      }
      return !usedUnlock;
    }
    return false;
  });
