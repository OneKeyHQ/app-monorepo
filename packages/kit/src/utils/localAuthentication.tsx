import type { LocalAuthenticationResult } from 'expo-local-authentication';

export const hasHardwareSupported = () =>
  new Promise<boolean>((resolve) => {
    resolve(false);
  });

export const localAuthenticate: () => Promise<LocalAuthenticationResult> = () =>
  Promise.resolve({ success: false, error: 'no supported' });

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const savePassword = (password: string) => Promise.resolve();

export const getPassword = () => Promise.resolve(null);
