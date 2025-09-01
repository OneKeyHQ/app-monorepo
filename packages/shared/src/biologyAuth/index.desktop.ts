import { AuthenticationType } from 'expo-local-authentication';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ETranslations } from '../locale';
import {
  getDefaultLocale,
  getLocaleMessages,
} from '../locale/getDefaultLocale';
import { memoizee } from '../utils/cacheUtils';

import type { IBiologyAuth } from './types';
import type {
  LocalAuthenticationError,
  LocalAuthenticationResult,
} from 'expo-local-authentication';

const isSupportBiologyAuthFn = () =>
  platformEnv.isE2E
    ? Promise.resolve(false)
    : globalThis?.desktopApiProxy?.security?.canPromptTouchID();

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
        error:
          'biologyAuthenticate no supported' as unknown as LocalAuthenticationError,
      } as LocalAuthenticationResult;
    }

    try {
      // The prompt text for Electron's touch id uses the system default language,
      //  so it needs the corresponding text in the system default language.
      const locale = getDefaultLocale();
      const messages = await getLocaleMessages(locale);
      const result = await globalThis?.desktopApiProxy?.security?.promptTouchID(
        messages[ETranslations.global_unlock],
      );
      if (result.success) {
        return {
          success: true,
        } as LocalAuthenticationResult;
      }
      if (result.isSupport) {
        return {
          success: false,
          error: (result.error ||
            'biologyAuthenticate failed') as unknown as LocalAuthenticationError,
          warning: result.error,
        };
      }
      return {
        success: false,
        error: 'not_available',
      };
    } catch (e: unknown) {
      const authError = e as { message: string };
      return {
        success: false,
        error: (authError?.message ||
          'biologyAuthenticate failed') as unknown as LocalAuthenticationError,
      };
    }
  };

const biologyAuth: IBiologyAuth = {
  isSupportBiologyAuth,
  biologyAuthenticate,
  getBiologyAuthType,
};
export default biologyAuth;
