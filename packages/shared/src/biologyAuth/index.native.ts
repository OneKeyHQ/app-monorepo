import {
  authenticateAsync,
  hasHardwareAsync,
  isEnrolledAsync,
  supportedAuthenticationTypesAsync,
} from 'expo-local-authentication';

import type { AuthenticationType } from 'expo-local-authentication';

export const isSupportBiologyAuth = () =>
  hasHardwareAsync().then((supported) =>
    isEnrolledAsync().then((isEnrolled) => supported && isEnrolled),
  );

export const biologyAuthenticate = async () => {
  if (!(await isSupportBiologyAuth())) {
    return { success: false, error: 'no supported' };
  }

  return authenticateAsync();
};

export const getBiologyAuthType: () => Promise<AuthenticationType[]> = () =>
  supportedAuthenticationTypesAsync();
