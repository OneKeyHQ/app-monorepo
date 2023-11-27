import biologyAuth from '@onekeyhq/shared/src/biologyAuth';
import { isSupportWebAuth } from '@onekeyhq/shared/src/webAuth';

import { EAtomNames } from '../atomNames';
import { globalAtom, globalAtomComputed } from '../utils';

import { settingsPersistAtom } from './settings';

export type IPasswordAtom = {
  passwordPromptPromiseId: number | undefined;
  unLock: boolean;
};
export const { target: passwordAtom, use: usePasswordAtom } =
  globalAtom<IPasswordAtom>({
    persist: false,
    name: EAtomNames.passwordAtom,
    initialValue: { passwordPromptPromiseId: undefined, unLock: false },
  });

export type IPasswordPersistAtom = {
  isPasswordSet: boolean;
  webAuthCredentialId: string;
};
export const { target: passwordPersistAtom, use: usePasswordPersistAtom } =
  globalAtom({
    persist: true,
    name: EAtomNames.passwordPersistAtom,
    initialValue: { isPasswordSet: false, webAuthCredentialId: '' },
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
