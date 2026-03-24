import { Semaphore } from 'async-mutex';
import { isEqual } from 'lodash';

import {
  decryptRevealableSeed,
  decryptStringAsync,
  encryptStringAsync,
  generateMnemonic,
  mnemonicToEntropy,
  revealEntropyToMnemonic,
} from '@onekeyhq/core/src/secret';
import appCrypto from '@onekeyhq/shared/src/appCrypto';
import { EAppCryptoAesEncryptionMode } from '@onekeyhq/shared/src/appCrypto/consts';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import type { ICloudBackupKeylessWalletPayload } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import { ECloudBackupProviderType } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';
import {
  EOAuthSocialLoginProvider,
  KEYLESS_BACKEND_SHARE_PAYLOAD_ENCRYPTION_KEY,
  KEYLESS_BACKEND_SHARE_PAYLOAD_ENCRYPTION_PREFIX,
  KEYLESS_BACKEND_SHARE_PAYLOAD_GCM_AAD,
  KEYLESS_ENCRYPTION_ITERATIONS,
  KEYLESS_MNEMONIC_GCM_AAD,
  KEYLESS_SUPABASE_PROJECT_URL,
  KEYLESS_SUPABASE_PUBLIC_API_KEY,
} from '@onekeyhq/shared/src/consts/authConsts';
import {
  IncorrectPinError,
  KeylessDataCorruptedError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import {
  EOneKeyErrorClassNames,
  type IOneKeyError,
} from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import type {
  IAuthKeyPack,
  ICloudKeyPack,
  IDeviceKeyPack,
  IKeylessBackendShare,
  IKeylessJuiceboxShare,
  IKeylessMnemonicInfo,
  IKeylessWalletPacks,
  IKeylessWalletRestoredData,
  IKeylessWalletUserInfo,
  ISupabaseJWTPayload,
} from '@onekeyhq/shared/src/keylessWallet/keylessWalletTypes';
import keylessWalletUtils from '@onekeyhq/shared/src/keylessWallet/keylessWalletUtils';
import shamirUtils from '@onekeyhq/shared/src/keylessWallet/shamirUtils';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EOnboardingV2OneKeyIDLoginMode } from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';
import type { IAvatarInfo } from '@onekeyhq/shared/src/utils/emojiUtils';
import { findMismatchedPaths } from '@onekeyhq/shared/src/utils/miscUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IApiClientResponse } from '@onekeyhq/shared/types/endpoint';
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import { EPrimeTransferDataType } from '@onekeyhq/shared/types/prime/primeTransferTypes';

import localDb from '../../dbs/local/localDb';
import {
  keylessDialogAtom,
  keylessPinConfirmStatusAtom,
  primePersistAtom,
} from '../../states/jotai/atoms';
import { devSettingsPersistAtom } from '../../states/jotai/atoms/devSettings';
import ServiceBase from '../ServiceBase';

import keylessAuthPackCache from './utils/keylessAuthPackCache';
import keylessDeviceKeyStorage from './utils/keylessDeviceKeyStorage';
import keylessMnemonicPasswordStorage from './utils/keylessMnemonicPasswordStorage';
import keylessRefreshTokenStorage from './utils/keylessRefreshTokenStorage';

import type { JuiceboxClient } from './utils/JuiceboxClient';
import type {
  IDBIndexedAccount,
  IDBWallet,
  IKeylessWalletDetailsInfo,
} from '../../dbs/local/types';
import type { IKeylessDialogAtomData } from '../../states/jotai/atoms';

const juiceboxClientCache = new cacheUtils.LRUCache<string, JuiceboxClient>({
  max: 100,
  ttl: timerUtils.getTimeDurationMs({ minute: 8 }),
  ttlAutopurge: true,
  dispose: (client) => {
    // Best-effort cleanup: clear any cached realm tokens when the client is evicted.
    try {
      client.dispose();
    } catch {
      // ignore
    }
  },
});
@backgroundClass()
class ServiceKeylessWallet extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  updatePinConfirmStatusMutex = new Semaphore(1);

  private async getJuiceboxClientFromCache(
    token: string,
  ): Promise<JuiceboxClient> {
    let client = juiceboxClientCache.get(token);
    if (!client) {
      juiceboxClientCache.clear();
      const { JuiceboxClient: JuiceboxClientRuntime } =
        await import('./utils/JuiceboxClient');
      client = new JuiceboxClientRuntime();
      await client.exchangeToken(token);
      juiceboxClientCache.set(token, client);
    }
    // Juicebox SDK uses a global callback for auth token retrieval.
    // Re-bind it to the current instance to avoid being overwritten by other instances.
    // client.setAsGlobalAuthTokenProvider();
    return client;
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
    const shouldMockCloudBackupOnWeb = false;

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
  async generateKeylessMnemonic(params?: {
    customMnemonic?: string;
  }): Promise<IKeylessMnemonicInfo> {
    return keylessWalletUtils.generateKeylessMnemonic(params);
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

  /**
   * Recover missing share using mnemonicPassword (base64) as the secret.
   * This is used for Reset PIN flow where we have:
   * - mnemonicPassword (stored locally)
   * - backendShare (from server)
   * And we need to recover juiceboxShare to upload with new PIN.
   */
  @backgroundMethod()
  async recoverMissingShareFromSecret(params: {
    secretBase64: string; // mnemonicPassword
    shareBase64: string; // backendShare
    missingX: number; // x-coordinate of juiceboxShare
  }): Promise<string> {
    const { secretBase64, shareBase64, missingX } = params;
    return shamirUtils.recoverMissingShareFromSecret({
      secretBase64,
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
  async generateKeylessWalletPacks(params?: {
    customMnemonic?: string;
  }): Promise<IKeylessWalletPacks> {
    const userInfo = await this.buildKeylessWalletUserInfo();

    const mnemonicInfo = await keylessWalletUtils.generateKeylessMnemonic({
      customMnemonic: params?.customMnemonic,
    });

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
    if (await this.backgroundApi.serviceAccount.getKeylessWallet()) {
      throw new OneKeyLocalError('Keyless wallet already exists');
    }
    const { servicePassword } = this.backgroundApi;
    const { password } = await servicePassword.promptPasswordVerify();

    const result = await localDb.createKeylessWallet({
      password,
      packSetId,
      name,
      avatar: avatarInfo,
    });
    await this.backgroundApi.servicePrimeCloudSync.clearCachedSyncCredential();
    await this.backgroundApi.serviceKeylessCloudSync.setPersistedCurrentCloudSyncKeylessWalletId(
      result.wallet.id,
    );
    void this.backgroundApi.servicePrimeCloudSync
      .syncNowKeyless({
        callerName: 'Create Keyless Wallet',
        noDebounceUpload: true,
        password,
      })
      .catch((error) => {
        errorUtils.autoPrintErrorIgnore(error);
      });
    return result;
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
    } catch (_error) {
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
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        'enableKeylessWallet',
        deviceKeyPack,
        authKeyPack,
        cloudKeyPack,
      );
    }
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
        if (process.env.NODE_ENV !== 'production') {
          console.error(
            '[ServiceKeylessWallet] Saved device pack:',
            JSON.stringify(savedDevicePack, null, 2),
          );
          console.error(
            '[ServiceKeylessWallet] Expected device pack:',
            JSON.stringify(params.devicePack, null, 2),
          );
        }
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
    } catch (_error) {
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
    } catch (_error) {
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
        } catch (_error) {
          // User cancelled or error occurred, return null
          return null;
        }
      }
      return null;
    } catch (_error) {
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
    } catch (_error) {
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
    } catch (_error) {
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

  /**
   * Decrypt keyless wallet mnemonic using mnemonicPassword.
   * Uses consistent encryption parameters: GCM mode, 600k iterations, KEYLESS_MNEMONIC_GCM_AAD.
   */
  private async decryptKeylessMnemonic(params: {
    encryptedMnemonic: string;
    mnemonicPassword: string;
  }): Promise<string> {
    const { encryptedMnemonic, mnemonicPassword } = params;
    return decryptStringAsync({
      data: encryptedMnemonic,
      dataEncoding: 'hex',
      resultEncoding: 'utf-8',
      password: mnemonicPassword,
      allowRawPassword: true,
      iterations: KEYLESS_ENCRYPTION_ITERATIONS,
      mode: EAppCryptoAesEncryptionMode.gcm,
      aad: KEYLESS_MNEMONIC_GCM_AAD,
    });
  }

  /**
   * Encrypt keyless wallet mnemonic using mnemonicPassword.
   * Uses consistent encryption parameters: GCM mode, 600k iterations, KEYLESS_MNEMONIC_GCM_AAD.
   */
  private async encryptKeylessMnemonic(params: {
    mnemonic: string;
    mnemonicPassword: string;
  }): Promise<string> {
    const { mnemonic, mnemonicPassword } = params;
    return encryptStringAsync({
      data: mnemonic,
      dataEncoding: 'utf-8',
      password: mnemonicPassword,
      allowRawPassword: true,
      iterations: KEYLESS_ENCRYPTION_ITERATIONS,
      mode: EAppCryptoAesEncryptionMode.gcm,
      aad: KEYLESS_MNEMONIC_GCM_AAD,
    });
  }

  private buildKeylessSocialUserIdFromToken(params: { token: string }): string {
    const { token } = params;
    const decodedToken = stringUtils.decodeJWT(token) as ISupabaseJWTPayload;
    const socialUserId = decodedToken?.user_metadata?.sub || '';
    if (socialUserId) {
      return socialUserId;
    }
    throw new OneKeyLocalError('Social user ID not found');
  }

  async buildKeylessOwnerIdFromSocialToken(params: {
    token: string;
    hashId: string; // return from server
    providerOverride?: EOAuthSocialLoginProvider;
  }): Promise<string> {
    const { token, hashId, providerOverride } = params;
    const socialUserId = this.buildKeylessSocialUserIdFromToken({ token });
    const provider =
      providerOverride ?? this.buildKeylessProviderFromSocialToken({ token });
    const devSettings = await devSettingsPersistAtom.get();
    const isTestEndpointEnabled = Boolean(
      devSettings.enabled && devSettings.settings?.enableTestEndpoint,
    );
    // Append a discriminator to isolate test endpoint users from production users.
    // Keep the legacy raw format when the switch is off to avoid changing prod ownerId.
    // IMPORTANT: Do not change these discriminator strings after release,
    // otherwise existing users' ownerId will change and break keyless flows.
    const raw = [
      provider,
      socialUserId,
      isTestEndpointEnabled ? 'test_endpoint' : 'prod_endpoint',
      hashId,
      'ADD725FB-9FF5-490E-A458-6EBD4053FAE2',
    ].join('--');

    const hashBytes = await appCrypto.hash.sha256(
      bufferUtils.toBuffer(raw, 'utf-8'),
    );
    return bufferUtils.bytesToHex(hashBytes);
  }

  private getKeylessInitProviderFromAppMetadata(params: {
    token: string;
  }): EOAuthSocialLoginProvider | undefined {
    const { token } = params;
    const decodedToken = stringUtils.decodeJWT(token) as ISupabaseJWTPayload;
    const provider = decodedToken?.app_metadata
      ?.provider as EOAuthSocialLoginProvider;
    if (
      provider === EOAuthSocialLoginProvider.Google ||
      provider === EOAuthSocialLoginProvider.Apple
    ) {
      return provider;
    }
    return undefined;
  }

  private getAlternativeKeylessProvider(
    provider: EOAuthSocialLoginProvider,
  ): EOAuthSocialLoginProvider {
    return provider === EOAuthSocialLoginProvider.Google
      ? EOAuthSocialLoginProvider.Apple
      : EOAuthSocialLoginProvider.Google;
  }

  buildKeylessProviderFromSocialToken(params: {
    token: string;
    skipFixedProvider?: boolean;
  }): EOAuthSocialLoginProvider {
    const { token, skipFixedProvider } = params;
    const decodedToken = stringUtils.decodeJWT(token) as ISupabaseJWTPayload;
    const socialUserId = this.buildKeylessSocialUserIdFromToken({ token });
    if (
      socialUserId &&
      this.fixedKeylessProviderMap[socialUserId] &&
      !skipFixedProvider
    ) {
      return this.fixedKeylessProviderMap[socialUserId];
    }

    /*
    export enum Issuer {
      GOOGLE = 'https://accounts.google.com',
      APPLE = 'https://appleid.apple.com',
    } 
    */
    // "user_metadata": {
    //    "iss": "https://accounts.google.com",
    //    "iss": "https://appleid.apple.com",
    const issuer = decodedToken?.user_metadata?.iss || '';
    if (issuer === 'https://accounts.google.com') {
      return EOAuthSocialLoginProvider.Google;
    }
    if (issuer === 'https://appleid.apple.com') {
      return EOAuthSocialLoginProvider.Apple;
    }

    throw new OneKeyLocalError(`Unsupported OAuth provider: ${issuer}`);
  }

  @backgroundMethod()
  @toastIfError()
  async apiGetKeylessSameEmailAccountStatus(params: {
    token: string;
  }): Promise<{
    isSameEmailAccountAtOldVersion: boolean;
    currentProvider: EOAuthSocialLoginProvider;
    retryProvider?: EOAuthSocialLoginProvider;
  }> {
    const { token } = params;
    const client = await this.getClient(EServiceEndpointEnum.Prime);
    const res = await client.post<
      IApiClientResponse<{
        hasWrongProviders: boolean;
      }>
    >('/prime/v1/keyless-wallet/hasWrongProviders', {
      token,
    });

    const isSuccess = res?.data?.code === 0 && res?.data?.message === 'success';
    if (!isSuccess) {
      throw new OneKeyLocalError(
        'Failed to get keyless same email account status',
      );
    }

    const wrongProvidersData = res?.data?.data;
    const isSameEmailAccountAtOldVersion =
      wrongProvidersData?.hasWrongProviders ?? false;

    const actualProvider = this.buildKeylessProviderFromSocialToken({
      token,
      skipFixedProvider: true,
    });
    const initProvider = this.getKeylessInitProviderFromAppMetadata({ token });

    let currentProvider = actualProvider;

    if (
      initProvider &&
      actualProvider !== initProvider &&
      isSameEmailAccountAtOldVersion
    ) {
      currentProvider = initProvider;
    }
    const retryProvider = isSameEmailAccountAtOldVersion
      ? this.getAlternativeKeylessProvider(currentProvider)
      : undefined;

    return {
      isSameEmailAccountAtOldVersion,
      currentProvider,
      retryProvider,
    };
  }

  private async apiGetKeylessBackendShare(params: { token: string }): Promise<{
    backendShareData: IKeylessBackendShare | null;
    hashId: string;
  }> {
    const { token } = params;

    const client = await this.getClient(EServiceEndpointEnum.Prime);
    const res = await client.post<
      IApiClientResponse<{
        backendShare: string;
        hashId: string;
      }>
    >('/prime/v1/keyless-wallet/getKeylessBackendShare', {
      token,
    });

    const isSuccess = res?.data?.code === 0 && res?.data?.message === 'success';
    const backendShareStr = res?.data?.data?.backendShare;
    const hashId = res?.data?.data?.hashId;

    // {"code":0,"message":"success","data":""}
    if (isSuccess && backendShareStr === '') {
      return {
        backendShareData: null,
        hashId,
      };
    }

    if (isSuccess && backendShareStr) {
      try {
        // Require encrypted payload with prefix
        if (
          !backendShareStr.startsWith(
            KEYLESS_BACKEND_SHARE_PAYLOAD_ENCRYPTION_PREFIX,
          )
        ) {
          throw new OneKeyLocalError(
            'Keyless backend share payload is not encrypted',
          );
        }

        // Strip prefix and decrypt
        const encryptedPayload = backendShareStr.slice(
          KEYLESS_BACKEND_SHARE_PAYLOAD_ENCRYPTION_PREFIX.length,
        );
        const decryptedJson = await decryptStringAsync({
          data: encryptedPayload,
          dataEncoding: 'hex',
          resultEncoding: 'utf-8',
          password: KEYLESS_BACKEND_SHARE_PAYLOAD_ENCRYPTION_KEY,
          allowRawPassword: true,
          iterations: KEYLESS_ENCRYPTION_ITERATIONS,
          mode: EAppCryptoAesEncryptionMode.gcm,
          aad: KEYLESS_BACKEND_SHARE_PAYLOAD_GCM_AAD,
        });

        const result = JSON.parse(decryptedJson) as
          | IKeylessBackendShare
          | undefined;
        if (result) {
          return {
            backendShareData: result,
            hashId,
          };
        }
      } catch (_e) {
        throw new OneKeyLocalError('Failed to decrypt keyless backend share');
      }
    }
    throw new OneKeyLocalError('Failed to get keyless backend share');
  }

  private async apiAcquireCreationLock(params: {
    token: string;
  }): Promise<{ hashId: string; lockId: string; expiresAt: number }> {
    const { token } = params;
    const client = await this.getClient(EServiceEndpointEnum.Prime);
    const res = await client.post<
      IApiClientResponse<{
        hashId: string;
        lockId: string;
        expiresAt: number;
      }>
    >('/prime/v1/keyless-wallet/acquireCreationLock', {
      token,
    });

    const isSuccess = res?.data?.code === 0 && res?.data?.message === 'success';
    const lockData = res?.data?.data;

    if (isSuccess && lockData?.lockId) {
      return lockData;
    }

    throw new OneKeyLocalError('Failed to acquire creation lock');
  }

  private async apiReleaseCreationLock(params: {
    token: string;
    lockId: string;
  }): Promise<void> {
    const { token, lockId } = params;
    const client = await this.getClient(EServiceEndpointEnum.Prime);
    await client.post<IApiClientResponse<{ ok: boolean }>>(
      '/prime/v1/keyless-wallet/releaseCreationLock',
      { token, lockId },
    );
    // Idempotent design: silently succeed if lock doesn't exist or has expired
  }

  @backgroundMethod()
  @toastIfError()
  async apiResetKeylessBackendShare(params: {
    token: string;
  }): Promise<{ ok: boolean }> {
    const devSettings = await devSettingsPersistAtom.get();
    if (!devSettings.enabled) {
      throw new OneKeyLocalError('Dev settings is not enabled');
    }
    const { token } = params;
    const client = await this.getClient(EServiceEndpointEnum.Prime);
    // /prime/v1/keyless-wallet/resetKeylessBackendShare
    const res = await client.post<IApiClientResponse<{ ok: undefined }>>(
      '/prime/v1/keyless-wallet/resetKeylessBackendShare',
      {
        token,
      },
    );

    void this.apiGetPinConfirmStatus({ token });

    if (res?.data?.code === 0 && res?.data?.message === 'success') {
      return { ok: true };
    }

    throw new OneKeyLocalError('Failed to reset keyless backend share');
  }

  @backgroundMethod()
  @toastIfError()
  async apiUploadKeylessBackendShare(params: {
    token: string;
    lockId: string;
    encryptedMnemonic: string;
    backendShare: string;
    juiceboxShareX: number;
  }): Promise<IKeylessBackendShare> {
    const { token, lockId, encryptedMnemonic, backendShare, juiceboxShareX } =
      params;
    // TODO: Replace with real API call
    // For now, save to mock cache
    const backendShareData: IKeylessBackendShare = {
      encryptedMnemonic, // TODO to base64
      backendShare,
      juiceboxShareX,
    };

    // Encrypt the backend share payload before uploading
    const jsonPayload = JSON.stringify(backendShareData);
    const encryptedPayload = await encryptStringAsync({
      data: jsonPayload,
      dataEncoding: 'utf-8',
      password: KEYLESS_BACKEND_SHARE_PAYLOAD_ENCRYPTION_KEY,
      allowRawPassword: true,
      iterations: KEYLESS_ENCRYPTION_ITERATIONS,
      mode: EAppCryptoAesEncryptionMode.gcm,
      aad: KEYLESS_BACKEND_SHARE_PAYLOAD_GCM_AAD,
    });
    const encryptedPayloadWithPrefix = `${KEYLESS_BACKEND_SHARE_PAYLOAD_ENCRYPTION_PREFIX}${encryptedPayload}`;

    const client = await this.getClient(EServiceEndpointEnum.Prime);
    const res = await client.post<IApiClientResponse<{ ok: boolean }>>(
      '/prime/v1/keyless-wallet/createKeylessBackendShare',
      {
        token,
        lockId,
        keylessBackendShare: encryptedPayloadWithPrefix,
      },
    );

    if (res?.data?.data?.ok === true) {
      return backendShareData;
    }

    throw new OneKeyLocalError('Failed to upload keyless backend share');
  }

  private async apiGetKeylessJuiceboxShare(params: {
    ownerId: string;
    token: string;
    pin: string;
  }): Promise<IKeylessJuiceboxShare> {
    const { ownerId, token, pin } = params;

    if (!token) {
      throw new OneKeyLocalError(
        'GetKeylessJuiceboxShare ERROR: Missing token',
      );
    }

    if (!pin) {
      throw new OneKeyLocalError('GetKeylessJuiceboxShare ERROR: Missing pin');
    }

    if (!ownerId) {
      throw new OneKeyLocalError(
        'GetKeylessJuiceboxShare ERROR: Missing ownerId',
      );
    }

    const juiceboxClient = await this.getJuiceboxClientFromCache(token);
    try {
      const secret = await juiceboxClient.recover({
        pin,
        // userInfo: `${ownerId}::::hello-world`,
        userInfo: ownerId,
      });

      const parts = secret.split('--');
      const backendShareXStr = parts.pop();
      if (!backendShareXStr) {
        throw new OneKeyLocalError(
          'Failed to get keyless juicebox share: backendShareXStr is empty',
        );
      }
      const backendShareX = parseInt(backendShareXStr || '0', 10);
      const juiceboxShare = parts.join('');
      if (!juiceboxShare) {
        throw new OneKeyLocalError(
          'Failed to get keyless juicebox share: juiceboxShare is empty',
        );
      }
      return {
        ownerId,
        pin,
        juiceboxShare,
        backendShareX,
      };
    } catch (_error) {
      console.error(_error);
      throw _error;
    }
  }

  @backgroundMethod()
  @toastIfError()
  async apiVerifyKeylessJuiceboxPin(params: {
    token: string;
    pin: string;
    refreshToken?: string;
    mode?: EOnboardingV2OneKeyIDLoginMode;
    dangerousRetryByFixedProvider: boolean;
    providerOverride?: EOAuthSocialLoginProvider;
  }): Promise<void> {
    const { token, pin, refreshToken, mode, dangerousRetryByFixedProvider } =
      params;
    let providerOverride = params.providerOverride;
    if (dangerousRetryByFixedProvider) {
      providerOverride = undefined;
    }
    const { hashId } = await this.apiGetKeylessBackendShare({
      token,
    });
    defaultLogger.wallet.keyless.verifyKeylessBackendShareRetrieved();
    const currentSocialProvider = this.buildKeylessProviderFromSocialToken({
      token,
      skipFixedProvider: !!providerOverride,
    });
    let socialProvider: EOAuthSocialLoginProvider =
      providerOverride ?? this.buildKeylessProviderFromSocialToken({ token });
    let ownerId = await this.buildKeylessOwnerIdFromSocialToken({
      token,
      hashId,
      providerOverride: socialProvider,
    });
    const socialUserId: string = this.buildKeylessSocialUserIdFromToken({
      token,
    });
    if (
      !providerOverride &&
      dangerousRetryByFixedProvider &&
      !this.fixedKeylessProviderMap[socialUserId]
    ) {
      const providerOnCreate = this.getKeylessInitProviderFromAppMetadata({
        token,
      });
      if (providerOnCreate) {
        const alternativeProvider =
          this.getAlternativeKeylessProvider(providerOnCreate);
        if (alternativeProvider !== socialProvider) {
          socialProvider = alternativeProvider;
          ownerId = await this.buildKeylessOwnerIdFromSocialToken({
            token,
            hashId,
            providerOverride: socialProvider,
          });
        }
      }
    }
    defaultLogger.wallet.keyless.verifyKeylessOwnerIdGenerated();

    if (mode === EOnboardingV2OneKeyIDLoginMode.KeylessVerifyPinOnly) {
      const keylessWallet =
        await this.backgroundApi.serviceAccount.getKeylessWallet();

      const walletOwnerId = keylessWallet?.keylessDetailsInfo?.keylessOwnerId;
      if (!walletOwnerId) {
        throw new OneKeyLocalError('Local keyless wallet not found.');
      }
      if (walletOwnerId !== ownerId) {
        throw new OneKeyLocalError(
          'The local keyless wallet does not match the server record. Please check that you are using the correct account.',
        );
      }
      defaultLogger.wallet.keyless.verifyKeylessWalletValidated();
    }

    try {
      await this.apiGetKeylessJuiceboxShare({
        ownerId,
        token,
        pin,
      });
      if (
        providerOverride &&
        socialProvider !== currentSocialProvider &&
        !this.fixedKeylessProviderMap[socialUserId]
      ) {
        this.fixedKeylessProviderMap[socialUserId] = socialProvider;
      }
      if (
        dangerousRetryByFixedProvider &&
        !this.fixedKeylessProviderMap[socialUserId]
      ) {
        this.fixedKeylessProviderMap[socialUserId] = socialProvider;
      }
    } catch (error) {
      const isPinErrorByInstance = error instanceof IncorrectPinError;
      const isPinErrorByClassName = errorUtils.isErrorByClassName({
        error,
        className: EOneKeyErrorClassNames.IncorrectPinError,
      });
      const isPinError = isPinErrorByInstance || isPinErrorByClassName;
      if (
        !providerOverride &&
        isPinError &&
        dangerousRetryByFixedProvider &&
        !this.fixedKeylessProviderMap[socialUserId]
      ) {
        this.fixedKeylessProviderMap[socialUserId] =
          this.getAlternativeKeylessProvider(socialProvider);
        void this.backgroundApi.serviceApp.showDialogLoading({
          title:
            'Provider fixed done, please try again, do not refresh the page or exit the app.',
          showExitButton: true,
        });
        throw new OneKeyLocalError(
          'Provider fixed done, please try again, do not refresh the page or exit the app.',
        );
      }
      throw error;
    }
    defaultLogger.wallet.keyless.verifyKeylessJuiceboxShareRetrieved();

    // Save tokens to secure storage (refreshToken with passcode, token without)
    if (
      refreshToken &&
      mode === EOnboardingV2OneKeyIDLoginMode.KeylessVerifyPinOnly
    ) {
      const { password } =
        await this.backgroundApi.servicePassword.promptPasswordVerify();
      await keylessRefreshTokenStorage.saveTokensToStorage({
        ownerId,
        refreshToken,
        token,
        password,
        backgroundApi: this.backgroundApi,
      });
      defaultLogger.wallet.keyless.verifyKeylessTokensStored();
    }
    void this.apiUpdatePinConfirmStatus({ token });
    defaultLogger.wallet.keyless.verifyKeylessPinConfirmStatusUpdated();
  }

  @backgroundMethod()
  @toastIfError()
  async apiUploadKeylessJuiceboxShare(params: {
    token: string;
    pin: string;
    ownerId: string;
    juiceboxShare: string;
    backendShareX: number;
  }): Promise<IKeylessJuiceboxShare> {
    const { token, pin, ownerId, juiceboxShare, backendShareX } = params;
    // TODO: Replace with real API call
    // exchange juicebox token from onekey auth server
    // upload juicebox share to juicebox network
    // For now, save to mock cache
    const juiceboxShareData: IKeylessJuiceboxShare = {
      ownerId,
      pin,
      juiceboxShare,
      backendShareX,
    };

    const juiceboxClient = await this.getJuiceboxClientFromCache(token);
    try {
      const secret = `${juiceboxShare}--${backendShareX}`;
      await juiceboxClient.register({
        pin,
        secret,
        userInfo: ownerId,
      });
    } catch (e) {
      console.error(e);
      throw e;
    }

    return juiceboxShareData;
  }

  /**
   * Reset PIN for keyless wallet.
   * This method:
   * 1. Gets ownerId from social login token
   * 2. Gets backendShare from server
   * 3. Gets mnemonicPassword from secure storage
   * 4. Recovers juiceboxShare using mnemonicPassword + backendShare
   * 5. Uploads juiceboxShare with new PIN
   */
  @backgroundMethod()
  @toastIfError()
  async resetKeylessWalletPin(params: {
    token: string | undefined;
    refreshToken?: string | undefined;
    newPin: string | undefined;
  }) {
    const { token, refreshToken, newPin } = params;
    if (!token) {
      throw new OneKeyLocalError('social login token is required');
    }
    if (!newPin) {
      throw new OneKeyLocalError('new PIN is required');
    }

    // Get password first to avoid multiple prompts
    const { password } =
      await this.backgroundApi.servicePassword.promptPasswordVerify();

    // 2. Get backendShare from server
    const { backendShareData, hashId } = await this.apiGetKeylessBackendShare({
      token,
    });
    if (!backendShareData) {
      throw new OneKeyLocalError('Backend share not found');
    }
    defaultLogger.wallet.keyless.resetKeylessBackendShareRetrieved();

    this.fixedKeylessProviderMap = {};

    // 1. Get ownerId from token
    const socialProvider = this.buildKeylessProviderFromSocialToken({
      token,
      skipFixedProvider: true,
    });
    const targetOwnerId = await this.buildKeylessOwnerIdFromSocialToken({
      token,
      hashId,
      providerOverride: socialProvider,
    });
    defaultLogger.wallet.keyless.resetKeylessOwnerIdGenerated();

    // 3. Get mnemonicPassword from secure storage
    let mnemonicPasswordSourceOwnerId = targetOwnerId;
    let mnemonicPassword =
      await keylessMnemonicPasswordStorage.getMnemonicPasswordFromStorage({
        ownerId: mnemonicPasswordSourceOwnerId,
        password,
        backgroundApi: this.backgroundApi,
      });
    if (!mnemonicPassword) {
      const fallbackProvider =
        this.getAlternativeKeylessProvider(socialProvider);
      mnemonicPasswordSourceOwnerId =
        await this.buildKeylessOwnerIdFromSocialToken({
          token,
          hashId,
          providerOverride: fallbackProvider,
        });
      mnemonicPassword =
        await keylessMnemonicPasswordStorage.getMnemonicPasswordFromStorage({
          ownerId: mnemonicPasswordSourceOwnerId,
          password,
          backgroundApi: this.backgroundApi,
        });
    }
    if (!mnemonicPassword) {
      defaultLogger.wallet.keyless.dataCorruptedError({
        reason:
          'getMnemonicPasswordFromStorage: mnemonicPassword not found in secure storage',
      });
      throw new KeylessDataCorruptedError();
    }
    defaultLogger.wallet.keyless.resetKeylessMnemonicPasswordRetrieved();

    // 3.1. Verify mnemonicPassword can decrypt backendShareData and matches local keyless wallet
    const decryptedMnemonic = await this.decryptKeylessMnemonic({
      encryptedMnemonic: backendShareData.encryptedMnemonic,
      mnemonicPassword,
    });
    if (!decryptedMnemonic) {
      throw new OneKeyLocalError(
        'Mnemonic password does not match backend share data. Please verify your credentials.',
      );
    }
    defaultLogger.wallet.keyless.resetKeylessMnemonicVerified();

    // 3.2. Verify decrypted mnemonic matches local keyless wallet mnemonic
    const keylessWallet =
      await this.backgroundApi.serviceAccount.getKeylessWallet();
    if (!keylessWallet) {
      throw new OneKeyLocalError('Keyless wallet not found.');
    }

    const credential = await localDb.getCredential(keylessWallet.id);
    defaultLogger.wallet.keyless.resetKeylessCredentialVerified();

    const rs = await decryptRevealableSeed({
      rs: credential.credential,
      password,
    });
    const localMnemonic = revealEntropyToMnemonic(rs.entropyWithLangPrefixed);
    if (localMnemonic !== decryptedMnemonic) {
      throw new OneKeyLocalError(
        'Decrypted mnemonic does not match local keyless wallet. Please verify your credentials.',
      );
    }
    defaultLogger.wallet.keyless.resetKeylessMnemonicDecrypted();

    // 4. Get x-coordinates from stored data
    // juiceboxShareX is stored in backendShareData for recovery
    const backendShareX = keylessWalletUtils.getShareXCoordinate(
      backendShareData.backendShare,
    );

    // 5. Recover juiceboxShare using recoverMissingShareFromSecret
    const juiceboxShare = await this.recoverMissingShareFromSecret({
      secretBase64: mnemonicPassword,
      shareBase64: backendShareData.backendShare,
      missingX: backendShareData.juiceboxShareX,
    });
    defaultLogger.wallet.keyless.resetKeylessJuiceboxShareRecovered();

    // 6. Upload juiceboxShare with new PIN
    await this.apiUploadKeylessJuiceboxShare({
      token,
      juiceboxShare,
      pin: newPin,
      backendShareX,
      ownerId: targetOwnerId,
    });
    defaultLogger.wallet.keyless.resetKeylessJuiceboxShareUploaded({
      backendShareX,
    });

    // Save tokens to secure storage (refreshToken with passcode, token without)
    if (refreshToken) {
      await keylessRefreshTokenStorage.saveTokensToStorage({
        ownerId: targetOwnerId,
        refreshToken,
        token,
        password,
        backgroundApi: this.backgroundApi,
      });
      defaultLogger.wallet.keyless.resetKeylessTokensStored();
    }

    if (mnemonicPasswordSourceOwnerId !== targetOwnerId) {
      await keylessMnemonicPasswordStorage.saveMnemonicPasswordToStorage({
        ownerId: targetOwnerId,
        mnemonicPassword,
        password,
        backgroundApi: this.backgroundApi,
      });
    }

    const socialUserIdHash = await accountUtils.hashKeylessSocialUserId({
      socialUserId: this.buildKeylessSocialUserIdFromToken({ token }),
    });
    const shouldUpdateKeylessDetailsInfo =
      keylessWallet.keylessDetailsInfo?.keylessOwnerId !== targetOwnerId ||
      keylessWallet.keylessDetailsInfo?.keylessProvider !== socialProvider ||
      keylessWallet.keylessDetailsInfo?.socialUserIdHash !== socialUserIdHash;
    if (shouldUpdateKeylessDetailsInfo) {
      const nextKeylessDetailsInfo: IKeylessWalletDetailsInfo = {
        ...keylessWallet.keylessDetailsInfo,
        keylessOwnerId: targetOwnerId,
        keylessProvider: socialProvider,
        socialUserIdHash,
      };
      await localDb.updateKeylessWalletDetailsInfo({
        walletId: keylessWallet.id,
        keylessDetailsInfo: nextKeylessDetailsInfo,
      });
    }

    void this.apiResetPinConfirmStatus({ token });
    defaultLogger.wallet.keyless.resetKeylessPinConfirmStatusUpdated();

    this.fixedKeylessProviderMap = {};
    return { success: true };
  }

  @backgroundMethod()
  @toastIfError()
  async apiMarkKeylessSameEmailResetPinSuccess(params: {
    token: string;
  }): Promise<{ success: true }> {
    const { token } = params;
    if (!token) {
      throw new OneKeyLocalError('social login token is required');
    }

    const client = await this.getClient(EServiceEndpointEnum.Prime);
    const res = await client.post<IApiClientResponse<undefined>>(
      '/prime/v1/keyless-wallet/resetPinDone',
      {
        token,
      },
    );

    const isSuccess = res?.data?.code === 0 && res?.data?.message === 'success';

    if (!isSuccess) {
      throw new OneKeyLocalError(
        'Failed to mark keyless same email reset pin success',
      );
    }

    return { success: true };
  }

  @backgroundMethod()
  @toastIfError()
  async autoResetKeylessWalletPinAfterRestoreForSameEmailAccount(params: {
    token: string;
    refreshToken?: string;
    pin: string;
  }): Promise<{ success: boolean; skipped: boolean }> {
    const { token, refreshToken, pin } = params;
    const { isSameEmailAccountAtOldVersion: isSameEmailAccount } =
      await this.apiGetKeylessSameEmailAccountStatus({ token });

    if (!isSameEmailAccount) {
      return {
        success: false,
        skipped: true,
      };
    }

    await this.resetKeylessWalletPin({
      token,
      refreshToken,
      newPin: pin,
    });
    await this.apiMarkKeylessSameEmailResetPinSuccess({ token });

    return {
      success: true,
      skipped: false,
    };
  }

  @backgroundMethod()
  @toastIfError()
  async restoreKeylessWalletFromServer(params: {
    token: string | undefined;
    refreshToken?: string | undefined;
    pin: string | undefined;
  }): Promise<{
    ownerId: string;
    mnemonic: string;
    keylessDetailsInfo: IKeylessWalletDetailsInfo;
  }> {
    const { token, refreshToken, pin } = params;
    if (!token) {
      throw new OneKeyLocalError('social login token is required');
    }
    if (!pin) {
      throw new OneKeyLocalError('pin is required');
    }

    // Get password first to avoid multiple prompts
    const { password } =
      await this.backgroundApi.servicePassword.promptPasswordVerify();

    // Get backend share from server
    const { backendShareData, hashId } = await this.apiGetKeylessBackendShare({
      token,
    });
    if (!backendShareData) {
      throw new OneKeyLocalError('Backend share not found');
    }
    if (!hashId) {
      throw new OneKeyLocalError('Hash ID not found');
    }
    defaultLogger.wallet.keyless.restoreKeylessBackendShareRetrieved();

    // check if keyless wallet is initialized
    const ownerId = await this.buildKeylessOwnerIdFromSocialToken({
      token,
      hashId,
    });
    defaultLogger.wallet.keyless.restoreKeylessOwnerIdGenerated();

    // Get juicebox share from juicebox network
    let juiceboxShareData: IKeylessJuiceboxShare | null = null;
    juiceboxShareData = await this.apiGetKeylessJuiceboxShare({
      token,
      pin,
      ownerId,
    });
    if (!juiceboxShareData) {
      throw new OneKeyLocalError('Juicebox share not found');
    }
    defaultLogger.wallet.keyless.restoreKeylessJuiceboxShareRetrieved();

    // Combine shares to recover mnemonic password
    const mnemonicPasswordShares = [
      bufferUtils.base64ToBytes(backendShareData.backendShare),
      bufferUtils.base64ToBytes(juiceboxShareData.juiceboxShare),
    ];
    const mnemonicPasswordBytes = await shamirUtils.combine(
      mnemonicPasswordShares.map((s) => new Uint8Array(s)),
    );
    const mnemonicPassword = bufferUtils.bytesToBase64(mnemonicPasswordBytes);
    defaultLogger.wallet.keyless.restoreKeylessMnemonicPasswordRecovered();

    // Decrypt mnemonic using recovered password
    const mnemonic = await this.decryptKeylessMnemonic({
      encryptedMnemonic: backendShareData.encryptedMnemonic,
      mnemonicPassword,
    });
    defaultLogger.wallet.keyless.restoreKeylessMnemonicDecrypted();

    // Save mnemonicPassword to secure storage for Reset PIN flow
    await keylessMnemonicPasswordStorage.saveMnemonicPasswordToStorage({
      ownerId,
      mnemonicPassword,
      password,
      backgroundApi: this.backgroundApi,
    });
    defaultLogger.wallet.keyless.restoreKeylessMnemonicPasswordStored();

    // Save tokens to secure storage (refreshToken with passcode, token without)
    if (refreshToken) {
      await keylessRefreshTokenStorage.saveTokensToStorage({
        ownerId,
        refreshToken,
        token,
        password,
        backgroundApi: this.backgroundApi,
      });
      defaultLogger.wallet.keyless.restoreKeylessTokensStored();
    }

    void this.apiUpdatePinConfirmStatus({ token });
    defaultLogger.wallet.keyless.restorePinConfirmStatusUpdated();

    const keylessProvider = this.buildKeylessProviderFromSocialToken({ token });

    this.fixedKeylessProviderMap = {};
    return {
      ownerId,
      mnemonic: await this.backgroundApi.servicePassword.encodeSensitiveText({
        text: mnemonic,
      }),
      keylessDetailsInfo: {
        keylessOwnerId: ownerId,
        keylessProvider,
        socialUserIdHash: await accountUtils.hashKeylessSocialUserId({
          socialUserId: this.buildKeylessSocialUserIdFromToken({ token }),
        }),
      },
    };
  }

  @backgroundMethod()
  @toastIfError()
  async clearKeylessOnboardingCache() {
    // Best-effort cleanup: clear per-client token caches first, then clear the LRU itself.
    for (const client of juiceboxClientCache.values()) {
      try {
        client.dispose();
      } catch {
        // ignore
      }
    }
    juiceboxClientCache.clear();
  }

  @backgroundMethod()
  @toastIfError()
  async createKeylessWalletToServer(params: {
    token: string | undefined;
    refreshToken?: string | undefined;
    pin: string | undefined;
    customMnemonic?: string;
  }): Promise<{
    ownerId: string;
    mnemonic: string;
    keylessDetailsInfo: IKeylessWalletDetailsInfo;
  }> {
    const { token, refreshToken, pin, customMnemonic } = params;
    if (await this.backgroundApi.serviceAccount.getKeylessWallet()) {
      throw new OneKeyLocalError('Keyless wallet already exists');
    }
    if (!token) {
      throw new OneKeyLocalError('social login token is required');
    }
    if (!pin) {
      throw new OneKeyLocalError('pin is required');
    }

    // Get password first to avoid multiple prompts
    const { password } =
      await this.backgroundApi.servicePassword.promptPasswordVerify();

    // 1. Acquire distributed lock
    const { lockId, hashId } = await this.apiAcquireCreationLock({ token });
    defaultLogger.wallet.keyless.createKeylessLockAcquired({ lockId });

    try {
      // 2. Double-check if already created (check inside lock for safety)
      const isCreated = await this.isKeylessWalletCreatedOnServer({ token });

      if (isCreated) {
        throw new OneKeyLocalError('Keyless wallet already created');
      }
      defaultLogger.wallet.keyless.createKeylessWalletNotYetCreated();

      const ownerId = await this.buildKeylessOwnerIdFromSocialToken({
        token,
        hashId,
      });
      defaultLogger.wallet.keyless.createKeylessOwnerIdGenerated();

      let mnemonic = '';
      const devSettings = await devSettingsPersistAtom.get();
      if (devSettings.enabled && customMnemonic && customMnemonic.trim()) {
        mnemonic = customMnemonic.trim();
      } else {
        mnemonic = generateMnemonic(256);
      }
      const mnemonicPasswordBytes = crypto.getRandomValues(new Uint8Array(32));
      const mnemonicPassword = bufferUtils.bytesToBase64(mnemonicPasswordBytes);
      const encryptedMnemonic: string = await this.encryptKeylessMnemonic({
        mnemonic,
        mnemonicPassword,
      });
      defaultLogger.wallet.keyless.createKeylessMnemonicEncrypted();

      const mnemonicPasswordShares = await shamirUtils.split(
        new Uint8Array(mnemonicPasswordBytes),
        2,
        2,
      );
      defaultLogger.wallet.keyless.createKeylessMnemonicPasswordShared();

      const [mnemonicPasswordShare1, mnemonicPasswordShare2] =
        mnemonicPasswordShares;
      const backendShare: string = bufferUtils.bytesToBase64(
        mnemonicPasswordShare1,
      );
      const juiceboxShare: string = bufferUtils.bytesToBase64(
        mnemonicPasswordShare2,
      );

      // Extract x-coordinates from shares
      const backendShareX =
        keylessWalletUtils.getShareXCoordinate(backendShare);
      const juiceboxShareX =
        keylessWalletUtils.getShareXCoordinate(juiceboxShare);

      // Save mnemonicPassword to secure storage for Reset PIN flow
      await keylessMnemonicPasswordStorage.saveMnemonicPasswordToStorage({
        ownerId,
        mnemonicPassword,
        password,
        backgroundApi: this.backgroundApi,
      });
      defaultLogger.wallet.keyless.createKeylessMnemonicPasswordStored();

      const _juiceboxShareData: IKeylessJuiceboxShare =
        await this.apiUploadKeylessJuiceboxShare({
          token,
          ownerId,
          juiceboxShare,
          pin,
          backendShareX, // Store the other share's x-coordinate for recovery
        });
      defaultLogger.wallet.keyless.createKeylessJuiceboxShareUploaded({
        juiceboxShareX,
      });

      // Make sure juiceboxShare is uploaded successfully before uploading backend share
      const _backendShareData: IKeylessBackendShare =
        await this.apiUploadKeylessBackendShare({
          token,
          lockId,
          encryptedMnemonic,
          backendShare,
          juiceboxShareX, // Store the other share's x-coordinate for recovery
        });
      defaultLogger.wallet.keyless.createKeylessBackendShareUploaded({
        backendShareX,
      });

      // Save tokens to secure storage (refreshToken with passcode, token without)
      if (refreshToken) {
        await keylessRefreshTokenStorage.saveTokensToStorage({
          ownerId,
          refreshToken,
          token,
          password,
          backgroundApi: this.backgroundApi,
        });
        defaultLogger.wallet.keyless.createKeylessTokensStored();
      }

      // void this.apiUpdatePinConfirmStatus({ token });

      const keylessProvider: EOAuthSocialLoginProvider =
        this.buildKeylessProviderFromSocialToken({
          token,
        });

      const socialUserId = this.buildKeylessSocialUserIdFromToken({ token });

      this.fixedKeylessProviderMap = {};

      return {
        ownerId,
        mnemonic: await this.backgroundApi.servicePassword.encodeSensitiveText({
          text: mnemonic,
        }),
        keylessDetailsInfo: {
          keylessOwnerId: ownerId,
          keylessProvider,
          socialUserIdHash: await accountUtils.hashKeylessSocialUserId({
            socialUserId,
          }),
        },
      };
    } finally {
      // 3. Release lock (always release, even if error occurs)
      await this.apiReleaseCreationLock({ token, lockId }).catch((e) => {
        // Silently handle release failure, lock will auto-expire
        console.error('Failed to release creation lock', e);
      });
    }
  }

  @backgroundMethod()
  @toastIfError()
  async isKeylessWalletCreatedOnServer(params: {
    token: string;
  }): Promise<boolean> {
    const { token } = params;
    const { backendShareData } = await this.apiGetKeylessBackendShare({
      token,
    });
    const isCreated = !!backendShareData?.encryptedMnemonic;
    return isCreated;
  }

  @backgroundMethod()
  @toastIfError()
  async getKeylessCachedAccessToken(params: {
    ownerId: string;
  }): Promise<string | null> {
    const { ownerId } = params;
    if (!ownerId) {
      throw new OneKeyLocalError('ownerId is required');
    }
    // AccessToken is stored without passcode encryption, so it can be retrieved directly
    const token = await keylessRefreshTokenStorage.getAccessTokenFromStorage({
      ownerId,
      backgroundApi: this.backgroundApi,
    });

    return token;
  }

  /**
   * Try to refresh access token using stored refreshToken.
   * Returns new accessToken and refreshToken if refresh is successful, null otherwise.
   * Note: This requires passcode verification as refreshToken is encrypted with passcode.
   *
   * @param params.forceRefresh - If true (default), force refresh token regardless of local cache.
   *                               If false, check if cached accessToken is still valid before refreshing.
   */
  @backgroundMethod()
  @toastIfError()
  async tryRefreshTokenFromStorage(params: {
    ownerId: string;
    forceRefresh?: boolean;
  }): Promise<{
    accessToken: string;
    refreshToken: string;
  } | null> {
    const { ownerId, forceRefresh = true } = params;
    if (!ownerId) {
      throw new OneKeyLocalError('ownerId is required');
    }
    try {
      // If not forcing refresh, check if cached accessToken is still valid
      if (!forceRefresh) {
        const cachedAccessToken =
          await keylessRefreshTokenStorage.getAccessTokenFromStorage({
            ownerId,
            backgroundApi: this.backgroundApi,
          });

        // Check if cached accessToken exists and is still valid
        if (cachedAccessToken) {
          const decodedToken = stringUtils.decodeJWT(
            cachedAccessToken,
          ) as ISupabaseJWTPayload;
          if (decodedToken?.exp && typeof decodedToken.exp === 'number') {
            // Check if token is still valid (with 5 minutes buffer to avoid edge cases)
            const expirationTime = decodedToken.exp * 1000; // Convert to milliseconds
            const currentTime = Date.now();
            const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds

            if (currentTime < expirationTime - bufferTime) {
              // Token is still valid, get refreshToken and return both
              const { password } =
                await this.backgroundApi.servicePassword.promptPasswordVerify();

              const storedTokens =
                await keylessRefreshTokenStorage.getTokensFromStorage({
                  ownerId,
                  password,
                  backgroundApi: this.backgroundApi,
                });

              if (storedTokens?.refreshToken) {
                return {
                  accessToken: cachedAccessToken,
                  refreshToken: storedTokens.refreshToken,
                };
              }
            }
          }
        }
      }

      // Force refresh or token is expired/doesn't exist, proceed with refresh
      // Get password first to avoid multiple prompts
      const { password } =
        await this.backgroundApi.servicePassword.promptPasswordVerify();

      // Get refreshToken from secure storage (requires passcode)
      const storedTokens =
        await keylessRefreshTokenStorage.getTokensFromStorage({
          ownerId,
          password,
          backgroundApi: this.backgroundApi,
        });

      if (!storedTokens?.refreshToken) {
        return null;
      }

      // Call Supabase HTTP API to refresh token
      const refreshUrl = `${KEYLESS_SUPABASE_PROJECT_URL}/auth/v1/token?grant_type=refresh_token`;
      const response = await fetch(refreshUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',

          // oxlint-disable-next-line @cspell/spellchecker
          apikey: KEYLESS_SUPABASE_PUBLIC_API_KEY,
        },
        body: JSON.stringify({
          refresh_token: storedTokens.refreshToken,
        }),
      });

      if (!response.ok) {
        return null;
      }

      const refreshResult = (await response.json()) as {
        access_token?: string;
        refresh_token?: string;
      };

      if (refreshResult?.access_token && refreshResult?.refresh_token) {
        await keylessRefreshTokenStorage.saveTokensToStorage({
          ownerId,
          refreshToken: refreshResult.refresh_token,
          token: refreshResult.access_token,
          password,
          backgroundApi: this.backgroundApi,
        });
        return {
          accessToken: refreshResult.access_token,
          refreshToken: refreshResult.refresh_token,
        };
      }

      return null;
    } catch (error) {
      // Silently fail - return null if any error occurs
      console.error('Failed to refresh token from storage:', error);
      return null;
    }
  }

  @backgroundMethod()
  @toastIfError()
  async apiResetPinConfirmStatus(params: { token: string }): Promise<void> {
    const { token } = params;

    const client = await this.getClient(EServiceEndpointEnum.Prime);
    const res = await client.post<IApiClientResponse<{ ok: boolean }>>(
      '/prime/v1/keyless-wallet/resetPinConfirmStatus',
      {
        token,
      },
    );

    const isSuccess = res?.data?.code === 0 && res?.data?.message === 'success';

    if (!isSuccess) {
      throw new OneKeyLocalError('Failed to reset pin confirm status');
    } else {
      await keylessPinConfirmStatusAtom.set(null);
    }
  }

  @backgroundMethod()
  @toastIfError()
  async apiUpdatePinConfirmStatus(params: {
    token: string;
    isCancelAction?: boolean;
  }): Promise<void> {
    const { token, isCancelAction } = params;

    const client = await this.getClient(EServiceEndpointEnum.Prime);
    const res = await client.post<IApiClientResponse<{ ok: boolean }>>(
      '/prime/v1/keyless-wallet/updatePinConfirmStatus',
      {
        token,
        isCancelAction,
      },
    );

    const isSuccess = res?.data?.code === 0 && res?.data?.message === 'success';

    if (!isSuccess) {
      throw new OneKeyLocalError('Failed to update pin confirm status');
    }
  }

  @backgroundMethod()
  @toastIfError()
  async cancelVerifyPin(params: {
    ownerId: string | 'CURRENT_KEYLESS_WALLET';
  }): Promise<void> {
    await this.updatePinConfirmStatusMutex.runExclusive(async () => {
      let { ownerId } = params;
      if (ownerId === 'CURRENT_KEYLESS_WALLET') {
        ownerId = '';
        const wallet =
          await this.backgroundApi.serviceAccount.getKeylessWallet();
        if (wallet?.keylessDetailsInfo?.keylessOwnerId) {
          ownerId = wallet.keylessDetailsInfo.keylessOwnerId;
        }
      }
      if (!ownerId) {
        throw new OneKeyLocalError(
          'cancelVerifyPin ERROR: ownerId is required',
        );
      }
      const accessToken = await this.getKeylessCachedAccessToken({ ownerId });

      if (accessToken) {
        await this.apiUpdatePinConfirmStatus({
          token: accessToken,
          isCancelAction: true,
        });
      }
    });
  }

  @backgroundMethod()
  async apiCheckAuthServerStatus(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        timerUtils.getTimeDurationMs({ seconds: 10 }),
      );

      const healthUrl = `${KEYLESS_SUPABASE_PROJECT_URL}/health`;
      const response = await fetch(healthUrl, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return false;
      }

      const result = (await response.json()) as { status?: string };
      return result?.status === 'ok';
    } catch (_error) {
      // Handle timeout or any other errors
      return false;
    }
  }

  @backgroundMethod()
  async fixKeylessWalletAvatar({
    wallet,
    accessToken,
  }: {
    wallet: IDBWallet;
    accessToken: string | null;
  }) {
    if (!accessToken) {
      return;
    }
    const socialProvider = this.buildKeylessProviderFromSocialToken({
      token: accessToken,
      skipFixedProvider: true,
    });
    if (!socialProvider) {
      return;
    }

    const keylessDetailsInfo = wallet?.keylessDetailsInfo;
    if (!keylessDetailsInfo) {
      return;
    }

    if (keylessDetailsInfo?.avatarProvider === socialProvider) {
      return;
    }

    const nextKeylessDetailsInfo: IKeylessWalletDetailsInfo = {
      ...keylessDetailsInfo,
      avatarProvider: socialProvider,
    };

    await localDb.updateKeylessWalletDetailsInfo({
      walletId: wallet.id,
      keylessDetailsInfo: nextKeylessDetailsInfo,
    });

    wallet.keylessDetailsInfo = nextKeylessDetailsInfo;
    wallet.keylessDetails = JSON.stringify(nextKeylessDetailsInfo);
  }

  @backgroundMethod()
  @toastIfError()
  async apiGetPinConfirmStatus(params: { token: string }): Promise<{
    shouldRemind: boolean;
  }> {
    // Wait for updatePinConfirmStatus mutex to complete
    await this.updatePinConfirmStatusMutex.waitForUnlock();
    const { token } = params;

    const client = await this.getClient(EServiceEndpointEnum.Prime);
    const res = await client.post<
      IApiClientResponse<{
        need_remind: boolean;
        remind_time: number;
        confirmed_count: number;
      }>
    >('/prime/v1/keyless-wallet/getPinConfirmStatus', {
      token,
    });

    this.fixedKeylessProviderMap = {};
    const socialUserIdHash = await accountUtils.hashKeylessSocialUserId({
      socialUserId: this.buildKeylessSocialUserIdFromToken({ token }),
    });
    this.fixedKeylessProviderMap = {};
    const socialProvider = this.buildKeylessProviderFromSocialToken({ token });

    const isSuccess = res?.data?.code === 0 && res?.data?.message === 'success';
    const shouldRemind = res?.data?.data?.need_remind;
    const remindTime = res?.data?.data?.remind_time;
    const confirmedCount = res?.data?.data?.confirmed_count;

    if (isSuccess) {
      await keylessPinConfirmStatusAtom.set({
        socialUserIdHash,
        socialProvider,
        needRemind: shouldRemind,
        remindTime,
        confirmedCount,
      });

      return {
        shouldRemind: !!shouldRemind,
      };
    }

    throw new OneKeyLocalError('Failed to get pin confirm status');
  }

  /**
   * Clear keyless refresh token storage.
   * Requires dev settings to be enabled.
   */
  @backgroundMethod()
  @toastIfError()
  async clearKeylessRefreshTokenStorage(params: {
    ownerId: string;
  }): Promise<{ success: boolean }> {
    const devSettings = await devSettingsPersistAtom.get();
    if (!devSettings.enabled) {
      throw new OneKeyLocalError('Dev settings is not enabled');
    }

    await keylessRefreshTokenStorage.removeTokensFromStorage({
      ownerId: params.ownerId,
    });

    return { success: true };
  }

  @backgroundMethod()
  async cleanupKeylessWalletStorage(params: {
    ownerId: string;
  }): Promise<void> {
    const { ownerId } = params;
    if (!ownerId) {
      return;
    }

    await keylessMnemonicPasswordStorage.removeMnemonicPasswordFromStorage({
      ownerId,
    });

    await keylessRefreshTokenStorage.removeTokensFromStorage({
      ownerId,
    });
  }

  fixedKeylessProviderMap: {
    [socialUserId: string]: EOAuthSocialLoginProvider;
  } = {};

  /**
   * Validate that the social user ID from the token matches the keyless wallet's social user ID.
   * Used during KeylessResetPin and KeylessVerifyPinOnly flows to ensure the logged-in user
   * owns the local keyless wallet.
   */
  @backgroundMethod()
  @toastIfError()
  async validateTokenMatchesKeylessWallet(params: {
    token: string;
    skipFixProvider?: boolean;
  }): Promise<{
    isValid: boolean;
  }> {
    const { token, skipFixProvider } = params;
    const socialUserId = this.buildKeylessSocialUserIdFromToken({ token });
    if (!socialUserId) {
      throw new OneKeyLocalError('Social user ID is required');
    }
    const socialUserIdHash = await accountUtils.hashKeylessSocialUserId({
      socialUserId,
    });
    if (!socialUserIdHash) {
      throw new OneKeyLocalError('Social user ID hash is required');
    }

    const socialProvider = this.buildKeylessProviderFromSocialToken({
      token,
    });
    if (!socialProvider) {
      throw new OneKeyLocalError('Social provider is required');
    }

    const keylessWallet =
      await this.backgroundApi.serviceAccount.getKeylessWallet();

    const walletSocialUserIdHash =
      keylessWallet?.keylessDetailsInfo?.socialUserIdHash || '';
    const walletSocialProvider =
      keylessWallet?.keylessDetailsInfo?.keylessProvider || '';

    if (!walletSocialUserIdHash) {
      throw new OneKeyLocalError(
        'Keyless wallet social user ID hash is required',
      );
    }
    if (!walletSocialProvider) {
      throw new OneKeyLocalError('Keyless wallet social provider is required');
    }

    if (
      !skipFixProvider &&
      socialUserId &&
      walletSocialProvider &&
      socialUserIdHash === walletSocialUserIdHash &&
      socialProvider !== walletSocialProvider
    ) {
      // fix provider
      this.fixedKeylessProviderMap[socialUserId] = walletSocialProvider;
      return this.validateTokenMatchesKeylessWallet({
        token,
        skipFixProvider: true,
      });
    }
    return {
      isValid:
        socialUserIdHash === walletSocialUserIdHash &&
        socialProvider === walletSocialProvider,
    };
  }

  @backgroundMethod()
  @toastIfError()
  async apiCheckRateLimitStatus(params: { token: string }): Promise<{
    isRateLimited: boolean;
    retryAfterSeconds: number;
    guessesRemaining: number;
  }> {
    const { token } = params;
    // getJuiceboxClientFromCache already calls exchangeToken internally when creating a new client
    // Do not call exchangeToken again as each token can only be exchanged once
    const client = await this.getJuiceboxClientFromCache(token);
    return client.checkRateLimitStatus();
  }

  private async getAllKeylessWallets(): Promise<IDBWallet[]> {
    const { wallets } = await this.backgroundApi.serviceAccount.getAllWallets({
      refillWalletInfo: true,
    });
    return wallets.filter((w) => w.isKeyless);
  }

  @backgroundMethod()
  async updateKeylessDataPasscode(params: {
    oldPassword: string;
    newPassword: string;
  }): Promise<{
    rollback: () => Promise<void>;
  }> {
    const { oldPassword, newPassword } = params;

    const keylessWallets = await this.getAllKeylessWallets();

    if (keylessWallets.length === 0) {
      return { rollback: async () => {} };
    }

    const backupData: Array<{
      ownerId: string;
      mnemonicPassword: string | null;
      refreshToken: string | null;
    }> = [];

    for (const wallet of keylessWallets) {
      const ownerId = wallet.keylessDetailsInfo?.keylessOwnerId;
      // eslint-disable-next-line no-continue
      if (!ownerId) continue;

      const mnemonicPassword =
        await keylessMnemonicPasswordStorage.getMnemonicPasswordFromStorageWithPassword(
          {
            ownerId,
            password: oldPassword,
            backgroundApi: this.backgroundApi,
          },
        );

      const refreshToken =
        await keylessRefreshTokenStorage.getRefreshTokenFromStorageWithPassword(
          {
            ownerId,
            password: oldPassword,
            backgroundApi: this.backgroundApi,
          },
        );

      backupData.push({
        ownerId,
        mnemonicPassword,
        refreshToken,
      });
    }

    for (const backup of backupData) {
      if (backup.mnemonicPassword) {
        await keylessMnemonicPasswordStorage.saveMnemonicPasswordToStorageWithPassword(
          {
            ownerId: backup.ownerId,
            mnemonicPassword: backup.mnemonicPassword,
            password: newPassword,
            backgroundApi: this.backgroundApi,
          },
        );
      }

      if (backup.refreshToken) {
        await keylessRefreshTokenStorage.saveRefreshTokenToStorageWithPassword({
          ownerId: backup.ownerId,
          refreshToken: backup.refreshToken,
          password: newPassword,
          backgroundApi: this.backgroundApi,
        });
      }
    }

    return {
      rollback: async () => {
        for (const backup of backupData) {
          if (backup.mnemonicPassword) {
            await keylessMnemonicPasswordStorage.saveMnemonicPasswordToStorageWithPassword(
              {
                ownerId: backup.ownerId,
                mnemonicPassword: backup.mnemonicPassword,
                password: oldPassword,
                backgroundApi: this.backgroundApi,
              },
            );
          }
          if (backup.refreshToken) {
            await keylessRefreshTokenStorage.saveRefreshTokenToStorageWithPassword(
              {
                ownerId: backup.ownerId,
                refreshToken: backup.refreshToken,
                password: oldPassword,
                backgroundApi: this.backgroundApi,
              },
            );
          }
        }
      },
    };
  }
}

export default ServiceKeylessWallet;
