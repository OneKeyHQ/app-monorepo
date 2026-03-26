import {
  authenticateAsync,
  hasHardwareAsync,
  isEnrolledAsync,
  supportedAuthenticationTypesAsync,
} from 'expo-local-authentication';

import { ETranslations } from '../locale';
import { appLocale } from '../locale/appLocale';
import { defaultLogger } from '../logger/logger';

import type { IBiologyAuth } from './types';
import type {
  AuthenticationType,
  LocalAuthenticationError,
  LocalAuthenticationResult,
} from 'expo-local-authentication';

const isSupportBiologyAuth = async () => {
  const supported = await hasHardwareAsync();
  const isEnrolled = await isEnrolledAsync();
  defaultLogger.setting.biologyAuth.isSupportBiologyAuth({
    hasHardware: supported,
    isEnrolled,
  });
  return supported && isEnrolled;
};

const getBiologyAuthType: () => Promise<AuthenticationType[]> = async () =>
  supportedAuthenticationTypesAsync();

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
    requireConfirmation: false,
  });
};

const biologyAuth: IBiologyAuth = {
  isSupportBiologyAuth,
  biologyAuthenticate,
  getBiologyAuthType,
};
export default biologyAuth;
