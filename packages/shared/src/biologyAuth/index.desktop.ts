import { AuthenticationType } from 'expo-local-authentication';

import type { LocalAuthenticationResult } from 'expo-local-authentication';

export const isSupportBiologyAuth = () =>
  new Promise<boolean>((resolve) => {
    const result = window?.desktopApi?.canPromptTouchID();
    resolve(!!result);
  });

export const biologyAuthenticate: () => Promise<LocalAuthenticationResult> =
  async () => {
    const supported = await isSupportBiologyAuth();
    if (!supported) {
      return { success: false, error: 'no supported' };
    }

    try {
      const result = await window?.desktopApi?.promptTouchID('action__unlock');
      return {
        success: result.success,
        error: result.error ?? 'no supported',
      };
    } catch {
      return { success: false, error: 'no supported' };
    }
  };

export const getBiologyAuthType: () => Promise<AuthenticationType[]> = () =>
  Promise.resolve([AuthenticationType.FINGERPRINT]);
