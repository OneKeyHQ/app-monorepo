import RNCloudFs from 'react-native-cloud-fs';

import { decryptAsync, encryptAsync } from '@onekeyhq/core/src/secret';
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { appleCloudKitStorage } from '@onekeyhq/shared/src/storage/AppleCloudKitStorage';
import type {
  IAppleCloudKitAccountInfo,
  IAppleCloudKitRecord,
} from '@onekeyhq/shared/src/storage/AppleCloudKitStorage/types';
import { appleKeyChainStorage } from '@onekeyhq/shared/src/storage/AppleKeyChainStorage';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import type {
  IBackupProviderAccountInfo,
  IBackupProviderInfo,
  IOneKeyBackupProvider,
} from './IOneKeyBackupProvider';

const CLOUDKIT_RECORD_TYPE = 'OneKeyBackupV2';
const CLOUDKIT_RECORD_ID_PREFIX = 'onekey_backup_v2_item';
const ICLOUD_KEYCHAIN_KEY = 'com.onekey.backup_v2.encryption.key';
const ICLOUD_KEYCHAIN_LABEL = 'OneKey Wallet Backup V2 Key (DO NOT DELETE)';
const ICLOUD_KEYCHAIN_DESCRIPTION =
  'DO NOT DELETE. Required to restore OneKey Wallet backups.';

export class ICloudBackupProvider implements IOneKeyBackupProvider {
  constructor(private readonly backgroundApi: IBackgroundApi) {
    this.backgroundApi = backgroundApi;
  }

  async loginCloudIfNeed(): Promise<void> {
    // do nothing
  }

  async logoutCloud(): Promise<void> {
    // do nothing
  }

  async getBackupProviderInfo(): Promise<IBackupProviderInfo> {
    return {
      displayName: '',
      displayNameI18nKey: ETranslations.global_icloud,
    };
  }

  // TODO methods
  // - manuallySync() / RNCloudFs.syncCloud();
  // - getCloudAccountInfo()

  async getCloudAccountInfo(): Promise<IBackupProviderAccountInfo> {
    const accountInfo = await appleCloudKitStorage.getAccountInfo();
    const cloudKitAvailable = await appleCloudKitStorage.isAvailable();
    const cloudFsAvailable = await RNCloudFs.isAvailable();
    const keychainCloudSyncEnabled =
      await appleKeyChainStorage.isICloudSyncEnabled();

    // return {
    //   iCloud: undefined,
    // };

    return {
      iCloud: {
        cloudKitStatus: accountInfo.status,
        cloudKitStatusName: accountInfo.statusName,
        cloudKitContainerUserId: accountInfo.containerUserId,
        cloudKitAvailable,
        cloudFsAvailable,
        keychainCloudSyncEnabled, // TODO not working as expected
      },
    };
  }

  async isAvailable(): Promise<boolean> {
    const a = await appleCloudKitStorage.isAvailable();
    const b = await RNCloudFs.isAvailable();
    return a || b;
  }

  async checkAvailability(): Promise<void> {
    if (!platformEnv.isNativeIOS && !platformEnv.isDesktopMac) {
      throw new OneKeyLocalError('iCloud backup is only supported on iOS/Mac');
    }

    const cloudFsAvailable = await RNCloudFs.isAvailable();
    if (!cloudFsAvailable) {
      throw new OneKeyLocalError(
        'CloudFS is not available. Please ensure you are signed in to iCloud.',
      );
    }

    const available = await appleCloudKitStorage.isAvailable();
    if (!available) {
      throw new OneKeyLocalError(
        'CloudKit is not available. Please ensure you are signed in to iCloud.',
      );
    }

    const iCloudSyncEnabled = await appleKeyChainStorage.isICloudSyncEnabled();
    if (!iCloudSyncEnabled) {
      throw new OneKeyLocalError(
        'iCloud Keychain sync is not enabled. Please enable iCloud Keychain in Settings > [Your Name] > iCloud > Keychain to use iCloud backup.',
      );
    }
  }

  private async generateEncryptionKey(): Promise<string> {
    const keyBytes = crypto.getRandomValues(new Uint8Array(32));
    return Buffer.from(keyBytes).toString('base64');
  }

  // Backup encryption key to multiple locations for redundancy
  private async backupEncryptionKeyToKeyChain(
    encryptionKey: string,
  ): Promise<void> {
    await appleKeyChainStorage.setItem({
      key: ICLOUD_KEYCHAIN_KEY,
      value: encryptionKey,
      label: ICLOUD_KEYCHAIN_LABEL,
      description: ICLOUD_KEYCHAIN_DESCRIPTION,
    });
  }

  // Attempt to recover encryption key from backup locations
  // Note: password parameter not used for iCloud (uses Keychain instead)
  async recoverEncryptionKey(_params?: {
    password?: string;
  }): Promise<string | null> {
    return this.recoverEncryptionKeyFromKeyChain();
  }

  // Internal method for keychain recovery
  private async recoverEncryptionKeyFromKeyChain(): Promise<string | null> {
    // Try recovery sources in order of preference
    try {
      // 1. Try iCloud Keychain (primary, fastest)
      const keychainKey = await appleKeyChainStorage.getItem({
        key: ICLOUD_KEYCHAIN_KEY,
      });
      if (keychainKey) {
        return keychainKey.value;
      }
      return null;
    } catch (error) {
      console.error('Key recovery error:', error);
      return null;
    }
  }

  async getBackupData() {
    const data =
      await this.backgroundApi.servicePrimeTransfer.buildTransferData();
    return data;
  }

  // Generate or retrieve encryption key with recovery support
  // Note: password parameter not used for iCloud (uses Keychain instead)
  async prepareEncryptionKey(_params?: { password?: string }): Promise<string> {
    let encryptionKey = await this.recoverEncryptionKeyFromKeyChain();
    if (!encryptionKey) {
      encryptionKey = await this.generateEncryptionKey();
      await this.backupEncryptionKeyToKeyChain(encryptionKey);
      const encryptionKey2 = await this.recoverEncryptionKeyFromKeyChain();
      if (encryptionKey2 !== encryptionKey) {
        throw new OneKeyLocalError(
          'Encryption key not found and recovery failed. Cannot restore backup. Please ensure iCloud Keychain is enabled or try restoring on the original device.',
        );
      }
    }
    return encryptionKey;
  }

  // Note: password parameter not used for iCloud (uses Keychain instead)
  async backupData(_params: {
    password?: string;
  }): Promise<{ recordID: string; content: string }> {
    // await this.checkAvailability();
    const encryptionKey = await this.prepareEncryptionKey();
    const { recordID, content } = await this.backupDataWithEncryptionKey(
      encryptionKey,
    );
    return { recordID, content };
  }

  async backupDataWithEncryptionKey(
    encryptionKey: string,
  ): Promise<{ recordID: string; content: string }> {
    // await this.checkAvailability();

    // Get backup data
    const data: IPrimeTransferData = await this.getBackupData();
    const dataJson = stringUtils.stableStringify(data);

    // Encrypt data
    const encryptedData = await encryptAsync({
      data: Buffer.from(dataJson, 'utf8'),
      password: encryptionKey,
      allowRawPassword: true,
    });

    // Convert encrypted data to base64 for CloudKit storage
    const encryptedDataBase64 = encryptedData.toString('base64');

    const recordId = `${CLOUDKIT_RECORD_ID_PREFIX}-${stringUtils.generateUUID()}`;

    // Save to CloudKit
    const result = await appleCloudKitStorage.saveRecord({
      recordType: CLOUDKIT_RECORD_TYPE,
      recordID: recordId,
      data: encryptedDataBase64,
    });

    console.log('backupData__savedRecordId: result', result);
    return {
      recordID: result.recordID,
      content: encryptedDataBase64,
    };
  }

  async downloadData({
    recordId,
  }: {
    recordId: string;
  }): Promise<IAppleCloudKitRecord | null> {
    await this.checkAvailability();
    const record = await appleCloudKitStorage.fetchRecord({
      recordID: recordId,
      recordType: CLOUDKIT_RECORD_TYPE,
    });
    if (!record) {
      return null;
    }
    return record;
  }

  // Note: password parameter not used for iCloud (uses Keychain instead)
  async restoreData({
    recordId,
  }: {
    recordId: string;
    password?: string;
  }): Promise<IPrimeTransferData | null> {
    await this.checkAvailability();

    // Fetch backup record from CloudKit
    const record = await this.downloadData({
      recordId,
    });

    if (!record || !record.data) {
      throw new OneKeyLocalError('No backup found in CloudKit');
    }

    // Retrieve encryption key with automatic recovery
    const encryptionKey = await this.recoverEncryptionKeyFromKeyChain();
    if (!encryptionKey) {
      throw new OneKeyLocalError(
        'Encryption key not found and recovery failed. Cannot restore backup. Please ensure iCloud Keychain is enabled or try restoring on the original device.',
      );
    }

    return this.decryptBackupData({
      record,
      encryptionKey,
    });
  }

  private async decryptBackupData({
    record,
    encryptionKey,
  }: {
    record: IAppleCloudKitRecord | null;
    encryptionKey: string;
  }): Promise<IPrimeTransferData | null> {
    try {
      if (!record || !record.data) {
        return null;
      }
      // Decode and decrypt data
      const encryptedData = Buffer.from(record.data, 'base64');

      // Decrypt data
      const decryptedData = await decryptAsync({
        data: encryptedData,
        password: encryptionKey,
        allowRawPassword: true,
      });

      // Parse and return data
      const dataJson = decryptedData.toString('utf8');
      return JSON.parse(dataJson) as IPrimeTransferData;
    } catch (error) {
      console.error('Failed to decrypt backup data:', error);
      return null;
    }
  }

  async getAllBackups(): Promise<
    { record: IAppleCloudKitRecord; backupData: IPrimeTransferData | null }[]
  > {
    await this.checkAvailability();

    const result = await appleCloudKitStorage.queryRecords({
      recordType: CLOUDKIT_RECORD_TYPE, // TODO pagination
    });
    const encryptionKey = await this.recoverEncryptionKeyFromKeyChain();
    if (!encryptionKey) {
      throw new OneKeyLocalError(
        'Encryption key not found and recovery failed. Cannot restore backup. Please ensure iCloud Keychain is enabled or try restoring on the original device.',
      );
    }
    return (
      await Promise.all(
        result.records.map(async (record) => {
          return {
            record,
            // TODO decrypt backup data later
            backupData: await this.decryptBackupData({
              record,
              encryptionKey,
            }),
          };
        }),
      )
    ).filter((item) => !!item?.backupData);
  }

  async deleteBackup({ recordId }: { recordId: string }): Promise<void> {
    await this.checkAvailability();

    // Delete ALL data to free up iCloud storage
    try {
      // 1. Delete backup data from CloudKit
      await appleCloudKitStorage.deleteRecord({
        recordID: recordId,
        recordType: CLOUDKIT_RECORD_TYPE,
      });
    } catch (error) {
      console.warn('Failed to delete backup data:', error);
      // Continue to delete other data even if this fails
    }
  }
}
