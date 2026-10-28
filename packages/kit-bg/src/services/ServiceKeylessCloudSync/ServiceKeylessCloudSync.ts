/* eslint-disable no-continue */
import { Semaphore } from 'async-mutex';

import { getPbkdf2KdfParamsForNonDbTx } from '@onekeyhq/shared/src/appCrypto/modules/pbkdf2';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { isHardwareCloudSyncPlatformSupported } from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import { HardwareCloudSyncError } from '@onekeyhq/shared/src/hardware/hardwareCloudSyncError';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import systemTimeUtils, {
  ECloudSyncDataTimeSource,
  ELocalSystemTimeStatus,
} from '@onekeyhq/shared/src/utils/systemTimeUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IHardwareCloudSyncSession,
  IKeylessCloudSyncCredential,
} from '@onekeyhq/shared/types/keylessCloudSync';
import { ECloudSyncMode } from '@onekeyhq/shared/types/keylessCloudSync';
import type {
  ICloudSyncCheckServerStatusPostData,
  ICloudSyncCheckServerStatusResult,
  ICloudSyncCredential,
  ICloudSyncDownloadPostData,
  ICloudSyncDownloadResult,
  ICloudSyncRawDataJson,
  ICloudSyncUploadPostData,
  ICloudSyncUploadResult,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import localDb from '../../dbs/local/localDb';
import {
  devSettingsPersistAtom,
  primeCloudSyncPersistAtom,
} from '../../states/jotai/atoms';
import ServiceBase from '../ServiceBase';
import keylessSyncCredentialStorage from '../ServiceKeylessWallet/utils/keylessSyncCredentialStorage';
import cloudSyncItemBuilder from '../ServicePrimeCloudSync/cloudSyncItemBuilder';
import { keylessCloudSyncApi } from '../ServicePrimeCloudSync/keylessCloudSyncApi';
import keylessCloudSyncUtils from '../ServicePrimeCloudSync/keylessCloudSyncUtils';

import {
  bootstrapHardwareCloudSyncDataKey,
  createHardwareCloudSyncDeviceKey,
  isHardwareCloudSyncKeyEnvelopeItem,
  refreshHardwareCloudSyncSessionIfNeeded,
  requestHardwareCloudSyncChallenge,
  requestRawWithHardwareCloudSyncSession,
  verifyHardwareCloudSyncChallenge,
} from './hardwareCloudSyncSession';

import type { IHardwareCloudSyncAuthSigner } from './hardwareCloudSyncCredential';
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

  private hardwareCloudKeyDeviceCancel:
    | { generation: number; cancel: () => void }
    | undefined;

  async persistNewKeylessCloudSyncCredential(
    credential: IKeylessCloudSyncCredential,
  ) {
    // The repair mutex is enough: every hardware commit also holds it, and
    // this must not wait for a sync or Keyless toggle holding the key lock.
    await this.repairCredentialMutex.runExclusive(async () => {
      if (await this.shouldPreserveHardwareCloudKey()) return;
      await keylessSyncCredentialStorage.saveCredential(credential);
      this.setKeylessCloudSyncCredentialCache(credential);
    });
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
    this.cancelHardwareCloudKeyDevicePrompt();
    return true;
  }

  // Aborts the device request and its hardware lease, not just the result.
  private cancelHardwareCloudKeyDevicePrompt() {
    const pending = this.hardwareCloudKeyDeviceCancel;
    this.hardwareCloudKeyDeviceCancel = undefined;
    pending?.cancel();
  }

  // Guards short sections that switch the key or write local items with it.
  // Never hold it across prompts, device interaction or network sync; those
  // re-check the selected key before writing instead.
  runWithCloudSyncKeyLock<T>(operation: () => Promise<T>): Promise<T> {
    return this.cloudSyncKeyMutex.runExclusive(operation);
  }

  private async assertCloudKeySelectionCanChange(
    targetId?: string,
    {
      rebuildsLocalItems = false,
    }: {
      // The target re-encrypts existing records from their local raw data.
      rebuildsLocalItems?: boolean;
    } = {},
  ) {
    const config = await primeCloudSyncPersistAtom.get();
    // Re-signing keeps the selected source. An older App version or lost
    // storage can drop its key and wallet ID while Keyless sync stays on; the
    // commit still rejects a key that does not match the encrypted records.
    const resignsSelectedSource =
      !!targetId &&
      config.hardwareCloudSyncKeySource?.credentialId === targetId;
    if (
      config.isCloudSyncEnabled ||
      (config.isCloudSyncEnabledKeyless &&
        !(
          resignsSelectedSource &&
          !(await keylessSyncCredentialStorage.getCredential(targetId))
        ))
    ) {
      throw new HardwareCloudSyncError(
        ETranslations.cloud_sync_turn_off_before_key_change__msg,
        'Turn off Cloud sync before changing how your data is encrypted.',
      );
    }
    if (
      rebuildsLocalItems ||
      (targetId &&
        (resignsSelectedSource ||
          config.currentCloudSyncKeylessWalletId === targetId))
    ) {
      return;
    }
    const { items } =
      await this.backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems();
    if (items.some((item) => !!item.pwdHash)) {
      throw new HardwareCloudSyncError(
        ETranslations.cloud_sync_key_change_migration_unavailable__msg,
        "Your data is already synced with another encryption method, and switching isn't available yet. Your existing data has been kept.",
      );
    }
  }

  @backgroundMethod()
  @toastIfError()
  async enableHardwareCloudSync({
    connectId,
    switchDevice = false,
  }: {
    connectId: string;
    // The user confirmed continuing with a hardware wallet that does not
    // match the one sync was turned on with; its data space is rebuilt from
    // local data, as when switching with sync off.
    switchDevice?: boolean;
  }) {
    if (!isHardwareCloudSyncPlatformSupported()) {
      throw new OneKeyError('Hardware Cloud keys are not available here.');
    }
    this.hardwareCloudKeyGeneration += 1;
    const generation = this.hardwareCloudKeyGeneration;
    const isCurrent = () => this.hardwareCloudKeyGeneration === generation;
    const assertCurrent = () => {
      if (!isCurrent()) {
        throw new OneKeyError('Hardware Cloud key operation was cancelled.');
      }
    };
    // A newer request supersedes a device prompt still owned by an older one.
    this.cancelHardwareCloudKeyDevicePrompt();

    // Fail fast before asking the device. The commit below re-validates.
    const startConfig = await primeCloudSyncPersistAtom.get();
    const previousSource = startConfig.hardwareCloudSyncKeySource;
    // With sync off this is a switch: records encrypted with another key are
    // rebuilt from local data, as switching to Keyless does. With sync on it
    // only re-signs the selected key, which must stay the same.
    const rebuildsLocalItems =
      switchDevice || !startConfig.isCloudSyncEnabledKeyless;
    await this.assertCloudKeySelectionCanChange(previousSource?.credentialId, {
      rebuildsLocalItems,
    });
    const { items: localItems } =
      await this.backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems();
    // Records encrypted with the selected key can only be unlocked by the same
    // recovery phrase, so another one is rejected before the device signs.
    const expectedCredentialId =
      !rebuildsLocalItems && localItems.some((item) => !!item.pwdHash)
        ? previousSource?.credentialId
        : undefined;
    assertCurrent();
    // Ask now so the locked commit below has no interactive step.
    const password =
      await this.backgroundApi.servicePrimeCloudSync.resolvePasswordOnlyIfHdXfpMissing();
    assertCurrent();

    // The device prompt can wait indefinitely for the user, so it runs outside
    // the Cloud key locks. Wallet reads and ordinary sync must not queue on it.
    const { generateHardwareCloudSyncCredentialWithSdk } =
      await import('./hardwareCloudSyncSdk');
    const client = await this.backgroundApi.servicePrime.getPrimeClient();
    const deviceKeyJwk = createHardwareCloudSyncDeviceKey();
    let authSession: IHardwareCloudSyncSession | undefined;
    // Sign-in uses its own path and a server nonce, in the same device session.
    const signAuth = async (signer: IHardwareCloudSyncAuthSigner) => {
      const { challengeId, message } = await requestHardwareCloudSyncChallenge({
        client,
        jwk: deviceKeyJwk,
      });
      const signature = await signer(message);
      authSession = await verifyHardwareCloudSyncChallenge({
        client,
        jwk: deviceKeyJwk,
        challengeId,
        signature,
      });
    };
    let derived: Awaited<
      ReturnType<typeof generateHardwareCloudSyncCredentialWithSdk>
    >;
    try {
      if (await this.isHardwareCloudSyncSoftwareKeyEnabled()) {
        const { generateHardwareCloudSyncCredentialWithSoftwareKey } =
          await import('./hardwareCloudSyncSoftwareKey');
        derived = await generateHardwareCloudSyncCredentialWithSoftwareKey({
          isCurrent,
          signAuth,
        });
      } else {
        derived = await generateHardwareCloudSyncCredentialWithSdk({
          backgroundApi: this.backgroundApi,
          connectId,
          expectedCredentialId,
          isCurrent,
          signAuth,
          onDeviceCancelChange: (cancel) => {
            if (!cancel) {
              if (
                this.hardwareCloudKeyDeviceCancel?.generation === generation
              ) {
                this.hardwareCloudKeyDeviceCancel = undefined;
              }
              return;
            }
            if (isCurrent()) {
              this.hardwareCloudKeyDeviceCancel = { generation, cancel };
            }
          },
        });
      }
    } catch (error) {
      assertCurrent();
      throw error;
    }
    assertCurrent();
    if (!authSession) {
      throw new OneKeyError('Cloud sync sign-in did not complete.');
    }
    // The signature-derived key only wraps the data key kept on the server.
    const dataKey = await bootstrapHardwareCloudSyncDataKey({
      client,
      session: authSession,
      kek: derived.credential.encryptionKey,
    });
    assertCurrent();
    const { source } = derived;
    const credential: IKeylessCloudSyncCredential = {
      ...derived.credential,
      encryptionKey: dataKey.dek,
      pwdHash: dataKey.pwdHash,
      hardwareSession: { ...authSession, dekId: dataKey.dekId },
    };

    await this.runWithCloudSyncKeyLock(() =>
      this.repairCredentialMutex.runExclusive(async () => {
        assertCurrent();
        this.hardwareCloudKeyPending = true;
        try {
          // Sync settings, records or the selected source may have changed
          // while the device was waiting.
          const current = await primeCloudSyncPersistAtom.get();
          const rebuildsLocalItemsNow =
            switchDevice || !current.isCloudSyncEnabledKeyless;
          if (
            switchDevice &&
            current.hardwareCloudSyncKeySource?.credentialId !==
              previousSource?.credentialId
          ) {
            throw new HardwareCloudSyncError(
              ETranslations.cloud_sync_key_selection_changed__msg,
              'The encryption method for Cloud sync changed. Your data will sync with the new one next time.',
            );
          }
          // A confirmed switch replaces the selected source while sync is on,
          // which the assert allows only for re-signing that source.
          await this.assertCloudKeySelectionCanChange(
            switchDevice ? previousSource?.credentialId : source.credentialId,
            { rebuildsLocalItems: rebuildsLocalItemsNow },
          );
          assertCurrent();
          const { items } =
            await this.backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems();
          const existing =
            current.currentCloudSyncKeylessWalletId === source.credentialId
              ? await keylessSyncCredentialStorage.getCredential(
                  source.credentialId,
                )
              : null;
          if (
            (!rebuildsLocalItemsNow &&
              items.some(
                (item) => item.pwdHash && item.pwdHash !== credential.pwdHash,
              )) ||
            (existing &&
              (existing.pwdHash !== credential.pwdHash ||
                existing.signingPublicKey !== credential.signingPublicKey))
          ) {
            throw new HardwareCloudSyncError(
              ETranslations.cloud_sync_hardware_different_key__msg,
              "This hardware wallet can't unlock your synced data. Your existing data has been kept.",
            );
          }
          assertCurrent();
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
            password,
            askPasswordOnlyIfHdXfpMissing: true,
          });
          await primeCloudSyncPersistAtom.set((value) => ({
            ...value,
            isCloudSyncEnabledKeyless: true,
          }));
        } catch (error) {
          // A key that did not end up enabled must not stay on this device;
          // turning sync on again has to ask the hardware for a new signature.
          if (
            this.hardwareCloudKeyCommitting &&
            !(await primeCloudSyncPersistAtom.get()).isCloudSyncEnabledKeyless
          ) {
            // The daily sweep retries if this cleanup itself fails.
            await keylessSyncCredentialStorage
              .removeAllCredentials()
              .catch(() => undefined);
            this.clearKeylessCloudSyncCredentialCache();
          }
          throw error;
        } finally {
          this.hardwareCloudKeyCommitting = false;
          this.hardwareCloudKeyPending = false;
        }
      }),
    );

    // Like turning Keyless sync on: one full sync right away, outside the key
    // locks. A failure leaves sync on with its key; Sync now can retry.
    await timerUtils.wait(0);
    await this.showDialogLoading({
      title: appLocale.intl.formatMessage({
        id: ETranslations.global_syncing,
      }),
    });
    try {
      await this.backgroundApi.servicePrimeCloudSync.startServerSyncFlow({
        setUndefinedTimeToNow: true,
        callerName: 'Enable Hardware Cloud Sync',
        forceSync: true,
      });
    } finally {
      await timerUtils.wait(1000);
      await this.hideDialogLoading();
    }
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
      // Enabling Keyless rebuilds the records from local data: init writes
      // them with the Keyless key and the sync flow re-encrypts the rest
      // (fillingSyncItemsMissingDataFromRawData), as OneKey ID migration does.
      // Data only on the hardware space and never synced here is not carried.
      await this.assertCloudKeySelectionCanChange(wallet.id, {
        rebuildsLocalItems: true,
      });
      // Do not keep the hardware key after leaving it; Keyless repairs its own.
      await this.repairCredentialMutex.runExclusive(() =>
        keylessSyncCredentialStorage.removeAllCredentials(),
      );
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

  private hardwareCloudKeySweepTimer:
    | ReturnType<typeof setInterval>
    | undefined;

  // Fallback for any path that left a hardware key behind while sync is off:
  // a turned-off hardware key must not stay on this device.
  async sweepHardwareCloudKeyIfSyncOff(): Promise<boolean> {
    return this.runWithCloudSyncKeyLock(() =>
      this.repairCredentialMutex.runExclusive(async () => {
        const config = await primeCloudSyncPersistAtom.get();
        const source = config.hardwareCloudSyncKeySource;
        if (!source || config.isCloudSyncEnabledKeyless) return false;
        if (
          !(await keylessSyncCredentialStorage.getCredential(
            source.credentialId,
          ))
        )
          return false;
        await keylessSyncCredentialStorage.removeAllCredentials();
        this.clearKeylessCloudSyncCredentialCache();
        return true;
      }),
    );
  }

  startHardwareCloudKeySweep() {
    void this.sweepHardwareCloudKeyIfSyncOff().catch(() => undefined);
    if (this.hardwareCloudKeySweepTimer) return;
    this.hardwareCloudKeySweepTimer = setInterval(
      () => {
        void this.sweepHardwareCloudKeyIfSyncOff().catch(() => undefined);
      },
      timerUtils.getTimeDurationMs({ day: 1 }),
    );
  }

  // Dev only: drops this device's hardware credential while keeping the
  // selection, to reproduce the "key missing" state.
  @backgroundMethod()
  async debugRemoveSelectedHardwareCloudKey(): Promise<boolean> {
    if (!platformEnv.isDev) return false;
    const source = (await primeCloudSyncPersistAtom.get())
      .hardwareCloudSyncKeySource;
    if (
      !source ||
      !(await keylessSyncCredentialStorage.getCredential(source.credentialId))
    ) {
      return false;
    }
    // The storage keeps only the current credential, which is this one.
    await keylessSyncCredentialStorage.removeAllCredentials();
    return true;
  }

  // Read-only: a failed storage read only offers a re-sign, never removes state.
  @backgroundMethod()
  async isSelectedHardwareCloudKeyMissing(): Promise<boolean> {
    const source = (await primeCloudSyncPersistAtom.get())
      .hardwareCloudSyncKeySource;
    if (!source) return false;
    return !(await keylessSyncCredentialStorage.getCredential(
      source.credentialId,
    ));
  }

  @backgroundMethod()
  async setPendingAutoEnableCloudSyncKeyless(enabled: boolean) {
    this.pendingAutoEnableCloudSyncKeyless = enabled;
  }

  // Null while a hardware key is selected: it has no wallet record in the App.
  async getKeylessWallet(): Promise<IDBWallet | null> {
    if ((await primeCloudSyncPersistAtom.get()).hardwareCloudSyncKeySource) {
      return null;
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
          credential.source.credentialId === source.credentialId &&
          credential.source.derivationVersion === source.derivationVersion
      : !credential.source;
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

  private async isHardwareCloudSyncSoftwareKeyEnabled(): Promise<boolean> {
    if (!platformEnv.isDev) return false;
    const devSettings = await devSettingsPersistAtom.get();
    return !!(
      devSettings.enabled && devSettings.settings?.hardwareCloudSyncSoftwareKey
    );
  }

  private hardwareSessionRefresh:
    | Promise<IKeylessCloudSyncCredential>
    | undefined;

  // One refresh at a time: a second use of a rotated refresh token makes the
  // server revoke the whole session.
  private async getFreshHardwareCredential(
    credential: IKeylessCloudSyncCredential,
  ): Promise<IKeylessCloudSyncCredential> {
    if (this.hardwareSessionRefresh) return this.hardwareSessionRefresh;
    const session = credential.hardwareSession;
    if (!session) return credential;
    const refreshing = (async () => {
      const client = await this.backgroundApi.servicePrime.getPrimeClient();
      const next = await refreshHardwareCloudSyncSessionIfNeeded({
        client,
        session,
      });
      if (!next) return credential;
      const updated = { ...credential, hardwareSession: next };
      await this.repairCredentialMutex.runExclusive(() =>
        keylessSyncCredentialStorage.saveCredential(updated),
      );
      this.setKeylessCloudSyncCredentialCache(updated);
      await this.backgroundApi.servicePrimeCloudSync.clearCachedSyncCredential();
      return updated;
    })();
    this.hardwareSessionRefresh = refreshing;
    try {
      return await refreshing;
    } finally {
      this.hardwareSessionRefresh = undefined;
    }
  }

  private async hardwareSyncPost<T>({
    credential,
    urlPath,
    postData,
  }: {
    credential: IKeylessCloudSyncCredential;
    urlPath: string;
    postData: Record<string, unknown>;
  }) {
    const fresh = await this.getFreshHardwareCredential(credential);
    if (!fresh.hardwareSession) {
      throw new OneKeyError('Cloud sync sign-in is missing.');
    }
    const client = await this.backgroundApi.servicePrime.getPrimeClient();
    return requestRawWithHardwareCloudSyncSession<T>({
      client,
      session: fresh.hardwareSession,
      method: 'POST',
      urlPath,
      data: { ...postData, pwdHash: fresh.pwdHash },
    });
  }

  private async getHardwareSessionCredential(): Promise<
    IKeylessCloudSyncCredential | undefined
  > {
    const syncCredential =
      await this.backgroundApi.servicePrimeCloudSync.getSyncCredentialSafe();
    const credential = syncCredential?.keylessCredential;
    return credential?.hardwareSession ? credential : undefined;
  }

  async apiCheckServerStatusKeyless({
    postData,
  }: {
    postData: ICloudSyncCheckServerStatusPostData;
  }) {
    const hardwareCredential = await this.getHardwareSessionCredential();
    if (hardwareCredential) {
      const response =
        await this.hardwareSyncPost<ICloudSyncCheckServerStatusResult>({
          credential: hardwareCredential,
          urlPath: '/prime/v1/sync/check',
          postData,
        });
      const data = response.data.data;
      if (data) {
        data.updated = data.updated?.filter(
          (item) => !isHardwareCloudSyncKeyEnvelopeItem(item),
        );
        data.diff = data.diff?.filter(
          (item) => !isHardwareCloudSyncKeyEnvelopeItem(item),
        );
      }
      return { response, pwdHash: hardwareCredential.pwdHash };
    }
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
    const hardwareCredential = await this.getHardwareSessionCredential();
    if (hardwareCredential) {
      const { data } = (
        await this.hardwareSyncPost<ICloudSyncDownloadResult>({
          credential: hardwareCredential,
          urlPath: '/prime/v1/sync/download',
          postData,
        })
      ).data;
      return {
        data: {
          ...data,
          serverData: data.serverData?.filter(
            (item) => !isHardwareCloudSyncKeyEnvelopeItem(item),
          ),
        },
        pwdHash: hardwareCredential.pwdHash,
      };
    }
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
    const hardwareCredential = await this.getHardwareSessionCredential();
    if (hardwareCredential) {
      return (
        await this.hardwareSyncPost<ICloudSyncUploadResult>({
          credential: hardwareCredential,
          urlPath,
          postData,
        })
      ).data.data;
    }
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
    const config = await primeCloudSyncPersistAtom.get();
    if (config.hardwareCloudSyncKeySource) return;
    const whenNoKeyless = options?.whenNoKeyless ?? 'clear';
    const currentCloudSyncKeylessWalletId: string | null =
      wallets
        .filter((wallet) => wallet.isKeyless)
        .toSorted((a, b) => a.id.localeCompare(b.id))[0]?.id || null;
    if (!currentCloudSyncKeylessWalletId && whenNoKeyless === 'skip') {
      return;
    }
    // Every wallet read lands here; only queue on the mutex when writing.
    if (
      currentCloudSyncKeylessWalletId &&
      !this.hardwareCloudKeyPending &&
      config.currentCloudSyncKeylessWalletId === currentCloudSyncKeylessWalletId
    ) {
      this.currentCloudSyncKeylessWalletIdCache =
        currentCloudSyncKeylessWalletId;
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
    const hardwareSource = (await primeCloudSyncPersistAtom.get())
      .hardwareCloudSyncKeySource;

    if (
      enabled &&
      hardwareSource &&
      !(await this.getKeylessCloudSyncCredential())
    ) {
      // Turning sync off deletes a hardware key; only a new signature restores it.
      throw new HardwareCloudSyncError(
        ETranslations.cloud_sync_hardware_sign_again__msg,
        'Connect your hardware wallet and sign again to turn on Cloud sync.',
      );
    }

    // A hardware key has no wallet record; its credential was checked above.
    if (shouldEnableKeyless && !hardwareSource) {
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
    }

    if (shouldEnableKeyless) {
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
    // A hardware key is removed too: turning sync off revokes it on this device,
    // and re-enabling requires a fresh signature from the same standard wallet.
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
    handleLocalSecretEnvelopeUnavailable = !silentEnable,
  }: {
    enabled: boolean;
    silentEnable?: boolean;
    forceEnable?: boolean;
    handleLocalSecretEnvelopeUnavailable?: boolean;
  }) {
    const sourceAtStart = (await primeCloudSyncPersistAtom.get())
      .hardwareCloudSyncKeySource?.credentialId;
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
      // Another flow selected a different key while this one ran without the
      // key lock. Rolling back would turn sync off and delete that new key.
      if (
        (await primeCloudSyncPersistAtom.get()).hardwareCloudSyncKeySource
          ?.credentialId !== sourceAtStart
      ) {
        throw error;
      }
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
    // Never move a hardware space to Keyless without an explicit choice.
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

    // A hardware key has no wallet record; a missing credential fails below.
    if (
      !(await primeCloudSyncPersistAtom.get()).hardwareCloudSyncKeySource &&
      !(await this.getKeylessWallet())
    ) {
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

    // Only the local write needs the key lock. The prompt and repair above ran
    // without it, so confirm this credential is still the selected key first.
    const initLocalSyncItems = () =>
      this.runWithCloudSyncKeyLock(async () => {
        const selected = await this.getKeylessCloudSyncCredential();
        if (selected?.signingPublicKey !== keylessCredential.signingPublicKey) {
          throw new HardwareCloudSyncError(
            ETranslations.cloud_sync_key_selection_changed__msg,
            'The encryption method for Cloud sync changed. Your data will sync with the new one next time.',
          );
        }
        await this.backgroundApi.servicePrimeCloudSync.initLocalSyncItemsDB({
          password,
          syncCredential:
            this.buildSyncCredentialWithKeylessCredential(keylessCredential),
        });
      });
    if (silentEnable) {
      await initLocalSyncItems();
      await timerUtils.wait(1000);
    } else {
      await this.withDialogLoading(
        {
          title: appLocale.intl.formatMessage({
            id: ETranslations.global_processing,
          }),
        },
        async () => {
          await initLocalSyncItems();
          await timerUtils.wait(1000);
        },
      );
    }

    return { success: true };
  }
}

export default ServiceKeylessCloudSync;
