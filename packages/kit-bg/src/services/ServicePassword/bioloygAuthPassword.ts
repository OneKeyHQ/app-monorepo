import {
  decodeSensitiveText,
  encodeKeyPrefix,
  encodeSensitiveText,
} from '@onekeyhq/core/src/secret';
import secureStorage from '@onekeyhq/shared/src/storage/secureStorage';

import { settingsPersistAtom } from '../../states/jotai/atoms';

export const savePassword = async (password: string) => {
  let text = decodeSensitiveText({ encodedText: password });
  const settings = await settingsPersistAtom.get();
  text = encodeSensitiveText({
    text,
    key: `${encodeKeyPrefix}${settings.instanceId}`,
  });
  await secureStorage.setSecureItem('password', text);
};

export const getPassword = async () => {
  let text = await secureStorage.getSecureItem('password');
  if (text) {
    const settings = await settingsPersistAtom.get();
    text = decodeSensitiveText({
      encodedText: text,
      key: `${encodeKeyPrefix}${settings.instanceId}`,
    });
    text = encodeSensitiveText({ text });
    return text;
  }
  throw new Error('No password');
};

export const deletePassword = async () => {
  await secureStorage.removeSecureItem('password');
};
