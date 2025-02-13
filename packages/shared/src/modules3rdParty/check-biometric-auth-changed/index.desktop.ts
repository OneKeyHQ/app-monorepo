import type { ICheckBiometricAuthChanged } from './type';

export const checkBiometricAuthChanged: ICheckBiometricAuthChanged = () =>
  Promise.resolve(desktopApi.checkBiometricAuthChanged());

export * from './type';
