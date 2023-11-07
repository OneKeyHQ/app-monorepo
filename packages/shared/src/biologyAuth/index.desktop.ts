import { AuthenticationType } from 'expo-local-authentication';

import { memoizee } from '../utils/cacheUtils';

import type { IBiologyAuth } from './types';
import type { LocalAuthenticationResult } from 'expo-local-authentication';

const isSupportBiologyAuthFn = () =>
  new Promise<boolean>((resolve) => {
    const result = window?.desktopApi?.canPromptTouchID();
    resolve(!!result);
  });

export const isSupportBiologyAuth = memoizee(isSupportBiologyAuthFn);

const getBiologyAuthTypeFn: () => Promise<AuthenticationType[]> = () =>
  Promise.resolve([AuthenticationType.FINGERPRINT]);

export const getBiologyAuthType = memoizee(getBiologyAuthTypeFn);

export const biologyAuthenticate: () => Promise<LocalAuthenticationResult> =
  async () => {
    const supported = await isSupportBiologyAuth();
    if (!supported) {
      return { success: false, error: 'no supported' };
    }

    try {
      const result = await window?.desktopApi?.promptTouchID('action__unlock');
      return {
        success: result.success,
        error: result.error ?? 'no supported',
      };
    } catch {
      return { success: false, error: 'no supported' };
    }
  };

const biologyAuth: IBiologyAuth = {
  isSupportBiologyAuth,
  biologyAuthenticate,
  getBiologyAuthType,
};
export default biologyAuth;
