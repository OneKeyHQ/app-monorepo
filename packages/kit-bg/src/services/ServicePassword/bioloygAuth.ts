import {
  decodeSensitiveText,
  encodeKeyPrefix,
  encodeSensitiveText,
} from '@onekeyhq/core/src/secret';
import {
  biologyAuthenticate,
  isSupportBiologyAuth,
} from '@onekeyhq/shared/src/biologyAuth';
import {
  getSecureItem,
  setSecureItem,
} from '@onekeyhq/shared/src/storage/secureStorage';

import { settingsAtom } from '../../states/jotai/atoms';

export { isSupportBiologyAuth };

export { biologyAuthenticate };

export const savePassword = async (password: string) => {
  let text = decodeSensitiveText({ encodedText: password });
  const settings = await settingsAtom.get();
  text = encodeSensitiveText({
    text,
    key: `${encodeKeyPrefix}${settings.instanceId}`,
  });
  await setSecureItem('password', text);
};

export const getPassword = async () => {
  let text = await getSecureItem('password');
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
