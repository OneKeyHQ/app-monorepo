import {
  authenticateAsync,
  hasHardwareAsync,
  isEnrolledAsync,
  supportedAuthenticationTypesAsync,
} from 'expo-local-authentication';

import { ETranslations } from '../locale';
import { appLocale } from '../locale/appLocale';
import { memoizee } from '../utils/cacheUtils';

import type { IBiologyAuth } from './types';
import type {
  AuthenticationType,
  LocalAuthenticationError,
  LocalAuthenticationResult,
} from 'expo-local-authentication';

const isSupportBiologyAuthFn = async () => {
  const supported = await hasHardwareAsync();
  const isEnrolled = await isEnrolledAsync();
  return supported && isEnrolled;
};

const isSupportBiologyAuth = memoizee(isSupportBiologyAuthFn, {
  promise: true,
});

const getBiologyAuthTypeFn: () => Promise<AuthenticationType[]> = async () =>
  supportedAuthenticationTypesAsync();

const getBiologyAuthType = memoizee(getBiologyAuthTypeFn, { promise: true });

export const biologyAuthenticate = async () => {
  if (!(await isSupportBiologyAuth())) {
    return {
      success: false,
      error: 'no supported' as LocalAuthenticationError,
    } as LocalAuthenticationResult;
  }

  return authenticateAsync({
    promptMessage: appLocale.intl.formatMessage({
      id: ETranslations.touch_id_unlock_desc,
    }),
    cancelLabel: appLocale.intl.formatMessage({
      id: ETranslations.global_cancel,
    }),
  });
};

const biologyAuth: IBiologyAuth = {
  isSupportBiologyAuth,
  biologyAuthenticate,
  getBiologyAuthType,
};
export default biologyAuth;
