import { AuthenticationType } from 'expo-local-authentication';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { memoizee } from '../utils/cacheUtils';

import type { IBiologyAuth } from './types';
import type { LocalAuthenticationResult } from 'expo-local-authentication';

const isSupportBiologyAuthFn = () =>
  new Promise<boolean>((resolve) => {
    const result = platformEnv.isE2E
      ? false
      : window?.desktopApi?.canPromptTouchID();
    resolve(!!result);
  });

export const isSupportBiologyAuth = memoizee(isSupportBiologyAuthFn, {
  promise: true,
});

const getBiologyAuthTypeFn: () => Promise<AuthenticationType[]> = () =>
  Promise.resolve([AuthenticationType.FINGERPRINT]);

export const getBiologyAuthType = memoizee(getBiologyAuthTypeFn, {
  promise: true,
});

export const biologyAuthenticate: () => Promise<LocalAuthenticationResult> =
  async () => {
    const supported = await isSupportBiologyAuth();
    if (!supported) {
      return {
        success: false,
        error: 'biologyAuthenticate no supported',
      };
    }

    try {
      const result = await window?.desktopApi?.promptTouchID('action__unlock');
      return result.success
        ? { success: true }
        : {
            success: false,
            error: result.error || 'biologyAuthenticate failed',
          };
    } catch (e: any) {
      return {
        success: false,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        error: e?.message || 'biologyAuthenticate failed',
      };
    }
  };

const biologyAuth: IBiologyAuth = {
  isSupportBiologyAuth,
  biologyAuthenticate,
  getBiologyAuthType,
};
export default biologyAuth;
