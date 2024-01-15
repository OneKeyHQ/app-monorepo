import { ELockDuration } from '@onekeyhq/kit/src/views/Setting/pages/AppLock/const';
import biologyAuth from '@onekeyhq/shared/src/biologyAuth';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { isSupportWebAuth } from '@onekeyhq/shared/src/webAuth';

import { EAtomNames } from '../atomNames';
import { globalAtom, globalAtomComputed } from '../utils';

import { settingsPersistAtom } from './settings';

import type { EPasswordPromptType } from '../../../services/ServicePassword/types';

export type IPasswordAtom = {
  passwordPromptPromiseTriggerData:
    | {
        idNumber: number;
        type: EPasswordPromptType;
      }
    | undefined;
  unLock: boolean;
};
export const { target: passwordAtom, use: usePasswordAtom } =
  globalAtom<IPasswordAtom>({
    persist: false,
    name: EAtomNames.passwordAtom,
    initialValue: {
      passwordPromptPromiseTriggerData: undefined,
      unLock: false,
    },
  });

export type IPasswordPersistAtom = {
  isPasswordSet: boolean;
  webAuthCredentialId: string;
  // Is the application not locked manually by the user
  manualLocking: boolean;
  appLockDuration: number;
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
    },
  });

export const {
  target: passwordWebAuthInfoAtom,
  use: usePasswordWebAuthInfoAtom,
} = globalAtomComputed(async (get) => {
  const { webAuthCredentialId } = get(passwordPersistAtom.atom());
  const isSupport = await isSupportWebAuth();
  const isEnable = isSupport && webAuthCredentialId?.length > 0;
  return { isSupport, isEnable };
});

export const {
  target: passwordBiologyAuthInfoAtom,
  use: usePasswordBiologyAuthInfoAtom,
} = globalAtomComputed(async (get) => {
  const authType = await biologyAuth.getBiologyAuthType();
  const isSupport = await biologyAuth.isSupportBiologyAuth();
  const isEnable =
    isSupport && get(settingsPersistAtom.atom()).isBiologyAuthSwitchOn;
  return { authType, isSupport, isEnable };
});

export const { target: appIsLocked, use: useAppIsLockedAtom } =
  globalAtomComputed((get) => {
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
