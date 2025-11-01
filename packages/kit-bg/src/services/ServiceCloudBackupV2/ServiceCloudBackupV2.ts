import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import googlePlayService from '@onekeyhq/shared/src/googlePlayService/googlePlayService';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IAppleCloudKitRecord } from '@onekeyhq/shared/src/storage/AppleCloudKitStorage/types';
import type { IGoogleDriveFile } from '@onekeyhq/shared/src/storage/GoogleDriveStorage/types';
import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import ServiceBase from '../ServiceBase';

import { OneKeyBackupProvider } from './backupProviders/OneKeyBackupProvider';

import type {
  IBackupProviderInfo,
  IOneKeyBackupProvider,
} from './backupProviders/IOneKeyBackupProvider';

export type IBackupStatus = {
  isAvailable: boolean;
  hasBackup: boolean;
  lastBackupTime?: number;
  backupSize?: number;
};

@backgroundClass()
class ServiceCloudBackupV2 extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  _backupProvider: IOneKeyBackupProvider | null = null;

  /**
   * Get the appropriate backup provider for current platform
   * @param platform Optional platform override, defaults to auto-detect
   * @returns Backup provider instance
   */
  private getProvider(): IOneKeyBackupProvider {
    if (!this._backupProvider) {
      this._backupProvider = new OneKeyBackupProvider(this.backgroundApi);
    }
    return this._backupProvider;
  }

  @backgroundMethod()
  async supportCloudBackup(): Promise<boolean> {
    if (platformEnv.isDev && platformEnv.isWeb) {
      return true;
    }
    if (platformEnv.isNativeIOS) {
      return true;
    }
    if (platformEnv.isNativeAndroid) {
      // return googlePlayService.isAvailable();
      return true;
    }
    if (platformEnv.isDesktop && platformEnv.isDesktopMac) {
      return false;
    }
    return false;
  }

  @backgroundMethod()
  async getBackupProviderInfo(): Promise<IBackupProviderInfo> {
    return this.getProvider().getBackupProviderInfo();
  }

  @backgroundMethod()
  async init(): Promise<void> {
    // Initialize backup service
    // Check if iCloud is available and set up listeners if needed
    if (platformEnv.isNativeIOS) {
      // await this.iCloudProvider.getBackupStatus();
    }
  }

  @backgroundMethod()
  async checkAvailability(): Promise<void> {
    const provider = this.getProvider();
    await provider.checkAvailability();
  }

  @backgroundMethod()
  async backup(params?: { password?: string }): Promise<{ recordID: string }> {
    const provider = this.getProvider();
    await provider.checkAvailability();
    return provider.backupData(params);
  }

  @backgroundMethod()
  async prepareEncryptionKey(params?: { password?: string }): Promise<string> {
    const provider = this.getProvider();
    await provider.checkAvailability();
    return provider.prepareEncryptionKey(params);
  }

  @backgroundMethod()
  async backupDataWithEncryptionKey(params: { encryptionKey: string }) {
    const provider = this.getProvider();
    await provider.checkAvailability();
    return provider.backupDataWithEncryptionKey(params.encryptionKey);
  }

  @backgroundMethod()
  async download(params: {
    recordId: string;
  }): Promise<IAppleCloudKitRecord | IGoogleDriveFile | null> {
    const provider = this.getProvider();
    await provider.checkAvailability();
    return provider.downloadData(params);
  }

  @backgroundMethod()
  async restore(params: {
    recordId: string;
    password?: string;
  }): Promise<IPrimeTransferData | null> {
    const provider = this.getProvider();

    try {
      const transferData = await provider.restoreData({
        recordId: params.recordId,
        password: params.password,
      });

      // TODO: Implement the restore flow similar to ServicePrimeTransfer
      // This would involve:
      // 1. Getting the selected transfer data from transferData
      // 2. Prompting for password if needed (Google Drive)
      // 3. Calling servicePrimeTransfer.startImport() with the data
      // For now, just emit an event so the UI can handle it

      await this.showToast({
        method: 'success',
        title: 'Backup Data Retrieved',
        message: 'Please implement the restore flow in the UI',
      });

      return transferData;
    } catch (error) {
      await this.showToast({
        method: 'error',
        title: 'Restore Failed',
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
      throw error;
    }
  }

  @backgroundMethod()
  async deleteBackup(params: { recordId: string }): Promise<void> {
    const provider = this.getProvider();

    try {
      await provider.deleteBackup({
        recordId: params.recordId,
      });

      await this.showToast({
        method: 'success',
        title: 'Backup Deleted',
        message: 'Your backup has been deleted',
      });
    } catch (error) {
      await this.showToast({
        method: 'error',
        title: 'Delete Failed',
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
      });
      throw error;
    }
  }

  @backgroundMethod()
  async getAllBackups(): Promise<
    Array<{ record: any; backupData: IPrimeTransferData | null }>
  > {
    const provider = this.getProvider();
    return provider.getAllBackups();
  }

  @backgroundMethod()
  async enableAutoBackup(): Promise<void> {
    // TODO: Implement auto-backup scheduling
    // This could use app lifecycle events to trigger automatic backups
    throw new OneKeyLocalError('Auto-backup not implemented yet');
  }

  @backgroundMethod()
  async disableAutoBackup(): Promise<void> {
    // TODO: Implement auto-backup disabling
    throw new OneKeyLocalError('Auto-backup not implemented yet');
  }

  @backgroundMethod()
  async getICloudKeyChainEncryptionKey(): Promise<string | null> {
    // This is iCloud-specific, so always use iCloud provider
    return this.getProvider().recoverEncryptionKey();
  }
}

export default ServiceCloudBackupV2;
