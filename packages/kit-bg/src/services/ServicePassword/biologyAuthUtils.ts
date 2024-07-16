import {
  decodeSensitiveText,
  encodeKeyPrefix,
  encodeSensitiveText,
} from '@onekeyhq/core/src/secret';
import biologyAuth from '@onekeyhq/shared/src/biologyAuth';
import type { IBiologyAuth } from '@onekeyhq/shared/src/biologyAuth/types';
import secureStorageInstance from '@onekeyhq/shared/src/storage/instance/secureStorageInstance';

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
    if (!secureStorageInstance.supportSecureStorage()) return;
    let text = decodeSensitiveText({ encodedText: password });
    const settings = await settingsPersistAtom.get();
    text = encodeSensitiveText({
      text,
      key: `${encodeKeyPrefix}${settings.sensitiveEncodeKey}`,
    });
    await secureStorageInstance.setSecureItem('password', text);
  };

  getPassword = async () => {
    if (!secureStorageInstance.supportSecureStorage()) {
      throw new Error('No password');
    }
    let text = await secureStorageInstance.getSecureItem('password');
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
    if (!secureStorageInstance.supportSecureStorage()) return;
    await secureStorageInstance.removeSecureItem('password');
  };
}
const biologyAuthUtils = new BiologyAuthUtils();
export { biologyAuthUtils };
