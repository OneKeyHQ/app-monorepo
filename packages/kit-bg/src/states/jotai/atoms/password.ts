import biologyAuth from '@onekeyhq/shared/src/biologyAuth';

import { EAtomNames } from '../atomNames';
import { globalAtom, globalAtomComputed } from '../utils';

import { settingsAtom } from './settings';

export const {
  target: passwordBiologyAuthInfoAtom,
  use: usePasswordBiologyAuthInfoAtom,
} = globalAtomComputed(async (get) => {
  const authType = await biologyAuth.getBiologyAuthType();
  const isSupport = await biologyAuth.isSupportBiologyAuth();
  const isEnable = isSupport && get(settingsAtom.atom()).isBiologyAuthSwitchOn;
  return { authType, isSupport, isEnable };
});

export type IPasswordPromptPromiseAtom = {
  promiseId: number | undefined;
};
export const {
  target: passwordPromptPromiseAtom,
  use: usePasswordPromptPromiseAtom,
} = globalAtom<IPasswordPromptPromiseAtom>({
  name: EAtomNames.passwordPromptPromiseAtom,
  initialValue: { promiseId: undefined },
});
