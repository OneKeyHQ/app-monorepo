import type {
  AuthenticationType,
  LocalAuthenticationResult,
} from 'expo-local-authentication';

export const isSupportBiologyAuth = () =>
  new Promise<boolean>((resolve) => {
    resolve(false);
  });

export const biologyAuthenticate: () => Promise<LocalAuthenticationResult> =
  () => Promise.reject(new Error('no supported'));

export const getBiologyAuthType: () => Promise<AuthenticationType> = () =>
  Promise.reject(new Error('no supported'));
