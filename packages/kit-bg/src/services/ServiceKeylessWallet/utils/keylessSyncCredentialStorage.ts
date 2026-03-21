import {
  decryptStringAsync,
  encryptStringAsync,
} from '@onekeyhq/core/src/secret';
import { EAppCryptoAesEncryptionMode } from '@onekeyhq/shared/src/appCrypto/consts';
import {
  KEYLESS_SYNC_CREDENTIAL_STORAGE_AAD,
  KEYLESS_SYNC_CREDENTIAL_STORAGE_KEY,
} from '@onekeyhq/shared/src/consts/keylessCloudSyncConsts';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import type { IKeylessCloudSyncCredential } from '@onekeyhq/shared/types/keylessCloudSync';

import keylessStorageUtils from './keylessStorageUtils';

function buildStorageKey(keylessWalletId: string): string {
  return `keyless_sync_credential_${keylessWalletId}`;
}

async function saveCredential(
  credential: IKeylessCloudSyncCredential,
): Promise<void> {
  const json = JSON.stringify(credential);
  const encryptedHex = await encryptStringAsync({
    password: KEYLESS_SYNC_CREDENTIAL_STORAGE_KEY,
    data: json,
    dataEncoding: 'utf8',
    allowRawPassword: true,
    iterations: 1,
    mode: EAppCryptoAesEncryptionMode.gcm,
    aad: KEYLESS_SYNC_CREDENTIAL_STORAGE_AAD,
  });
  const base64 = bufferUtils.bytesToBase64(
    bufferUtils.hexToBytes(encryptedHex),
  );
  await keylessStorageUtils.storageSetItem(
    buildStorageKey(credential.keylessWalletId),
    base64,
  );
}

async function getCredential(
  keylessWalletId: string,
): Promise<IKeylessCloudSyncCredential | null> {
  const base64 = await keylessStorageUtils.storageGetItem(
    buildStorageKey(keylessWalletId),
  );
  if (!base64) {
    return null;
  }
  try {
    const json = await decryptStringAsync({
      password: KEYLESS_SYNC_CREDENTIAL_STORAGE_KEY,
      data: base64,
      dataEncoding: 'base64',
      resultEncoding: 'utf8',
      allowRawPassword: true,
      iterations: 1,
      mode: EAppCryptoAesEncryptionMode.gcm,
      aad: KEYLESS_SYNC_CREDENTIAL_STORAGE_AAD,
    });
    const credential = JSON.parse(json) as IKeylessCloudSyncCredential;
    if (credential.keylessWalletId !== keylessWalletId) {
      await removeCredential(keylessWalletId);
      return null;
    }
    return credential;
  } catch {
    await removeCredential(keylessWalletId);
    return null;
  }
}

async function removeCredential(keylessWalletId: string): Promise<void> {
  await keylessStorageUtils.storageRemoveItem(
    buildStorageKey(keylessWalletId),
  );
}

export default {
  saveCredential,
  getCredential,
  removeCredential,
};
