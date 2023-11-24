import { atom } from 'jotai';
import { unwrap } from 'jotai/utils';

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

const isSupportBiologyAtom = unwrap(
  atom(async () => biologyAuth.isSupportBiologyAuth()),
  () => false,
);

const isSupportWebAtom = unwrap(
  atom(async () => isSupportWebAuth()),
  () => false,
);

const biologyAuthTypeAtom = unwrap(
  atom(async () => biologyAuth.getBiologyAuthType()),
  () => [],
);

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
} = globalAtomComputed((get) => {
  const { webAuthCredentialId } = get(passwordPersistAtom.atom());
  const isSupport = get(isSupportWebAtom);
  const isEnable = isSupport && webAuthCredentialId?.length > 0;
  return {
    isSupport,
    isEnable,
  };
});

export const {
  target: passwordBiologyAuthInfoAtom,
  use: usePasswordBiologyAuthInfoAtom,
} = globalAtomComputed((get) => {
  const authType = get(biologyAuthTypeAtom);
  const isSupport = get(isSupportBiologyAtom);
  const isEnable =
    isSupport && get(settingsPersistAtom.atom()).isBiologyAuthSwitchOn;
  return {
    authType,
    isSupport,
    isEnable,
  };
});

export const useSupportWebOrBiology = () => {};
