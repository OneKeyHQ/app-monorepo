import type { ICheckBiometricAuthChanged } from './type';

export const checkBiometricAuthChanged: ICheckBiometricAuthChanged = () =>
  Promise.resolve(false);

export * from './type';
