import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import {
  buildKeylessLocalEncryptionKey,
  buildKeylessLocalEncryptionKeyWithoutPasscode,
} from './keylessLocalEncryptionKey';

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
 * RefreshToken is encrypted using the user's passcode via buildKeylessLocalEncryptionKey.
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
 * Requires user passcode to decrypt.
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
    const decryptedRefreshToken =
      await backgroundApi.servicePassword.decryptString({
        password: decryptionKey,
        data: encryptedPayloadBase64,
        dataEncoding: 'base64',
        resultEncoding: 'utf8',
        allowRawPassword: true,
      });

    return decryptedRefreshToken;
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

/**
 * Save token to local storage without passcode encryption.
 * Token is encrypted using sensitiveEncodeKey only (no passcode required).
 */
async function saveTokenToStorage(params: {
  ownerId: string;
  token: string;
  backgroundApi: IBackgroundApi;
}): Promise<void> {
  const { ownerId, token, backgroundApi } = params;

  // 1. Build unique key for this ownerId
  const key = accountUtils.buildKeylessTokenKey({ ownerId });

  // 2. Encrypt without passcode (using sensitiveEncodeKey only)
  const encryptionKey = await buildKeylessLocalEncryptionKeyWithoutPasscode();

  const encryptedPayloadHex = await backgroundApi.servicePassword.encryptString(
    {
      password: encryptionKey,
      data: token,
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
 * Get token from local storage and decrypt it.
 * Does not require passcode.
 */
async function getTokenFromStorage(params: {
  ownerId: string;
  backgroundApi: IBackgroundApi;
}): Promise<string | null> {
  const { ownerId, backgroundApi } = params;

  // 1. Build unique key for this ownerId
  const key = accountUtils.buildKeylessTokenKey({ ownerId });

  // 2. Read encrypted data from storage
  const encryptedPayloadBase64 = await storageGetItem(key);

  if (!encryptedPayloadBase64) {
    return null;
  }

  // 3. Decrypt without passcode (using sensitiveEncodeKey only)
  const decryptionKey = await buildKeylessLocalEncryptionKeyWithoutPasscode();

  try {
    const decryptedToken = await backgroundApi.servicePassword.decryptString({
      password: decryptionKey,
      data: encryptedPayloadBase64,
      dataEncoding: 'base64',
      resultEncoding: 'utf8',
      allowRawPassword: true,
    });

    return decryptedToken;
  } catch (error) {
    throw new OneKeyLocalError(
      `Failed to decrypt token: corrupted data: ${(error as Error)?.message}`,
    );
  }
}

/**
 * Remove token from local storage.
 */
async function removeTokenFromStorage(params: {
  ownerId: string;
}): Promise<void> {
  const { ownerId } = params;

  // 1. Build unique key for this ownerId
  const key = accountUtils.buildKeylessTokenKey({ ownerId });

  // 2. Remove encrypted data from storage
  await storageRemoveItem(key);
}

/**
 * Save both refreshToken and token to storage.
 * RefreshToken requires passcode encryption, token does not.
 */
async function saveTokensToStorage(params: {
  ownerId: string;
  refreshToken: string;
  token: string;
  backgroundApi: IBackgroundApi;
}): Promise<void> {
  const { ownerId, refreshToken, token, backgroundApi } = params;

  // Save token first (without passcode)
  await saveTokenToStorage({ ownerId, token, backgroundApi });

  // Then save refreshToken (with passcode)
  await saveRefreshTokenToStorage({ ownerId, refreshToken, backgroundApi });
}

/**
 * Get both refreshToken and token from storage.
 * RefreshToken requires passcode verification, token does not.
 */
async function getTokensFromStorage(params: {
  ownerId: string;
  backgroundApi: IBackgroundApi;
}): Promise<{ token: string; refreshToken: string } | null> {
  const { ownerId, backgroundApi } = params;

  // Get token first (without passcode)
  const token = await getTokenFromStorage({ ownerId, backgroundApi });

  if (!token) {
    return null;
  }

  // Then get refreshToken (with passcode)
  const refreshToken = await getRefreshTokenFromStorage({
    ownerId,
    backgroundApi,
  });

  if (!refreshToken) {
    return null;
  }

  return { token, refreshToken };
}

/**
 * Remove both refreshToken and token from storage.
 */
async function removeTokensFromStorage(params: {
  ownerId: string;
}): Promise<void> {
  const { ownerId } = params;

  await Promise.all([
    removeRefreshTokenFromStorage({ ownerId }),
    removeTokenFromStorage({ ownerId }),
  ]);
}

export default {
  // refresh token
  saveRefreshTokenToStorage,
  getRefreshTokenFromStorage,
  removeRefreshTokenFromStorage,
  // access token
  saveTokenToStorage,
  getTokenFromStorage,
  removeTokenFromStorage,
  // Combined operations (for convenience)
  saveTokensToStorage,
  getTokensFromStorage,
  removeTokensFromStorage,
};
