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
  IBackupCloudServerData,
  IBackupCloudServerDownloadData,
  IBackupDataEncryptedPayload,
  IBackupDataManifest,
  IBackupDataManifestItem,
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
    const cloudKitAccountInfo = await appleCloudKitStorage.getAccountInfo();
    const cloudKitAvailable = await appleCloudKitStorage.isAvailable();
    let cloudFsAvailable: boolean | undefined;
    if (platformEnv.isNativeIOS) {
      cloudFsAvailable = await RNCloudFs?.isAvailable?.();
    }
    const keychainCloudSyncEnabled =
      await appleKeyChainStorage.isICloudSyncEnabled();

    // return {
    //   iCloud: undefined,
    // };

    return {
      userId: cloudKitAccountInfo.containerUserId ?? '',
      iCloud: {
        cloudKitStatus: cloudKitAccountInfo.status,
        cloudKitStatusName: cloudKitAccountInfo.statusName,
        cloudKitContainerUserId: cloudKitAccountInfo.containerUserId,
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
  async backupData(
    payload: IBackupDataEncryptedPayload,
  ): Promise<{ recordID: string; content: string }> {
    // await this.checkAvailability();
    const recordID = `${CLOUDKIT_RECORD_ID_PREFIX}-${stringUtils.generateUUID()}`;

    const content = stringUtils.stableStringify(payload);
    // Save to CloudKit
    const result = await appleCloudKitStorage.saveRecord({
      recordType: CLOUDKIT_RECORD_TYPE,
      recordID,
      data: content,
    });

    console.log('backupData__savedRecordId: result', result);

    return {
      recordID,
      content,
    };
  }

  async downloadData({
    recordId,
  }: {
    recordId: string;
  }): Promise<IBackupCloudServerDownloadData | null> {
    await this.checkAvailability();
    const record = await appleCloudKitStorage.fetchRecord({
      recordID: recordId,
      recordType: CLOUDKIT_RECORD_TYPE,
    });
    if (!record?.data) {
      return null;
    }
    try {
      return {
        payload: JSON.parse(record.data) as IBackupDataEncryptedPayload,
        content: record.data,
      };
    } catch (error) {
      console.error('Failed to download backup data:', error);
      return null;
    }
  }

  private async decryptBackupData({
    payload,
    password,
  }: {
    payload: IBackupDataEncryptedPayload;
    password: string;
  }): Promise<IPrimeTransferData | null> {
    try {
      if (!payload || !payload.privateDataEncrypted) {
        return null;
      }
      // Decode and decrypt data
      const encryptedData: Buffer = Buffer.from(
        payload.privateDataEncrypted,
        'base64',
      );

      // Decrypt data
      const decryptedData = await decryptAsync({
        data: encryptedData,
        password,
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

  async getAllBackups(): Promise<IBackupDataManifest> {
    await this.checkAvailability();

    const result = await appleCloudKitStorage.queryRecords({
      recordType: CLOUDKIT_RECORD_TYPE, // TODO pagination
    });
    const items: IBackupDataManifestItem[] = (
      await Promise.all(
        result.records.map(async (record) => {
          try {
            const data = JSON.parse(record.data) as IBackupDataEncryptedPayload;
            const d: IBackupDataManifestItem = {
              recordID: record.recordID,
              dataTime: data.publicData?.dataTime ?? 0,
              totalWalletsCount: data.publicData?.totalWalletsCount ?? 0,
              totalAccountsCount: data.publicData?.totalAccountsCount ?? 0,
            };
            return d;
          } catch (e) {
            return {
              recordID: record.recordID,
              dataTime: 0,
              totalWalletsCount: 0,
              totalAccountsCount: 0,
            };
          }
        }),
      )
    )
      .filter(Boolean)
      .sort((a, b) => (b.dataTime ?? 0) - (a.dataTime ?? 0));
    return {
      total: items.length,
      items,
    };
  }

  async deleteBackup({ recordId }: { recordId: string }): Promise<void> {
    await this.checkAvailability();
    await appleCloudKitStorage.deleteRecord({
      recordID: recordId,
      recordType: CLOUDKIT_RECORD_TYPE,
    });
  }
}
