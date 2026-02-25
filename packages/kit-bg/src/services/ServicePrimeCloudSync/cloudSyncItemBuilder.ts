import { sha512 } from '@noble/hashes/sha512';
import { isNil } from 'lodash';

import {
  decryptStringAsync,
  encryptStringAsync,
} from '@onekeyhq/core/src/secret';
import {
  WALLET_TYPE_HW,
  WALLET_TYPE_QR,
} from '@onekeyhq/shared/src/consts/dbConsts';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import {
  IncorrectMasterPassword,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import cloudSyncUtils from '@onekeyhq/shared/src/utils/cloudSyncUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type {
  ICloudSyncCredential,
  ICloudSyncCredentialForLock,
  ICloudSyncPayloadDbWalletFields,
  ICloudSyncRawDataJson,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import keylessCloudSyncUtils from './keylessCloudSyncUtils';

import type {
  IDBCloudSyncItem,
  IDBDevice,
  IDBWallet,
} from '../../dbs/local/types';

class CloudSyncItemBuilder {
  /**
   * Get pwdHash from sync credential
   * For keyless mode, returns precomputed pwdHash from keylessCredential
   * For OneKey ID mode, returns masterPasswordUUID
   */
  getPwdHash(syncCredential: ICloudSyncCredential | undefined): string {
    if (!syncCredential) {
      return '';
    }

    const { keylessCredential } = syncCredential;
    if (keylessCredential) {
      // pwdHash is precomputed in deriveKeylessCredential
      return keylessCredential.pwdHash || '';
    }

    // Fallback to OneKey ID mode
    return syncCredential.masterPasswordUUID || '';
  }

  canLocalItemSyncToScene({
    item,
    syncCredential,
  }: {
    item: IDBCloudSyncItem;
    syncCredential: ICloudSyncCredential;
  }) {
    const pwdHash = this.getPwdHash(syncCredential);

    return (
      !item.localSceneUpdated &&
      (item.data || item.isDeleted) &&
      item.dataTime &&
      // Check pwdHash matches current mode or is empty
      (item.pwdHash === pwdHash || !item.pwdHash)
    );
  }

  setDefaultPropsOfServerToLocalItem({
    localItem,
  }: {
    localItem: IDBCloudSyncItem;
  }) {
    localItem.localSceneUpdated = false;
    localItem.serverUploaded = true;
    return localItem;
  }

  buildWalletSyncKey<T extends EPrimeCloudSyncDataType>({
    dataType,
    wallet,
    dbDevice,
    accountIndex, // for indexed account
  }: {
    dataType: T;
    wallet: (IDBWallet & ICloudSyncPayloadDbWalletFields) | undefined;
    dbDevice?: IDBDevice; // IQrWalletDevice
    accountIndex: number | undefined;
  }) {
    if (!wallet) {
      throw new OneKeyLocalError(
        'buildWalletSyncKey ERROR: wallet is required',
      );
    }
    const {
      // use hd exclusive hash, not shared xfp, avoid software and hardware wallets' avatar and name shared
      hash: hdWalletHash,
      // xfp: walletXfp, // do NOT use xfp
      type: walletType,
      passphraseState = '',
    } = wallet;
    let keyHash = hdWalletHash;
    let deviceType = '';
    if (walletType === WALLET_TYPE_HW) {
      keyHash = dbDevice?.deviceId;
      deviceType = dbDevice?.deviceType || '';
    }
    if (walletType === WALLET_TYPE_QR) {
      keyHash = dbDevice?.deviceId;
      deviceType = dbDevice?.deviceType || '';
    }
    if (!keyHash) {
      throw new OneKeyLocalError(`keyHash is required: ${wallet.id}`);
    }
    if (!dataType) {
      throw new OneKeyLocalError(`dataType is required: ${wallet.id}`);
    }
    if (!walletType) {
      throw new OneKeyLocalError(`walletType is required: ${wallet.id}`);
    }

    const rawKey = [
      `${walletType}:${deviceType || ''}`,
      `${keyHash}:${passphraseState || ''}`,
      isNil(accountIndex) ? '' : accountIndex?.toString() || '',
    ]
      .filter(Boolean)
      .join('__'); // --
    const key = bufferUtils.bytesToHex(sha512(rawKey));
    return {
      rawKey,
      key,
      dataType,
      walletType,
      walletHash: hdWalletHash,
      passphraseState,
    };
  }

  buildEncryptPassword({
    primeAccountSalt,
    syncPassword,
  }: {
    primeAccountSalt: string;
    syncPassword: string;
  }) {
    if (!primeAccountSalt || !syncPassword) {
      throw new OneKeyLocalError(
        'buildEncryptPassword ERROR: primeAccountSalt or syncPassword is required',
      );
    }
    return `${primeAccountSalt}:${syncPassword}:B8392FFE-200E-4197-8BDE-E3FEBD1A77AC`;
  }

  buildRawDataString(rawDataJson: ICloudSyncRawDataJson) {
    const rawData = stringUtils.stableStringify(rawDataJson);
    return rawData;
  }

  async buildSyncItemFromRawDataJson({
    key,
    rawDataJson,
    syncCredential,
    dataTime,
  }: {
    key: string;
    rawDataJson: ICloudSyncRawDataJson;
    syncCredential: ICloudSyncCredential | undefined;
    dataTime: number | undefined;
  }) {
    const { rawData, encryptedData } = await this.encryptSyncItem({
      rawDataJson,
      syncCredential,
    });

    // Compute pwdHash using unified method
    const pwdHash = encryptedData ? this.getPwdHash(syncCredential) : '';

    const item: IDBCloudSyncItem = {
      id: key,
      rawKey: rawDataJson.rawKey,
      dataType: rawDataJson.dataType,
      rawData,
      data: encryptedData,
      dataTime,
      isDeleted: false, // TODO re-update deleted items
      pwdHash,
      localSceneUpdated: false,
      serverUploaded: false,
    };
    return item;
  }

  async encryptSyncItem({
    rawDataJson,
    syncCredential,
  }: {
    rawDataJson: ICloudSyncRawDataJson;
    syncCredential: ICloudSyncCredential | undefined;
  }) {
    const rawData: string = this.buildRawDataString(rawDataJson);
    let encryptedData: string | undefined;
    if (syncCredential) {
      const { keylessCredential } = syncCredential;
      // Use keyless encryption if keylessCredential is available
      if (keylessCredential) {
        encryptedData = await keylessCloudSyncUtils.encryptWithKeylessKey({
          rawData,
          encryptionKey: keylessCredential.encryptionKey,
        });
      } else {
        // Fallback to OneKey ID encryption
        const { primeAccountSalt, securityPasswordR1: syncPassword } =
          syncCredential;
        const password = this.buildEncryptPassword({
          primeAccountSalt,
          syncPassword,
        });
        encryptedData = await encryptStringAsync({
          password,
          allowRawPassword: true,
          data: rawData,
          dataEncoding: 'utf8',
        });
      }
    }
    return {
      rawData,
      encryptedData,
    };
  }

  async decryptSyncItem({
    item,
    syncCredential,
  }: {
    item: IDBCloudSyncItem;
    syncCredential: ICloudSyncCredential | undefined;
  }) {
    const { dataType, isDeleted } = item;
    let rawDataJson: ICloudSyncRawDataJson | undefined;

    if (syncCredential && item.data) {
      let decryptedData: string | undefined;
      const credentialPwdHash: string | undefined =
        this.getPwdHash(syncCredential);

      // Determine decryption method based on pwdHash prefix
      if (
        keylessCloudSyncUtils.isKeylessPwdHash(item.pwdHash) &&
        syncCredential.keylessCredential
      ) {
        // Keyless decryption
        try {
          decryptedData = await keylessCloudSyncUtils.decryptWithKeylessKey({
            encryptedData: item.data,
            encryptionKey: syncCredential.keylessCredential.encryptionKey,
          });
        } catch (error) {
          console.error('decryptSyncItem keyless decrypt error', error, item);
          throw new IncorrectMasterPassword();
        }
      } else if (keylessCloudSyncUtils.isKeylessPwdHash(item.pwdHash)) {
        // Item has keyless pwdHash but no keyless credential available — cannot decrypt
        console.error(
          'decryptSyncItem: item has keyless pwdHash but keylessCredential is missing',
          item.id,
        );
        throw new IncorrectMasterPassword();
      } else {
        // OneKey ID decryption
        let credentialToUse = syncCredential;
        if (item.dataType === EPrimeCloudSyncDataType.Lock) {
          const syncCredentialForLock: ICloudSyncCredentialForLock = {
            ...syncCredential,
            securityPasswordR1: 'lock',
          };
          credentialToUse = syncCredentialForLock;
        }
        const { primeAccountSalt, securityPasswordR1: syncPassword } =
          credentialToUse;
        const password = this.buildEncryptPassword({
          primeAccountSalt,
          syncPassword,
        });
        try {
          decryptedData = await decryptStringAsync({
            password,
            allowRawPassword: true,
            data: item.data,
            dataEncoding: 'hex',
            resultEncoding: 'utf8',
          });
        } catch (error) {
          console.error('decryptSyncItem decrypt error', error, item);
          throw new IncorrectMasterPassword();
        }
      }

      try {
        if (decryptedData) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          rawDataJson = JSON.parse(decryptedData) as ICloudSyncRawDataJson;
          item.pwdHash = credentialPwdHash || '';
        }
      } catch (error) {
        console.error('decryptSyncItem jsonParse error', error, item);
      }
      item.rawDataJson = rawDataJson;
      item.rawData = decryptedData || '';
      item.rawKey = rawDataJson?.rawKey || item.rawKey || '';
    } else if (
      !item.rawDataJson &&
      !item.data &&
      item.rawData &&
      cloudSyncUtils.canSyncWithoutServer(item.dataType)
    ) {
      try {
        rawDataJson = JSON.parse(item.rawData) as ICloudSyncRawDataJson;
        item.rawDataJson = rawDataJson;
        item.rawKey = rawDataJson?.rawKey || item.rawKey || '';
      } catch (error) {
        console.error('decryptSyncItem jsonParse error', error, item);
      }
    }

    return {
      dbItem: item,
      rawDataJson,
      dataType,
      isDeleted,
    };
  }
}

export default new CloudSyncItemBuilder();
