import biologyAuth from '@onekeyhq/shared/src/biologyAuth';

import { EAtomNames } from '../atomNames';
import { globalAtom, globalAtomComputed } from '../utils';

import { settingsAtom } from './settings';

export type IPasswordAtom = {
  passwordPromptPromiseId: number | undefined;
};
export const { target: passwordAtom, use: usePasswordAtom } =
  globalAtom<IPasswordAtom>({
    name: EAtomNames.passwordAtom,
    initialValue: { passwordPromptPromiseId: undefined },
  });

export const {
  target: passwordBiologyAuthInfoAtom,
  use: usePasswordBiologyAuthInfoAtom,
} = globalAtomComputed(async (get) => {
  const authType = await biologyAuth.getBiologyAuthType();
  const isSupport = await biologyAuth.isSupportBiologyAuth();
  const isEnable = isSupport && get(settingsAtom.atom()).isBiologyAuthSwitchOn;
  return { authType, isSupport, isEnable };
});
