import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IDeviceKeyPack } from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { settingsPersistAtom } from '../../../states/jotai/atoms';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';

/**
 * Build encryption key from sensitiveEncodeKey and session passcode.
 */
async function buildEncryptionKey(params: {
  backgroundApi: IBackgroundApi;
}): Promise<string> {
  const { backgroundApi } = params;

  // 1. Get sensitiveEncodeKey from settings
  const settings = await settingsPersistAtom.get();
  const sensitiveEncodeKey = settings.sensitiveEncodeKey;

  // 2. Get current session passcode
  const { password } =
    await backgroundApi.servicePassword.promptPasswordVerify();

  // 3. Combine sensitiveEncodeKey and passcode to form encryption key
  return `${sensitiveEncodeKey}${password}`;
}

async function devicePackSetItem(key: string, encryptedPayloadBase64: string) {
  const isSecureStorageSupported =
    await appStorage.secureStorage.supportSecureStorage();
  if (isSecureStorageSupported) {
    await appStorage.secureStorage.setSecureItem(key, encryptedPayloadBase64);
  } else {
    await appStorage.setItem(key, encryptedPayloadBase64);
  }
}

async function devicePackGetItem(key: string): Promise<string | null> {
  const isSecureStorageSupported =
    await appStorage.secureStorage.supportSecureStorage();
  if (isSecureStorageSupported) {
    return appStorage.secureStorage.getSecureItem(key);
  }
  return appStorage.getItem(key);
}

/**
 * Save device pack to local storage with passcode encryption.
 * Unified method for creating, enabling, and manual recovery flows.
 */
async function saveDevicePackToStorage(params: {
  devicePack: IDeviceKeyPack;
  backgroundApi: IBackgroundApi;
}): Promise<void> {
  const { devicePack, backgroundApi } = params;
  // 1. Build unique key for this packSetId
  const key = accountUtils.buildKeylessDevicePackKey({
    packSetId: devicePack.packSetId,
  });

  // 2. Serialize devicePack to JSON string
  const jsonString = stringUtils.stableStringify(devicePack);

  // 3. Encrypt with encryption key
  const encryptionKey = await buildEncryptionKey({ backgroundApi });

  const encryptedPayloadHex = await backgroundApi.servicePassword.encryptString(
    {
      password: encryptionKey,
      data: jsonString,
      dataEncoding: 'utf8',
      allowRawPassword: true,
    },
  );

  // Convert hex to base64 for storage
  const encryptedPayloadBase64 = bufferUtils.bytesToBase64(
    bufferUtils.hexToBytes(encryptedPayloadHex),
  );

  // 4. Store encrypted data, prefer secureStorage if available
  await devicePackSetItem(key, encryptedPayloadBase64);
}

/**
 * Get device pack from local storage and decrypt it.
 */
async function getDevicePackFromStorage(params: {
  packSetId: string;
  backgroundApi: IBackgroundApi;
}): Promise<IDeviceKeyPack | null> {
  const { packSetId, backgroundApi } = params;
  // 1. Build unique key for this packSetId
  const key = accountUtils.buildKeylessDevicePackKey({
    packSetId,
  });

  // 2. Read encrypted data from storage, prefer secureStorage if available
  const encryptedPayloadBase64 = await devicePackGetItem(key);

  if (!encryptedPayloadBase64) {
    return null;
  }

  // 3. Decrypt with encryption key
  const decryptionKey = await buildEncryptionKey({ backgroundApi });

  let jsonString: string;
  try {
    jsonString = await backgroundApi.servicePassword.decryptString({
      password: decryptionKey,
      data: encryptedPayloadBase64,
      dataEncoding: 'base64',
      resultEncoding: 'utf8',
      allowRawPassword: true,
    });
  } catch (error) {
    throw new OneKeyLocalError(
      'Failed to decrypt device pack: invalid password or corrupted data',
    );
  }

  // 4. Parse JSON string to devicePack object
  try {
    return JSON.parse(jsonString) as IDeviceKeyPack;
  } catch (error) {
    throw new OneKeyLocalError(
      'Failed to parse device pack: invalid JSON format',
    );
  }
}

export default {
  saveDevicePackToStorage,
  getDevicePackFromStorage,
};
