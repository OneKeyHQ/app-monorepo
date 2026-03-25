import { ensureSensitiveTextEncoded } from '@onekeyhq/core/src/secret';
import {
  decodeSensitiveTextAsync,
  encodeKeyPrefix,
  encodeSensitiveTextAsync,
} from '@onekeyhq/core/src/secret/encryptors/aes256';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import biologyAuth from '@onekeyhq/shared/src/biologyAuth';
import type { IBiologyAuth } from '@onekeyhq/shared/src/biologyAuth/types';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import type { ISecureStorageSetOptions } from '@onekeyhq/shared/src/storage/secureStorage/types';
import { BIOLOGY_AUTH_CANCEL_ERROR } from '@onekeyhq/shared/types/password';

import { settingsPersistAtom } from '../../states/jotai/atoms/settings';

const SECURE_STORAGE_PASSWORD_KEY = 'password';

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

  savePassword = async (
    password: string,
    options?: ISecureStorageSetOptions,
  ) => {
    ensureSensitiveTextEncoded(password);
    if (!(await appStorage.secureStorage.supportSecureStorage())) {
      return;
    }
    const key =
      await appGlobals.$backgroundApiProxy.servicePassword.getBgSensitiveTextEncodeKey();
    let text = await decodeSensitiveTextAsync({ encodedText: password, key });
    const settings = await settingsPersistAtom.get();
    text = await encodeSensitiveTextAsync({
      text,
      key: `${encodeKeyPrefix}${settings.sensitiveEncodeKey}`,
    });
    await appStorage.secureStorage.setSecureItem(
      SECURE_STORAGE_PASSWORD_KEY,
      text,
      options,
    );
  };

  getPassword = async () => {
    if (!(await appStorage.secureStorage.supportSecureStorage())) {
      throw new OneKeyLocalError('No password');
    }
    let text = await appStorage.secureStorage.getSecureItem(
      SECURE_STORAGE_PASSWORD_KEY,
    );
    if (text) {
      const settings = await settingsPersistAtom.get();
      text = await decodeSensitiveTextAsync({
        encodedText: text,
        key: `${encodeKeyPrefix}${settings.sensitiveEncodeKey}`,
      });
      const key =
        await appGlobals.$backgroundApiProxy.servicePassword.getBgSensitiveTextEncodeKey();
      text = await encodeSensitiveTextAsync({ text, key });
      return text;
    }
    throw new OneKeyLocalError('No password');
  };

  deletePassword = async () => {
    if (!(await appStorage.secureStorage.supportSecureStorage())) return;
    await appStorage.secureStorage.removeSecureItem(
      SECURE_STORAGE_PASSWORD_KEY,
    );
  };

  hasPassword = async (): Promise<boolean> => {
    if (!(await appStorage.secureStorage.supportSecureStorage())) {
      return false;
    }
    if (appStorage.secureStorage.hasSecureItem) {
      // Extension PRF storage can check password-item existence by key
      // without triggering a WebAuthn prompt.
      return appStorage.secureStorage.hasSecureItem(
        SECURE_STORAGE_PASSWORD_KEY,
      );
    }
    const value = await appStorage.secureStorage.getSecureItem(
      SECURE_STORAGE_PASSWORD_KEY,
    );
    return !!value;
  };

  getCredentialId = async (): Promise<string | null> => {
    if (!(await appStorage.secureStorage.supportSecureStorage())) {
      return null;
    }
    return appStorage.secureStorage.getCredentialId?.() ?? null;
  };

  savePasswordForPasskey = async (
    password: string,
    options?: {
      repairBrokenState?: boolean;
    },
  ): Promise<string | null> => {
    try {
      await this.savePassword(password, {
        allowDiscoverable: false,
      });
    } catch (error) {
      const canResetForPasskeyReEnroll =
        typeof Reflect.get(
          appStorage.secureStorage,
          'resetForPasskeyReEnroll',
        ) === 'function';
      if (
        (error as Error)?.name === BIOLOGY_AUTH_CANCEL_ERROR ||
        !options?.repairBrokenState ||
        !canResetForPasskeyReEnroll
      ) {
        throw error;
      }
      await appStorage.secureStorage.resetForPasskeyReEnroll?.();
      await this.savePassword(password, {
        allowDiscoverable: false,
      });
    }

    return this.getCredentialId();
  };
}
export const biologyAuthUtils = new BiologyAuthUtils();
