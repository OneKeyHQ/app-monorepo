import { decryptAsync, encryptAsync } from '@onekeyhq/core/src/secret';
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import googlePlayService from '@onekeyhq/shared/src/googlePlayService/googlePlayService';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IAppleCloudKitAccountInfo } from '@onekeyhq/shared/src/storage/AppleCloudKitStorage/types';
import { googleDriveStorage } from '@onekeyhq/shared/src/storage/GoogleDriveStorage';
import type { IGoogleDriveFile } from '@onekeyhq/shared/src/storage/GoogleDriveStorage/types';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import type {
  IBackupCloudServerData,
  IBackupCloudServerDownloadData,
  IBackupDataEncryptedPayload,
  IBackupDataManifest,
  IBackupProviderAccountInfo,
  IBackupProviderInfo,
  IOneKeyBackupProvider,
} from './IOneKeyBackupProvider';

// File naming constants
const GOOGLE_DRIVE_BACKUP_PREFIX = 'OnekeyBackup_V2_Rev202510/';
/*
const CLOUD_FLODER_NAME = 'onekey_backup_V5/';
ServiceCloudBackupV1 use this folder name, V5 means OneKeyApp V5, not backup version V5, actually it's backup version V1.
*/

export class GoogleDriveBackupProvider implements IOneKeyBackupProvider {
  constructor(private readonly backgroundApi: IBackgroundApi) {
    this.backgroundApi = backgroundApi;
  }

  async getBackupProviderInfo(): Promise<IBackupProviderInfo> {
    return {
      displayName: '',
      displayNameI18nKey: ETranslations.global_google_drive,
    };
  }

  async getCloudAccountInfo(): Promise<IBackupProviderAccountInfo> {
    throw new OneKeyLocalError(
      'GoogleDriveBackupProvider.getCloudAccountInfo() Method not implemented.',
    );
  }

  async loginCloudIfNeed(): Promise<void> {
    // TODO signInSilently
    await googleDriveStorage.signIn();
  }

  async logoutCloud(): Promise<void> {
    await googleDriveStorage.signOut();
  }

  async isAvailable(): Promise<boolean> {
    // return await googleDriveStorage.isAvailable();
    return googlePlayService.isAvailable();
  }

  async checkAvailability(): Promise<void> {
    if (
      !platformEnv.isNativeIOS &&
      !platformEnv.isNativeAndroid &&
      !platformEnv.isDesktop
    ) {
      throw new OneKeyLocalError(
        'Google Drive backup is only supported on iOS/Android/Desktop',
      );
    }

    const available = await googleDriveStorage.isAvailable();
    if (!available) {
      throw new OneKeyLocalError(
        'Google Drive is not available. Please sign in to your Google account.',
      );
    }
  }

  async prepareEncryptionKey(params?: { password?: string }): Promise<string> {
    // Get Google user info
    const userInfo = await googleDriveStorage.getUserInfo();
    if (!userInfo) {
      throw new OneKeyLocalError('Failed to get Google user information');
    }
    if (!params?.password) {
      throw new OneKeyLocalError(
        'Password is required for Google Drive backup',
      );
    }
    return `${userInfo.userId}___${params.password}`;
  }

  async recoverEncryptionKey(_params?: {
    password?: string;
  }): Promise<string | null> {
    throw new OneKeyLocalError(
      'Google Drive backup encryption key is fixed and cannot be recovered',
    );
  }

  async backupData(
    payload: IBackupDataEncryptedPayload,
  ): Promise<{ recordID: string; content: string }> {
    await this.checkAvailability();
    throw new OneKeyLocalError(
      'GoogleDriveBackupProvider.backupData() Method not implemented.',
    );
    // const password = params?.password;
    // if (!password) {
    //   throw new OneKeyLocalError(
    //     'Password is required for Google Drive backup',
    //   );
    // }

    // // TODO move to interface
    // const userInfo = await googleDriveStorage.signIn();
    // if (!userInfo) {
    //   throw new OneKeyLocalError('Failed to sign in to Google Drive');
    // }

    // const encryptionKey = await this.prepareEncryptionKey({ password });
    // const { recordID, content } = await this.backupDataWithEncryptionKey(
    //   encryptionKey,
    // );
    // return { recordID, content };
  }

  async downloadData({
    recordId,
  }: {
    recordId: string;
  }): Promise<IBackupCloudServerDownloadData | null> {
    await this.checkAvailability();
    const file = await googleDriveStorage.downloadFile({ fileId: recordId });
    if (!file) {
      return null;
    }
    throw new OneKeyLocalError(
      'GoogleDriveBackupProvider.downloadData() Method not implemented.',
    );
  }

  async restoreData({
    recordId,
    password,
  }: {
    recordId: string;
    password?: string;
  }): Promise<IPrimeTransferData | null> {
    if (!password) {
      throw new OneKeyLocalError(
        'Password is required for Google Drive restore',
      );
    }

    await this.checkAvailability();

    // Get Google user info
    const userInfo = await googleDriveStorage.signIn();
    if (!userInfo) {
      throw new OneKeyLocalError('Failed to get Google user information');
    }

    // Download data file
    const serverData = await this.downloadData({
      recordId,
    });
    if (!serverData || !serverData.payload?.privateDataEncrypted) {
      throw new OneKeyLocalError('Backup data not found in Google Drive');
    }

    const encryptionKey = await this.prepareEncryptionKey({ password });

    // Decrypt backup data with MEK
    try {
      const encryptedData = Buffer.from(
        serverData.payload.privateDataEncrypted,
        'base64',
      );
      const decryptedData = await decryptAsync({
        data: encryptedData,
        password: encryptionKey,
        allowRawPassword: true,
      });

      const dataJson = decryptedData.toString('utf8');
      return JSON.parse(dataJson) as IPrimeTransferData;
    } catch (error) {
      throw new OneKeyLocalError(
        `Failed to decrypt backup data. The backup may be corrupted: ${
          (error as Error)?.message
        }`,
      );
    }
  }

  async getAllBackups(): Promise<IBackupDataManifest> {
    await this.checkAvailability();
    return { items: [], total: 0 };

    // // List all backup data files
    // const result = await googleDriveStorage.listFiles({
    //   // TODO query not working
    //   query: `name contains '${GOOGLE_DRIVE_BACKUP_PREFIX}_'`,
    //   pageSize: 10_000, // TODO pagination
    // });

    // return (
    //   await Promise.all(
    //     result.files.map(async (file) => {
    //       // const backupData = await this.restoreData({
    //       //   recordId: file.id,
    //       //   password,
    //       // });
    //       if (
    //         file?.name &&
    //         file?.name?.startsWith(GOOGLE_DRIVE_BACKUP_PREFIX)
    //       ) {
    //         return { record: file, backupData: null };
    //       }
    //       return null;
    //     }),
    //   )
    // ).filter((item) => !!item);
  }

  async deleteBackup({ recordId }: { recordId: string }): Promise<void> {
    await this.checkAvailability();

    // Delete data file
    try {
      await googleDriveStorage.deleteFile({ fileId: recordId });
    } catch (error) {
      console.warn('Failed to delete backup data file:', error);
    }
  }
}
