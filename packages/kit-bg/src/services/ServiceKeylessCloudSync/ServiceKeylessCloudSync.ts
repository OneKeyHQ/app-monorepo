/* eslint-disable no-continue */
import { Semaphore } from 'async-mutex';

import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import systemTimeUtils, {
  ELocalSystemTimeStatus,
} from '@onekeyhq/shared/src/utils/systemTimeUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IKeylessCloudSyncCredential } from '@onekeyhq/shared/types/keylessCloudSync';
import { ECloudSyncMode } from '@onekeyhq/shared/types/keylessCloudSync';
import type {
  ICloudSyncCheckServerStatusPostData,
  ICloudSyncCredential,
  ICloudSyncDownloadPostData,
  ICloudSyncRawDataJson,
  ICloudSyncUploadPostData,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import localDb from '../../dbs/local/localDb';
import { primeCloudSyncPersistAtom } from '../../states/jotai/atoms';
import ServiceBase from '../ServiceBase';
import keylessSyncCredentialStorage from '../ServiceKeylessWallet/utils/keylessSyncCredentialStorage';
import cloudSyncItemBuilder from '../ServicePrimeCloudSync/cloudSyncItemBuilder';
import { keylessCloudSyncApi } from '../ServicePrimeCloudSync/keylessCloudSyncApi';
import keylessCloudSyncUtils from '../ServicePrimeCloudSync/keylessCloudSyncUtils';

import type { IDBCloudSyncItem, IDBWallet } from '../../dbs/local/types';

@backgroundClass()
class ServiceKeylessCloudSync extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  private repairCredentialMutex = new Semaphore(1);

  async getKeylessWallet(): Promise<IDBWallet | null> {
    const keylessWallet =
      await this.backgroundApi.serviceAccount.getKeylessWallet();
    await this.setPersistedCurrentCloudSyncKeylessWalletId(
      keylessWallet?.id ?? null,
    );
    return keylessWallet ?? null;
  }

  async getKeylessCloudSyncCredential(): Promise<IKeylessCloudSyncCredential | null> {
    const keylessWalletId = await this.getCurrentCloudSyncKeylessWalletId();
    if (!keylessWalletId) {
      return null;
    }
    const credential =
      this.getKeylessCloudSyncCredentialCacheSync(keylessWalletId);
    if (credential) {
      return credential;
    }
    await this.hydrateKeylessSyncCredentialFromStorageIfNeeded();
    return this.getKeylessCloudSyncCredentialCacheSync(keylessWalletId) ?? null;
  }

  async getActiveSyncMode(): Promise<ECloudSyncMode> {
    const { isCloudSyncEnabled, isCloudSyncEnabledKeyless } =
      await primeCloudSyncPersistAtom.get();
    if (isCloudSyncEnabled) {
      return ECloudSyncMode.OnekeyId;
    }
    if (isCloudSyncEnabledKeyless) {
      return ECloudSyncMode.Keyless;
    }
    return ECloudSyncMode.None;
  }

  async getKeylessSyncAuth<T extends Record<string, unknown>>({
    postData,
  }: {
    postData: T;
  }): Promise<{
    publicKey: string;
    signatureHeader: string;
    pwdHash: string | undefined;
    fullPostData: T & { pwdHash: string | undefined };
  } | null> {
    const syncCredential =
      await this.backgroundApi.servicePrimeCloudSync.getSyncCredentialSafe();
    const keylessCredential = syncCredential?.keylessCredential;
    if (!keylessCredential) {
      return null;
    }
    const pwdHash = syncCredential.keylessCredential?.pwdHash;
    const fullPostData = { ...postData, pwdHash };
    const dataString = stringUtils.stableStringify(fullPostData);
    const dataHash = keylessCloudSyncUtils.computeDataHash(dataString);
    const signatureHeader = keylessCloudSyncUtils.buildKeylessSignatureHeader({
      signingPrivateKey: keylessCredential.signingPrivateKey,
      signingPublicKey: keylessCredential.signingPublicKey,
      dataHash,
    });
    return {
      publicKey: keylessCredential.signingPublicKey,
      signatureHeader,
      pwdHash,
      fullPostData,
    };
  }

  async apiCheckServerStatusKeyless({
    postData,
  }: {
    postData: ICloudSyncCheckServerStatusPostData;
  }) {
    const auth = await this.getKeylessSyncAuth({
      postData,
    });
    if (!auth) {
      throw new OneKeyError('Keyless sync auth is not found');
    }

    const client = await this.backgroundApi.servicePrime.getPrimeClient();

    const response = await keylessCloudSyncApi.checkStatus({
      client,
      signatureHeader: auth.signatureHeader,
      postData: auth.fullPostData,
    });
    return {
      response,
      pwdHash: auth.pwdHash,
    };
  }

  async apiDownloadItemsKeyless({
    postData,
  }: {
    postData: ICloudSyncDownloadPostData;
  }) {
    const auth = await this.getKeylessSyncAuth({
      postData,
    });
    if (!auth) {
      throw new OneKeyError('Keyless sync auth is not found');
    }

    const client = await this.backgroundApi.servicePrime.getPrimeClient();

    const response = await keylessCloudSyncApi.download({
      client,
      signatureHeader: auth.signatureHeader,
      postData: auth.fullPostData,
    });
    return response.data.data;
  }

  async apiUploadItemsKeyless({
    postData,
    urlPath,
  }: {
    postData: ICloudSyncUploadPostData;
    urlPath: string;
  }) {
    const auth = await this.getKeylessSyncAuth({
      postData,
    });
    if (!auth) {
      throw new OneKeyError('Keyless sync auth is not found');
    }

    const client = await this.backgroundApi.servicePrime.getPrimeClient();

    const response = await keylessCloudSyncApi.upload({
      client,
      signatureHeader: auth.signatureHeader,
      postData: auth.fullPostData,
      urlPath,
    });
    return response.data.data;
  }

  computePwdHashForMode(
    syncCredential: ICloudSyncCredential | undefined,
    targetMode: ECloudSyncMode,
  ): string {
    if (!syncCredential) {
      return '';
    }
    if (targetMode === ECloudSyncMode.Keyless) {
      return syncCredential?.keylessCredential?.pwdHash || '';
    }
    return syncCredential?.masterPasswordUUID || '';
  }

  buildCredentialForTargetMode(
    syncCredential: ICloudSyncCredential | undefined,
    targetMode: ECloudSyncMode,
  ): ICloudSyncCredential | undefined {
    if (!syncCredential) {
      return undefined;
    }
    if (targetMode === ECloudSyncMode.Keyless) {
      return syncCredential.keylessCredential ? syncCredential : undefined;
    }
    return {
      ...syncCredential,
      keylessCredential: undefined,
    };
  }

  async convertSyncItemsForModeSwitch({
    items,
    targetMode,
    syncCredential,
  }: {
    items: IDBCloudSyncItem[];
    targetMode: ECloudSyncMode;
    syncCredential: ICloudSyncCredential | undefined;
  }): Promise<IDBCloudSyncItem[]> {
    if (targetMode === ECloudSyncMode.None || !syncCredential) {
      return items;
    }

    const convertedItems: IDBCloudSyncItem[] = [];
    const targetPwdHash = this.computePwdHashForMode(
      syncCredential,
      targetMode,
    );

    for (const item of items) {
      try {
        if (item.dataType === EPrimeCloudSyncDataType.Lock) {
          convertedItems.push(item);
          continue;
        }

        if (item.pwdHash === targetPwdHash && item.data) {
          convertedItems.push(item);
          continue;
        }

        let rawDataJson: ICloudSyncRawDataJson | undefined;
        if (item.data) {
          try {
            const decrypted = await cloudSyncItemBuilder.decryptSyncItem({
              item,
              syncCredential,
            });
            rawDataJson = decrypted.rawDataJson;
          } catch (error) {
            console.error(
              `[PrimeCloudSync] Failed to decrypt item ${item.id}:`,
              error,
            );
          }
        }

        if (!rawDataJson && item.rawData) {
          try {
            rawDataJson = JSON.parse(item.rawData) as ICloudSyncRawDataJson;
          } catch {
            // Ignore parse error and keep original item.
          }
        }

        if (!rawDataJson) {
          console.warn(
            `[PrimeCloudSync] Cannot decrypt item ${item.id}, skipping conversion`,
          );
          convertedItems.push(item);
          continue;
        }

        const targetCredential = this.buildCredentialForTargetMode(
          syncCredential,
          targetMode,
        );
        const reEncrypted =
          await cloudSyncItemBuilder.buildSyncItemFromRawDataJson({
            key: item.id,
            rawDataJson,
            syncCredential: targetCredential,
            dataTime: Date.now(),
          });

        convertedItems.push({
          ...reEncrypted,
          serverUploaded: false,
        });
      } catch (error) {
        console.error(
          `[PrimeCloudSync] Failed to convert item ${item.id}:`,
          error,
        );
        convertedItems.push(item);
      }
    }

    return convertedItems;
  }

  async handleModeSwitchConversion(newMode: ECloudSyncMode): Promise<void> {
    if (newMode === ECloudSyncMode.None) {
      return;
    }

    const syncCredential =
      await this.backgroundApi.servicePrimeCloudSync.getSyncCredentialSafe();
    if (!syncCredential) {
      return;
    }

    const { syncItems } = await localDb.getAllSyncItems();
    const itemsToConvert = syncItems.filter(
      (item) => item.dataType !== EPrimeCloudSyncDataType.Lock,
    );

    if (itemsToConvert.length === 0) {
      return;
    }

    const targetPwdHash = this.computePwdHashForMode(syncCredential, newMode);
    const itemsNeedConversion = itemsToConvert.filter(
      (item) => item.pwdHash !== targetPwdHash || !item.data,
    );

    if (itemsNeedConversion.length === 0) {
      return;
    }

    const convertedItems = await this.convertSyncItemsForModeSwitch({
      items: itemsNeedConversion,
      targetMode: newMode,
      syncCredential,
    });

    const itemsNeedUpdate = convertedItems.filter((converted, index) => {
      const original = itemsNeedConversion[index];
      return (
        converted.pwdHash !== original.pwdHash ||
        converted.data !== original.data ||
        converted.rawData !== original.rawData
      );
    });

    if (itemsNeedUpdate.length > 0) {
      await localDb.addAndUpdateSyncItems({
        items: itemsNeedUpdate,
        skipUploadToServer: true,
      });
      console.log(
        `[PrimeCloudSync] Mode switch conversion completed for ${itemsNeedUpdate.length} items`,
      );
    }
  }

  keylessCloudSyncCredentialCache = new cacheUtils.LRUCache<
    string,
    IKeylessCloudSyncCredential
  >({
    max: 1000,
    ttl: timerUtils.getTimeDurationMs({ minute: 5 }),
    ttlAutopurge: true,
  });

  currentCloudSyncKeylessWalletIdCache: string | null | undefined;

  async setPersistedCurrentCloudSyncKeylessWalletId(
    currentCloudSyncKeylessWalletId: string | null,
  ) {
    this.currentCloudSyncKeylessWalletIdCache = currentCloudSyncKeylessWalletId;
    await primeCloudSyncPersistAtom.set((v) => {
      if (
        v.currentCloudSyncKeylessWalletId === currentCloudSyncKeylessWalletId
      ) {
        return v;
      }
      return {
        ...v,
        currentCloudSyncKeylessWalletId,
      };
    });
  }

  async syncPersistedCurrentCloudSyncKeylessWalletIdWithWallets(
    wallets: IDBWallet[],
    options?: {
      /**
       * When `wallets` contains no keyless wallet:
       * - `'clear'`: persist `currentCloudSyncKeylessWalletId` as `null` (default).
       * - `'skip'`: do not change persisted value (e.g. filtered `getWallets` list).
       */
      whenNoKeyless?: 'clear' | 'skip';
    },
  ): Promise<void> {
    const whenNoKeyless = options?.whenNoKeyless ?? 'clear';
    const currentCloudSyncKeylessWalletId: string | null =
      wallets
        .filter((wallet) => wallet.isKeyless)
        .toSorted((a, b) => a.id.localeCompare(b.id))[0]?.id || null;
    if (!currentCloudSyncKeylessWalletId && whenNoKeyless === 'skip') {
      return;
    }
    this.currentCloudSyncKeylessWalletIdCache = currentCloudSyncKeylessWalletId;
    await this.setPersistedCurrentCloudSyncKeylessWalletId(
      currentCloudSyncKeylessWalletId,
    );
    if (!currentCloudSyncKeylessWalletId) {
      await keylessSyncCredentialStorage.removeAllCredentials();
    }
  }

  async getCurrentCloudSyncKeylessWalletId(): Promise<string | null> {
    if (this.currentCloudSyncKeylessWalletIdCache !== undefined) {
      return this.currentCloudSyncKeylessWalletIdCache;
    }
    const { currentCloudSyncKeylessWalletId, isCloudSyncEnabledKeyless } =
      await primeCloudSyncPersistAtom.get();
    if (currentCloudSyncKeylessWalletId) {
      this.currentCloudSyncKeylessWalletIdCache =
        currentCloudSyncKeylessWalletId;
      return this.currentCloudSyncKeylessWalletIdCache;
    }
    if (
      currentCloudSyncKeylessWalletId === null &&
      !isCloudSyncEnabledKeyless
    ) {
      this.currentCloudSyncKeylessWalletIdCache = null;
      return this.currentCloudSyncKeylessWalletIdCache;
    }
    return null;
  }

  setKeylessCloudSyncCredentialCache(
    keylessCloudSyncCredential: IKeylessCloudSyncCredential,
  ) {
    this.currentCloudSyncKeylessWalletIdCache =
      keylessCloudSyncCredential.keylessWalletId;
    this.keylessCloudSyncCredentialCache.set(
      keylessCloudSyncCredential.keylessWalletId,
      keylessCloudSyncCredential,
    );
  }

  /**
   * Load encrypted keyless sync credential into memory before a long IndexedDB
   * transaction. Never await storage reads while an IDB tx is open.
   */
  @backgroundMethod()
  async hydrateKeylessSyncCredentialFromStorageIfNeeded(): Promise<void> {
    const keylessWalletId = await this.getCurrentCloudSyncKeylessWalletId();
    if (!keylessWalletId) {
      return;
    }
    if (this.getKeylessCloudSyncCredentialCacheSync(keylessWalletId)) {
      return;
    }
    const credential =
      await keylessSyncCredentialStorage.getCredential(keylessWalletId);
    if (!credential) {
      return;
    }
    if (credential.keylessWalletId !== keylessWalletId) {
      await keylessSyncCredentialStorage.removeAllCredentials();
      return;
    }
    this.setKeylessCloudSyncCredentialCache(credential);
  }

  getKeylessCloudSyncCredentialCacheSync(
    keylessWalletId: string,
  ): IKeylessCloudSyncCredential | undefined {
    return this.keylessCloudSyncCredentialCache.get(keylessWalletId);
  }

  async getKeylessCloudSyncCredentialCache({
    keylessWalletId,
  }: {
    keylessWalletId?: string;
  } = {}) {
    const currentCloudSyncKeylessWalletId =
      keylessWalletId ?? (await this.getCurrentCloudSyncKeylessWalletId());
    if (!currentCloudSyncKeylessWalletId) {
      return undefined;
    }
    return this.keylessCloudSyncCredentialCache.get(
      currentCloudSyncKeylessWalletId,
    );
  }

  clearKeylessCloudSyncCredentialCache({
    keylessWalletId,
  }: {
    keylessWalletId?: string;
  } = {}) {
    if (keylessWalletId) {
      this.keylessCloudSyncCredentialCache.delete(keylessWalletId);
      if (this.currentCloudSyncKeylessWalletIdCache === keylessWalletId) {
        this.currentCloudSyncKeylessWalletIdCache = undefined;
      }
      return;
    }
    this.keylessCloudSyncCredentialCache.clear();
    this.currentCloudSyncKeylessWalletIdCache = undefined;
  }

  async repairKeylessSyncCredentialIfNeeded({
    password,
  }: {
    password: string;
  }): Promise<void> {
    await this.repairCredentialMutex.runExclusive(async () => {
      const walletId = await this.getCurrentCloudSyncKeylessWalletId();
      if (!walletId) {
        return;
      }
      const existing =
        await keylessSyncCredentialStorage.getCredential(walletId);
      if (existing?.keylessWalletId === walletId) {
        return;
      }
      if (existing) {
        await keylessSyncCredentialStorage.removeAllCredentials();
      }
      // Credential missing — re-derive from seed while password is available
      try {
        const credentialRecord = await localDb.getCredential(walletId);
        if (!credentialRecord?.credential) {
          return;
        }
        const { decryptRevealableSeed } =
          await import('@onekeyhq/core/src/secret');
        const { default: bufferUtils } =
          await import('@onekeyhq/shared/src/utils/bufferUtils');
        const revealableSeed = await decryptRevealableSeed({
          rs: credentialRecord.credential,
          password,
        });
        const seedBuffer = bufferUtils.toBuffer(revealableSeed.seed, 'hex');
        const credential = await keylessCloudSyncUtils.deriveKeylessCredential({
          seed: seedBuffer,
          keylessWalletId: walletId,
        });
        await keylessSyncCredentialStorage.saveCredential(credential);
        this.setKeylessCloudSyncCredentialCache(credential);
      } catch (error) {
        console.error(
          '[ServiceKeylessCloudSync] Failed to repair credential:',
          error,
        );
      }
    });
  }

  buildSyncCredentialWithKeylessCredential(
    keylessCredential: IKeylessCloudSyncCredential,
  ): ICloudSyncCredential {
    return {
      primeAccountSalt: '',
      securityPasswordR1: '',
      masterPasswordUUID: '',
      keylessCredential,
    };
  }

  async setCloudSyncEnabledKeyless(enabled: boolean): Promise<boolean> {
    const shouldEnableKeyless = enabled;

    if (shouldEnableKeyless) {
      const keylessWallet = await this.getKeylessWallet();
      if (!keylessWallet) {
        await this.setPersistedCurrentCloudSyncKeylessWalletId(null);
        await primeCloudSyncPersistAtom.set((v) => ({
          ...v,
          isCloudSyncEnabledKeyless: false,
        }));
        await this.backgroundApi.serviceApp.showToast({
          method: 'error',
          title: appLocale.intl.formatMessage({
            id: ETranslations.global_no_wallet,
          }),
          message: appLocale.intl.formatMessage({
            id: ETranslations.create_keyless_wallet,
          }),
        });
        return false;
      }
      await this.setPersistedCurrentCloudSyncKeylessWalletId(keylessWallet.id);

      const { isCloudSyncEnabled } = await primeCloudSyncPersistAtom.get();
      if (isCloudSyncEnabled) {
        await this.backgroundApi.servicePrimeCloudSync.setCloudSyncEnabled(
          false,
        );
      }
    }

    await primeCloudSyncPersistAtom.set((v) => ({
      ...v,
      isCloudSyncEnabled: shouldEnableKeyless ? false : v.isCloudSyncEnabled,
      isCloudSyncEnabledKeyless: shouldEnableKeyless,
    }));
    await this.backgroundApi.servicePrimeCloudSync.clearCachedSyncCredential();

    if (shouldEnableKeyless) {
      // Re-hydrate credential cache after clearing stale entries
      await this.hydrateKeylessSyncCredentialFromStorageIfNeeded();
    }

    // Remove persisted credential when disabling keyless sync
    if (!shouldEnableKeyless) {
      const currentWalletId = await this.getCurrentCloudSyncKeylessWalletId();
      if (currentWalletId) {
        await keylessSyncCredentialStorage.removeAllCredentials();
      }
    }

    return shouldEnableKeyless;
  }

  @backgroundMethod()
  @toastIfError()
  async toggleCloudSyncKeyless({
    enabled,
    silentEnable = false,
    forceEnable = false,
  }: {
    enabled: boolean;
    silentEnable?: boolean;
    forceEnable?: boolean;
  }) {
    try {
      if (enabled) {
        const { success } = await this.prepareCloudSyncKeyless({
          silentEnable,
        });
        const shouldEnable = success || forceEnable;
        await this.setCloudSyncEnabledKeyless(shouldEnable);
        if (success) {
          if (!silentEnable) {
            await timerUtils.wait(0);
            await this.showDialogLoading({
              title: appLocale.intl.formatMessage({
                id: ETranslations.global_syncing,
              }),
            });
            try {
              await this.backgroundApi.servicePrimeCloudSync.startServerSyncFlow(
                {
                  setUndefinedTimeToNow: true,
                  callerName: 'Enable Keyless Cloud Sync',
                },
              );
            } finally {
              await timerUtils.wait(1000);
              await this.hideDialogLoading();
            }
          } else {
            await this.backgroundApi.servicePrimeCloudSync.startServerSyncFlow({
              setUndefinedTimeToNow: true,
              callerName: 'Enable Keyless Cloud Sync',
            });
          }
        }
      } else {
        await this.setCloudSyncEnabledKeyless(false);
      }
    } catch (error) {
      if (enabled && forceEnable) {
        await this.setCloudSyncEnabledKeyless(true);
      } else {
        await this.setCloudSyncEnabledKeyless(false);
      }
      throw error;
    } finally {
      void this.backgroundApi.servicePrime.apiFetchPrimeUserInfo();
    }
  }

  @backgroundMethod()
  async autoEnableCloudSyncKeyless() {
    const { wallets } = await this.backgroundApi.serviceAccount.getAllWallets();
    await this.syncPersistedCurrentCloudSyncKeylessWalletIdWithWallets(wallets);
    const { isCloudSyncEnabledKeyless, isCloudSyncEnabled } =
      await primeCloudSyncPersistAtom.get();
    if (isCloudSyncEnabledKeyless) {
      return;
    }
    if (isCloudSyncEnabled) {
      return;
    }
    // If ID sync is active, sync ID data first before switching (auto-migration)
    const isMigrationFromId = isCloudSyncEnabled;
    if (isMigrationFromId) {
      try {
        await this.backgroundApi.servicePrimeCloudSync.startServerSyncFlow({
          callerName: 'Auto-migration: ID sync before switch',
          noDebounceUpload: true,
        });
      } catch {
        // ID sync failure shouldn't block auto-enable
      }
    }
    try {
      await this.toggleCloudSyncKeyless({
        enabled: true,
        silentEnable: true,
        forceEnable: true,
      });
    } catch (error) {
      errorUtils.autoPrintErrorIgnore(error);
      void this.backgroundApi.serviceApp.showToast({
        method: 'error',
        title: appLocale.intl.formatMessage({
          id: ETranslations.global_sync_error,
        }),
      });
    }
  }

  async prepareCloudSyncKeyless({
    silentEnable = false,
  }: {
    silentEnable?: boolean;
  } = {}): Promise<{
    success: boolean;
  }> {
    if (systemTimeUtils.systemTimeStatus === ELocalSystemTimeStatus.INVALID) {
      throw new OneKeyError(
        appLocale.intl.formatMessage({
          id: ETranslations.prime_time_error_description,
        }),
      );
    }

    const keylessWallet = await this.getKeylessWallet();
    if (!keylessWallet) {
      await this.backgroundApi.serviceApp.showToast({
        method: 'error',
        title: appLocale.intl.formatMessage({
          id: ETranslations.global_no_wallet,
        }),
        message: appLocale.intl.formatMessage({
          id: ETranslations.create_keyless_wallet,
        }),
      });

      return { success: false };
    }

    const { password } =
      await this.backgroundApi.servicePassword.promptPasswordVerify();

    // Ensure credential exists before proceeding (auto-repair if missing)
    await this.repairKeylessSyncCredentialIfNeeded({ password });

    const keylessCredential = await this.getKeylessCloudSyncCredential();
    if (!keylessCredential) {
      throw new OneKeyError('Failed to get keyless credential');
    }

    if (silentEnable) {
      const syncCredential =
        this.buildSyncCredentialWithKeylessCredential(keylessCredential);
      await this.backgroundApi.servicePrimeCloudSync.initLocalSyncItemsDB({
        password,
        syncCredential,
      });
      await timerUtils.wait(1000);
    } else {
      await this.withDialogLoading(
        {
          title: appLocale.intl.formatMessage({
            id: ETranslations.global_processing,
          }),
        },
        async () => {
          const syncCredential =
            this.buildSyncCredentialWithKeylessCredential(keylessCredential);
          await this.backgroundApi.servicePrimeCloudSync.initLocalSyncItemsDB({
            password,
            syncCredential,
          });
          await timerUtils.wait(1000);
        },
      );
    }

    return { success: true };
  }
}

export default ServiceKeylessCloudSync;
