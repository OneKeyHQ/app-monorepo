import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import LOCALES from '@onekeyhq/components/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { getDefaultLocale } from './locale';

export const hasHardwareSupported = () =>
  new Promise<boolean>((resolve) => {
    if (platformEnv.isNative) {
      const p = LocalAuthentication.hasHardwareAsync().then((supported) =>
        LocalAuthentication.isEnrolledAsync().then(
          (isEnrolled) => supported && isEnrolled,
        ),
      );
      resolve(p);
    } else if (platformEnv.isDesktop) {
      const result = window?.desktopApi?.canPromptTouchID();
      resolve(!!result);
    } else {
      resolve(false);
    }
  });

export const localAuthenticate: () => Promise<LocalAuthentication.LocalAuthenticationResult> =
  async () => {
    const supported = await hasHardwareSupported();
    if (!supported) {
      return { success: false, error: 'no supported' };
    }
    if (platformEnv.isNative) {
      return LocalAuthentication.authenticateAsync({
        cancelLabel: 'Cancel',
      });
    }
    if (platformEnv.isDesktop) {
      try {
        const defaultLocale = getDefaultLocale();
        let reason = 'unlock';
        const cachedLocale = LOCALES[defaultLocale];
        if (typeof cachedLocale === 'object') {
          reason = cachedLocale.action__unlock;
        } else if (typeof cachedLocale === 'function') {
          const module = await cachedLocale();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          reason = module.default.action__unlock;
        }
        const result = await window?.desktopApi?.promptTouchID(
          reason.toLowerCase(),
        );
        return {
          success: result.success,
          error: result.error ?? 'no supported',
        };
      } catch {
        return { success: false, error: 'no supported' };
      }
    } else {
      return { success: false, error: 'no supported' };
    }
  };

export const savePassword = async (password: string) => {
  if (platformEnv.isNative) {
    await SecureStore.setItemAsync('password', password);
  }
  if (platformEnv.isDesktop) {
    window?.desktopApi.secureSetItemAsync('password', password);
  }
};

export const getPassword = async () => {
  if (platformEnv.isNative) {
    return SecureStore.getItemAsync('password');
  }
  if (platformEnv.isDesktop) {
    return window?.desktopApi.secureGetItemAsync('password');
  }
  return null;
};
