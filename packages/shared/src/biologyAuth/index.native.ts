import {
  authenticateAsync,
  hasHardwareAsync,
  isEnrolledAsync,
  supportedAuthenticationTypesAsync,
} from 'expo-local-authentication';

import { memoizee } from '../utils/cacheUtils';

import type { IBiologyAuth } from './types';
import type { AuthenticationType } from 'expo-local-authentication';

const isSupportBiologyAuthFn = () =>
  hasHardwareAsync().then((supported) =>
    isEnrolledAsync().then((isEnrolled) => supported && isEnrolled),
  );

const isSupportBiologyAuth = memoizee(isSupportBiologyAuthFn);

const getBiologyAuthTypeFn: () => Promise<AuthenticationType[]> = () =>
  supportedAuthenticationTypesAsync();

const getBiologyAuthType = memoizee(getBiologyAuthTypeFn);

export const biologyAuthenticate = async () => {
  if (!(await isSupportBiologyAuth())) {
    return { success: false, error: 'no supported' };
  }

  return authenticateAsync();
};

const biologyAuth: IBiologyAuth = {
  isSupportBiologyAuth,
  biologyAuthenticate,
  getBiologyAuthType,
};
export default biologyAuth;
