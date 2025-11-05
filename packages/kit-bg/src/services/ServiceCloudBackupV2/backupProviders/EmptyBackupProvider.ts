/* eslint-disable @typescript-eslint/no-unused-vars */
import type { IBackgroundApi } from '@onekeyhq/kit-bg/src/apis/IBackgroundApi';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IAppleCloudKitAccountInfo,
  IAppleCloudKitRecord,
} from '@onekeyhq/shared/src/storage/AppleCloudKitStorage/types';
import type { IGoogleDriveFile } from '@onekeyhq/shared/src/storage/GoogleDriveStorage';
import type { IPrimeTransferData } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import type {
  IBackupCloudServerData,
  IBackupCloudServerDownloadData,
  IBackupDataManifest,
  IBackupProviderAccountInfo,
  IBackupProviderInfo,
  IOneKeyBackupProvider,
} from './IOneKeyBackupProvider';

export class EmptyBackupProvider implements IOneKeyBackupProvider {
  constructor(private readonly backgroundApi: IBackgroundApi) {
    this.backgroundApi = backgroundApi;
  }

  async loginCloudIfNeed(): Promise<void> {
    // do nothing
  }

  async logoutCloud(): Promise<void> {
    // do nothing
  }

  async getCloudAccountInfo(): Promise<IBackupProviderAccountInfo> {
    throw new OneKeyLocalError(
      'EmptyBackupProvider.getCloudAccountInfo() Method not implemented.',
    );
  }

  async getBackupProviderInfo(): Promise<IBackupProviderInfo> {
    return {
      displayName: 'Empty Backup Provider',
      displayNameI18nKey: '',
    };
  }

  async isAvailable(): Promise<boolean> {
    return false;
  }

  checkAvailability(): Promise<void> {
    throw new OneKeyLocalError('Method not implemented.');
  }

  prepareEncryptionKey(params?: { password?: string }): Promise<string> {
    throw new OneKeyLocalError('Method not implemented.');
  }

  recoverEncryptionKey(params?: { password?: string }): Promise<string | null> {
    throw new OneKeyLocalError('Method not implemented.');
  }

  backupData(): Promise<{ recordID: string; content: string }> {
    throw new OneKeyLocalError('Method not implemented.');
  }

  restoreData(params: {
    recordId: string;
    password?: string;
  }): Promise<IPrimeTransferData | null> {
    throw new OneKeyLocalError('Method not implemented.');
  }

  downloadData(): Promise<IBackupCloudServerDownloadData | null> {
    throw new OneKeyLocalError('Method not implemented.');
  }

  getAllBackups(): Promise<IBackupDataManifest> {
    throw new OneKeyLocalError('Method not implemented.');
  }

  deleteBackup(params: { recordId: string }): Promise<void> {
    throw new OneKeyLocalError('Method not implemented.');
  }
}
