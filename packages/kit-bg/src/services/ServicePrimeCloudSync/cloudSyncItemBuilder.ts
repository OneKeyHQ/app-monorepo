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

import type {
  IDBCloudSyncItem,
  IDBDevice,
  IDBWallet,
} from '../../dbs/local/types';

class CloudSyncItemBuilder {
  canLocalItemSyncToScene({
    item,
    syncCredential,
  }: {
    item: IDBCloudSyncItem;
    syncCredential: ICloudSyncCredential;
  }) {
    return (
      !item.localSceneUpdated &&
      (item.data || item.isDeleted) &&
      item.dataTime &&
      // TODO server item.pwdHash missing
      (item.pwdHash === syncCredential.masterPasswordUUID || !item.pwdHash)
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
    const item: IDBCloudSyncItem = {
      id: key,
      rawKey: rawDataJson.rawKey,
      dataType: rawDataJson.dataType,
      rawData,
      data: encryptedData,
      dataTime,
      isDeleted: false, // TODO re-update deleted items

      pwdHash: encryptedData ? syncCredential?.masterPasswordUUID || '' : '',

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
      if (item.dataType === EPrimeCloudSyncDataType.Lock) {
        const syncCredentialForLock: ICloudSyncCredentialForLock = {
          ...syncCredential,
          securityPasswordR1: 'lock',
        };
        // eslint-disable-next-line no-param-reassign
        syncCredential = syncCredentialForLock;
      }
      const { primeAccountSalt, securityPasswordR1: syncPassword } =
        syncCredential;
      const password = this.buildEncryptPassword({
        primeAccountSalt,
        syncPassword,
      });
      let decryptedData: string | undefined;
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

      try {
        if (decryptedData) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          rawDataJson = JSON.parse(decryptedData) as ICloudSyncRawDataJson;
          item.pwdHash = syncCredential?.masterPasswordUUID || '';
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
