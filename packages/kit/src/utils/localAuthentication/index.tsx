import type { LocalAuthenticationResult } from 'expo-local-authentication';

export const hasHardwareSupported = () =>
  new Promise<boolean>((resolve) => {
    resolve(false);
  });

export const localAuthenticate: () => Promise<LocalAuthenticationResult> = () =>
  Promise.reject(new Error('no supported'));

export const savePassword = (password: string) =>
  Promise.reject(new Error('no supported'));

export const getPassword = () => Promise.reject(new Error('no supported'));
