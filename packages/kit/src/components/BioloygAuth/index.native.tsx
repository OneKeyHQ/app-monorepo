import {
  authenticateAsync,
  hasHardwareAsync,
  isEnrolledAsync,
} from 'expo-local-authentication';
import { getItemAsync, setItemAsync } from 'expo-secure-store';

import {
  decodeSensitiveText,
  encodeKeyPrefix,
  encodeSensitiveText,
} from '@onekeyhq/core/src/secret';
import { settingsAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

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

export const savePassword = async (password: string) => {
  let text = decodeSensitiveText({ encodedText: password });
  const settings = await settingsAtom.get();
  text = encodeSensitiveText({
    text,
    key: `${encodeKeyPrefix}${settings.instanceId}`,
  });
  await setItemAsync('password', text);
};

export const getPassword = async () => {
  let text = await getItemAsync('password');
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
