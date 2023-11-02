import {
  authenticateAsync,
  hasHardwareAsync,
  isEnrolledAsync,
} from 'expo-local-authentication';
import { getItemAsync, setItemAsync } from 'expo-secure-store';

import {
  decodeSensitiveText,
  encodeSensitiveText,
} from '@onekeyhq/core/src/secret';

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
  const text = decodeSensitiveText({ encodedText: password });

  void setItemAsync('password', text);
};

export const getPassword = async () => {
  const text = await getItemAsync('password');
  if (text) {
    const result = encodeSensitiveText({ text });
    return result;
  }
};
