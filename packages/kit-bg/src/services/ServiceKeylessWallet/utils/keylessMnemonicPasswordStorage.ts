import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { buildKeylessLocalEncryptionKey } from './keylessLocalEncryptionKey';
import keylessStorageUtils from './keylessStorageUtils';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';

/**
 * Save mnemonicPassword to local storage with encryption.
 * This is used for Reset PIN flow to recover juicebox share.
 */
async function saveMnemonicPasswordToStorage(params: {
  ownerId: string;
  mnemonicPassword: string;
  backgroundApi: IBackgroundApi;
}): Promise<void> {
  const { ownerId, mnemonicPassword, backgroundApi } = params;

  // 1. Build unique key for this ownerId
  const key = accountUtils.buildKeylessMnemonicPasswordKey({ ownerId });

  // 2. Encrypt with encryption key
  const encryptionKey = await buildKeylessLocalEncryptionKey({ backgroundApi });

  const encryptedPayloadHex = await backgroundApi.servicePassword.encryptString(
    {
      password: encryptionKey,
      data: mnemonicPassword,
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
 * Get mnemonicPassword from local storage and decrypt it.
 */
async function getMnemonicPasswordFromStorage(params: {
  ownerId: string;
  backgroundApi: IBackgroundApi;
}): Promise<string | null> {
  const { ownerId, backgroundApi } = params;

  // 1. Build unique key for this ownerId
  const key = accountUtils.buildKeylessMnemonicPasswordKey({ ownerId });

  // 2. Read encrypted data from storage
  const encryptedPayloadBase64 = await keylessStorageUtils.storageGetItem(key);

  if (!encryptedPayloadBase64) {
    return null;
  }

  // 3. Decrypt with encryption key
  const decryptionKey = await buildKeylessLocalEncryptionKey({ backgroundApi });

  try {
    const mnemonicPassword = await backgroundApi.servicePassword.decryptString({
      password: decryptionKey,
      data: encryptedPayloadBase64,
      dataEncoding: 'base64',
      resultEncoding: 'utf8',
      allowRawPassword: true,
    });
    return mnemonicPassword;
  } catch (error) {
    throw new OneKeyLocalError(
      `Failed to decrypt mnemonicPassword: invalid password or corrupted data: ${
        (error as Error)?.message
      }`,
    );
  }
}

/**
 * Remove mnemonicPassword from local storage.
 */
async function removeMnemonicPasswordFromStorage(params: {
  ownerId: string;
}): Promise<void> {
  const { ownerId } = params;

  // 1. Build unique key for this ownerId
  const key = accountUtils.buildKeylessMnemonicPasswordKey({ ownerId });

  // 2. Remove encrypted data from storage
  await keylessStorageUtils.storageRemoveItem(key);
}

export default {
  saveMnemonicPasswordToStorage,
  getMnemonicPasswordFromStorage,
  removeMnemonicPasswordFromStorage,
};
