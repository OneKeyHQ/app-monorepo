import { decodeSensitiveTextAsync, sha256 } from '@onekeyhq/core/src/secret';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IDeviceKeyPack } from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { settingsPersistAtom } from '../../../states/jotai/atoms';

import { buildKeylessLocalEncryptionKey } from './keylessLocalEncryptionKey';
import keylessStorageUtils from './keylessStorageUtils';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';

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
  const encryptionKey = await buildKeylessLocalEncryptionKey({ backgroundApi });

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
  await keylessStorageUtils.storageSetItem(key, encryptedPayloadBase64);
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
  const encryptedPayloadBase64 = await keylessStorageUtils.storageGetItem(key);

  if (!encryptedPayloadBase64) {
    return null;
  }

  // 3. Decrypt with encryption key
  const decryptionKey = await buildKeylessLocalEncryptionKey({ backgroundApi });

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
      `Failed to decrypt device pack: invalid password or corrupted data: ${
        (error as Error)?.message
      }`,
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

/**
 * Remove device pack from local storage.
 */
async function removeDevicePackFromStorage(params: {
  packSetId: string;
}): Promise<void> {
  const { packSetId } = params;
  // 1. Build unique key for this packSetId
  const key = accountUtils.buildKeylessDevicePackKey({
    packSetId,
  });

  // 2. Remove encrypted data from storage, prefer secureStorage if available
  await keylessStorageUtils.storageRemoveItem(key);
}

export default {
  saveDevicePackToStorage,
  getDevicePackFromStorage,
  removeDevicePackFromStorage,
};
