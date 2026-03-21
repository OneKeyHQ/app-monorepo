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

const STORAGE_KEY = 'keyless_sync_credentials';

type ICredentialMap = Record<string, IKeylessCloudSyncCredential>;

async function readMap(): Promise<ICredentialMap> {
  const base64 = await keylessStorageUtils.storageGetItem(STORAGE_KEY);
  if (!base64) {
    return {};
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
    return JSON.parse(json) as ICredentialMap;
  } catch {
    // Corrupted — wipe everything
    await keylessStorageUtils.storageRemoveItem(STORAGE_KEY);
    return {};
  }
}

async function writeMap(map: ICredentialMap): Promise<void> {
  if (Object.keys(map).length === 0) {
    await keylessStorageUtils.storageRemoveItem(STORAGE_KEY);
    return;
  }
  const json = JSON.stringify(map);
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
  await keylessStorageUtils.storageSetItem(STORAGE_KEY, base64);
}

async function saveCredential(
  credential: IKeylessCloudSyncCredential,
): Promise<void> {
  // Overwrite entire map — only keep the current credential
  await writeMap({ [credential.keylessWalletId]: credential });
}

async function getCredential(
  keylessWalletId: string,
): Promise<IKeylessCloudSyncCredential | null> {
  const map = await readMap();
  const credential = map[keylessWalletId];
  if (!credential) {
    // Not found — clear all orphaned entries
    if (Object.keys(map).length > 0) {
      await writeMap({});
    }
    return null;
  }
  return credential;
}

async function removeCredential(keylessWalletId: string): Promise<void> {
  const map = await readMap();
  delete map[keylessWalletId];
  await writeMap(map);
}

async function removeAllCredentials(): Promise<void> {
  await keylessStorageUtils.storageRemoveItem(STORAGE_KEY);
}

export default {
  saveCredential,
  getCredential,
  removeCredential,
  removeAllCredentials,
};
