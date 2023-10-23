import {
  authenticateAsync,
  hasHardwareAsync,
  isEnrolledAsync,
} from 'expo-local-authentication';
import { getItemAsync, setItemAsync } from 'expo-secure-store';

import {
  decodeSensitiveText,
  encodeSensitiveText,
} from '@onekeyhq/core/src/secret/encryptors/aes256';

import { appSelector } from '../../store';
// import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

export const hasHardwareSupported = () =>
  hasHardwareAsync().then((supported) =>
    isEnrolledAsync().then((isEnrolled) => supported && isEnrolled),
  );

export const localAuthenticate = async () => {
  if (!(await hasHardwareSupported())) {
    return { success: false, error: 'no supported' };
  }

  return authenticateAsync();
};

export const savePassword = (password: string) => {
  let text = password;
  try {
    text = decodeSensitiveText({ encodedText: text });
  } catch (e: any) {
    // debugLogger.common.error(
    //   'method localAuthentication.savePassword() failed to decodeSensitiveText',
    // );
  }
  const instanceId = appSelector((s) => s.settings.instanceId);
  text = encodeSensitiveText({ text, key: instanceId });
  setItemAsync('password', text);
};

export const getPassword = async () => {
  const instanceId = appSelector((s) => s.settings.instanceId);
  let text = await getItemAsync('password');
  if (text) {
    try {
      text = decodeSensitiveText({ encodedText: text, key: instanceId });
      const result = encodeSensitiveText({ text });
      return result;
    } catch (e: any) {
      // debugLogger.common.error(
      //   'method localAuthentication.getPassword() failed to decodeSensitiveText',
      // );
    }
  }
};
