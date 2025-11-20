/* eslint-disable spellcheck/spell-checker */
import { cloneDeep } from 'lodash';

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
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IPrimeTransferData,
  IPrimeTransferPrivateData,
} from '@onekeyhq/shared/types/prime/primeTransferTypes';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import { cloudBackupStatusAtom } from '../../states/jotai/atoms/cloudBackup';
import ServiceBase from '../ServiceBase';

import { OneKeyBackupProvider } from './backupProviders/OneKeyBackupProvider';

import type { GoogleDriveBackupProvider } from './backupProviders/GoogleDriveBackupProvider';
import type { ICloudBackupProvider } from './backupProviders/ICloudBackupProvider';
import type {
  IBackupCloudServerDownloadData,
  IBackupDataEncryptedPayload,
  IBackupProviderInfo,
  IOneKeyBackupProvider,
} from './backupProviders/IOneKeyBackupProvider';
import type { ICloudBackupStatusAtom } from '../../states/jotai/atoms/cloudBackup';

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
    void this.init();
  }

  @backgroundMethod()
  async init(): Promise<void> {
    void this.initCloudBackupStatusAtom();
  }

  async initCloudBackupStatusAtom(): Promise<void> {
    const supportCloudBackup = await this.supportCloudBackup();
    if (supportCloudBackup) {
      const cloudBackupProviderInfo = await this.getBackupProviderInfo();
      const title = cloudBackupProviderInfo.displayNameI18nKey
        ? appLocale.intl.formatMessage({
            id: cloudBackupProviderInfo.displayNameI18nKey as any,
          })
        : cloudBackupProviderInfo.displayName;
      await cloudBackupStatusAtom.set(
        (): ICloudBackupStatusAtom => ({
          supportCloudBackup,
          cloudBackupProviderName: title,
          cloudBackupProviderIcon: 'CloudOutline',
          cloudBackupProviderInfo,
        }),
      );
    }
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
    if (
      platformEnv.isDesktop &&
      platformEnv.isDesktopMac &&
      platformEnv.isMas
    ) {
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
  async clearBackupPassword(): Promise<void> {
    const provider = this.getProvider();
    await provider.checkAvailability();
    await provider.clearBackupPassword();
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
    console.log('serviceCloudBackupV2__buildFullBackupPassword');
    const fullPassword = await this.buildFullBackupPassword({
      password: params.password,
    });
    console.log('serviceCloudBackupV2__verifyBackupPassword');
    const result = await provider.verifyBackupPassword({
      password: fullPassword,
    });
    console.log('serviceCloudBackupV2__verifyBackupPassword__result: ', result);
    return result;
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
    // eslint-disable-next-line no-param-reassign
    params = cloneDeep(params);
    console.log('serviceCloudBackupV2__backup');
    // throw new OneKeyLocalError('test error');
    if (!params?.password) {
      throw new OneKeyLocalError('Password is required for backup');
    }
    if (!params?.data?.privateData) {
      throw new OneKeyLocalError('Private data is required for backup');
    }
    const backupPassword: string = params?.password;
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
      console.log('serviceCloudBackupV2__decryptCredentials');
      for (const [key, value] of entries) {
        try {
          if (
            accountUtils.isHdWallet({ walletId: key }) ||
            accountUtils.isTonMnemonicCredentialId(key)
          ) {
            data.privateData.decryptedCredentials[key] =
              await decryptRevealableSeed({
                rs: value,
                password: localPassword,
              });
          } else if (accountUtils.isImportedAccount({ accountId: key })) {
            data.privateData.decryptedCredentials[key] =
              await decryptImportedCredential({
                credential: value,
                password: localPassword,
              });
          }
        } catch (error) {
          /*
          data not matched to encoding: hex
          key: "imported--607--e205f9...355fca5--v4R2--ton_credential"
          value: "|RP|17...918143"
          */
          console.error('serviceCloudBackupV2__decryptCredentials__error', {
            error,
            key,
            value: `${value?.slice(0, 10)}...${value?.slice(-6)}`,
          });
          throw new OneKeyLocalError(
            `Failed to decrypt current credentials: ${key}`,
          );
        }
      }
      console.log('serviceCloudBackupV2__decryptCredentials__done');
    }
    if (data?.privateData && data?.privateData?.credentials) {
      data.privateData.credentials = {};
    }

    console.log('serviceCloudBackupV2__stringify_privateData');
    const privateData = stringUtils.stableStringify(data.privateData);

    console.log('serviceCloudBackupV2__encryptPayload');
    const privateDataEncryptedBuffer = await encryptAsync({
      data: Buffer.from(privateData, 'utf8'),
      password: await this.buildFullBackupPassword({
        password: backupPassword,
      }),
      allowRawPassword: true,
    });

    console.log('serviceCloudBackupV2__toBase64');
    const privateDataEncrypted = privateDataEncryptedBuffer.toString('base64');

    console.log('serviceCloudBackupV2__backupData');
    const result = await provider.backupData({
      privateDataEncrypted,
      publicData: data.publicData,
      isEmptyData: data.isEmptyData,
      isWatchingOnly: data.isWatchingOnly,
      appVersion: data.appVersion,
    });

    const { recordID, content } = result;
    console.log('serviceCloudBackupV2__download');
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
      void this.deleteSilently({
        recordId: recordID,
        skipManifestUpdate: true,
      });
      throw new OneKeyLocalError('Failed to backup data: content mismatch');
    }

    await timerUtils.wait(2000);

    const allBackups = await this.getAllBackups();
    const matchedBackup = allBackups?.items?.find(
      (item) => item.recordID === recordID,
    );
    if (!matchedBackup) {
      void this.deleteSilently({
        recordId: recordID,
        skipManifestUpdate: true,
      });
      throw new OneKeyLocalError(
        appLocale.intl.formatMessage({
          id: ETranslations.backup_write_to_cloud_failed,
        }),
      );
    }

    await this.backgroundApi.serviceAccount.updateHdWalletsBackedUpStatusForCloudBackup(
      {
        publicData: data.publicData,
      },
    );
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
  async restorePreparePrivateData(params: {
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
    return privateData;
  }

  @backgroundMethod()
  @toastIfError()
  async restore(params: {
    payload: IBackupDataEncryptedPayload | undefined;
    password: string;
  }) {
    if (!params?.payload) {
      throw new OneKeyLocalError('Payload is required for restore');
    }
    const privateData = await this.restorePreparePrivateData({
      password: params.password,
      payload: params.payload,
    });

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
        isFromCloudBackupRestore: true,
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
  async delete(params: {
    recordId: string;
    skipPasswordVerify?: boolean;
    skipManifestUpdate?: boolean;
  }): Promise<void> {
    const provider = this.getProvider();
    if (!params?.skipPasswordVerify) {
      await this.backgroundApi.servicePassword.promptPasswordVerify({
        reason: EReasonForNeedPassword.Security,
      });
    }
    await provider.deleteBackup({
      recordId: params.recordId,
      skipManifestUpdate: params?.skipManifestUpdate,
    });
  }

  async deleteSilently(params: {
    recordId: string;
    skipManifestUpdate: boolean | undefined;
  }): Promise<void> {
    return this.delete({
      recordId: params.recordId,
      skipPasswordVerify: true,
      skipManifestUpdate: params?.skipManifestUpdate,
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
  @toastIfError()
  async androidListAllFiles() {
    const provider = this.getProvider();
    const result = await (provider as GoogleDriveBackupProvider).listAllFiles();

    return {
      result,
      count: result?.files?.length ?? 0,
    };
  }

  @backgroundMethod()
  @toastIfError()
  async androidGetManifestFileObject() {
    const provider = this.getProvider();
    return (provider as GoogleDriveBackupProvider).getManifestFileObject();
  }

  @backgroundMethod()
  @toastIfError()
  async androidGetManifest() {
    const provider = this.getProvider();
    return (provider as GoogleDriveBackupProvider).getManifest();
  }

  @backgroundMethod()
  @toastIfError()
  async androidGetLegacyMetaData() {
    return this.backgroundApi.serviceCloudBackup.downloadMetadataFile();
  }

  @backgroundMethod()
  @toastIfError()
  async androidRemoveManifestFile() {
    const provider = this.getProvider();
    return (provider as GoogleDriveBackupProvider).removeManifestFile();
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
