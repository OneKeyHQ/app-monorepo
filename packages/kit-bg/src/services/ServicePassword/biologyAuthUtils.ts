import {
  decodeSensitiveTextAsync,
  encodeKeyPrefix,
  encodeSensitiveTextAsync,
} from '@onekeyhq/core/src/secret/encryptors/aes256';
import biologyAuth from '@onekeyhq/shared/src/biologyAuth';
import type { IBiologyAuth } from '@onekeyhq/shared/src/biologyAuth/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';

import { settingsPersistAtom } from '../../states/jotai/atoms/settings';

class BiologyAuthUtils implements IBiologyAuth {
  isSupportBiologyAuth() {
    return biologyAuth.isSupportBiologyAuth();
  }

  biologyAuthenticate() {
    return biologyAuth.biologyAuthenticate();
  }

  getBiologyAuthType() {
    return biologyAuth.getBiologyAuthType();
  }

  savePassword = async (password: string) => {
    if (!(await appStorage.secureStorage.supportSecureStorage())) return;
    let text = await decodeSensitiveTextAsync({ encodedText: password });
    const settings = await settingsPersistAtom.get();
    text = await encodeSensitiveTextAsync({
      text,
      key: `${encodeKeyPrefix}${settings.sensitiveEncodeKey}`,
    });
    await appStorage.secureStorage.setSecureItem('password', text);
  };

  getPassword = async () => {
    if (!(await appStorage.secureStorage.supportSecureStorage())) {
      throw new OneKeyLocalError('No password');
    }
    let text = await appStorage.secureStorage.getSecureItem('password');
    if (text) {
      const settings = await settingsPersistAtom.get();
      text = await decodeSensitiveTextAsync({
        encodedText: text,
        key: `${encodeKeyPrefix}${settings.sensitiveEncodeKey}`,
      });
      text = await encodeSensitiveTextAsync({ text });
      return text;
    }
    throw new OneKeyLocalError('No password');
  };

  deletePassword = async () => {
    if (!(await appStorage.secureStorage.supportSecureStorage())) return;
    await appStorage.secureStorage.removeSecureItem('password');
  };
}
export const biologyAuthUtils = new BiologyAuthUtils();
