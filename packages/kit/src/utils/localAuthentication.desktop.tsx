import LOCALES from '@onekeyhq/components/src/locale';
import {
  decodeSensitiveText,
  encodeSensitiveText,
} from '@onekeyhq/engine/src/secret/encryptors/aes256';
import flowLogger from '@onekeyhq/shared/src/logger/flowLogger/flowLogger';

import { getDefaultLocale } from './locale';

import type { LocalAuthenticationResult } from 'expo-local-authentication';

export const hasHardwareSupported = () =>
  new Promise<boolean>((resolve) => {
    const result = window?.desktopApi?.canPromptTouchID();
    resolve(!!result);
  });

export const localAuthenticate: () => Promise<LocalAuthenticationResult> =
  async () => {
    const supported = await hasHardwareSupported();
    if (!supported) {
      return { success: false, error: 'no supported' };
    }

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
  };

export const savePassword = (password: string) => {
  let text = password;
  if (text) {
    try {
      text = decodeSensitiveText({ encodedText: text });
    } catch (e: any) {
      flowLogger.error.log(
        'method localAuthentication.savePassword() failed to decodeSensitiveText',
      );
    }
    window?.desktopApi.secureSetItemAsync('password', text);
  } else {
    window?.desktopApi.secureDelItemAsync('password');
  }
};

export const getPassword = async () => {
  const text = await window?.desktopApi.secureGetItemAsync('password');
  if (text) {
    const result = encodeSensitiveText({ text });
    return result;
  }
};
