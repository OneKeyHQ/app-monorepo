import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { buildKeylessLocalEncryptionKey } from './keylessLocalEncryptionKey';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';

async function storageSetItem(key: string, encryptedPayloadBase64: string) {
  const isSecureStorageSupported =
    await appStorage.secureStorage.supportSecureStorage();
  if (isSecureStorageSupported) {
    await appStorage.secureStorage.setSecureItem(key, encryptedPayloadBase64);
  } else {
    await appStorage.setItem(key, encryptedPayloadBase64);
  }
}

async function storageGetItem(key: string): Promise<string | null> {
  const isSecureStorageSupported =
    await appStorage.secureStorage.supportSecureStorage();
  if (isSecureStorageSupported) {
    return appStorage.secureStorage.getSecureItem(key);
  }
  return appStorage.getItem(key);
}

async function storageRemoveItem(key: string): Promise<void> {
  const isSecureStorageSupported =
    await appStorage.secureStorage.supportSecureStorage();
  if (isSecureStorageSupported) {
    await appStorage.secureStorage.removeSecureItem(key);
  } else {
    await appStorage.removeItem(key);
  }
}

/**
 * Save refreshToken to local storage with passcode encryption.
 * The refreshToken is encrypted using the user's passcode via buildKeylessLocalEncryptionKey.
 * This is used for refreshing access tokens.
 */
async function saveRefreshTokenToStorage(params: {
  ownerId: string;
  refreshToken: string;
  backgroundApi: IBackgroundApi;
}): Promise<void> {
  const { ownerId, refreshToken, backgroundApi } = params;

  // 1. Build unique key for this ownerId
  const key = accountUtils.buildKeylessRefreshTokenKey({ ownerId });

  // 2. Encrypt with passcode-based encryption key
  // buildKeylessLocalEncryptionKey will prompt for passcode and combine it with sensitiveEncodeKey
  const encryptionKey = await buildKeylessLocalEncryptionKey({ backgroundApi });

  const encryptedPayloadHex = await backgroundApi.servicePassword.encryptString(
    {
      password: encryptionKey,
      data: refreshToken,
      dataEncoding: 'utf8',
      allowRawPassword: true,
    },
  );

  // Convert hex to base64 for storage
  const encryptedPayloadBase64 = bufferUtils.bytesToBase64(
    bufferUtils.hexToBytes(encryptedPayloadHex),
  );

  // 3. Store encrypted data, prefer secureStorage if available
  await storageSetItem(key, encryptedPayloadBase64);
}

/**
 * Get refreshToken from local storage and decrypt it.
 * Requires user passcode to decrypt the refreshToken.
 */
async function getRefreshTokenFromStorage(params: {
  ownerId: string;
  backgroundApi: IBackgroundApi;
}): Promise<string | null> {
  const { ownerId, backgroundApi } = params;

  // 1. Build unique key for this ownerId
  const key = accountUtils.buildKeylessRefreshTokenKey({ ownerId });

  // 2. Read encrypted data from storage
  const encryptedPayloadBase64 = await storageGetItem(key);

  if (!encryptedPayloadBase64) {
    return null;
  }

  // 3. Decrypt with passcode-based encryption key
  // buildKeylessLocalEncryptionKey will prompt for passcode to decrypt
  const decryptionKey = await buildKeylessLocalEncryptionKey({ backgroundApi });

  try {
    const refreshToken = await backgroundApi.servicePassword.decryptString({
      password: decryptionKey,
      data: encryptedPayloadBase64,
      dataEncoding: 'base64',
      resultEncoding: 'utf8',
      allowRawPassword: true,
    });
    return refreshToken;
  } catch (error) {
    throw new OneKeyLocalError(
      `Failed to decrypt refreshToken: invalid password or corrupted data: ${
        (error as Error)?.message
      }`,
    );
  }
}

/**
 * Remove refreshToken from local storage.
 */
async function removeRefreshTokenFromStorage(params: {
  ownerId: string;
}): Promise<void> {
  const { ownerId } = params;

  // 1. Build unique key for this ownerId
  const key = accountUtils.buildKeylessRefreshTokenKey({ ownerId });

  // 2. Remove encrypted data from storage
  await storageRemoveItem(key);
}

export default {
  saveRefreshTokenToStorage,
  getRefreshTokenFromStorage,
  removeRefreshTokenFromStorage,
};
