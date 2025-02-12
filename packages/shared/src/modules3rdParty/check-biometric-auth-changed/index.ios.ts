import { checkBiometricAuthChanged as nativeCheckBiometricAuthChanged } from 'react-native-check-biometric-auth-changed';

import type { ICheckBiometricAuthChanged } from './type';

export const checkBiometricAuthChanged: ICheckBiometricAuthChanged = () =>
  nativeCheckBiometricAuthChanged();

export * from './type';
