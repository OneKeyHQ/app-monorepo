import biologyAuth from '@onekeyhq/shared/src/biologyAuth';

import { EAtomNames } from '../atomNames';
import { globalAtom, globalAtomComputed } from '../utils';

import { settingsPersistAtom } from './settings';

export type IPasswordAtom = {
  passwordPromptPromiseId: number | undefined;
};
export const { target: passwordAtom, use: usePasswordAtom } =
  globalAtom<IPasswordAtom>({
    persist: false,
    name: EAtomNames.passwordAtom,
    initialValue: { passwordPromptPromiseId: undefined },
  });

export type IPasswordPersistAtom = {
  isPasswordSet: boolean;
};
export const { target: passwordPersistAtom, use: usePasswordPersistAtom } =
  globalAtom({
    persist: true,
    name: EAtomNames.passwordPersistAtom,
    initialValue: { isPasswordSet: false },
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
