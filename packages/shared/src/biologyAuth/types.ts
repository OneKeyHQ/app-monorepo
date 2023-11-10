import type {
  AuthenticationType,
  LocalAuthenticationResult,
} from 'expo-local-authentication';

export interface IBiologyAuth {
  isSupportBiologyAuth: () => Promise<boolean>;
  biologyAuthenticate: () => Promise<LocalAuthenticationResult>;
  getBiologyAuthType: () => Promise<AuthenticationType[]>;
}
