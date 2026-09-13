import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { isSupportWebAuth } from '@onekeyhq/shared/src/webAuth';

import { runtimePersistenceAdapter } from '../../../runtime/RuntimeEnvironmentAdapter';
import { globalAtomComputed } from '../utils';

import { settingsPersistAtom } from './settings';

import type { AuthenticationType } from 'expo-local-authentication';

export * from './passwordLock';

// WebAuth support is a static device capability, so this atom must NOT depend on
// any atom that changes at runtime. It used to read `webAuthCredentialId` from
// passwordPersistAtom purely to derive an `isEnable` flag that no consumer ever
// read. That dependency made every passwordPersistAtom write recompute this
// async atom, so its value became a pending promise again and every reader
// suspended while `isSupportWebAuth()` re-ran its WebAuthn probes (~150-300ms).
// In the settings modal that suspension had no nearby boundary, so it reached
// the lazy page's Suspense and React hid the whole, already-painted page behind
// the loading spinner — the OK-53013 flicker. Callers that need the enabled
// state read `webAuthCredentialId` from passwordPersistAtom directly.
export const {
  target: passwordWebAuthInfoAtom,
  use: usePasswordWebAuthInfoAtom,
} = globalAtomComputed<
  Promise<{
    isSupport: boolean;
  }>
>(async () => {
  // TODO: remove webAuth in Native App
  if (platformEnv.isNative) {
    return {
      isSupport: false,
    };
  }
  const isSupport = await isSupportWebAuth();

  return { isSupport };
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
  if (runtimePersistenceAdapter.isUnavailable()) {
    return {
      authType: [],
      isSupport: false,
      isEnable: false,
    };
  }
  const { biologyAuthUtils } =
    await import('../../../services/ServicePassword/biologyAuthUtils');
  const authType = await biologyAuthUtils.getBiologyAuthType();
  const isSupport = await biologyAuthUtils.isSupportBiologyAuth();
  const isEnable =
    isSupport && get(settingsPersistAtom.atom()).isBiologyAuthSwitchOn;
  return { authType, isSupport, isEnable };
});
