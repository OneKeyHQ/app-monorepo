import {
  decryptAsync,
  decryptImportedCredential,
  decryptRevealableSeed,
  encryptAsync,
} from '@onekeyhq/core/src/secret';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import googlePlayService from '@onekeyhq/shared/src/googlePlayService/googlePlayService';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IAppleCloudKitRecord } from '@onekeyhq/shared/src/storage/AppleCloudKitStorage/types';
import type { IGoogleDriveFile } from '@onekeyhq/shared/src/storage/GoogleDriveStorage/types';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type {
  IPrimeTransferData,
  IPrimeTransferPrivateData,
} from '@onekeyhq/shared/types/prime/primeTransferTypes';

import ServiceBase from '../ServiceBase';

import { OneKeyBackupProvider } from './backupProviders/OneKeyBackupProvider';

import type { ICloudBackupProvider } from './backupProviders/ICloudBackupProvider';
import type {
  IBackupCloudServerData,
  IBackupCloudServerDownloadData,
  IBackupDataEncryptedPayload,
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

  private getProvider(): IOneKeyBackupProvider {
    if (!this._backupProvider) {
      this._backupProvider = new OneKeyBackupProvider(this.backgroundApi);
    }
    return this._backupProvider;
  }

  @backgroundMethod()
  async supportCloudBackup(): Promise<boolean> {
    if (platformEnv.isNativeIOS) {
      // return false;
      return true;
    }
    if (platformEnv.isNativeAndroid) {
      // return googlePlayService.isAvailable();
      return true;
    }
    if (platformEnv.isDesktop && platformEnv.isDesktopMac) {
      return true;
    }
    return false;
  }

  @backgroundMethod()
  @toastIfError()
  async getCloudAccountInfo() {
    return this.getProvider().getCloudAccountInfo();
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
  @toastIfError()
  async checkAvailability(): Promise<void> {
    const provider = this.getProvider();
    await provider.checkAvailability();
  }

  @backgroundMethod()
  @toastIfError()
  async loginCloudIfNeed() {
    const provider = this.getProvider();
    await provider.loginCloudIfNeed();
  }

  @backgroundMethod()
  @toastIfError()
  async logoutCloud() {
    const provider = this.getProvider();
    await provider.logoutCloud();
  }

  @backgroundMethod()
  async prepareEncryptionKey(params?: { password?: string }): Promise<string> {
    const provider = this.getProvider();
    await provider.checkAvailability();
    return provider.prepareEncryptionKey(params);
  }

  @backgroundMethod()
  @toastIfError()
  async buildBackupData() {
    const data =
      await this.backgroundApi.servicePrimeTransfer.buildTransferData({
        isForCloudBackup: true,
      });
    return data;
  }

  async buildFullBackupPassword(params: { password: string }): Promise<string> {
    if (!params?.password) {
      throw new OneKeyLocalError('Password is required for backup');
    }
    const cloudAccountInfo = await this.getCloudAccountInfo();
    if (!cloudAccountInfo?.userId) {
      throw new OneKeyLocalError(
        'Cloud account user ID is required for backup',
      );
    }
    return `${cloudAccountInfo.userId}:${params?.password}:4A561E9E-E747-4AFF-B835-FE2EF2D61B41`;
  }

  @backgroundMethod()
  @toastIfError()
  async setBackupPassword(params: {
    password: string;
  }): Promise<{ recordID: string }> {
    const provider = this.getProvider();
    await provider.checkAvailability();
    return provider.setBackupPassword({
      password: await this.buildFullBackupPassword({
        password: params.password,
      }),
    });
  }

  @backgroundMethod()
  @toastIfError()
  async verifyBackupPassword(params: { password: string }): Promise<boolean> {
    const provider = this.getProvider();
    await provider.checkAvailability();
    return provider.verifyBackupPassword({
      password: await this.buildFullBackupPassword({
        password: params.password,
      }),
    });
  }

  @backgroundMethod()
  @toastIfError()
  async isBackupPasswordSet(): Promise<boolean> {
    const provider = this.getProvider();
    await provider.checkAvailability();
    return provider.isBackupPasswordSet();
  }

  @backgroundMethod()
  @toastIfError()
  async backup(params: {
    data: IPrimeTransferData;
    password: string;
  }): Promise<{ recordID: string; content: string }> {
    if (!params?.password) {
      throw new OneKeyLocalError('Password is required for backup');
    }
    if (!params?.data?.privateData) {
      throw new OneKeyLocalError('Private data is required for backup');
    }
    const backupPassword = params?.password;
    const data: IPrimeTransferData = params.data;
    if (data?.publicData) {
      data.publicData.dataTime = Date.now();
    }

    const provider = this.getProvider();
    await provider.checkAvailability();

    if (!data?.privateData?.decryptedCredentials) {
      const { password: localPassword } =
        await this.backgroundApi.servicePassword.promptPasswordVerify();
      data.privateData.decryptedCredentials = {};
      const entries = Object.entries(data.privateData.credentials || {});
      for (const [key, value] of entries) {
        if (accountUtils.isHdWallet({ walletId: key })) {
          data.privateData.decryptedCredentials[key] =
            await decryptRevealableSeed({
              rs: value,
              password: localPassword,
            });
        }
        if (accountUtils.isImportedAccount({ accountId: key })) {
          data.privateData.decryptedCredentials[key] =
            await decryptImportedCredential({
              credential: value,
              password: localPassword,
            });
        }
      }
    }
    if (data?.privateData && data?.privateData?.credentials) {
      data.privateData.credentials = {};
    }

    const privateData = stringUtils.stableStringify(data.privateData);

    const privateDataEncryptedBuffer = await encryptAsync({
      data: Buffer.from(privateData, 'utf8'),
      password: await this.buildFullBackupPassword({
        password: backupPassword,
      }),
      allowRawPassword: true,
    });

    const privateDataEncrypted = privateDataEncryptedBuffer.toString('base64');

    const result = await provider.backupData({
      privateDataEncrypted,
      publicData: data.publicData,
      isEmptyData: data.isEmptyData,
      isWatchingOnly: data.isWatchingOnly,
      appVersion: data.appVersion,
    });

    const { recordID, content } = result;
    const downloadData = await this.download({
      recordId: recordID,
    });
    if (!downloadData?.payload?.publicData?.walletDetails) {
      throw new OneKeyLocalError('Failed to backup data: no wallet details');
    }
    if (!downloadData?.payload?.privateDataEncrypted) {
      throw new OneKeyLocalError('Failed to backup data: no private data');
    }
    if (!downloadData?.content) {
      throw new OneKeyLocalError('Failed to backup data: no data downloaded');
    }
    if (downloadData?.content !== content) {
      throw new OneKeyLocalError('Failed to backup data: content mismatch');
    }
    return result;
  }

  @backgroundMethod()
  @toastIfError()
  async download(params: {
    recordId: string;
  }): Promise<IBackupCloudServerDownloadData | null> {
    const provider = this.getProvider();
    await provider.checkAvailability();
    return provider.downloadData(params);
  }

  @backgroundMethod()
  @toastIfError()
  async restore(params: {
    payload: IBackupDataEncryptedPayload | undefined;
    password: string;
  }) {
    if (!params?.password) {
      throw new OneKeyLocalError('Password is required for restore');
    }
    if (!params?.payload) {
      throw new OneKeyLocalError('Payload is required for restore');
    }
    const backupPassword = params?.password;

    // Decode and decrypt data
    const privateDataEncrypted: Buffer = Buffer.from(
      params.payload.privateDataEncrypted,
      'base64',
    );

    // Decrypt data
    const privateDataBuffer = await decryptAsync({
      data: privateDataEncrypted,
      password: await this.buildFullBackupPassword({
        password: backupPassword,
      }),
      allowRawPassword: true,
    });

    // Parse and return data
    const privateDataJSON = privateDataBuffer.toString('utf8');
    const privateData = JSON.parse(
      privateDataJSON,
    ) as IPrimeTransferPrivateData;

    const transferData: IPrimeTransferData = {
      ...params.payload,
      privateData,
    };
    const selectedTransferData =
      await this.backgroundApi.servicePrimeTransfer.getSelectedTransferData({
        data: transferData,
        selectedItemMap: 'ALL',
      });

    const firstWalletCredential =
      selectedTransferData?.wallets?.[0]?.credentialDecrypted;
    const firstImportedAccountCredential =
      selectedTransferData?.importedAccounts?.[0]?.credentialDecrypted;

    let localPassword = '';
    if (firstWalletCredential || firstImportedAccountCredential) {
      const { password } =
        await this.backgroundApi.servicePassword.promptPasswordVerify();
      localPassword = password;
    }

    try {
      await this.backgroundApi.servicePrimeTransfer.initImportProgress({
        selectedTransferData,
      });

      const { success, errorsInfo } =
        await this.backgroundApi.servicePrimeTransfer.startImport({
          selectedTransferData,
          includingDefaultNetworks: true,
          password: localPassword,
        });

      await this.backgroundApi.servicePrimeTransfer.completeImportProgress({
        errorsInfo,
      });

      // TODO: Implement the restore flow similar to ServicePrimeTransfer
      // This would involve:
      // 1. Getting the selected transfer data from transferData
      // 2. Prompting for password if needed (Google Drive)
      // 3. Calling servicePrimeTransfer.startImport() with the data
      // For now, just emit an event so the UI can handle it
      return {
        success,
        errorsInfo,
        transferData,
        selectedTransferData,
      };
    } catch (error) {
      await this.backgroundApi.servicePrimeTransfer.resetImportProgress();
      throw error;
    }
  }

  @backgroundMethod()
  @toastIfError()
  async delete(params: { recordId: string }): Promise<void> {
    const provider = this.getProvider();
    await provider.deleteBackup({
      recordId: params.recordId,
    });
  }

  @backgroundMethod()
  @toastIfError()
  async getAllBackups() {
    const provider = this.getProvider();
    return provider.getAllBackups();
  }

  @backgroundMethod()
  @toastIfError()
  async iOSQueryAllRecords() {
    const provider = this.getProvider();
    return (provider as ICloudBackupProvider).queryAllRecords();
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
