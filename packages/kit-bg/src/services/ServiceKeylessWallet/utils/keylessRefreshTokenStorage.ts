import { KeylessDataCorruptedError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import {
  buildKeylessLocalEncryptionKeyWithPassword,
  buildKeylessLocalEncryptionKeyWithoutPasscode,
} from './keylessLocalEncryptionKey';
import keylessStorageUtils from './keylessStorageUtils';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';

async function saveRefreshTokenToStorageWithPassword(params: {
  ownerId: string;
  refreshToken: string;
  password: string;
  backgroundApi: IBackgroundApi;
}): Promise<void> {
  const { ownerId, refreshToken, password, backgroundApi } = params;

  const key = accountUtils.buildKeylessRefreshTokenKey({ ownerId });
  const encryptionKey = await buildKeylessLocalEncryptionKeyWithPassword({
    password,
  });

  const encryptedPayloadHex = await backgroundApi.servicePassword.encryptString(
    {
      password: encryptionKey,
      data: refreshToken,
      dataEncoding: 'utf8',
      allowRawPassword: true,
    },
  );

  const encryptedPayloadBase64 = bufferUtils.bytesToBase64(
    bufferUtils.hexToBytes(encryptedPayloadHex),
  );

  await keylessStorageUtils.storageSetItem(key, encryptedPayloadBase64);
}

async function getRefreshTokenFromStorageWithPassword(params: {
  ownerId: string;
  password: string;
  backgroundApi: IBackgroundApi;
}): Promise<string | null> {
  const { ownerId, password, backgroundApi } = params;

  const key = accountUtils.buildKeylessRefreshTokenKey({ ownerId });
  const encryptedPayloadBase64 = await keylessStorageUtils.storageGetItem(key);

  if (!encryptedPayloadBase64) {
    return null;
  }

  const decryptionKey = await buildKeylessLocalEncryptionKeyWithPassword({
    password,
  });

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
  } catch (_error) {
    defaultLogger.wallet.keyless.dataCorruptedError({
      reason:
        'getRefreshTokenFromStorageWithPassword: failed to decrypt refreshToken by decryptionKey',
    });
    throw new KeylessDataCorruptedError();
  }
}

/**
 * Save refreshToken to local storage with passcode encryption.
 * RefreshToken is encrypted using the user's passcode via buildKeylessLocalEncryptionKeyWithPassword.
 *
 * NOTE: This function requires `password` parameter. Caller is responsible for
 * obtaining the password via promptPasswordVerify() before calling this function.
 * This design prevents multiple password prompts when saving multiple items in a transaction.
 */
async function saveRefreshTokenToStorage(params: {
  ownerId: string;
  refreshToken: string;
  password: string;
  backgroundApi: IBackgroundApi;
}): Promise<void> {
  const { ownerId, refreshToken, password, backgroundApi } = params;

  return saveRefreshTokenToStorageWithPassword({
    ownerId,
    refreshToken,
    password,
    backgroundApi,
  });
}

/**
 * Get refreshToken from local storage and decrypt it.
 * Requires user passcode to decrypt.
 *
 * NOTE: This function requires `password` parameter. Caller is responsible for
 * obtaining the password via promptPasswordVerify() before calling this function.
 * This design prevents multiple password prompts when getting multiple items in a transaction.
 */
async function getRefreshTokenFromStorage(params: {
  ownerId: string;
  password: string;
  backgroundApi: IBackgroundApi;
}): Promise<string | null> {
  const { ownerId, password, backgroundApi } = params;

  return getRefreshTokenFromStorageWithPassword({
    ownerId,
    password,
    backgroundApi,
  });
}

async function removeRefreshTokenFromStorage(params: {
  ownerId: string;
}): Promise<void> {
  const { ownerId } = params;

  const key = accountUtils.buildKeylessRefreshTokenKey({ ownerId });

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
  } catch (_error) {
    defaultLogger.wallet.keyless.dataCorruptedError({
      reason:
        'getAccessTokenFromStorage: failed to decrypt token by decryptionKey',
    });
    throw new KeylessDataCorruptedError();
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
 *
 * NOTE: This function requires `password` parameter. Caller is responsible for
 * obtaining the password via promptPasswordVerify() before calling this function.
 */
async function saveTokensToStorage(params: {
  ownerId: string;
  refreshToken: string;
  token: string;
  password: string;
  backgroundApi: IBackgroundApi;
}): Promise<void> {
  const { ownerId, refreshToken, token, password, backgroundApi } = params;

  await saveAccessTokenToStorage({ ownerId, token, backgroundApi });

  await saveRefreshTokenToStorage({
    ownerId,
    refreshToken,
    password,
    backgroundApi,
  });
}

/**
 * Get both refreshToken and token from storage.
 * RefreshToken requires passcode verification, token does not.
 *
 * NOTE: This function requires `password` parameter. Caller is responsible for
 * obtaining the password via promptPasswordVerify() before calling this function.
 */
async function getTokensFromStorage(params: {
  ownerId: string;
  password: string;
  backgroundApi: IBackgroundApi;
}): Promise<{ token: string | null; refreshToken: string | null }> {
  const { ownerId, password, backgroundApi } = params;

  const token = await getAccessTokenFromStorage({ ownerId, backgroundApi });

  const refreshToken = await getRefreshTokenFromStorage({
    ownerId,
    password,
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
  saveRefreshTokenToStorage,
  getRefreshTokenFromStorage,
  removeRefreshTokenFromStorage,
  saveRefreshTokenToStorageWithPassword,
  getRefreshTokenFromStorageWithPassword,
  saveAccessTokenToStorage,
  getAccessTokenFromStorage,
  removeAccessTokenFromStorage,
  saveTokensToStorage,
  getTokensFromStorage,
  removeTokensFromStorage,
};
