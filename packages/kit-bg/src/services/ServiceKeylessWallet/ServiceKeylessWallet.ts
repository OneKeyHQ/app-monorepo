import { isEqual } from 'lodash';

import { mnemonicToEntropy } from '@onekeyhq/core/src/secret';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { ICloudBackupKeylessWalletPayload } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import { ECloudBackupProviderType } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import type {
  IAuthKeyPack,
  ICloudKeyPack,
  IDeviceKeyPack,
  IKeylessMnemonicInfo,
  IKeylessWalletPacks,
  IKeylessWalletRestoredData,
  IKeylessWalletUserInfo,
} from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import keylessWalletUtils from '@onekeyhq/shared/src/keylessWallet/keylessWalletUtils';
import shamirUtils from '@onekeyhq/shared/src/keylessWallet/shamirUtils';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IAvatarInfo } from '@onekeyhq/shared/src/utils/emojiUtils';
import { findMismatchedPaths } from '@onekeyhq/shared/src/utils/miscUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';
import { EPrimeTransferDataType } from '@onekeyhq/shared/types/prime/primeTransferTypes';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';

import localDb from '../../dbs/local/localDb';
import { keylessDialogAtom, primePersistAtom } from '../../states/jotai/atoms';
import { devSettingsPersistAtom } from '../../states/jotai/atoms/devSettings';
import ServiceBase from '../ServiceBase';

import keylessAuthPackCache from './utils/keylessAuthPackCache';
import keylessDeviceKeyStorage from './utils/keylessDeviceKeyStorage';

import type { IDBIndexedAccount, IDBWallet } from '../../dbs/local/types';
import type { IKeylessDialogAtomData } from '../../states/jotai/atoms';

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

  @backgroundMethod()
  @toastIfError()
  async revealKeylessWalletMnemonic(_params: {
    walletId: string;
    password: string;
  }): Promise<{
    mnemonic: string;
  }> {
    const result = await this.enableKeylessWalletSilently({
      restoreAuthPackFromServer: true,
    });
    if (!result?.packs?.mnemonic) {
      // TODO i18n @franco 无法启用无私钥钱包
      throw new OneKeyLocalError('核验身份失败，无法启用您的无私钥钱包');
    }
    return {
      mnemonic: result.packs.mnemonic,
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
    const { password } = await servicePassword.promptPasswordVerify();

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
  async restoreKeylessWalletSafe(params: {
    deviceKeyPack?: IDeviceKeyPack;
    authKeyPack?: IAuthKeyPack;
    cloudKeyPack?: ICloudKeyPack;
  }): Promise<IKeylessWalletRestoredData | undefined> {
    try {
      return await this.restoreKeylessWallet(params);
    } catch (error) {
      return undefined;
    }
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

  /**
   * Save device pack to local storage with passcode encryption.
   * Unified method for creating, enabling, and manual recovery flows.
   */
  @backgroundMethod()
  async saveDevicePackToStorage(params: {
    devicePack: IDeviceKeyPack;
  }): Promise<{ success: boolean; packSetIdFromDevicePack: string }> {
    await keylessDeviceKeyStorage.saveDevicePackToStorage({
      ...params,
      backgroundApi: this.backgroundApi,
    });
    await timerUtils.wait(1000);

    const savedDevicePack =
      await keylessDeviceKeyStorage.getDevicePackFromStorage({
        packSetId: params.devicePack.packSetId,
        backgroundApi: this.backgroundApi,
      });
    if (!savedDevicePack?.encrypted) {
      throw new OneKeyLocalError('Failed to save device pack to storage');
    }
    if (!isEqual(savedDevicePack, params.devicePack)) {
      if (process.env.NODE_ENV !== 'production') {
        // Print mismatched fields
        const mismatchedPaths = findMismatchedPaths(
          savedDevicePack,
          params.devicePack,
        );
        console.error(
          '[ServiceKeylessWallet] Device pack mismatch detected:',
          JSON.stringify(mismatchedPaths, null, 2),
        );
        console.error(
          '[ServiceKeylessWallet] Saved device pack:',
          JSON.stringify(savedDevicePack, null, 2),
        );
        console.error(
          '[ServiceKeylessWallet] Expected device pack:',
          JSON.stringify(params.devicePack, null, 2),
        );
      }
      throw new OneKeyLocalError(
        'Failed to save device pack to storage, mismatched fields',
      );
    }
    return {
      success: true,
      packSetIdFromDevicePack: savedDevicePack.packSetId,
    };
  }

  /**
   * Get device pack from local storage and decrypt it.
   */
  @backgroundMethod()
  async getDevicePackFromStorage(params: {
    packSetId: string;
  }): Promise<IDeviceKeyPack | null> {
    return keylessDeviceKeyStorage.getDevicePackFromStorage({
      ...params,
      backgroundApi: this.backgroundApi,
    });
  }

  /**
   * Cache authPack in memory with encryption.
   * Uses sensitiveEncodeKey + session passcode as encryption key.
   * Avoids any disk persistence to reduce security risk.
   */
  @backgroundMethod()
  async cacheAuthPackInMemory(params: { authPack: IAuthKeyPack }) {
    return keylessAuthPackCache.cacheAuthPackInMemory({
      ...params,
      backgroundApi: this.backgroundApi,
    });
  }

  /**
   * Get authPack from memory cache and decrypt it.
   * Returns null if cache miss.
   */
  @backgroundMethod()
  async getAuthPackFromCache(params: {
    packSetId: string;
  }): Promise<IAuthKeyPack | null> {
    return keylessAuthPackCache.getAuthPackFromCache({
      ...params,
      backgroundApi: this.backgroundApi,
    });
  }

  @backgroundMethod()
  async getKeylessAuthPackFromCacheSafe(): Promise<IAuthKeyPack | null> {
    try {
      const user = await primePersistAtom.get();
      const packSetId = user?.keylessWalletId;
      if (!packSetId) {
        return null;
      }
      return await this.getAuthPackFromCache({ packSetId });
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear authPack cache for a specific packSetId or all caches.
   * Should be called when user logs out or switches accounts.
   */
  @backgroundMethod()
  async clearAuthPackCache(params?: { packSetId?: string }): Promise<void> {
    return keylessAuthPackCache.clearAuthPackCache(params);
  }

  /**
   * Get device pack from local storage.
   * Returns null if not found.
   */
  @backgroundMethod()
  async getKeylessDevicePack(params: {
    packSetId: string;
  }): Promise<IDeviceKeyPack | null> {
    return this.getDevicePackFromStorage(params);
  }

  @backgroundMethod()
  async getKeylessDevicePackSafe(): Promise<IDeviceKeyPack | null> {
    try {
      const user = await primePersistAtom.get();
      const packSetId = user?.keylessWalletId;
      if (!packSetId) {
        return null;
      }
      return await this.getKeylessDevicePack({ packSetId });
    } catch (error) {
      return null;
    }
  }

  /**
   * Remove device pack from local storage.
   * Requires allowDeleteKeylessKey setting to be enabled.
   */
  @backgroundMethod()
  async removeDevicePackFromStorage(params: {
    packSetId: string;
  }): Promise<void> {
    // Check if deletion is allowed
    const devSettings = await devSettingsPersistAtom.get();
    const isDeletionAllowed =
      devSettings.enabled && devSettings.settings?.allowDeleteKeylessKey;
    if (!isDeletionAllowed) {
      throw new OneKeyLocalError(
        'Deletion of keyless key is not allowed. Please enable the setting in dev settings.',
      );
    }

    await keylessDeviceKeyStorage.removeDevicePackFromStorage({
      packSetId: params.packSetId,
    });
  }

  /**
   * Remove auth pack from cache.
   * Requires allowDeleteKeylessKey setting to be enabled.
   */
  @backgroundMethod()
  async removeAuthPackFromCache(params?: {
    packSetId?: string;
  }): Promise<void> {
    // Check if deletion is allowed
    const devSettings = await devSettingsPersistAtom.get();
    const isDeletionAllowed =
      devSettings.enabled && devSettings.settings?.allowDeleteKeylessKey;
    if (!isDeletionAllowed) {
      throw new OneKeyLocalError(
        'Deletion of keyless key is not allowed. Please enable the setting in dev settings.',
      );
    }

    await keylessAuthPackCache.clearAuthPackCache(params);
  }

  /**
   * Remove keyless wallet.
   * Requires allowDeleteKeylessKey setting to be enabled.
   */
  @backgroundMethod()
  async removeKeylessWallet(params: { packSetId: string }): Promise<void> {
    // Check if deletion is allowed
    const devSettings = await devSettingsPersistAtom.get();
    const isDeletionAllowed =
      devSettings.enabled && devSettings.settings?.allowDeleteKeylessKey;
    if (!isDeletionAllowed) {
      throw new OneKeyLocalError(
        'Deletion of keyless key is not allowed. Please enable the setting in dev settings.',
      );
    }

    const walletId = accountUtils.buildKeylessWalletId({
      sharePackSetId: params.packSetId,
    });

    await this.backgroundApi.serviceAccount.removeWallet({
      walletId,
    });
  }

  @backgroundMethod()
  async promptKeylessAuthPackDialog(): Promise<IAuthKeyPack | null> {
    const authPack = await new Promise<IAuthKeyPack | null>(
      // eslint-disable-next-line no-async-promise-executor
      async (resolve, reject) => {
        const promiseId = this.backgroundApi.servicePromise.createCallback({
          resolve,
          reject,
        });
        await keylessDialogAtom.set((v: IKeylessDialogAtomData) => ({
          ...v,
          promptKeylessAuthPackDialog: promiseId,
        }));
      },
    );
    return authPack;
  }

  @backgroundMethod()
  @toastIfError()
  async resolveKeylessAuthPackDialog({
    promiseId,
    authPack,
  }: {
    promiseId: number;
    authPack: IAuthKeyPack;
  }) {
    await keylessDialogAtom.set((v: IKeylessDialogAtomData) => ({
      ...v,
      promptKeylessAuthPackDialog: undefined,
    }));
    await this.backgroundApi.servicePromise.resolveCallback({
      id: promiseId,
      data: authPack,
    });
  }

  @backgroundMethod()
  async rejectKeylessAuthPackDialog({
    promiseId,
    error,
  }: {
    promiseId: number;
    error: IOneKeyError;
  }) {
    await keylessDialogAtom.set((v: IKeylessDialogAtomData) => ({
      ...v,
      promptKeylessAuthPackDialog: undefined,
    }));
    return this.backgroundApi.servicePromise.rejectCallback({
      id: promiseId,
      error,
    });
  }

  @backgroundMethod()
  async getKeylessAuthPackSafe({
    restoreAuthPackFromServer,
  }: {
    restoreAuthPackFromServer: boolean | undefined;
  }): Promise<IAuthKeyPack | null> {
    try {
      const user = await primePersistAtom.get();
      const packSetId = user?.keylessWalletId;
      if (!packSetId) {
        return null;
      }

      try {
        const cachedAuthPack = await this.getAuthPackFromCache({ packSetId });
        if (cachedAuthPack) {
          return cachedAuthPack;
        }
      } catch (error) {
        console.error('getKeylessAuthPackSafe ERROR', error);
      }

      // Only restore from server if restoreAuthPackFromServer is true
      if (restoreAuthPackFromServer) {
        try {
          const authPack = await this.promptKeylessAuthPackDialog();
          if (authPack) {
            // Cache the authPack in memory
            await this.cacheAuthPackInMemory({ authPack });
            return authPack;
          }
        } catch (error) {
          // User cancelled or error occurred, return null
          return null;
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get auth pack from server with OTP verification.
   * This method should be called when getKeylessAuthPack returns null.
   * The caller should:
   * 1. Call servicePrime.sendEmailOTP(EPrimeEmailOTPScene.GetKeylessWalletAuthPack) to send OTP
   * 2. Show EmailOTPDialog to user for code input (via useOneKeyAuth().sendEmailOTP)
   * 3. Call this method with the OTP code and uuid
   * 4. The returned authPack will be automatically cached in memory
   */
  @backgroundMethod()
  @toastIfError()
  async getAuthPackFromServerWithOTP(params: {
    packSetId: string;
    emailOTP: string;
    uuid: string;
  }): Promise<IAuthKeyPack> {
    const { packSetId, emailOTP, uuid } = params;

    if (!packSetId) {
      throw new OneKeyLocalError('Pack set id is required');
    }

    // Verify user is logged in
    const primeUserInfo = await primePersistAtom.get();
    if (
      !primeUserInfo?.onekeyUserId ||
      !primeUserInfo?.isLoggedIn ||
      !primeUserInfo?.isLoggedInOnServer
    ) {
      throw new OneKeyLocalError('OneKeyID user is not logged in');
    }

    // Call server API to get authPack with OTP verification
    const client = await this.backgroundApi.servicePrime.getOneKeyIdClient(
      EServiceEndpointEnum.Prime,
    );
    const result = await client.post<IApiClientResponse<string>>(
      '/prime/v1/user/getKeylessAuthShare',
      {
        uuid,
        emailOTP,
        keylessWalletId: packSetId,
      },
    );

    const authPackString = result?.data?.data;
    if (!authPackString) {
      throw new OneKeyLocalError('Failed to get authPack from server');
    }
    let authPack: IAuthKeyPack;
    try {
      authPack = JSON.parse(authPackString) as IAuthKeyPack;
    } catch (error) {
      throw new OneKeyLocalError('Failed to parse authPack from server');
    }

    // Verify packSetId matches
    if (authPack?.packSetId !== packSetId) {
      throw new OneKeyLocalError('Pack set id does not match');
    }

    // Cache the authPack in memory
    await this.cacheAuthPackInMemory({ authPack });

    return authPack;
  }

  /**
   * Upload auth pack to server with OTP verification.
   * This method should be called during keyless wallet creation.
   * The caller should:
   * 1. Call servicePrime.sendEmailOTP(EPrimeEmailOTPScene.GetKeylessWalletAuthPack) to send OTP
   * 2. Show EmailOTPDialog to user for code input (via useOneKeyAuth().sendEmailOTP)
   * 3. Call this method with the OTP code and uuid
   * 4. The authPack will be uploaded to server and cached in memory
   */
  @backgroundMethod()
  @toastIfError()
  async uploadAuthPackToServerWithOTP(params: {
    authPack: IAuthKeyPack;
    emailOTP: string;
    uuid: string;
  }): Promise<{
    success: boolean;
  }> {
    const { authPack, emailOTP, uuid } = params;
    const packSetId = authPack.packSetId;

    if (!packSetId) {
      throw new OneKeyLocalError('Pack set id is required');
    }

    // Verify user is logged in
    const primeUserInfo = await primePersistAtom.get();
    if (
      !primeUserInfo?.onekeyUserId ||
      !primeUserInfo?.isLoggedIn ||
      !primeUserInfo?.isLoggedInOnServer
    ) {
      throw new OneKeyLocalError('OneKeyID user is not logged in');
    }

    // Serialize authPack to JSON string
    const authPackString = stringUtils.stableStringify(authPack);

    // Call server API to upload authPack with OTP verification
    const client = await this.backgroundApi.servicePrime.getOneKeyIdClient(
      EServiceEndpointEnum.Prime,
    );

    const result = await client.post<
      IApiClientResponse<{
        ok: boolean;
      }>
    >('/prime/v1/user/createKeylessAuthShare', {
      uuid,
      emailOTP,
      keylessWalletId: packSetId,
      keylessAuthShare: authPackString,
    });

    const responseData = result?.data?.data;

    const success = responseData?.ok;
    if (!success) {
      throw new OneKeyLocalError('Failed to upload authPack to server');
    }

    // Cache the authPack in memory after successful upload
    await this.cacheAuthPackInMemory({ authPack });

    await this.backgroundApi.servicePrime.apiFetchPrimeUserInfo();

    return {
      success,
    };
  }

  // deleteAuthPackFromServer
  @backgroundMethod()
  @toastIfError()
  async deleteAuthPackFromServer() {
    // Check if deletion is allowed
    const devSettings = await devSettingsPersistAtom.get();
    const isDeletionAllowed =
      devSettings.enabled && devSettings.settings?.allowDeleteKeylessKey;
    if (!isDeletionAllowed) {
      throw new OneKeyLocalError(
        'Deletion of keyless key is not allowed. Please enable the setting in dev settings.',
      );
    }

    // Call server API to delete authPack
    const client = await this.backgroundApi.servicePrime.getOneKeyIdClient(
      EServiceEndpointEnum.Prime,
    );
    const result = await client.post<
      IApiClientResponse<{
        ok: boolean;
      }>
    >(`/prime/v1/user/resetKeylessAuthShare`, {});
    return result.data.data;
  }

  /**
   * Get cloud pack from cloud backup.
   * Returns null if not found or cloud backup is not available.
   */
  @backgroundMethod()
  async getKeylessCloudPack(params: {
    packSetId: string;
  }): Promise<ICloudKeyPack> {
    const { packSetId } = params;

    // TODO login cloud drive
    try {
      const isSupportCloudBackup =
        await this.backgroundApi.serviceCloudBackupV2.supportCloudBackup();
      if (!isSupportCloudBackup) {
        throw new OneKeyLocalError(
          'Cloud backup is not supported on this device',
        );
      }

      const cloudPayload = await this.restoreCloudKeyPack({ packSetId });
      if (!cloudPayload?.cloudKeyPack) {
        throw new OneKeyLocalError(
          'Failed to get keyless cloud pack from cloud backup, no cloudKeyPack found',
        );
      }
      return cloudPayload?.cloudKeyPack;
    } catch (error) {
      throw new OneKeyLocalError(
        `Failed to get keyless cloud pack from cloud backup: ${
          (error as Error)?.message
        }`,
      );
    }
  }

  @backgroundMethod()
  async getKeylessCloudPackSafe({
    cloudKeyProvider,
  }: {
    cloudKeyProvider: ECloudBackupProviderType;
  }) {
    try {
      const user = await primePersistAtom.get();
      const packSetId = user?.keylessWalletId;
      if (!packSetId) {
        return undefined;
      }
      const isSupportCloudBackup =
        await this.backgroundApi.serviceCloudBackupV2.supportCloudBackup();
      if (!isSupportCloudBackup) {
        return undefined;
      }
      const cloudAccount =
        await this.backgroundApi.serviceCloudBackupV2.getCloudAccountInfo();
      if (
        cloudAccount &&
        cloudAccount.userId &&
        cloudKeyProvider === cloudAccount.providerType
      ) {
        const cloudPack = await this.getKeylessCloudPack({ packSetId });
        return cloudPack;
      }
      return undefined;
    } catch (error) {
      return undefined;
    }
  }

  @backgroundMethod()
  async enableKeylessWalletSilently({
    restoreAuthPackFromServer,
  }: {
    restoreAuthPackFromServer?: boolean;
  } = {}) {
    const deviceKeyPack = await this.getKeylessDevicePackSafe();
    let authKeyPack = await this.getKeylessAuthPackFromCacheSafe();
    let cloudKeyPack: ICloudKeyPack | undefined;
    if (deviceKeyPack && authKeyPack) {
      void (deviceKeyPack && authKeyPack);
      const restoredPacks = await this.restoreKeylessWalletSafe({
        deviceKeyPack,
        authKeyPack,
      });
      return restoredPacks;
    }
    if (!deviceKeyPack) {
      if (!authKeyPack) {
        void (!deviceKeyPack && !authKeyPack);
        authKeyPack = await this.getKeylessAuthPackSafe({
          restoreAuthPackFromServer,
        });
      } else {
        void (!deviceKeyPack && authKeyPack);
        // do nothing
      }
      if (authKeyPack?.cloudKeyProvider) {
        cloudKeyPack = await this.getKeylessCloudPackSafe({
          cloudKeyProvider: authKeyPack?.cloudKeyProvider,
        });
      }

      if (authKeyPack && cloudKeyPack) {
        const restoredPacks = await this.restoreKeylessWalletSafe({
          authKeyPack,
          cloudKeyPack,
        });
        if (restoredPacks?.packs?.deviceKeyPack) {
          const { success } = await this.saveDevicePackToStorage({
            devicePack: restoredPacks?.packs?.deviceKeyPack,
          });
          if (success) {
            return restoredPacks;
          }
        }
      }
    }
    if (!authKeyPack) {
      if (deviceKeyPack) {
        void (deviceKeyPack && !authKeyPack);
        cloudKeyPack = await this.getKeylessCloudPackSafe({
          cloudKeyProvider: deviceKeyPack.cloudKeyProvider,
        });
        if (!cloudKeyPack) {
          authKeyPack = await this.getKeylessAuthPackSafe({
            restoreAuthPackFromServer,
          });
        }
        const restoredPacks = await this.restoreKeylessWalletSafe({
          authKeyPack: authKeyPack || undefined,
          cloudKeyPack: cloudKeyPack || undefined,
          deviceKeyPack: deviceKeyPack || undefined,
        });
        if (restoredPacks?.packs?.authKeyPack) {
          const { success } = await this.cacheAuthPackInMemory({
            authPack: restoredPacks?.packs?.authKeyPack,
          });
          if (success) {
            return restoredPacks;
          }
        }
      }
      void (!deviceKeyPack && !authKeyPack);
      // do nothing
    }
  }
}

export default ServiceKeylessWallet;
