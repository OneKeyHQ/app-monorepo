// TODO: move consts to shared
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { ELockDuration } from '@onekeyhq/kit/src/views/Setting/pages/AppAutoLock/const';
import biologyAuth from '@onekeyhq/shared/src/biologyAuth';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { isSupportWebAuth } from '@onekeyhq/shared/src/webAuth';

import { EAtomNames } from '../atomNames';
import { globalAtom, globalAtomComputed } from '../utils';

import { settingsPersistAtom } from './settings';

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
export const { target: passwordPersistAtom, use: usePasswordPersistAtom } =
  globalAtom<IPasswordPersistAtom>({
    persist: true,
    name: EAtomNames.passwordPersistAtom,
    initialValue: {
      isPasswordSet: false,
      webAuthCredentialId: '',
      manualLocking: false,
      appLockDuration: 240,
      enableSystemIdleLock: false,
    },
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
  const authType = await biologyAuth.getBiologyAuthType();
  const isSupport = await biologyAuth.isSupportBiologyAuth();
  const isEnable =
    isSupport && get(settingsPersistAtom.atom()).isBiologyAuthSwitchOn;
  return { authType, isSupport, isEnable };
});

export const { target: appIsLocked, use: useAppIsLockedAtom } =
  globalAtomComputed<boolean>((get) => {
    const { isPasswordSet, manualLocking, appLockDuration } = get(
      passwordPersistAtom.atom(),
    );
    const { unLock } = get(passwordAtom.atom());
    if (isPasswordSet) {
      if (manualLocking) {
        return true;
      }
      if (platformEnv.isWeb || platformEnv.isDev) {
        return !unLock && String(appLockDuration) !== ELockDuration.Never;
      }
      return !unLock;
    }
    return false;
  });
