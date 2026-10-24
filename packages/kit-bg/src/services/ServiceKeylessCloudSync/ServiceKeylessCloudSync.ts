/* eslint-disable no-continue */
import { Semaphore } from 'async-mutex';

import { getPbkdf2KdfParamsForNonDbTx } from '@onekeyhq/shared/src/appCrypto/modules/pbkdf2';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import systemTimeUtils, {
  ECloudSyncDataTimeSource,
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

  // Keep the explicit "Switch Now" intent in memory until the keyless wallet is created.
  private pendingAutoEnableCloudSyncKeyless = false;

  private repairCredentialMutex = new Semaphore(1);

  private cloudSyncKeyMutex = new Semaphore(1);

  private hardwareCloudKeyGeneration = 0;

  private hardwareCloudKeyPending = false;

  private hardwareCloudKeyCommitting = false;

  async persistNewKeylessCloudSyncCredential(
    credential: IKeylessCloudSyncCredential,
  ) {
    await this.runWithCloudSyncKeyLock(() =>
      this.repairCredentialMutex.runExclusive(async () => {
        if (await this.shouldPreserveHardwareCloudKey()) return;
        await keylessSyncCredentialStorage.saveCredential(credential);
        this.setKeylessCloudSyncCredentialCache(credential);
      }),
    );
  }

  async shouldPreserveHardwareCloudKey(): Promise<boolean> {
    return (
      this.hardwareCloudKeyPending ||
      !!(await primeCloudSyncPersistAtom.get()).hardwareCloudSyncKeySource
    );
  }

  @backgroundMethod()
  async cancelHardwareCloudKeyOperation() {
    // After commit starts, complete it atomically instead of acknowledging a late cancel.
    if (this.hardwareCloudKeyCommitting) return false;
    this.hardwareCloudKeyGeneration += 1;
    return true;
  }

  // Shared with the complete sync flow, so a late download cannot cross a key change.
  runWithCloudSyncKeyLock<T>(operation: () => Promise<T>): Promise<T> {
    return this.cloudSyncKeyMutex.runExclusive(operation);
  }

  @backgroundMethod()
  async getHardwareCloudSyncCandidates() {
    const { wallets } = await this.backgroundApi.serviceAccount.getAllWallets();
    return wallets
      .filter(
        (wallet) =>
          accountUtils.isHwWallet({ walletId: wallet.id }) &&
          !wallet.passphraseState &&
          !!wallet.xfp,
      )
      .map((wallet) => ({ id: wallet.id, name: wallet.name }));
  }

  private async assertCloudKeySelectionCanChange(targetId?: string) {
    const config = await primeCloudSyncPersistAtom.get();
    if (config.isCloudSyncEnabled || config.isCloudSyncEnabledKeyless) {
      throw new OneKeyError('Turn off Cloud sync before changing its key.');
    }
    if (targetId && config.currentCloudSyncKeylessWalletId === targetId) {
      return;
    }
    const { items } =
      await this.backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems();
    if (items.some((item) => !!item.pwdHash)) {
      throw new OneKeyError(
        'This profile already has Cloud data. Changing its key requires a migration that is not available yet. Existing data has been preserved.',
      );
    }
  }

  @backgroundMethod()
  @toastIfError()
  async enableHardwareCloudSync({ walletId }: { walletId: string }) {
    if (!platformEnv.isDev) {
      throw new OneKeyError(
        'Hardware Cloud keys require device compatibility validation.',
      );
    }
    this.hardwareCloudKeyGeneration += 1;
    const generation = this.hardwareCloudKeyGeneration;
    await this.runWithCloudSyncKeyLock(() =>
      this.repairCredentialMutex.runExclusive(async () => {
        this.hardwareCloudKeyPending = true;
        try {
          const previous = await primeCloudSyncPersistAtom.get();
          const { normalizeHardwareCloudWalletXfp } =
            await import('./hardwareCloudSyncCredential');
          const selectedWallet = await this.backgroundApi.localDb.getWallet({
            walletId,
          });
          const sameRoot =
            !!previous.hardwareCloudSyncKeySource &&
            !!selectedWallet.xfp &&
            normalizeHardwareCloudWalletXfp(
              previous.hardwareCloudSyncKeySource.walletXfp,
            ) === normalizeHardwareCloudWalletXfp(selectedWallet.xfp);
          await this.assertCloudKeySelectionCanChange(
            sameRoot
              ? previous.hardwareCloudSyncKeySource?.credentialId
              : undefined,
          );
          const { generateHardwareCloudSyncCredentialWithSdk } =
            await import('./hardwareCloudSyncSdk');
          const { credential, source } =
            await generateHardwareCloudSyncCredentialWithSdk({
              backgroundApi: this.backgroundApi,
              walletId,
              isCurrent: () => this.hardwareCloudKeyGeneration === generation,
            });
          await this.assertCloudKeySelectionCanChange(source.credentialId);
          if (this.hardwareCloudKeyGeneration !== generation) {
            throw new OneKeyError(
              'Hardware Cloud key operation was cancelled.',
            );
          }
          const { items } =
            await this.backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems();
          const existing =
            previous.currentCloudSyncKeylessWalletId === source.credentialId
              ? await keylessSyncCredentialStorage.getCredential(
                  source.credentialId,
                )
              : null;
          if (
            items.some(
              (item) => item.pwdHash && item.pwdHash !== credential.pwdHash,
            ) ||
            (existing &&
              (existing.pwdHash !== credential.pwdHash ||
                existing.signingPublicKey !== credential.signingPublicKey))
          ) {
            throw new OneKeyError(
              'This hardware produced a different Cloud key. Existing data and credentials have been preserved.',
            );
          }
          if (this.hardwareCloudKeyGeneration !== generation) {
            throw new OneKeyError(
              'Hardware Cloud key operation was cancelled.',
            );
          }
          this.hardwareCloudKeyCommitting = true;
          await keylessSyncCredentialStorage.saveCredential({
            ...credential,
            source,
          });
          await this.backgroundApi.servicePrimeCloudSync.clearCachedSyncCredential();
          await primeCloudSyncPersistAtom.set((value) => ({
            ...value,
            hardwareCloudSyncKeySource: source,
            currentCloudSyncKeylessWalletId: source.credentialId,
            isCloudSyncEnabled: false,
            isCloudSyncEnabledKeyless: false,
            lastSyncTimeKeyless: undefined,
          }));
          this.setKeylessCloudSyncCredentialCache({ ...credential, source });
          await this.backgroundApi.servicePrimeCloudSync.initLocalSyncItemsDB({
            syncCredential: this.buildSyncCredentialWithKeylessCredential({
              ...credential,
              source,
            }),
          });
          await primeCloudSyncPersistAtom.set((value) => ({
            ...value,
            isCloudSyncEnabledKeyless: true,
          }));
        } finally {
          this.hardwareCloudKeyCommitting = false;
          this.hardwareCloudKeyPending = false;
        }
      }),
    );
  }

  @backgroundMethod()
  @toastIfError()
  async selectKeylessCloudSyncKey() {
    await this.runWithCloudSyncKeyLock(async () => {
      const selected = (await primeCloudSyncPersistAtom.get())
        .hardwareCloudSyncKeySource;
      if (!selected) return;
      const wallet = await this.backgroundApi.serviceAccount.getKeylessWallet();
      if (!wallet)
        throw new OneKeyError('Add a Keyless wallet before selecting it.');
      await this.assertCloudKeySelectionCanChange(wallet.id);
      await this.backgroundApi.servicePrimeCloudSync.clearCachedSyncCredential();
      await primeCloudSyncPersistAtom.set((value) => ({
        ...value,
        hardwareCloudSyncKeySource: undefined,
        currentCloudSyncKeylessWalletId: wallet.id,
        lastSyncTimeKeyless: undefined,
      }));
      this.currentCloudSyncKeylessWalletIdCache = wallet.id;
    });
  }

  @backgroundMethod()
  async setPendingAutoEnableCloudSyncKeyless(enabled: boolean) {
    this.pendingAutoEnableCloudSyncKeyless = enabled;
  }

  async getKeylessWallet(): Promise<IDBWallet | null> {
    const source = (await primeCloudSyncPersistAtom.get())
      .hardwareCloudSyncKeySource;
    if (source) {
      return (
        (await this.backgroundApi.localDb.getWallet({
          walletId: source.walletId,
        })) ?? null
      );
    }
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
      if (await this.isCredentialForSelectedSource(credential))
        return credential;
      this.keylessCloudSyncCredentialCache.delete(keylessWalletId);
    }
    await this.hydrateKeylessSyncCredentialFromStorageIfNeeded();
    return this.getKeylessCloudSyncCredentialCacheSync(keylessWalletId) ?? null;
  }

  private async isCredentialForSelectedSource(
    credential: IKeylessCloudSyncCredential,
  ) {
    const source = (await primeCloudSyncPersistAtom.get())
      .hardwareCloudSyncKeySource;
    return source
      ? credential.keylessWalletId === source.credentialId &&
          credential.source?.type === 'hardware' &&
          credential.source.walletXfp === source.walletXfp &&
          credential.source.derivationVersion === source.derivationVersion
      : !credential.source;
  }

  async getActiveSyncMode(): Promise<ECloudSyncMode> {
    const {
      isCloudSyncEnabled,
      isCloudSyncEnabledKeyless,
      hardwareCloudSyncKeySource,
    } = await primeCloudSyncPersistAtom.get();
    if (hardwareCloudSyncKeySource && !platformEnv.isDev)
      return ECloudSyncMode.None;
    if (isCloudSyncEnabled) {
      return ECloudSyncMode.OnekeyId;
    }
    if (isCloudSyncEnabledKeyless) {
      return ECloudSyncMode.Keyless;
    }
    return ECloudSyncMode.None;
  }

  private async getKeylessSignatureTimestamp(): Promise<number> {
    if (!systemTimeUtils.hasFreshServerTimeInCurrentProcess()) {
      try {
        await systemTimeUtils.ensureFreshServerTime();
      } catch (error) {
        errorUtils.autoPrintErrorIgnore(error);
      }
    }
    const correctedNow = systemTimeUtils.getCorrectedCloudSyncNow();
    if (
      correctedNow.source === ECloudSyncDataTimeSource.Estimated ||
      correctedNow.source === ECloudSyncDataTimeSource.TrustedLocal
    ) {
      return correctedNow.time;
    }
    return Date.now();
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
    const timestamp = await this.getKeylessSignatureTimestamp();
    const signatureHeader = keylessCloudSyncUtils.buildKeylessSignatureHeader({
      signingPrivateKey: keylessCredential.signingPrivateKey,
      signingPublicKey: keylessCredential.signingPublicKey,
      dataHash,
      timestamp,
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
    return {
      data: response.data.data,
      pwdHash: auth.pwdHash,
    };
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
            dataTime:
              await this.backgroundApi.servicePrimeCloudSync.getCloudSyncDataTime(
                {
                  syncItemKey: item.id,
                  existingDataTime: item.dataTime,
                },
              ),
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
    const source = (await primeCloudSyncPersistAtom.get())
      .hardwareCloudSyncKeySource;
    if (source && currentCloudSyncKeylessWalletId !== source.credentialId)
      return;
    await primeCloudSyncPersistAtom.set((v) => {
      if (
        v.hardwareCloudSyncKeySource ||
        v.currentCloudSyncKeylessWalletId === currentCloudSyncKeylessWalletId
      ) {
        return v;
      }
      return {
        ...v,
        currentCloudSyncKeylessWalletId,
      };
    });
    const selected = await primeCloudSyncPersistAtom.get();
    this.currentCloudSyncKeylessWalletIdCache =
      selected.hardwareCloudSyncKeySource?.credentialId ??
      selected.currentCloudSyncKeylessWalletId;
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
    if ((await primeCloudSyncPersistAtom.get()).hardwareCloudSyncKeySource)
      return;
    const whenNoKeyless = options?.whenNoKeyless ?? 'clear';
    const currentCloudSyncKeylessWalletId: string | null =
      wallets
        .filter((wallet) => wallet.isKeyless)
        .toSorted((a, b) => a.id.localeCompare(b.id))[0]?.id || null;
    if (!currentCloudSyncKeylessWalletId && whenNoKeyless === 'skip') {
      return;
    }
    await this.repairCredentialMutex.runExclusive(async () => {
      if (await this.shouldPreserveHardwareCloudKey()) return;
      await this.setPersistedCurrentCloudSyncKeylessWalletId(
        currentCloudSyncKeylessWalletId,
      );
      if (!currentCloudSyncKeylessWalletId) {
        await keylessSyncCredentialStorage.removeAllCredentials();
      }
    });
  }

  async getCurrentCloudSyncKeylessWalletId(): Promise<string | null> {
    const source = (await primeCloudSyncPersistAtom.get())
      .hardwareCloudSyncKeySource;
    if (source) return source.credentialId;
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
    const cached = this.getKeylessCloudSyncCredentialCacheSync(keylessWalletId);
    if (cached) {
      if (await this.isCredentialForSelectedSource(cached)) return;
      this.keylessCloudSyncCredentialCache.delete(keylessWalletId);
    }
    const credential =
      await keylessSyncCredentialStorage.getCredential(keylessWalletId);
    if (!credential) {
      return;
    }
    if (
      credential.keylessWalletId !== keylessWalletId ||
      !(await this.isCredentialForSelectedSource(credential))
    ) {
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
    const credential = this.keylessCloudSyncCredentialCache.get(
      currentCloudSyncKeylessWalletId,
    );
    return credential && (await this.isCredentialForSelectedSource(credential))
      ? credential
      : undefined;
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
    throwOnLocalSecretEnvelopeUnavailable,
  }: {
    password: string;
    throwOnLocalSecretEnvelopeUnavailable?: boolean;
  }): Promise<void> {
    if (await this.shouldPreserveHardwareCloudKey()) {
      // Repairing a hardware credential requires the explicit hardware flow, never a local seed.
      return;
    }
    await this.repairCredentialMutex.runExclusive(async () => {
      if (await this.shouldPreserveHardwareCloudKey()) return;
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
        const credentialRecord = await localDb.getCredentialInner({
          credentialId: walletId,
        });
        if (!credentialRecord?.credential) {
          return;
        }
        const { decryptRevealableSeed } =
          await import('@onekeyhq/core/src/secret');
        const { default: bufferUtils } =
          await import('@onekeyhq/shared/src/utils/bufferUtils');
        // The credential read has completed, so no IndexedDB transaction is
        // active while WebCrypto derives the wallet-password key.
        const kdfParams = getPbkdf2KdfParamsForNonDbTx();
        const revealableSeed = await decryptRevealableSeed({
          rs: credentialRecord.credential,
          password,
          ...kdfParams,
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
        if (
          throwOnLocalSecretEnvelopeUnavailable &&
          errorUtils.isErrorByClassName({
            error,
            className: EOneKeyErrorClassNames.LocalSecretEnvelopeUnavailable,
          })
        ) {
          throw error;
        }
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
    return this.runWithCloudSyncKeyLock(() =>
      this.setCloudSyncEnabledKeylessWithKeyLock(enabled),
    );
  }

  private async setCloudSyncEnabledKeylessWithKeyLock(
    enabled: boolean,
  ): Promise<boolean> {
    const shouldEnableKeyless = enabled;

    if (
      enabled &&
      (await primeCloudSyncPersistAtom.get()).hardwareCloudSyncKeySource &&
      !(await this.getKeylessCloudSyncCredential())
    ) {
      throw new OneKeyError(
        'Connect the standard hardware wallet to restore its Cloud key.',
      );
    }

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
        await this.backgroundApi.servicePrimeCloudSync.setCloudSyncEnabledWithKeyLock(
          false,
        );
      }
    }

    await primeCloudSyncPersistAtom.set((v) => ({
      ...v,
      isCloudSyncEnabled: shouldEnableKeyless ? false : v.isCloudSyncEnabled,
      isCloudSyncEnabledKeyless: shouldEnableKeyless,
      hasEverEnabledKeylessSync:
        shouldEnableKeyless ||
        !!v.hasEverEnabledKeylessSync ||
        !!v.isCloudSyncEnabledKeyless ||
        !!v.lastSyncTimeKeyless,
    }));
    await this.backgroundApi.servicePrimeCloudSync.clearCachedSyncCredential();

    if (shouldEnableKeyless) {
      // Re-hydrate credential cache after clearing stale entries
      await this.hydrateKeylessSyncCredentialFromStorageIfNeeded();
    }

    // Remove persisted credential when disabling keyless sync
    if (!shouldEnableKeyless) {
      if ((await primeCloudSyncPersistAtom.get()).hardwareCloudSyncKeySource)
        return false;
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
    handleLocalSecretEnvelopeUnavailable = !silentEnable,
  }: {
    enabled: boolean;
    silentEnable?: boolean;
    forceEnable?: boolean;
    handleLocalSecretEnvelopeUnavailable?: boolean;
  }) {
    try {
      if (enabled) {
        const { success } = await this.prepareCloudSyncKeyless({
          silentEnable,
          throwOnLocalSecretEnvelopeUnavailable:
            handleLocalSecretEnvelopeUnavailable,
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
                  // Re-apply scene updates after the Keyless wallet,
                  // credential, and cached password are all ready. Bot Wallet
                  // items can be skipped during the earlier login window.
                  forceSync: true,
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
              forceSync: true,
            });
          }
        }
      } else {
        await this.setCloudSyncEnabledKeyless(false);
      }
    } catch (error) {
      const shouldHandleLocalSecretEnvelopeUnavailable =
        enabled &&
        handleLocalSecretEnvelopeUnavailable &&
        errorUtils.isErrorByClassName({
          error,
          className: EOneKeyErrorClassNames.LocalSecretEnvelopeUnavailable,
        });
      if (
        enabled &&
        forceEnable &&
        !shouldHandleLocalSecretEnvelopeUnavailable
      ) {
        await this.setCloudSyncEnabledKeyless(true);
      } else {
        await this.setCloudSyncEnabledKeyless(false);
      }
      if (shouldHandleLocalSecretEnvelopeUnavailable) {
        errorToastUtils.showLocalSecretEnvelopeErrorDialogIfNeeded(error);
      }
      throw error;
    } finally {
      void this.backgroundApi.servicePrime.apiFetchPrimeUserInfo();
    }
  }

  @backgroundMethod()
  async enableKeylessCloudSyncWithMigrationIfNeeded({
    showLoading = false,
    ignorePreMigrationSyncError = false,
    handleLocalSecretEnvelopeUnavailable = false,
  }: {
    showLoading?: boolean;
    ignorePreMigrationSyncError?: boolean;
    handleLocalSecretEnvelopeUnavailable?: boolean;
  } = {}) {
    const runMigration = async () => {
      const { isCloudSyncEnabled } = await primeCloudSyncPersistAtom.get();
      if (isCloudSyncEnabled) {
        try {
          await this.backgroundApi.servicePrimeCloudSync.startServerSyncFlow({
            callerName: showLoading
              ? 'Migration: ID sync before switch'
              : 'Auto-migration: ID sync before switch',
            noDebounceUpload: true,
          });
        } catch (error) {
          if (!ignorePreMigrationSyncError) {
            throw error;
          }
        }
      }

      await this.toggleCloudSyncKeyless({
        enabled: true,
        silentEnable: true,
        forceEnable: true,
        handleLocalSecretEnvelopeUnavailable,
      });
      await this.backgroundApi.servicePrimeCloudSync.updateLastSyncTime({
        syncMode: ECloudSyncMode.Keyless,
      });
    };

    if (!showLoading) {
      await runMigration();
      return;
    }

    await this.showDialogLoading({
      title: appLocale.intl.formatMessage({
        id: ETranslations.global_syncing,
      }),
    });
    try {
      await runMigration();
    } finally {
      await timerUtils.wait(1000);
      await this.hideDialogLoading();
    }
  }

  @backgroundMethod()
  async autoEnableCloudSyncKeyless() {
    if ((await primeCloudSyncPersistAtom.get()).hardwareCloudSyncKeySource)
      return;
    const { wallets } = await this.backgroundApi.serviceAccount.getAllWallets();
    await this.syncPersistedCurrentCloudSyncKeylessWalletIdWithWallets(wallets);
    const shouldMigrateFromId = this.pendingAutoEnableCloudSyncKeyless;
    const {
      isCloudSyncEnabledKeyless,
      isCloudSyncEnabled,
      hasEverEnabledOneKeyIdSync,
      hasEverEnabledKeylessSync,
      lastSyncTimeKeyless,
    } = await primeCloudSyncPersistAtom.get();
    const hasUsedKeylessSyncBefore =
      !!hasEverEnabledKeylessSync || !!lastSyncTimeKeyless;
    if (isCloudSyncEnabledKeyless) {
      this.pendingAutoEnableCloudSyncKeyless = false;
      return;
    }
    // Keep prior OneKey ID sync users on their current mode unless they
    // explicitly chose "Switch Now" from the Cloud Sync page. Once Keyless
    // sync has been enabled, Keyless becomes the only upgrade path.
    if (
      !shouldMigrateFromId &&
      (isCloudSyncEnabled ||
        (hasEverEnabledOneKeyIdSync && !hasUsedKeylessSyncBefore))
    ) {
      return;
    }
    try {
      await this.enableKeylessCloudSyncWithMigrationIfNeeded({
        showLoading: false,
        ignorePreMigrationSyncError: true,
      });
      this.pendingAutoEnableCloudSyncKeyless = false;
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
    throwOnLocalSecretEnvelopeUnavailable = !silentEnable,
  }: {
    silentEnable?: boolean;
    throwOnLocalSecretEnvelopeUnavailable?: boolean;
  } = {}): Promise<{
    success: boolean;
  }> {
    return this.runWithCloudSyncKeyLock(() =>
      this.prepareCloudSyncKeylessWithKeyLock({
        silentEnable,
        throwOnLocalSecretEnvelopeUnavailable,
      }),
    );
  }

  private async prepareCloudSyncKeylessWithKeyLock({
    silentEnable,
    throwOnLocalSecretEnvelopeUnavailable,
  }: {
    silentEnable: boolean;
    throwOnLocalSecretEnvelopeUnavailable: boolean;
  }): Promise<{ success: boolean }> {
    // A transient or offline check may leave INVALID unconfirmed. Keep the
    // timestamp safety guards, but only block sync for a confirmed clock error.
    if (
      systemTimeUtils.systemTimeStatus === ELocalSystemTimeStatus.INVALID &&
      systemTimeUtils.isTimeErrorConfirmed
    ) {
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
    await this.repairKeylessSyncCredentialIfNeeded({
      password,
      throwOnLocalSecretEnvelopeUnavailable,
    });

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
