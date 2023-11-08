import type { IBiologyAuth } from './types';
import type {
  AuthenticationType,
  LocalAuthenticationResult,
} from 'expo-local-authentication';

const isSupportBiologyAuth = () =>
  new Promise<boolean>((resolve) => {
    resolve(false);
  });

const biologyAuthenticate: () => Promise<LocalAuthenticationResult> = () =>
  Promise.reject(new Error('no supported'));

const getBiologyAuthType: () => Promise<AuthenticationType[]> = () =>
  Promise.resolve([]);

const biologyAuth: IBiologyAuth = {
  isSupportBiologyAuth,
  biologyAuthenticate,
  getBiologyAuthType,
};
export default biologyAuth;
