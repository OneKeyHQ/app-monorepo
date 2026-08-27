import {
  authenticateAsync,
  hasHardwareAsync,
  isEnrolledAsync,
  supportedAuthenticationTypesAsync,
} from 'expo-local-authentication';

import { ETranslations } from '../locale';
import { appLocale } from '../locale/appLocale';
import platformEnv from '../platformEnv';
import { memoizee } from '../utils/cacheUtils';

import type { IBiologyAuth } from './types';
import type {
  AuthenticationType,
  LocalAuthenticationError,
  LocalAuthenticationResult,
} from 'expo-local-authentication';

// On the native background runtime the expo-local-authentication native
// module is an inert stub (apps/mobile/background.ts) and the biometric
// prompt must present from the UI runtime anyway, so every call forwards to
// the main thread over the SharedRPC reverse channel installed by
// setupBackgroundThreadRPCHandler.
type IMainNativeUtilsForwarder = (request: {
  module: 'secureStorage' | 'biologyAuth';
  method: string;
  params?: unknown[];
}) => Promise<unknown>;

const getMainThreadForwarder = (): IMainNativeUtilsForwarder | undefined => {
  if (!platformEnv.isNativeBackgroundThread) {
    return undefined;
  }
  return (
    globalThis as {
      __onekeyCallMainThreadNativeUtils?: IMainNativeUtilsForwarder;
    }
  ).__onekeyCallMainThreadNativeUtils;
};

const isSupportBiologyAuthFn = async () => {
  const forwarder = getMainThreadForwarder();
  if (forwarder) {
    return (await forwarder({
      module: 'biologyAuth',
      method: 'isSupportBiologyAuth',
    })) as boolean;
  }
  const supported = await hasHardwareAsync();
  const isEnrolled = await isEnrolledAsync();
  return supported && isEnrolled;
};

const isSupportBiologyAuth = memoizee(isSupportBiologyAuthFn, {
  promise: true,
});

const getBiologyAuthTypeFn: () => Promise<AuthenticationType[]> = async () => {
  const forwarder = getMainThreadForwarder();
  if (forwarder) {
    return (await forwarder({
      module: 'biologyAuth',
      method: 'getBiologyAuthType',
    })) as AuthenticationType[];
  }
  return supportedAuthenticationTypesAsync();
};

const getBiologyAuthType = memoizee(getBiologyAuthTypeFn, { promise: true });

export const biologyAuthenticate = async () => {
  const forwarder = getMainThreadForwarder();
  if (forwarder) {
    return (await forwarder({
      module: 'biologyAuth',
      method: 'biologyAuthenticate',
    })) as LocalAuthenticationResult;
  }
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
