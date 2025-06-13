import {
  decodeSensitiveTextAsync,
  encodeKeyPrefix,
  encodeSensitiveTextAsync,
} from '@onekeyhq/core/src/secret';
import biologyAuth from '@onekeyhq/shared/src/biologyAuth';
import type { IBiologyAuth } from '@onekeyhq/shared/src/biologyAuth/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import secureStorageInstance from '@onekeyhq/shared/src/storage/instance/secureStorageInstance';

import { settingsPersistAtom } from '../../states/jotai/atoms/settings';

const biologyAuthNativeError = 'biology_native_error';
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
    let text = await decodeSensitiveTextAsync({ encodedText: password });
    const settings = await settingsPersistAtom.get();
    text = await encodeSensitiveTextAsync({
      text,
      key: `${encodeKeyPrefix}${settings.sensitiveEncodeKey}`,
    });
    await secureStorageInstance.setSecureItem('password', text);
  };

  getPassword = async () => {
    if (!secureStorageInstance.supportSecureStorage()) {
      throw new OneKeyLocalError('No password');
    }
    let text = await secureStorageInstance.getSecureItem('password');
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
    if (!secureStorageInstance.supportSecureStorage()) return;
    await secureStorageInstance.removeSecureItem('password');
  };
}
const biologyAuthUtils = new BiologyAuthUtils();
export { biologyAuthNativeError, biologyAuthUtils };
