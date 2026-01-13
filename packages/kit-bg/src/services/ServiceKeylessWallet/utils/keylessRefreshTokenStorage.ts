import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import {
  buildKeylessLocalEncryptionKey,
  buildKeylessLocalEncryptionKeyWithoutPasscode,
} from './keylessLocalEncryptionKey';
import keylessStorageUtils from './keylessStorageUtils';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';

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

  const tokenData = refreshToken;

  const encryptedPayloadHex = await backgroundApi.servicePassword.encryptString(
    {
      password: encryptionKey,
      data: tokenData,
      dataEncoding: 'utf8',
      allowRawPassword: true,
    },
  );

  // Convert hex to base64 for storage
  const encryptedPayloadBase64 = bufferUtils.bytesToBase64(
    bufferUtils.hexToBytes(encryptedPayloadHex),
  );

  // 3. Store encrypted data, prefer secureStorage if available
  await keylessStorageUtils.storageSetItem(key, encryptedPayloadBase64);
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
  const encryptedPayloadBase64 = await keylessStorageUtils.storageGetItem(key);

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
  await keylessStorageUtils.storageRemoveItem(key);
}

/**
 * Save accessToken to local storage without passcode encryption.
 * AccessToken is encrypted using sensitiveEncodeKey only (no passcode required).
 */
async function saveAccessTokenToStorage(params: {
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
  await keylessStorageUtils.storageSetItem(key, encryptedPayloadBase64);
}

/**
 * Get accessToken from local storage and decrypt it.
 * Does not require passcode.
 */
async function getAccessTokenFromStorage(params: {
  ownerId: string;
  backgroundApi: IBackgroundApi;
}): Promise<string | null> {
  const { ownerId, backgroundApi } = params;

  // 1. Build unique key for this ownerId
  const key = accountUtils.buildKeylessTokenKey({ ownerId });

  // 2. Read encrypted data from storage
  const encryptedPayloadBase64 = await keylessStorageUtils.storageGetItem(key);

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
 * Remove accessToken from local storage.
 */
async function removeAccessTokenFromStorage(params: {
  ownerId: string;
}): Promise<void> {
  const { ownerId } = params;

  // 1. Build unique key for this ownerId
  const key = accountUtils.buildKeylessTokenKey({ ownerId });

  // 2. Remove encrypted data from storage
  await keylessStorageUtils.storageRemoveItem(key);
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

  // Save accessToken first (without passcode)
  await saveAccessTokenToStorage({ ownerId, token, backgroundApi });

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
}): Promise<{ token: string | null; refreshToken: string | null }> {
  const { ownerId, backgroundApi } = params;

  // Get accessToken first (without passcode)
  const token = await getAccessTokenFromStorage({ ownerId, backgroundApi });

  // Then get refreshToken (with passcode)
  const refreshToken = await getRefreshTokenFromStorage({
    ownerId,
    backgroundApi,
  });

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
    removeAccessTokenFromStorage({ ownerId }),
  ]);
}

export default {
  // refresh token
  saveRefreshTokenToStorage,
  getRefreshTokenFromStorage,
  removeRefreshTokenFromStorage,
  // access token
  saveAccessTokenToStorage,
  getAccessTokenFromStorage,
  removeAccessTokenFromStorage,
  // Combined operations (for convenience)
  saveTokensToStorage,
  getTokensFromStorage,
  removeTokensFromStorage,
};
