import type { LocalAuthenticationResult } from 'expo-local-authentication';

export const hasHardwareSupported = () =>
  new Promise<boolean>((resolve) => {
    resolve(false);
  });

export const localAuthenticate: () => Promise<LocalAuthenticationResult> = () =>
  Promise.reject(new Error('no supported'));

export const savePassword = async (password: string) =>
  Promise.reject(new Error('no supported'));

export const getPassword = async () =>
  Promise.reject(new Error('no supported'));
