/* eslint-disable no-continue */
import { Semaphore } from 'async-mutex';

import { getPbkdf2KdfParamsForNonDbTx } from '@onekeyhq/shared/src/appCrypto/modules/pbkdf2';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  getHardwareCloudSyncIdentityTagFromCredentialId,
  isHardwareCloudSyncPlatformSupported,
} from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyError } from '@onekeyhq/shared/src/errors';
import { EOneKeyErrorClassNames } from '@onekeyhq/shared/src/errors/types/errorTypes';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import errorUtils from '@onekeyhq/shared/src/errors/utils/errorUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import {
  HardwareCloudSyncCancelledError,
  HardwareCloudSyncError,
} from '@onekeyhq/shared/src/hardware/hardwareCloudSyncError';
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
import { EServiceEndpointEnum } from '@onekeyhq/shared/types/endpoint';
import type {
  IHardwareCloudSyncKeySource,
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
import { isSupportedCloudSyncDataType } from '../ServicePrimeCloudSync/cloudSyncCheckUtils';
import cloudSyncItemBuilder from '../ServicePrimeCloudSync/cloudSyncItemBuilder';
import { keylessCloudSyncApi } from '../ServicePrimeCloudSync/keylessCloudSyncApi';
import keylessCloudSyncUtils from '../ServicePrimeCloudSync/keylessCloudSyncUtils';

import { logHardwareCloudSyncFailure } from './hardwareCloudSyncLog';
import {
  commitHardwareCloudSyncMigration,
  migrateHardwareCloudSyncRecords,
  recoverHardwareCloudSyncMigration,
} from './hardwareCloudSyncMigration';
import {
  assertHardwareCloudSyncChallengeFor,
  bootstrapHardwareCloudSyncDataKey,
  createHardwareCloudSyncDeviceKey,
  getCurrentHardwareCloudSyncDataKeyId,
  getHardwareCloudSyncDeviceKeyThumbprint,
  isHardwareCloudSyncKeyEnvelopeItem,
  isHardwareCloudSyncNonceInvalidError,
  isHardwareCloudSyncPwdHashInvalidError,
  isHardwareCloudSyncUnauthorizedError,
  reencryptHardwareCloudSyncItems,
  refreshHardwareCloudSyncSessionIfNeeded,
  requestHardwareCloudSyncChallenge,
  requestRawWithHardwareCloudSyncSession,
  revokeHardwareCloudSyncSession,
  rotateHardwareCloudSyncDataKey,
  verifyHardwareCloudSyncChallenge,
} from './hardwareCloudSyncSession';

import type {
  IHardwareCloudKeyDevice,
  IHardwareCloudKeyUnlock,
} from './hardwareCloudSyncCredential';
import type { IHardwareCloudSyncDataKey } from './hardwareCloudSyncSession';
import type { IDBCloudSyncItem, IDBWallet } from '../../dbs/local/types';
import type { AxiosInstance } from 'axios';

const HARDWARE_SESSION_CHECK_INTERVAL_MS = timerUtils.getTimeDurationMs({
  minute: 5,
});

// Repeated user-facing failures of the hardware Cloud sync flow.
function hardwareSignedOutError() {
  return new HardwareCloudSyncError(
    ETranslations.cloud_sync_hardware_signed_out__msg,
    'Cloud sync is signed out. Reconnect your hardware wallet.',
  );
}

function keyChangeInProgressError() {
  return new HardwareCloudSyncError(
    ETranslations.cloud_sync_key_change_in_progress__msg,
    'The encryption key is being changed. Try again once it finishes.',
  );
}

function settingsChangedError() {
  return new HardwareCloudSyncError(
    ETranslations.cloud_sync_settings_changed__msg,
    'Cloud sync settings changed. Try again.',
  );
}

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
  private hardwareCloudMigrationRecovered = false;
  private hardwareCloudMigrationRecovering = false;

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
    return this.cloudSyncKeyMutex.runExclusive(async () => {
      // Recover before admitting another writer. Reads inside this lock see
      // the flag already set and never wait on the lock they are running in.
      if (!this.hardwareCloudMigrationRecovered) {
        this.hardwareCloudMigrationRecovering = true;
        try {
          await this.repairCredentialMutex.runExclusive(() =>
            recoverHardwareCloudSyncMigration(this.backgroundApi),
          );
        } finally {
          this.hardwareCloudMigrationRecovering = false;
        }
        this.hardwareCloudMigrationRecovered = true;
      }
      return operation();
    });
  }

  private assertUnknownSyncItemsCanMigrate(
    items: IDBCloudSyncItem[],
    availablePwdHashes: string[],
  ) {
    if (
      items.some(
        (item) =>
          !isSupportedCloudSyncDataType(item.dataType) &&
          item.pwdHash &&
          !availablePwdHashes.includes(item.pwdHash),
      )
    ) {
      throw new HardwareCloudSyncError(
        ETranslations.cloud_sync_key_change_migration_unavailable__msg,
        "Your data is already synced with another encryption method, and switching isn't available yet. Your existing data has been kept.",
      );
    }
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
    const { items } =
      await this.backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems({
        includeUnsupportedDataTypes: true,
      });
    if (rebuildsLocalItems) {
      // Unknown records cannot be rebuilt by this client's business sync.
      this.assertUnknownSyncItemsCanMigrate(items, []);
    }
    if (
      rebuildsLocalItems ||
      (targetId &&
        (resignsSelectedSource ||
          config.currentCloudSyncKeylessWalletId === targetId))
    ) {
      return;
    }
    if (items.some((item) => !!item.pwdHash)) {
      throw new HardwareCloudSyncError(
        ETranslations.cloud_sync_key_change_migration_unavailable__msg,
        "Your data is already synced with another encryption method, and switching isn't available yet. Your existing data has been kept.",
      );
    }
  }

  private async getHardwareCloudSyncEnvironment(): Promise<'prod' | 'test'> {
    if (platformEnv.isWebEmbed) {
      return globalThis.WEB_EMBED_ONEKEY_APP_SETTINGS?.enableTestEndpoint
        ? 'test'
        : 'prod';
    }
    const config = await devSettingsPersistAtom.get();
    return config.enabled && config.settings?.enableTestEndpoint
      ? 'test'
      : 'prod';
  }

  // Sign-in uses its own path and a server nonce, never the key path.
  private async signInHardwareCloudSync({
    client,
    device,
  }: {
    client: AxiosInstance;
    device: IHardwareCloudKeyDevice;
  }): Promise<IHardwareCloudSyncSession> {
    const deviceKeyJwk = createHardwareCloudSyncDeviceKey();
    const identityTag = getHardwareCloudSyncIdentityTagFromCredentialId(
      device.credentialId,
    );
    const env = await this.getHardwareCloudSyncEnvironment();
    const assertEnvironmentUnchanged = async () => {
      if (env !== (await this.getHardwareCloudSyncEnvironment())) {
        throw new OneKeyError('Cloud sync environment changed. Try again.');
      }
    };
    const { challengeId, message } = await requestHardwareCloudSyncChallenge({
      client,
      jwk: deviceKeyJwk,
      identityTag,
      env,
    });
    await assertEnvironmentUnchanged();
    assertHardwareCloudSyncChallengeFor({
      message,
      jwk: deviceKeyJwk,
      identityTag,
      env,
    });
    const signature = await device.signAuth(message, {
      identityTag,
      env,
      jkt: getHardwareCloudSyncDeviceKeyThumbprint(deviceKeyJwk),
    });
    await assertEnvironmentUnchanged();
    assertHardwareCloudSyncChallengeFor({
      message,
      jwk: deviceKeyJwk,
      identityTag,
      env,
    });
    const session = await verifyHardwareCloudSyncChallenge({
      client,
      jwk: deviceKeyJwk,
      challengeId,
      signature,
    });
    await assertEnvironmentUnchanged();
    return session;
  }

  // The device prompt can wait indefinitely, so callers run it outside the
  // Cloud key locks.
  private async deriveHardwareCloudKey({
    connectId,
    expectedCredentialId,
    generation,
    isCurrent,
    signatures,
    unlock,
  }: {
    connectId: string;
    expectedCredentialId?: string;
    generation: number;
    isCurrent: () => boolean;
    // Device confirmations the flow expects, shown as progress.
    signatures: number;
    unlock: IHardwareCloudKeyUnlock;
  }) {
    const softwareKey = await this.getHardwareCloudSyncSoftwareKeySettings();
    if (softwareKey) {
      const { generateHardwareCloudSyncCredentialWithSoftwareKey } =
        await import('./hardwareCloudSyncSoftwareKey');
      return generateHardwareCloudSyncCredentialWithSoftwareKey({
        profile: softwareKey.profile,
        isCurrent,
        unlock,
      });
    }
    const { generateHardwareCloudSyncCredentialWithSdk } =
      await import('./hardwareCloudSyncSdk');
    let signed = 0;
    let total = signatures;
    return generateHardwareCloudSyncCredentialWithSdk({
      backgroundApi: this.backgroundApi,
      connectId,
      expectedCredentialId,
      isCurrent,
      unlock,
      onDeviceSign: () => {
        if (!isCurrent()) return;
        signed += 1;
        // Another device created the key first: its salt is signed too, and
        // each key costs two confirmations.
        if (signed > total) total += 2;
        appEventBus.emit(EAppEventBusNames.HardwareCloudKeySignProgress, {
          current: signed,
          total,
        });
      },
      onDeviceCancelChange: (cancel) => {
        if (!cancel) {
          if (this.hardwareCloudKeyDeviceCancel?.generation === generation) {
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
      throw new HardwareCloudSyncError(
        ETranslations.cloud_sync_hardware_unavailable__msg,
        "Hardware wallet encryption isn't supported on this platform.",
      );
    }
    if (this.hardwareCloudKeyCommitting) {
      throw keyChangeInProgressError();
    }
    this.hardwareCloudKeyGeneration += 1;
    const generation = this.hardwareCloudKeyGeneration;
    const isCurrent = () => this.hardwareCloudKeyGeneration === generation;
    const assertCurrent = () => {
      if (!isCurrent()) {
        throw new HardwareCloudSyncCancelledError();
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
      await this.backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems({
        includeUnsupportedDataTypes: true,
      });
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
    const client = await this.getHardwareSyncClient();
    let previousPwdHashes: string[] = [];
    // One device session: sign in on P_auth, read the Lock, then sign the
    // salted key message for that envelope (or for a new one).
    const unlock: IHardwareCloudKeyUnlock = async (device) => {
      const session = await this.signInHardwareCloudSync({ client, device });
      const dataKey = await bootstrapHardwareCloudSyncDataKey({
        client,
        session,
        deriveKek: device.deriveKek,
        minGeneration: await this.getHardwareKeyGeneration(device.credentialId),
      });
      await this.recordHardwareKeyGeneration(
        device.credentialId,
        dataKey.generation,
      );
      previousPwdHashes = dataKey.previousPwdHashes;
      return {
        keylessWalletId: device.credentialId,
        // Requests are signed with the session's device key instead.
        signingPrivateKey: '',
        signingPublicKey: '',
        encryptionKey: dataKey.dek,
        pwdHash: dataKey.pwdHash,
        hardwareSession: { ...session, dekId: dataKey.dekId },
      };
    };
    let derived: {
      credential: IKeylessCloudSyncCredential;
      source: IHardwareCloudSyncKeySource;
    };
    try {
      derived = await this.deriveHardwareCloudKey({
        connectId,
        expectedCredentialId,
        generation,
        isCurrent,
        // Sign in, then the data key's message twice.
        signatures: 3,
        unlock,
      });
    } catch (error) {
      assertCurrent();
      throw error;
    }
    assertCurrent();
    const { source, credential } = derived;
    const dataKey = { previousPwdHashes };

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
            await this.backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems(
              {
                includeUnsupportedDataTypes: true,
              },
            );
          this.assertUnknownSyncItemsCanMigrate(items, [credential.pwdHash]);
          const existing =
            current.currentCloudSyncKeylessWalletId === source.credentialId
              ? await keylessSyncCredentialStorage.getCredential(
                  source.credentialId,
                )
              : null;
          // Records under an earlier data key of this wallet (another device
          // reset it) are rebuilt with the current one.
          const knownPwdHashes = new Set([
            credential.pwdHash,
            ...dataKey.previousPwdHashes,
          ]);
          if (
            (!rebuildsLocalItemsNow &&
              items.some(
                (item) => item.pwdHash && !knownPwdHashes.has(item.pwdHash),
              )) ||
            (existing &&
              (!knownPwdHashes.has(existing.pwdHash) ||
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
      // The commit cleared it, and a sync with nothing to upload or apply
      // writes no time of its own.
      await this.backgroundApi.servicePrimeCloudSync.updateLastSyncTime({
        syncMode: ECloudSyncMode.Keyless,
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
        throw new HardwareCloudSyncError(
          ETranslations.create_keyless_wallet_first__desc,
          'A keyless wallet is required to encrypt and sync your data.',
        );
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
    // A hardware Cloud key has no Keyless signing key: its requests carry the
    // DPoP session, and push registration goes out unsigned.
    if (!keylessCredential?.signingPrivateKey) {
      return null;
    }
    const { pwdHash } = keylessCredential;
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

  private async getHardwareCloudSyncSoftwareKeySettings(): Promise<
    { profile?: string } | undefined
  > {
    if (!platformEnv.isDev) return undefined;
    const devSettings = await devSettingsPersistAtom.get();
    if (
      !devSettings.enabled ||
      !devSettings.settings?.hardwareCloudSyncSoftwareKey
    ) {
      return undefined;
    }
    return {
      profile: devSettings.settings.hardwareCloudSyncSoftwareKeyProfile,
    };
  }

  // Hardware sync is apart from OneKey ID: the plain client sends no OneKey ID
  // token, and has no 90002 handler that could sign the user out of it.
  private getHardwareSyncClient() {
    return this.getClient(EServiceEndpointEnum.Prime);
  }

  private hardwareSessionRefresh:
    | Promise<IKeylessCloudSyncCredential>
    | undefined;

  private hardwareSessionEnding = false;

  // One refresh at a time: refreshing twice with one token voids the first
  // reply's token, and later using it makes the server revoke the session.
  // A failed refresh keeps the stored token; the server accepts it once more
  // while the token from a lost reply is unused.
  private async getFreshHardwareCredential(
    credential: IKeylessCloudSyncCredential,
    { force }: { force?: boolean } = {},
  ): Promise<IKeylessCloudSyncCredential> {
    if (this.hardwareSessionEnding) {
      throw settingsChangedError();
    }
    if (this.hardwareSessionRefresh) return this.hardwareSessionRefresh;
    const session = credential.hardwareSession;
    if (!session) return credential;
    const refreshing = (async () => {
      // A refresh that finished after this request read its credential has
      // already rotated the token; use the stored one instead of reusing it.
      const stored = await keylessSyncCredentialStorage.getCredential(
        credential.keylessWalletId,
      );
      if (
        stored?.hardwareSession?.sessionId === session.sessionId &&
        stored.hardwareSession.refreshToken !== session.refreshToken
      ) {
        return stored;
      }
      const client = await this.getHardwareSyncClient();
      let next: IHardwareCloudSyncSession | undefined;
      try {
        next = await refreshHardwareCloudSyncSessionIfNeeded({
          client,
          session,
          force,
        });
      } catch (error) {
        if (isHardwareCloudSyncUnauthorizedError(error)) {
          await this.requireHardwareCloudSyncSignIn(credential);
        }
        throw error;
      }
      if (!next) return credential;
      const updated = { ...credential, hardwareSession: next };
      return this.saveHardwareCredential(updated, {
        expected: credential,
        refreshedSession: true,
      });
    })();
    this.hardwareSessionRefresh = refreshing;
    try {
      return await refreshing;
    } finally {
      this.hardwareSessionRefresh = undefined;
    }
  }

  // True while storage still holds this hardware session as the selected key:
  // a request in flight must not write back after sync was turned off or
  // switched to Keyless (saveCredential replaces the whole credential table).
  private async isStoredHardwareSession(
    credential: IKeylessCloudSyncCredential,
  ): Promise<boolean> {
    const config = await primeCloudSyncPersistAtom.get();
    if (
      !config.isCloudSyncEnabledKeyless ||
      config.hardwareCloudSyncKeySource?.credentialId !==
        credential.keylessWalletId
    ) {
      return false;
    }
    const stored = await keylessSyncCredentialStorage.getCredential(
      credential.keylessWalletId,
    );
    return (
      !!stored?.hardwareSession &&
      stored.hardwareSession.sessionId === credential.hardwareSession?.sessionId
    );
  }

  // The session was revoked or the key was reset elsewhere: drop this
  // device's key so the page asks to connect the hardware wallet again.
  private async requireHardwareCloudSyncSignIn(
    credential: IKeylessCloudSyncCredential,
  ): Promise<never> {
    await this.repairCredentialMutex.runExclusive(async () => {
      if (await this.isStoredHardwareSession(credential)) {
        await keylessSyncCredentialStorage.removeAllCredentials();
      }
    });
    this.clearKeylessCloudSyncCredentialCache();
    await this.backgroundApi.servicePrimeCloudSync.clearCachedSyncCredential();
    // The page shows the missing key without waiting to regain focus.
    appEventBus.emit(EAppEventBusNames.HardwareCloudKeyDropped, undefined);
    throw new HardwareCloudSyncError(
      ETranslations.cloud_sync_reset_on_other_device__msg,
      'Cloud sync changed on another device. Reconnect your hardware wallet.',
    );
  }

  private lastHardwareSessionCheckAt = 0;

  // A reset or sign-out on another device otherwise shows up only at this
  // device's next sync. Reading the Lock is cheap: a revoked session or a new
  // data key drops the local key, as a refused sync does. Errors stay silent.
  // The App coming back is throttled; opening the Cloud sync page is not.
  @backgroundMethod()
  async checkHardwareCloudSyncSessionThrottled({
    force,
  }: { force?: boolean } = {}): Promise<void> {
    const config = await primeCloudSyncPersistAtom.get();
    if (
      !config.isCloudSyncEnabledKeyless ||
      !config.hardwareCloudSyncKeySource
    ) {
      return;
    }
    if (
      !force &&
      Date.now() - this.lastHardwareSessionCheckAt <
        HARDWARE_SESSION_CHECK_INTERVAL_MS
    ) {
      return;
    }
    this.lastHardwareSessionCheckAt = Date.now();
    try {
      const credential = await this.getHardwareSessionCredential();
      if (!credential) return;
      const fresh = await this.getFreshHardwareCredential(credential);
      const session = fresh.hardwareSession;
      if (!session) return;
      const client = await this.getHardwareSyncClient();
      let serverDekId: string | undefined;
      try {
        serverDekId = await getCurrentHardwareCloudSyncDataKeyId({
          client,
          session,
        });
      } catch (error) {
        if (!isHardwareCloudSyncUnauthorizedError(error)) throw error;
        // A revoked session fails the refresh too, which drops the key.
        await this.getFreshHardwareCredential(fresh, { force: true });
        return;
      }
      if (serverDekId && serverDekId !== session.dekId) {
        await this.handleHardwareDataKeyRefused(fresh);
      }
    } catch (error) {
      logHardwareCloudSyncFailure('Background session check failed', error);
      errorUtils.autoPrintErrorIgnore(error);
    }
  }

  // After a reset other devices must sign again. Best effort: they are also
  // refused by the new key, and the next reset retries the revoke.
  private async revokeOtherHardwareSessions(
    credential: IKeylessCloudSyncCredential,
  ) {
    await this.revokeHardwareSession(credential, 'allExceptCurrent');
  }

  // Turning sync off ends this device's session on the server too. Best
  // effort: the local key is deleted either way and the token expires.
  // Sync is already off, so storage refuses a refreshed token; refresh here
  // without storing it, as it only has to last until the revoke.
  private async revokeCurrentHardwareSession(
    credential: IKeylessCloudSyncCredential,
  ) {
    const originalSession = credential.hardwareSession;
    if (!originalSession) return;
    try {
      // Let a refresh in flight finish first, so one token is not sent twice.
      await this.hardwareSessionRefresh?.catch(() => undefined);
      const stored = await keylessSyncCredentialStorage.getCredential(
        credential.keylessWalletId,
      );
      const session =
        stored?.hardwareSession?.sessionId === originalSession.sessionId
          ? stored.hardwareSession
          : originalSession;
      const client = await this.getHardwareSyncClient();
      const fresh =
        (await refreshHardwareCloudSyncSessionIfNeeded({ client, session })) ??
        session;
      await this.revokeHardwareSession(
        { ...credential, hardwareSession: fresh },
        'current',
      );
    } catch (error) {
      logHardwareCloudSyncFailure(
        'Current session revoke preparation failed',
        error,
      );
      errorUtils.autoPrintErrorIgnore(error);
    }
  }

  private async revokeHardwareSession(
    credential: IKeylessCloudSyncCredential,
    scope: 'current' | 'allExceptCurrent',
  ) {
    if (!credential.hardwareSession) return;
    try {
      const client = await this.getHardwareSyncClient();
      await revokeHardwareCloudSyncSession({
        client,
        session: credential.hardwareSession,
        scope,
      });
    } catch (error) {
      logHardwareCloudSyncFailure(`Revoke ${scope} session failed`, error);
      errorUtils.autoPrintErrorIgnore(error);
    }
  }

  private async saveHardwareCredential(
    credential: IKeylessCloudSyncCredential,
    {
      expected = credential,
      refreshedSession = false,
    }: {
      expected?: IKeylessCloudSyncCredential;
      refreshedSession?: boolean;
    } = {},
  ): Promise<IKeylessCloudSyncCredential> {
    const saved = await this.repairCredentialMutex.runExclusive(async () => {
      if (!(await this.isStoredHardwareSession(expected))) return undefined;
      const stored = await keylessSyncCredentialStorage.getCredential(
        expected.keylessWalletId,
      );
      if (
        !stored?.hardwareSession ||
        stored.pwdHash !== expected.pwdHash ||
        stored.hardwareSession.dekId !== expected.hardwareSession?.dekId ||
        (refreshedSession &&
          stored.hardwareSession.refreshToken !==
            expected.hardwareSession?.refreshToken)
      ) {
        return undefined;
      }
      // Reset can wait on the device while a normal request rotates the token.
      // Only the refresh operation itself may replace the stored token pair.
      // Keep any recovery key saved while the refresh request was in flight.
      const updated = refreshedSession
        ? { ...stored, hardwareSession: credential.hardwareSession }
        : {
            ...credential,
            hardwareSession: {
              ...stored.hardwareSession,
              dekId:
                credential.hardwareSession?.dekId ??
                stored.hardwareSession.dekId,
            },
          };
      await keylessSyncCredentialStorage.saveCredential(updated);
      return updated;
    });
    if (!saved) {
      throw settingsChangedError();
    }
    this.setKeylessCloudSyncCredentialCache(saved);
    await this.backgroundApi.servicePrimeCloudSync.clearCachedSyncCredential();
    return saved;
  }

  // Moves this device to a data key the server already uses.
  private async commitHardwareDataKey(
    credential: IKeylessCloudSyncCredential,
    next: IHardwareCloudSyncDataKey,
  ): Promise<IKeylessCloudSyncCredential> {
    return this.runWithCloudSyncKeyLock(async () => {
      const session = credential.hardwareSession;
      if (!session) {
        throw hardwareSignedOutError();
      }
      // Read after the device and network waits, so account edits made while
      // confirming the reset are carried forward instead of an old snapshot.
      const { items: originalItems } =
        await this.backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems({
          includeUnsupportedDataTypes: true,
        });
      this.assertUnknownSyncItemsCanMigrate(originalItems, [
        credential.pwdHash,
        next.pwdHash,
      ]);
      const items = await reencryptHardwareCloudSyncItems({
        items: originalItems,
        from: {
          dek: credential.encryptionKey,
          dekId: session.dekId,
          pwdHash: credential.pwdHash,
        },
        to: next,
      });
      const updated: IKeylessCloudSyncCredential = {
        ...credential,
        encryptionKey: next.dek,
        pwdHash: next.pwdHash,
        hardwareSession: { ...session, dekId: next.dekId },
        pendingDataKey: undefined,
      };
      const saved = await this.saveHardwareCredential(updated, {
        expected: credential,
      });
      const originalsById = new Map(
        originalItems.map((item) => [item.id, item]),
      );
      const replacementsById = new Map(items.map((item) => [item.id, item]));
      await localDb.updateSyncItem({
        ids: items.map((item) => item.id),
        updater: (record) => {
          const original = originalsById.get(record.id);
          const replacement = replacementsById.get(record.id);
          // A later edit must keep its raw data; the following full sync rebuilds
          // it with the selected key. Compare inside the database transaction.
          if (
            original &&
            replacement &&
            record.pwdHash === original.pwdHash &&
            record.data === original.data &&
            record.rawData === original.rawData &&
            record.dataTime === original.dataTime &&
            record.isDeleted === original.isDeleted
          ) {
            record.data = replacement.data;
            record.pwdHash = replacement.pwdHash;
          }
          return record;
        },
      });
      return saved;
    });
  }

  // The server refused a stale data key: finish this device's interrupted
  // reset, or stop here because another device reset it.
  private async handleHardwareDataKeyRefused(
    credential: IKeylessCloudSyncCredential,
  ): Promise<IKeylessCloudSyncCredential | undefined> {
    const session = credential.hardwareSession;
    if (!session) return undefined;
    const client = await this.getHardwareSyncClient();
    const serverDekId = await getCurrentHardwareCloudSyncDataKeyId({
      client,
      session,
    });
    const stored = await keylessSyncCredentialStorage.getCredential(
      credential.keylessWalletId,
    );
    const sameSession =
      stored?.hardwareSession?.sessionId === session.sessionId;
    if (
      sameSession &&
      stored.hardwareSession?.dekId === serverDekId &&
      serverDekId !== session.dekId
    ) {
      // Another request already completed recovery while this one waited.
      return stored;
    }
    // An in-flight request can predate the pending-key save. Recover from the
    // durable credential when its session and pending key match the server.
    const recoveryCredential =
      sameSession && stored.pendingDataKey?.dekId === serverDekId
        ? stored
        : credential;
    const pending = recoveryCredential.pendingDataKey;
    if (pending && serverDekId === pending.dekId) {
      const updated = await this.commitHardwareDataKey(
        recoveryCredential,
        pending,
      );
      // The generation was computed here before the flush, not read back
      // from the server.
      if (
        recoveryCredential.source?.type === 'hardware' &&
        pending.generation
      ) {
        await this.recordHardwareKeyGeneration(
          recoveryCredential.source.credentialId,
          pending.generation,
        );
      }
      await this.revokeOtherHardwareSessions(updated);
      return updated;
    }
    if (serverDekId && serverDekId !== session.dekId) {
      // Only the hardware wallet can unwrap the new key.
      await this.requireHardwareCloudSyncSignIn(credential);
    }
    if (pending) {
      await this.saveHardwareCredential({
        ...credential,
        pendingDataKey: undefined,
      });
    }
    return undefined;
  }

  private async hardwareSyncPost<T>({
    credential,
    urlPath,
    postData,
    retryAfterKeySwitch,
  }: {
    credential: IKeylessCloudSyncCredential;
    urlPath: string;
    postData: Record<string, unknown>;
    // Uploads carry records encrypted with the old key, so they never retry.
    retryAfterKeySwitch?: boolean;
  }) {
    const fresh = await this.getFreshHardwareCredential(credential);
    // Records built before a key switch must not go out under the new key:
    // the server would accept data nobody can decrypt.
    if (
      !retryAfterKeySwitch &&
      typeof postData.pwdHash === 'string' &&
      postData.pwdHash !== fresh.pwdHash
    ) {
      throw new HardwareCloudSyncError(
        ETranslations.cloud_sync_key_changed_sync_again__msg,
        'Encryption key changed. Sync again.',
      );
    }
    const client = await this.getHardwareSyncClient();
    const send = (current: IKeylessCloudSyncCredential) => {
      if (!current.hardwareSession) {
        throw hardwareSignedOutError();
      }
      return requestRawWithHardwareCloudSyncSession<T>({
        client,
        session: current.hardwareSession,
        method: 'POST',
        urlPath,
        data: { ...postData, pwdHash: current.pwdHash },
      });
    };
    try {
      return await send(fresh);
    } catch (error) {
      if (isHardwareCloudSyncUnauthorizedError(error)) {
        // A revoked session fails the refresh too, which asks for sign-in.
        const refreshed = await this.getFreshHardwareCredential(fresh, {
          force: true,
        });
        if (!retryAfterKeySwitch) throw error;
        return send(refreshed);
      }
      if (!isHardwareCloudSyncPwdHashInvalidError(error)) throw error;
      const switched = await this.handleHardwareDataKeyRefused(fresh);
      if (!switched || !retryAfterKeySwitch) throw error;
      return send(switched);
    }
  }

  @backgroundMethod()
  @toastIfError()
  async resetHardwareCloudSyncKey({
    connectId,
    targetCredentialId,
    overwriteTargetSnapshot,
  }: {
    connectId: string;
    targetCredentialId?: string;
    overwriteTargetSnapshot?: string;
  }) {
    if (this.hardwareCloudKeyCommitting) {
      throw keyChangeInProgressError();
    }
    const config = await primeCloudSyncPersistAtom.get();
    const source = config.hardwareCloudSyncKeySource;
    if (!source || !config.isCloudSyncEnabledKeyless) {
      throw new HardwareCloudSyncError(
        ETranslations.cloud_sync_hardware_turn_on_first__msg,
        'Turn on Cloud sync with a hardware wallet first.',
      );
    }
    // Merge what other devices uploaded before everything is re-encrypted.
    await this.backgroundApi.servicePrimeCloudSync.startServerSyncFlow({
      callerName: 'Reset hardware Cloud sync key',
      forceSync: true,
    });
    const stored = await this.getKeylessCloudSyncCredential();
    if (!stored?.hardwareSession) {
      throw new HardwareCloudSyncError(
        ETranslations.cloud_sync_hardware_reconnect_first__msg,
        'Connect your hardware wallet to turn on Cloud sync again.',
      );
    }

    const credential = await this.getFreshHardwareCredential(stored);
    const session = credential.hardwareSession;
    if (!session) {
      throw hardwareSignedOutError();
    }
    const client = await this.getHardwareSyncClient();
    if (this.hardwareCloudKeyCommitting) {
      throw keyChangeInProgressError();
    }
    this.hardwareCloudKeyGeneration += 1;
    const generation = this.hardwareCloudKeyGeneration;
    const isCurrent = () => this.hardwareCloudKeyGeneration === generation;
    this.cancelHardwareCloudKeyDevicePrompt();
    let rotated:
      | Awaited<
          ReturnType<typeof rotateHardwareCloudSyncDataKey<IDBCloudSyncItem>>
        >
      | undefined;
    let committing = false;
    let replacement: IKeylessCloudSyncCredential | undefined;
    let replacementGeneration = 0;
    let migrationSource = credential;
    const beforeFlush = async () => {
      if (!isCurrent() || !(await this.isStoredHardwareSession(credential))) {
        throw new HardwareCloudSyncCancelledError();
      }
      this.hardwareCloudKeyCommitting = true;
      committing = true;
      await this.showDialogLoading({
        title: appLocale.intl.formatMessage({
          id: ETranslations.global_syncing,
        }),
      });
    };
    // Pin the confirmed wallet identity before signing. The original wallet
    // rotates its data key; a replacement copies data into its own space.
    const unlock: IHardwareCloudKeyUnlock = async (device) => {
      if (device.credentialId !== source.credentialId) {
        if (
          targetCredentialId === device.credentialId &&
          device.source?.credentialId === device.credentialId
        ) {
          const { items: migrationItems } =
            await this.backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems(
              { includeUnsupportedDataTypes: true },
            );
          this.assertUnknownSyncItemsCanMigrate(migrationItems, [
            credential.pwdHash,
          ]);
          const targetSession = await this.signInHardwareCloudSync({
            client,
            device,
          });
          const targetKey = await bootstrapHardwareCloudSyncDataKey({
            client,
            session: targetSession,
            deriveKek: device.deriveKek,
            minGeneration: await this.getHardwareKeyGeneration(
              device.credentialId,
            ),
          });
          replacementGeneration = targetKey.generation;
          const target: IKeylessCloudSyncCredential = {
            keylessWalletId: device.credentialId,
            source: device.source,
            signingPrivateKey: '',
            signingPublicKey: '',
            encryptionKey: targetKey.dek,
            pwdHash: targetKey.pwdHash,
            hardwareSession: { ...targetSession, dekId: targetKey.dekId },
          };
          await migrateHardwareCloudSyncRecords({
            client,
            source: credential,
            target,
            isCurrent,
            beforeFlush,
            overwriteTargetSnapshot,
            savePending: async (pendingHardwareKeyMigration) => {
              migrationSource = await this.saveHardwareCredential({
                ...credential,
                pendingHardwareKeyMigration,
              });
            },
          });
          replacement = target;
          return target;
        }
        throw new HardwareCloudSyncError(
          ETranslations.cloud_sync_hardware_different_key__msg,
          "This hardware wallet can't unlock your synced data. Your existing data has been kept.",
        );
      }
      const { items } =
        await this.backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems({
          includeUnsupportedDataTypes: true,
        });
      this.assertUnknownSyncItemsCanMigrate(items, [credential.pwdHash]);
      rotated = await rotateHardwareCloudSyncDataKey({
        client,
        session,
        deriveKek: device.deriveKek,
        minGeneration: await this.getHardwareKeyGeneration(source.credentialId),
        current: {
          dek: credential.encryptionKey,
          dekId: session.dekId,
          pwdHash: credential.pwdHash,
        },
        // Preflight opaque local ciphertext before replacing the server key.
        // Commit re-reads local data so edits during the reset are preserved.
        localItems: items.filter(
          (item) => !isSupportedCloudSyncDataType(item.dataType),
        ),
        isCurrent,
        beforeFlush,
        savePending: async (pending) => {
          await this.saveHardwareCredential({
            ...credential,
            pendingDataKey: pending,
          });
        },
      }).catch(async (error: unknown) => {
        // Refused outright: the server kept the old key, so drop the pending.
        if (!isHardwareCloudSyncNonceInvalidError(error)) throw error;
        await this.saveHardwareCredential({
          ...credential,
          pendingDataKey: undefined,
        });
        throw new HardwareCloudSyncError(
          ETranslations.cloud_sync_data_changed_during_key_change__msg,
          'Synced data changed during the key change. Try again.',
        );
      });
      return credential;
    };
    try {
      const derived = await this.deriveHardwareCloudKey({
        connectId,
        expectedCredentialId: targetCredentialId ?? source.credentialId,
        generation,
        isCurrent,
        // The new key's message twice; the session is already signed in.
        signatures:
          targetCredentialId && targetCredentialId !== source.credentialId
            ? 3
            : 2,
        unlock,
      });
      if (replacement) {
        const target = { ...replacement, source: derived.source };
        await this.runWithCloudSyncKeyLock(() =>
          this.repairCredentialMutex.runExclusive(async () => {
            if (
              !isCurrent() ||
              !(await this.isStoredHardwareSession(migrationSource))
            )
              throw new HardwareCloudSyncCancelledError();
            try {
              this.setKeylessCloudSyncCredentialCache(target);
              await commitHardwareCloudSyncMigration({
                backgroundApi: this.backgroundApi,
                source: migrationSource,
                target,
              });
            } catch (error) {
              this.hardwareCloudMigrationRecovered = false;
              throw error;
            } finally {
              this.clearKeylessCloudSyncCredentialCache();
              await this.backgroundApi.servicePrimeCloudSync.clearCachedSyncCredential();
            }
            this.setKeylessCloudSyncCredentialCache(target);
          }),
        );
        await this.recordHardwareKeyGeneration(
          target.keylessWalletId,
          replacementGeneration,
        );
        await this.revokeOtherHardwareSessions(migrationSource);
        await this.revokeCurrentHardwareSession(migrationSource);
        await this.backgroundApi.servicePrimeCloudSync.startServerSyncFlow({
          callerName: 'Switch hardware Cloud sync wallet',
          forceSync: true,
        });
        await this.backgroundApi.servicePrimeCloudSync.updateLastSyncTime({
          syncMode: ECloudSyncMode.Keyless,
        });
        return;
      }
      if (!rotated) {
        throw new HardwareCloudSyncCancelledError();
      }
      const updated = await this.commitHardwareDataKey(
        credential,
        rotated.next,
      );
      await this.recordHardwareKeyGeneration(
        source.credentialId,
        rotated.generation,
      );
      await this.revokeOtherHardwareSessions(updated);
      await this.backgroundApi.servicePrimeCloudSync.startServerSyncFlow({
        callerName: 'Reset hardware Cloud sync key',
        forceSync: true,
      });
      await this.backgroundApi.servicePrimeCloudSync.updateLastSyncTime({
        syncMode: ECloudSyncMode.Keyless,
      });
    } finally {
      if (committing) {
        this.hardwareCloudKeyCommitting = false;
        await this.hideDialogLoading();
      }
    }
  }

  private async getHardwareKeyGeneration(credentialId: string) {
    const { hardwareCloudSyncKeyGenerations } =
      await primeCloudSyncPersistAtom.get();
    return hardwareCloudSyncKeyGenerations?.[credentialId] ?? 0;
  }

  private async recordHardwareKeyGeneration(
    credentialId: string,
    generation: number,
  ) {
    await primeCloudSyncPersistAtom.set((value) => {
      const known = value.hardwareCloudSyncKeyGenerations?.[credentialId] ?? 0;
      if (generation <= known) return value;
      return {
        ...value,
        hardwareCloudSyncKeyGenerations: {
          ...value.hardwareCloudSyncKeyGenerations,
          [credentialId]: generation,
        },
      };
    });
  }

  // Hardware credentials never fall back to the Keyless request signature.
  private async getHardwareSessionCredential(): Promise<
    IKeylessCloudSyncCredential | undefined
  > {
    const syncCredential =
      await this.backgroundApi.servicePrimeCloudSync.getSyncCredentialSafe();
    const credential = syncCredential?.keylessCredential;
    if (!credential) return undefined;
    if (credential.hardwareSession) return credential;
    if (
      credential.source?.type === 'hardware' ||
      (await primeCloudSyncPersistAtom.get()).hardwareCloudSyncKeySource
    ) {
      throw hardwareSignedOutError();
    }
    return undefined;
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
          retryAfterKeySwitch: true,
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
          retryAfterKeySwitch: true,
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

  // CONFIG_FLUSH or LOCK_CHANGE for a hardware Cloud key: another device
  // replaced the data key (a reset) when the pushed pwdHash is not ours. It is
  // checked with the server first, as a refused sync would be, and never
  // treated as a OneKey ID master password change.
  async onHardwareKeyFlushPush({ pwdHash }: { pwdHash?: string }) {
    try {
      const credential = await this.getKeylessCloudSyncCredential();
      if (!credential?.hardwareSession) return;
      // Same key: the flush only rewrote data, which the push leaves out.
      if (credential.pwdHash === pwdHash) {
        await this.backgroundApi.servicePrimeCloudSync.startServerSyncFlowSilently(
          { callerName: 'Hardware Cloud sync flush push' },
        );
        return;
      }
      await this.handleHardwareDataKeyRefused(
        await this.getFreshHardwareCredential(credential),
      );
    } catch (error) {
      logHardwareCloudSyncFailure('Flush push handling failed', error);
      errorUtils.autoPrintErrorIgnore(error);
    }
  }

  // The server says this session was revoked. A push alone never drops the
  // key: a refresh confirms it, and its 90700 drops the key as a refused
  // sync does.
  async onHardwareSessionRevokedPush({ sessionId }: { sessionId?: string }) {
    try {
      const credential = await this.getKeylessCloudSyncCredential();
      const session = credential?.hardwareSession;
      if (!credential || !session || session.sessionId !== sessionId) return;
      await this.getFreshHardwareCredential(credential, { force: true });
    } catch (error) {
      logHardwareCloudSyncFailure(
        'Session revoked push handling failed',
        error,
      );
      errorUtils.autoPrintErrorIgnore(error);
    }
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
  async hydrateKeylessSyncCredentialFromStorageIfNeeded({
    forDbTransaction = false,
  }: { forDbTransaction?: boolean } = {}): Promise<void> {
    // Recovery writes account records. Its transaction warm-up must not wait
    // for the recovery lock; ordinary reads still wait until recovery finishes.
    if (forDbTransaction && this.hardwareCloudMigrationRecovering) return;
    const keylessWalletId = await this.getCurrentCloudSyncKeylessWalletId();
    if (!keylessWalletId) {
      return;
    }
    const cached = this.getKeylessCloudSyncCredentialCacheSync(keylessWalletId);
    if (cached) {
      if (await this.isCredentialForSelectedSource(cached)) return;
      this.keylessCloudSyncCredentialCache.delete(keylessWalletId);
    }
    if (
      !this.hardwareCloudKeyCommitting &&
      !this.hardwareCloudMigrationRecovered
    ) {
      await this.runWithCloudSyncKeyLock(async () => undefined);
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

  async setCloudSyncEnabledKeyless(
    enabled: boolean,
    { onlyIfSyncOff = false }: { onlyIfSyncOff?: boolean } = {},
  ): Promise<boolean> {
    return this.runWithCloudSyncKeyLock(async () => {
      if (onlyIfSyncOff) {
        const current = await primeCloudSyncPersistAtom.get();
        if (
          current.isCloudSyncEnabled ||
          current.isCloudSyncEnabledKeyless ||
          current.hardwareCloudSyncKeySource ||
          this.hardwareCloudKeyPending ||
          this.hardwareCloudKeyCommitting
        ) {
          return false;
        }
      }
      return this.setCloudSyncEnabledKeylessWithKeyLock(enabled);
    });
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

    const endingHardwareSession = !shouldEnableKeyless && !!hardwareSource;
    if (endingHardwareSession) this.hardwareSessionEnding = true;
    try {
      if (endingHardwareSession) {
        // Let the existing refresh persist before disabling storage writes, and
        // prevent another request from starting a refresh during revocation.
        await this.hardwareSessionRefresh?.catch(() => undefined);
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
          const stored =
            await keylessSyncCredentialStorage.getCredential(currentWalletId);
          if (stored?.hardwareSession) {
            await this.revokeCurrentHardwareSession(stored);
          }
          await keylessSyncCredentialStorage.removeAllCredentials();
        }
      }

      return shouldEnableKeyless;
    } finally {
      if (endingHardwareSession) this.hardwareSessionEnding = false;
    }
  }

  @backgroundMethod()
  @toastIfError()
  async toggleCloudSyncKeyless({
    enabled,
    silentEnable = false,
    forceEnable = false,
    handleLocalSecretEnvelopeUnavailable = !silentEnable,
    onlyIfSyncOff = false,
  }: {
    enabled: boolean;
    silentEnable?: boolean;
    forceEnable?: boolean;
    handleLocalSecretEnvelopeUnavailable?: boolean;
    onlyIfSyncOff?: boolean;
  }) {
    const sourceAtStart = (await primeCloudSyncPersistAtom.get())
      .hardwareCloudSyncKeySource?.credentialId;
    const setEnabled = (value: boolean) =>
      onlyIfSyncOff
        ? this.setCloudSyncEnabledKeyless(value, { onlyIfSyncOff: true })
        : this.setCloudSyncEnabledKeyless(value);
    try {
      if (enabled) {
        const { success } = await this.prepareCloudSyncKeyless({
          silentEnable,
          throwOnLocalSecretEnvelopeUnavailable:
            handleLocalSecretEnvelopeUnavailable,
        });
        const shouldEnable = success || forceEnable;
        const applied = await setEnabled(shouldEnable);
        if (onlyIfSyncOff && !applied) return false;
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
        await setEnabled(false);
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
        await setEnabled(true);
      } else {
        await setEnabled(false);
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
    onlyIfSyncOff = false,
  }: {
    showLoading?: boolean;
    ignorePreMigrationSyncError?: boolean;
    handleLocalSecretEnvelopeUnavailable?: boolean;
    onlyIfSyncOff?: boolean;
  } = {}) {
    const runMigration = async () => {
      const current = await primeCloudSyncPersistAtom.get();
      const { isCloudSyncEnabled } = current;
      if (
        onlyIfSyncOff &&
        (isCloudSyncEnabled ||
          current.isCloudSyncEnabledKeyless ||
          current.hardwareCloudSyncKeySource ||
          this.hardwareCloudKeyPending ||
          this.hardwareCloudKeyCommitting)
      ) {
        return;
      }
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

      const applied = await this.toggleCloudSyncKeyless({
        enabled: true,
        silentEnable: true,
        forceEnable: true,
        handleLocalSecretEnvelopeUnavailable,
        onlyIfSyncOff,
      });
      if (applied === false) return;
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
    const config = await primeCloudSyncPersistAtom.get();
    // "Create and switch" is an explicit OneKey ID migration. Ordinary wallet
    // creation only enables sync when all modes are off, regardless of history.
    const shouldMigrateFromId =
      this.pendingAutoEnableCloudSyncKeyless &&
      config.isCloudSyncEnabled &&
      !config.hardwareCloudSyncKeySource;
    if (
      config.isCloudSyncEnabledKeyless ||
      (config.isCloudSyncEnabled && !shouldMigrateFromId) ||
      this.hardwareCloudKeyPending ||
      this.hardwareCloudKeyCommitting
    ) {
      this.pendingAutoEnableCloudSyncKeyless = false;
      return;
    }
    try {
      if (config.hardwareCloudSyncKeySource) {
        await this.selectKeylessCloudSyncKey();
      }
      const { wallets } =
        await this.backgroundApi.serviceAccount.getAllWallets();
      await this.syncPersistedCurrentCloudSyncKeylessWalletIdWithWallets(
        wallets,
      );
      await this.enableKeylessCloudSyncWithMigrationIfNeeded({
        showLoading: false,
        ignorePreMigrationSyncError: true,
        onlyIfSyncOff: !shouldMigrateFromId,
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
