import { ESecretEncryptPayloadFormat } from '@onekeyhq/core/src/secret/encryptors/aes256';
import { PBKDF2_CURRENT_NUM_OF_ITERATIONS } from '@onekeyhq/shared/src/appCrypto/consts';
import { getPbkdf2KdfParamsForNonDbTx } from '@onekeyhq/shared/src/appCrypto/modules/pbkdf2';
import { KeylessDataCorruptedError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { buildKeylessLocalEncryptionKeyWithPassword } from './keylessLocalEncryptionKey';
import keylessStorageUtils from './keylessStorageUtils';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';

// sensitiveEncodeKey is persisted with local app data, so the low-entropy app
// passcode still requires the full password-hardening KDF.
const KEYLESS_LOCAL_ENCRYPTION_ITERATIONS = PBKDF2_CURRENT_NUM_OF_ITERATIONS;

async function saveMnemonicPasswordToStorageWithPassword(params: {
  ownerId: string;
  mnemonicPassword: string;
  password: string;
  backgroundApi: IBackgroundApi;
}): Promise<void> {
  const { ownerId, mnemonicPassword, password, backgroundApi } = params;

  const key = accountUtils.buildKeylessMnemonicPasswordKey({ ownerId });
  const encryptionKey = await buildKeylessLocalEncryptionKeyWithPassword({
    password,
  });
  // Derivation finishes before appStorage starts its write, so WebCrypto does
  // not run inside an IndexedDB transaction callback.
  const kdfParams = getPbkdf2KdfParamsForNonDbTx();

  const encryptedPayloadHex = await backgroundApi.servicePassword.encryptString(
    {
      password: encryptionKey,
      data: mnemonicPassword,
      dataEncoding: 'utf8',
      allowRawPassword: true,
      format: ESecretEncryptPayloadFormat.v2,
      iterations: KEYLESS_LOCAL_ENCRYPTION_ITERATIONS,
      ...kdfParams,
    },
  );

  const encryptedPayloadBase64 = bufferUtils.bytesToBase64(
    bufferUtils.hexToBytes(encryptedPayloadHex),
  );

  await keylessStorageUtils.storageSetItem(key, encryptedPayloadBase64);
}

async function getMnemonicPasswordFromStorageWithPassword(params: {
  ownerId: string;
  password: string;
  backgroundApi: IBackgroundApi;
}): Promise<string | null> {
  const { ownerId, password, backgroundApi } = params;

  const key = accountUtils.buildKeylessMnemonicPasswordKey({ ownerId });
  const encryptedPayloadBase64 = await keylessStorageUtils.storageGetItem(key);

  if (!encryptedPayloadBase64) {
    return null;
  }

  const decryptionKey = await buildKeylessLocalEncryptionKeyWithPassword({
    password,
  });
  const kdfParams = getPbkdf2KdfParamsForNonDbTx();

  try {
    const mnemonicPassword = await backgroundApi.servicePassword.decryptString({
      password: decryptionKey,
      data: encryptedPayloadBase64,
      dataEncoding: 'base64',
      resultEncoding: 'utf8',
      allowRawPassword: true,
      ...kdfParams,
    });
    return mnemonicPassword;
  } catch (_error) {
    defaultLogger.wallet.keyless.dataCorruptedError({
      reason:
        'getMnemonicPasswordFromStorageWithPassword: failed to decrypt mnemonicPassword by decryptionKey',
    });
    throw new KeylessDataCorruptedError();
  }
}

/**
 * Save mnemonicPassword to local storage with encryption.
 * This is used for Reset PIN flow to recover juicebox share.
 *
 * NOTE: This function requires `password` parameter. Caller is responsible for
 * obtaining the password via promptPasswordVerify() before calling this function.
 * This design prevents multiple password prompts when saving multiple items in a transaction.
 * Here transaction means the application workflow, not an IndexedDB callback.
 */
async function saveMnemonicPasswordToStorage(params: {
  ownerId: string;
  mnemonicPassword: string;
  password: string;
  backgroundApi: IBackgroundApi;
}): Promise<void> {
  const { ownerId, mnemonicPassword, password, backgroundApi } = params;

  return saveMnemonicPasswordToStorageWithPassword({
    ownerId,
    mnemonicPassword,
    password,
    backgroundApi,
  });
}

/**
 * Get mnemonicPassword from local storage and decrypt it.
 *
 * NOTE: This function requires `password` parameter. Caller is responsible for
 * obtaining the password via promptPasswordVerify() before calling this function.
 * This design prevents multiple password prompts when getting multiple items in a transaction.
 * Here transaction means the application workflow, not an IndexedDB callback.
 */
async function getMnemonicPasswordFromStorage(params: {
  ownerId: string;
  password: string;
  backgroundApi: IBackgroundApi;
}): Promise<string | null> {
  const { ownerId, password, backgroundApi } = params;

  return getMnemonicPasswordFromStorageWithPassword({
    ownerId,
    password,
    backgroundApi,
  });
}

async function removeMnemonicPasswordFromStorage(params: {
  ownerId: string;
}): Promise<void> {
  const { ownerId } = params;

  const key = accountUtils.buildKeylessMnemonicPasswordKey({ ownerId });

  await keylessStorageUtils.storageRemoveItem(key);
}

export default {
  saveMnemonicPasswordToStorage,
  getMnemonicPasswordFromStorage,
  removeMnemonicPasswordFromStorage,
  saveMnemonicPasswordToStorageWithPassword,
  getMnemonicPasswordFromStorageWithPassword,
};
