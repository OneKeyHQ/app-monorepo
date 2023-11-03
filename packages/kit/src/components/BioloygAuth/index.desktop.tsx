import LOCALES from '@onekeyhq/components/src/locale';
import {
  decodeSensitiveText,
  encodeKeyPrefix,
  encodeSensitiveText,
} from '@onekeyhq/core/src/secret';
import { getDefaultLocale } from '@onekeyhq/kit/src/utils/locale';
import { settingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

// import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

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

export const savePassword = async (password: string) => {
  let text = password;
  if (text) {
    text = decodeSensitiveText({ encodedText: text });

    const settings = await settingsAtom.get();
    text = encodeSensitiveText({
      text,
      key: `${encodeKeyPrefix}${settings.instanceId}`,
    });
    return window?.desktopApi.secureSetItemAsync('password', text);
  }
  return window?.desktopApi.secureDelItemAsync('password');
};

export const getPassword = async () => {
  let text = await window?.desktopApi.secureGetItemAsync('password');
  if (text) {
    const settings = await settingsAtom.get();
    text = decodeSensitiveText({
      encodedText: text,
      key: `${encodeKeyPrefix}${settings.instanceId}`,
    });
    text = encodeSensitiveText({ text });
    return text;
  }
  throw new Error('No password');
};
