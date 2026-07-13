import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { isSupportWebAuth } from '@onekeyhq/shared/src/webAuth';

import { globalAtomComputed } from '../utils';

import { passwordPersistAtom } from './passwordLock';
import { settingsPersistAtom } from './settings';

import type { AuthenticationType } from 'expo-local-authentication';

export * from './passwordLock';

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
  const { biologyAuthUtils } =
    await import('../../../services/ServicePassword/biologyAuthUtils');
  const authType = await biologyAuthUtils.getBiologyAuthType();
  const isSupport = await biologyAuthUtils.isSupportBiologyAuth();
  const isEnable =
    isSupport && get(settingsPersistAtom.atom()).isBiologyAuthSwitchOn;
  return { authType, isSupport, isEnable };
});
