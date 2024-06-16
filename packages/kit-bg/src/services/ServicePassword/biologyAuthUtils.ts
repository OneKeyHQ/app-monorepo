import {
  decodeSensitiveText,
  encodeKeyPrefix,
  encodeSensitiveText,
} from '@onekeyhq/core/src/secret';
import biologyAuth from '@onekeyhq/shared/src/biologyAuth';
import type { IBiologyAuth } from '@onekeyhq/shared/src/biologyAuth/types';
import secureStorage from '@onekeyhq/shared/src/storage/secureStorage';

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
    if (!secureStorage.supportSecureStorage()) return;
    let text = decodeSensitiveText({ encodedText: password });
    const settings = await settingsPersistAtom.get();
    text = encodeSensitiveText({
      text,
      key: `${encodeKeyPrefix}${settings.sensitiveEncodeKey}`,
    });
    await secureStorage.setSecureItem('password', text);
  };

  getPassword = async () => {
    if (!secureStorage.supportSecureStorage()) {
      throw new Error('No password');
    }
    let text = await secureStorage.getSecureItem('password');
    if (text) {
      const settings = await settingsPersistAtom.get();
      text = decodeSensitiveText({
        encodedText: text,
        key: `${encodeKeyPrefix}${settings.sensitiveEncodeKey}`,
      });
      text = encodeSensitiveText({ text });
      return text;
    }
    throw new Error('No password');
  };

  deletePassword = async () => {
    if (!secureStorage.supportSecureStorage()) return;
    await secureStorage.removeSecureItem('password');
  };
}
const biologyAuthUtils = new BiologyAuthUtils();
export { biologyAuthUtils };
