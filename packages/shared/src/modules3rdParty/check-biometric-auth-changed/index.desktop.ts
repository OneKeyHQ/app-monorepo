import type { ICheckBiometricAuthChanged } from './type';

export const checkBiometricAuthChanged: ICheckBiometricAuthChanged = async () =>
  Promise.resolve(await desktopApiProxy.security.checkBiometricAuthChanged());

export * from './type';
