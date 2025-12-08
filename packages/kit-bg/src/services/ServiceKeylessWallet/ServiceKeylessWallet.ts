import { mnemonicToEntropy } from '@onekeyhq/core/src/secret';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { ICloudBackupKeylessWalletPayload } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import { ECloudBackupProviderType } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IAuthKeyPack,
  IAuthKeyPackEncryptedData,
  ICloudKeyPack,
  ICloudKeyPackEncryptedData,
  IDeviceKeyPack,
  IDeviceKeyPackEncryptedData,
  IKeylessMnemonicInfo,
  IKeylessWalletPacks,
  IKeylessWalletRestoredData,
  IKeylessWalletUserInfo,
} from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import keylessWalletUtils from '@onekeyhq/shared/src/keylessWallet/keylessWalletUtils';
import shamirUtils from '@onekeyhq/shared/src/keylessWallet/shamirUtils';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import type { IAvatarInfo } from '@onekeyhq/shared/src/utils/emojiUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EPrimeTransferDataType } from '@onekeyhq/shared/types/prime/primeTransferTypes';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import localDb from '../../dbs/local/localDb';
import { primePersistAtom } from '../../states/jotai/atoms';
import { devSettingsPersistAtom } from '../../states/jotai/atoms/devSettings';
import ServiceBase from '../ServiceBase';

import type { IDBIndexedAccount, IDBWallet } from '../../dbs/local/types';

@backgroundClass()
class ServiceKeylessWallet extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async buildKeylessWalletUserInfo(): Promise<IKeylessWalletUserInfo> {
    const primeUserInfo = await primePersistAtom.get();
    if (
      !primeUserInfo?.onekeyUserId ||
      !primeUserInfo?.isLoggedIn ||
      !primeUserInfo?.isLoggedInOnServer
    ) {
      throw new OneKeyLocalError('OneKeyID user is not logged in');
    }
    const onekeyIdUserId = primeUserInfo.onekeyUserId;
    const onekeyIdEmail = primeUserInfo.email;
    if (!onekeyIdEmail) {
      throw new OneKeyLocalError('OneKeyID email is not set');
    }
    if (!onekeyIdUserId) {
      throw new OneKeyLocalError('OneKeyID user ID is not set');
    }

    // Check if we should mock cloud backup info on web platform
    const devSettings = await devSettingsPersistAtom.get();
    const shouldMockCloudBackupOnWeb =
      devSettings.enabled &&
      devSettings.settings?.allowCreateKeylessWalletOnWeb;

    let cloudKeyProvider: ECloudBackupProviderType;
    let cloudKeyUserId: string;
    let cloudKeyUserEmail: string;

    if (shouldMockCloudBackupOnWeb) {
      // Mock cloud backup info for web platform
      cloudKeyProvider = ECloudBackupProviderType.GoogleDrive;
      cloudKeyUserId = `mock_web_user_${onekeyIdUserId}`;
      cloudKeyUserEmail = 'mock_email@sample.com';
    } else {
      const isSupportCloudBackup =
        await this.backgroundApi.serviceCloudBackupV2.supportCloudBackup();
      if (!isSupportCloudBackup) {
        throw new OneKeyLocalError(
          'Cloud backup is not supported on this device',
        );
      }

      const cloudAccountInfo =
        await this.backgroundApi.serviceCloudBackupV2.getCloudAccountInfo();
      cloudKeyProvider = cloudAccountInfo.providerType;
      cloudKeyUserId = cloudAccountInfo.userId;
      cloudKeyUserEmail = cloudAccountInfo.userEmail;
    }

    return {
      onekeyIdEmail,
      onekeyIdUserId,
      cloudKeyProvider,
      cloudKeyUserId,
      cloudKeyUserEmail,
    };
  }

  @backgroundMethod()
  async generateKeylessMnemonic(): Promise<IKeylessMnemonicInfo> {
    return keylessWalletUtils.generateKeylessMnemonic();
  }

  /**
   * Recover the missing Shamir share using GF(256) arithmetic.
   * Given the secret (entropy) and one share, compute any other share.
   *
   * Share format (shamir-secret-sharing library): [y-values (N bytes), x-coordinate (1 byte)]
   * Note: x-coordinate is at the END, not the beginning!
   *
   * Math: f(x) = secret + a1*x in GF(256) for threshold=2
   * Given secret and (x1, y1), compute a1 = (y1 - secret) / x1
   * Then compute y_missing = secret + a1 * x_missing
   */
  @backgroundMethod()
  async recoverMissingShare(params: {
    mnemonic: string;
    shareBase64: string;
    missingX: number;
  }): Promise<string> {
    const { shareBase64, mnemonic, missingX } = params;
    return shamirUtils.recoverMissingShare({
      entropyHex: mnemonicToEntropy(mnemonic),
      shareBase64,
      missingX,
    });
  }

  @backgroundMethod()
  async restoreMnemonicFromShareKey(params: {
    deviceKey?: string;
    authKey?: string;
    cloudKey?: string;
  }): Promise<{
    mnemonic: string;
    shares: string[];
  }> {
    return keylessWalletUtils.restoreMnemonicFromShareKey(params);
  }

  @backgroundMethod()
  @toastIfError()
  async generateKeylessWalletPacks(): Promise<IKeylessWalletPacks> {
    const userInfo = await this.buildKeylessWalletUserInfo();

    const mnemonicInfo = await keylessWalletUtils.generateKeylessMnemonic();

    const wallet = await keylessWalletUtils.generateKeylessWalletPacks({
      userInfo,
      mnemonicInfo,
      packSetId: keylessWalletUtils.generateKeylessWalletPackSetId(),
    });
    return wallet;
  }

  async restoreKeylessWalletMnemonic(_params: {
    walletId: string;
    password: string;
  }): Promise<{
    mnemonic: string;
  }> {
    const MOCKED_KEYLESS_MNEMONIC =
      'sketch boil bubble crazy yard thunder wrestle clutch episode roast unique quiz inform grain month spirit veteran solution nature layer notable mom second pet';

    return {
      mnemonic: MOCKED_KEYLESS_MNEMONIC,
    };
  }

  @backgroundMethod()
  @toastIfError()
  async createKeylessWallet({
    packSetId,
    name,
    avatarInfo,
  }: {
    packSetId: string;
    name?: string;
    avatarInfo?: IAvatarInfo;
  }): Promise<{
    wallet: IDBWallet;
    indexedAccount: IDBIndexedAccount | undefined;
  }> {
    const { servicePassword } = this.backgroundApi;
    const { password } = await servicePassword.promptPasswordVerify({
      reason: EReasonForNeedPassword.CreateOrRemoveWallet,
    });

    return localDb.createKeylessWallet({
      password,
      packSetId,
      name,
      avatar: avatarInfo,
    });
  }

  @backgroundMethod()
  @toastIfError()
  async restoreKeylessWallet(params: {
    deviceKeyPack?: IDeviceKeyPack;
    authKeyPack?: IAuthKeyPack;
    cloudKeyPack?: ICloudKeyPack;
  }): Promise<IKeylessWalletRestoredData> {
    const { deviceKeyPack, authKeyPack, cloudKeyPack } = params;

    if (!deviceKeyPack && !authKeyPack && !cloudKeyPack) {
      throw new OneKeyLocalError('No packs provided');
    }
    const checkPackSetId = (
      pack1: IDeviceKeyPack | IAuthKeyPack | ICloudKeyPack,
      pack2: IDeviceKeyPack | IAuthKeyPack | ICloudKeyPack,
    ) => {
      if (pack1.packSetId !== pack2.packSetId) {
        throw new OneKeyLocalError('Pack set id does not match');
      }
    };

    // Recover mnemonic from any 2 of 3 packs
    if (deviceKeyPack && authKeyPack) {
      checkPackSetId(deviceKeyPack, authKeyPack);

      return keylessWalletUtils.restoreFromDeviceAndAuth({
        deviceKeyPack,
        authKeyPack,
      });
    }
    if (deviceKeyPack && cloudKeyPack) {
      checkPackSetId(deviceKeyPack, cloudKeyPack);

      return keylessWalletUtils.restoreFromDeviceAndCloud({
        deviceKeyPack,
        cloudKeyPack,
      });
    }
    if (authKeyPack && cloudKeyPack) {
      checkPackSetId(authKeyPack, cloudKeyPack);
      // const cloudAccountInfo =
      //   await this.backgroundApi.serviceCloudBackupV2.getCloudAccountInfo();
      // const cloudKeyUserId = cloudAccountInfo.userId;
      return keylessWalletUtils.restoreFromAuthAndCloud({
        authKeyPack,
        cloudKeyPack,
      });
    }

    throw new OneKeyLocalError(
      'Need at least 2 packs to restore keyless wallet',
    );
  }

  @backgroundMethod()
  public async enableKeylessWallet(params: {
    deviceKeyPack: IDeviceKeyPack;
    authKeyPack: IAuthKeyPack;
    cloudKeyPack: ICloudKeyPack;
  }) {
    // 1. Save DeviceKeyPack to local storage
    // 2. Upload AuthKeyPack to server (Auth Service)
    // 3. Upload CloudKeyPack to cloud storage (iCloud/Google Drive)
    const { deviceKeyPack, authKeyPack, cloudKeyPack } = params;
    console.log(
      'enableKeylessWallet',
      deviceKeyPack,
      authKeyPack,
      cloudKeyPack,
    );
  }

  @backgroundMethod()
  @toastIfError()
  async backupCloudKeyPack(params: {
    payload: ICloudBackupKeylessWalletPayload;
    allowDuplicate?: boolean;
  }): Promise<{ recordID: string; content: string; meta: string }> {
    console.log('serviceKeylessWallet__backupCloudKeyPack');
    const { payload, allowDuplicate = true } = params;

    if (!payload?.cloudKeyPack) {
      throw new OneKeyLocalError('CloudKeyPack is required for backup');
    }
    if (!payload?.cloudKeyPack?.packSetId) {
      throw new OneKeyLocalError('packSetId is required for backup');
    }

    await this.backgroundApi.serviceCloudBackupV2.checkAvailability();

    // Check if backup already exists when duplicate is not allowed
    if (!allowDuplicate) {
      const existingBackup =
        await this.backgroundApi.serviceCloudBackupV2.getKeylessWalletBackupRecordID(
          {
            packSetId: payload.cloudKeyPack.packSetId,
          },
        );
      if (existingBackup?.recordID) {
        throw new OneKeyLocalError(
          `Backup already exists for packSetId: ${payload.cloudKeyPack.packSetId}`,
        );
      }
    }

    console.log('serviceKeylessWallet__backupCloudKeyPackData');
    const result =
      await this.backgroundApi.serviceCloudBackupV2.backupKeylessWalletData(
        payload,
      );

    const { recordID, content } = result;

    // Wait for cloud sync
    await timerUtils.wait(2000);

    // Verify backup was saved successfully by downloading it
    console.log('serviceKeylessWallet__downloadCloudKeyPack');
    const downloadData =
      await this.backgroundApi.serviceCloudBackupV2.downloadKeylessWallet({
        recordID,
      });

    if (!downloadData?.payload?.cloudKeyPack) {
      throw new OneKeyLocalError(
        'Failed to backup keyless wallet: no cloudKeyPack found',
      );
    }
    if (!downloadData?.content) {
      throw new OneKeyLocalError(
        'Failed to backup keyless wallet: no data downloaded',
      );
    }
    if (downloadData?.content !== content) {
      await this.backgroundApi.serviceCloudBackupV2.delete({
        recordId: recordID,
        skipPasswordVerify: true,
        skipManifestUpdate: true,
      });
      throw new OneKeyLocalError(
        'Failed to backup keyless wallet: content mismatch',
      );
    }

    // Verify backup exists in manifest
    const keylessWalletBackup =
      await this.backgroundApi.serviceCloudBackupV2.getKeylessWalletBackupRecordID(
        {
          packSetId: payload.cloudKeyPack.packSetId,
        },
      );
    if (!keylessWalletBackup?.recordID) {
      await this.backgroundApi.serviceCloudBackupV2.delete({
        recordId: recordID,
        skipPasswordVerify: true,
        skipManifestUpdate: true,
      });
      throw new OneKeyLocalError(
        appLocale.intl.formatMessage({
          id: ETranslations.backup_write_to_cloud_failed,
        }),
      );
    }

    console.log('serviceKeylessWallet__backupCloudKeyPack__success');
    return result;
  }

  @backgroundMethod()
  @toastIfError()
  async restoreCloudKeyPack(params: {
    packSetId: string;
  }): Promise<ICloudBackupKeylessWalletPayload> {
    await this.backgroundApi.serviceCloudBackupV2.checkAvailability();
    const recordIDResult =
      await this.backgroundApi.serviceCloudBackupV2.getKeylessWalletBackupRecordID(
        {
          packSetId: params.packSetId,
        },
      );
    if (!recordIDResult?.recordID) {
      throw new OneKeyLocalError(
        'Failed to restore keyless wallet: no recordID found',
      );
    }
    const downloadData =
      await this.backgroundApi.serviceCloudBackupV2.downloadKeylessWallet({
        recordID: recordIDResult.recordID,
      });
    if (!downloadData?.payload?.cloudKeyPack) {
      throw new OneKeyLocalError(
        'Failed to restore keyless wallet: no cloudKeyPack found',
      );
    }
    return downloadData?.payload;
  }

  // Device-to-device transfer methods

  /**
   * Get navigation params for sending deviceKeyPack to another device.
   * The caller should:
   * 1. Store deviceKeyPack to globalThis.$pendingDeviceKeyPackForTransfer
   * 2. Navigate to PrimeTransfer with the returned params
   */
  @backgroundMethod()
  async sendDeviceKeyPack(): Promise<{
    transferType: EPrimeTransferDataType;
  }> {
    return {
      transferType: EPrimeTransferDataType.keylessWallet,
    };
  }

  /**
   * Get navigation params for receiving deviceKeyPack from another device.
   * This will display QR code for the sender to scan.
   */
  @backgroundMethod()
  async receiveDeviceKeyPack(): Promise<{
    transferType: EPrimeTransferDataType;
  }> {
    return {
      transferType: EPrimeTransferDataType.keylessWallet,
    };
  }
}

export default ServiceKeylessWallet;
