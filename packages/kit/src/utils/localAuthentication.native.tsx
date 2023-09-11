import {
  authenticateAsync,
  hasHardwareAsync,
  isEnrolledAsync,
} from 'expo-local-authentication';
import { getItemAsync, setItemAsync } from 'expo-secure-store';

import {
  decodeSensitiveText,
  encodeSensitiveText,
} from '@onekeyhq/engine/src/secret/encryptors/aes256';
import flowLogger from '@onekeyhq/shared/src/logger/flowLogger/flowLogger';

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
    flowLogger.error.log(
      'method localAuthentication.savePassword() failed to decodeSensitiveText',
    );
  }
  setItemAsync('password', text);
};

export const getPassword = async () => {
  const text = await getItemAsync('password');
  if (text) {
    const result = encodeSensitiveText({ text });
    return result;
  }
};
