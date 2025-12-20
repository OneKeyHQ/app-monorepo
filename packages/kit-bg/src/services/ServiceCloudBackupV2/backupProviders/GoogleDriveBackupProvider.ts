import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { omit } from 'lodash';

import {
  decryptStringAsync,
  encryptStringAsync,
} from '@onekeyhq/core/src/secret';
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import {
  CLOUD_BACKUP_PASSWORD_SALT,
  CLOUD_BACKUP_PASSWORD_VERIFY_TEXT,
} from '@onekeyhq/shared/src/cloudBackup/cloudBackupConsts';
import { ECloudBackupProviderType } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import type {
  IBackupCloudServerDownloadData,
  IBackupDataEncryptedPayload,
  IBackupDataManifest,
  IBackupDataPasswordVerify,
  IBackupProviderAccountInfo,
  IBackupProviderInfo,
  ICloudBackupKeylessWalletPayload,
} from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import { GoogleSignInConfigure } from '@onekeyhq/shared/src/consts/googleSignConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import googlePlayService from '@onekeyhq/shared/src/googlePlayService/googlePlayService';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { googleDriveStorage } from '@onekeyhq/shared/src/storage/GoogleDriveStorage';
import type {
  IGoogleDriveFile,
  IGoogleUserInfo,
} from '@onekeyhq/shared/src/storage/GoogleDriveStorage/types';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import type { IOneKeyBackupProvider } from './IOneKeyBackupProvider';

// File naming constants
const GOOGLE_DRIVE_BACKUP_FILE_NAME_PREFIX = 'OnekeyBackup_V2_Rev202510--';
const GOOGLE_DRIVE_BACKUP_KEYLESS_WALLET_FILE_NAME_PREFIX =
  'OnekeyKeylessWallet--';
const GOOGLE_DRIVE_BACKUP_MANIFEST_FILE_NAME =
  'OnekeyBackup_V2_Rev202510--manifest.json';
/*
const CLOUD_FLODER_NAME = 'onekey_backup_V5/';
ServiceCloudBackupV1 use this folder name, V5 means OneKeyApp V5, not backup version V5, actually it's backup version V1.
*/

export class GoogleDriveBackupProvider implements IOneKeyBackupProvider {
  constructor(private readonly backgroundApi: IBackgroundApi) {
    this.backgroundApi = backgroundApi;
  }

  async clearBackupPassword(): Promise<void> {
    const manifest = await this.getManifest();
    manifest.backupPasswordVerify = undefined;
    await this.saveManifest(manifest);
  }

  async setBackupPassword(params?: {
    password?: string;
  }): Promise<{ recordID: string }> {
    if (!params?.password) {
      throw new OneKeyLocalError('Password is required for backup setPassword');
    }
    const manifest = await this.getManifest();
    const content: IBackupDataPasswordVerify = {
      content: await encryptStringAsync({
        allowRawPassword: true,
        password: params.password + CLOUD_BACKUP_PASSWORD_SALT,
        data: CLOUD_BACKUP_PASSWORD_VERIFY_TEXT,
        dataEncoding: 'utf8',
      }),
    };
    manifest.backupPasswordVerify = content;
    if (!manifest?.googleDriveLegacyMetaDataFileId) {
      try {
        const fileObj =
          await this.backgroundApi.serviceCloudBackup.getGoogleDriveMetadataFileObject();
        manifest.googleDriveLegacyMetaDataFileId = fileObj?.id;
      } catch (error) {
        console.error(
          'Failed to get GoogleDriveBackup Legacy MetaData file:',
          error,
        );
      }
    }
    await this.saveManifest(manifest);
    const fileObj = await googleDriveStorage.getFileObject({
      fileName: GOOGLE_DRIVE_BACKUP_MANIFEST_FILE_NAME,
    });
    const fileId: string | undefined = fileObj?.id;
    if (!fileId) {
      throw new OneKeyLocalError('GoogleDriveBackup Manifest fileId not found');
    }
    return { recordID: fileId };
  }

  async verifyBackupPassword(params?: { password?: string }): Promise<boolean> {
    if (!params?.password) {
      throw new OneKeyLocalError(
        'Password is required for backup verifyPassword',
      );
    }
    const manifest = await this.getManifest();
    const verify = manifest.backupPasswordVerify;
    if (!verify?.content) {
      throw new OneKeyLocalError('backup password not set before backup');
    }
    const decryptedContent = await decryptStringAsync({
      allowRawPassword: true,
      password: params.password + CLOUD_BACKUP_PASSWORD_SALT,
      data: verify.content,
      dataEncoding: 'hex',
      resultEncoding: 'utf8',
    });
    if (decryptedContent !== CLOUD_BACKUP_PASSWORD_VERIFY_TEXT) {
      return false;
    }
    return true;
  }

  async isBackupPasswordSet(): Promise<boolean> {
    const manifest = await this.getManifest();
    return !!manifest?.backupPasswordVerify?.content;
  }

  async getBackupProviderInfo(): Promise<IBackupProviderInfo> {
    return {
      displayName: '',
      displayNameI18nKey: ETranslations.global_google_drive,
      // id: ETranslations.backup_backup_to_google_drive,
    };
  }

  async getCloudAccountInfo(): Promise<IBackupProviderAccountInfo> {
    let email = '';
    let userInfo: IGoogleUserInfo | null = null;
    const isGooglePlayServiceAvailable = await googlePlayService.isAvailable();
    // let isCloudFsAvailable: boolean | undefined;
    if (isGooglePlayServiceAvailable) {
      // isAvailable is iOS only
      // isCloudFsAvailable = await RNCloudFs.isAvailable();

      GoogleSignin.configure(GoogleSignInConfigure);
      const isSignedIn = await GoogleSignin.isSignedIn();

      // if (!isSignedIn) {
      //   await GoogleSignin.signInSilently();
      //   isSignedIn = await GoogleSignin.isSignedIn();
      // }

      if (isSignedIn) {
        userInfo = await GoogleSignin.getCurrentUser();
        email = userInfo?.user?.email || '';

        // await RNCloudFs.loginIfNeeded();
      }
    }

    return {
      userId: userInfo?.user?.id || '',
      userEmail: userInfo?.user?.email || '',
      providerType: ECloudBackupProviderType.GoogleDrive,
      googleDrive: {
        email,
        userInfo,
        googlePlayServiceAvailable: isGooglePlayServiceAvailable,
      },
    };
  }

  async loginCloudIfNeed(): Promise<void> {
    await googleDriveStorage.loginIfNeeded({ showSignInDialog: true });
  }

  async logoutCloud(): Promise<void> {
    await googleDriveStorage.logout();
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
    return `${userInfo?.user?.id}___${params.password}`;
  }

  async recoverEncryptionKey(_params?: {
    password?: string;
  }): Promise<string | null> {
    throw new OneKeyLocalError(
      'Google Drive backup encryption key is fixed and cannot be recovered',
    );
  }

  buildBackupFileName(): string {
    return `${GOOGLE_DRIVE_BACKUP_FILE_NAME_PREFIX}${stringUtils.generateUUID()}.json`;
  }

  buildKeylessWalletBackupFileName(packSetId: string): string {
    return `${GOOGLE_DRIVE_BACKUP_KEYLESS_WALLET_FILE_NAME_PREFIX}${packSetId}.json`;
  }

  async backupData(
    payload: IBackupDataEncryptedPayload,
  ): Promise<{ recordID: string; content: string }> {
    await this.checkAvailability();
    const fileName = this.buildBackupFileName();
    const content = stringUtils.stableStringify(payload);
    const result = await googleDriveStorage.uploadFile({ fileName, content });
    await this.appendToManifest({
      payload,
      fileID: result.fileId,
      fileName,
    });
    void this.backgroundApi.serviceCloudBackup.touchLegacyMetaDataFile();
    return { recordID: result.fileId, content };
  }

  async backupKeylessWalletData(
    payload: ICloudBackupKeylessWalletPayload,
  ): Promise<{ recordID: string; content: string; meta: string }> {
    await this.checkAvailability();
    const fileName = this.buildKeylessWalletBackupFileName(
      payload.cloudKeyPack.packSetId,
    );
    const content = stringUtils.stableStringify(payload);
    const result = await googleDriveStorage.uploadFile({ fileName, content });
    await this.appendToKeylessWalletManifest({
      payload,
      fileId: result.fileId,
      fileName,
    });
    void this.backgroundApi.serviceCloudBackup.touchLegacyMetaDataFile();
    return { recordID: result.fileId, content, meta: '' };
  }

  async getManifest() {
    // await googleDriveStorage.fileExists({ fileId: '' });
    const fileObj = await googleDriveStorage.getFileObject({
      fileName: GOOGLE_DRIVE_BACKUP_MANIFEST_FILE_NAME,
    });
    if (!fileObj) {
      const files = await googleDriveStorage.listFiles();
      if (files?.files?.length >= 0) {
        const manifestFileObj = await googleDriveStorage.getFileObject({
          fileName: GOOGLE_DRIVE_BACKUP_MANIFEST_FILE_NAME,
        });
        if (!manifestFileObj) {
          const manifest: IBackupDataManifest = {
            items: [],
            total: 0,
          };
          return manifest;
        }
      }
    }
    const fileId: string | undefined = fileObj?.id;
    if (!fileId) {
      throw new OneKeyLocalError('GoogleDriveBackup Manifest fileId not found');
    }
    const file = await googleDriveStorage.downloadFile({ fileId });
    if (!file?.content) {
      throw new OneKeyLocalError(
        'GoogleDriveBackup Manifest file content not found',
      );
    }
    return JSON.parse(file.content) as IBackupDataManifest;
  }

  async saveManifest(manifest: IBackupDataManifest) {
    const content = stringUtils.stableStringify(manifest);
    await googleDriveStorage.uploadFile({
      fileName: GOOGLE_DRIVE_BACKUP_MANIFEST_FILE_NAME,
      content,
    });
  }

  async appendToManifest({
    payload,
    fileID,
    fileName,
  }: {
    payload: IBackupDataEncryptedPayload;
    fileID: string;
    fileName: string;
  }) {
    if (!payload.publicData) {
      throw new OneKeyLocalError('Payload publicData not found');
    }
    const manifest = await this.getManifest();
    if (!manifest.items) {
      manifest.items = [];
    }
    manifest.items.unshift({
      ...omit(payload.publicData ?? {}, ['walletDetails']),
      recordID: fileID,
      fileName,
    });
    manifest.total = manifest.items.length;
    await this.saveManifest(manifest);
  }

  async appendToKeylessWalletManifest({
    payload,
    fileId,
    fileName,
  }: {
    payload: ICloudBackupKeylessWalletPayload;
    fileId: string;
    fileName: string;
  }) {
    const manifest = await this.getManifest();
    if (!manifest?.keylessWallets) {
      manifest.keylessWallets = {};
    }
    manifest.keylessWallets[payload.cloudKeyPack.packSetId] = {
      recordID: fileId,
      fileName,
    };
    await this.saveManifest(manifest);
  }

  async deleteFromManifest({ fileId }: { fileId: string }) {
    const manifest = await this.getManifest();
    const items = manifest.items || [];
    manifest.items = items.filter((item) => item.recordID !== fileId);
    manifest.total = manifest.items.length;
    await this.saveManifest(manifest);
  }

  async downloadData({
    recordId,
  }: {
    recordId: string;
  }): Promise<IBackupCloudServerDownloadData | null> {
    await this.checkAvailability();
    const file = await googleDriveStorage.downloadFile({ fileId: recordId });
    if (!file?.content) {
      return null;
    }
    try {
      return {
        payload: JSON.parse(file.content) as IBackupDataEncryptedPayload,
        content: file.content,
      };
    } catch (error) {
      console.error('Failed to download backup data:', error);
      return null;
    }
  }

  async downloadKeylessWalletData({ recordID }: { recordID: string }): Promise<{
    payload: ICloudBackupKeylessWalletPayload;
    content: string;
  } | null> {
    await this.checkAvailability();
    const file = await googleDriveStorage.downloadFile({
      fileId: recordID,
    });
    if (!file?.content) {
      return null;
    }
    try {
      return {
        payload: JSON.parse(file.content) as ICloudBackupKeylessWalletPayload,
        content: file.content,
      };
    } catch (error) {
      console.error('Failed to download keyless wallet data:', error);
      return null;
    }
  }

  async getKeylessWalletBackupRecordID({
    packSetId,
  }: {
    packSetId: string;
  }): Promise<{ recordID: string; packSetId: string } | null> {
    await this.checkAvailability();
    const manifest = await this.getManifest();
    const keylessWalletInfo = manifest?.keylessWallets?.[packSetId];
    if (!keylessWalletInfo?.recordID) {
      return null;
    }
    const exists = await googleDriveStorage.fileExists({
      fileId: keylessWalletInfo.recordID,
    });
    if (!exists) {
      throw new OneKeyLocalError('Keyless wallet backup file not found');
    }
    return {
      recordID: keylessWalletInfo.recordID,
      packSetId,
    };
  }

  async getAllBackups(): Promise<IBackupDataManifest> {
    await this.checkAvailability();
    return this.getManifest();
  }

  async listAllFiles(): Promise<{ files: IGoogleDriveFile[] }> {
    const files = await googleDriveStorage.listFiles();
    return files;
  }

  async getManifestFileObject() {
    const fileObj = await googleDriveStorage.getFileObject({
      fileName: GOOGLE_DRIVE_BACKUP_MANIFEST_FILE_NAME,
    });
    return fileObj;
  }

  async removeManifestFile(): Promise<void> {
    const fileObj = await this.getManifestFileObject();
    if (!fileObj) {
      throw new OneKeyLocalError('GoogleDriveBackup Manifest file not found');
    }
    const fileId: string | undefined = fileObj?.id;
    if (!fileId) {
      throw new OneKeyLocalError('GoogleDriveBackup Manifest fileId not found');
    }
    await googleDriveStorage.deleteFile({
      fileId,
    });
  }

  async deleteBackup({
    recordId,
    skipManifestUpdate,
  }: {
    recordId: string;
    skipManifestUpdate?: boolean;
  }): Promise<void> {
    await this.checkAvailability();

    const result = await googleDriveStorage.deleteFile({ fileId: recordId });
    if (result && !skipManifestUpdate) {
      await this.deleteFromManifest({
        fileId: recordId,
      });
    }
  }
}
