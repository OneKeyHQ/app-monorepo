/* eslint-disable no-continue */
import { Semaphore } from 'async-mutex';

import { getPbkdf2KdfParamsForNonDbTx } from '@onekeyhq/shared/src/appCrypto/modules/pbkdf2';
import {
  backgroundClass,
  backgroundMethod,
  toastIfError,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { endpointsMap } from '@onekeyhq/shared/src/config/endpointsMap';
import {
  HARDWARE_CLOUD_SYNC_CREDENTIAL_ID_PREFIX,
  HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX,
  isHardwareCloudSyncPlatformSupported,
} from '@onekeyhq/shared/src/consts/hardwareCloudSyncConsts';
import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyError, OneKeyLocalError } from '@onekeyhq/shared/src/errors';
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
import { isSameServiceBaseURL } from '@onekeyhq/shared/src/request/helpers/serviceRequestUrl';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
import resetUtils from '@onekeyhq/shared/src/utils/resetUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import systemTimeUtils, {
  ECloudSyncDataTimeSource,
  ELocalSystemTimeStatus,
} from '@onekeyhq/shared/src/utils/systemTimeUtils';
import timerUtils, {
  resolveBeforeTimeout,
} from '@onekeyhq/shared/src/utils/timerUtils';
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
import {
  getCloudSyncStorageEnvironment,
  getCloudSyncStorageEnvironmentForRuntime,
} from '../../states/jotai/jotaiStorageConsts';
import ServiceBase from '../ServiceBase';
import keylessSyncCredentialStorage from '../ServiceKeylessWallet/utils/keylessSyncCredentialStorage';
import {
  isRetainedHardwareCloudCopy,
  isSupportedCloudSyncDataType,
} from '../ServicePrimeCloudSync/cloudSyncCheckUtils';
import cloudSyncItemBuilder from '../ServicePrimeCloudSync/cloudSyncItemBuilder';
import { keylessCloudSyncApi } from '../ServicePrimeCloudSync/keylessCloudSyncApi';
import keylessCloudSyncUtils from '../ServicePrimeCloudSync/keylessCloudSyncUtils';
import {
  PUBLIC_ACCOUNT_SNAPSHOT_PREFIX,
  PublicAccountSnapshotUnsupportedError,
  normalizePublicAccountSnapshotRecord,
} from '../ServicePrimeCloudSync/publicAccountSnapshot';

import {
  logHardwareCloudSyncDiagnostic,
  logHardwareCloudSyncFailure,
} from './hardwareCloudSyncLog';
import {
  bootstrapHardwareCloudSyncDataKey,
  canUseHardwareCloudSyncSessionAt,
  getCurrentHardwareCloudSyncDataKeyId,
  isHardwareCloudSyncKeyEnvelopeItem,
  isHardwareCloudSyncNonceInvalidError,
  isHardwareCloudSyncPwdHashInvalidError,
  isHardwareCloudSyncUnauthorizedError,
  reencryptHardwareCloudSyncItems,
  refreshHardwareCloudSyncSessionIfNeeded,
  requestRawWithHardwareCloudSyncSession,
  revokeHardwareCloudSyncSession,
  rotateHardwareCloudSyncDataKey,
} from './hardwareCloudSyncSession';

import type {
  IHardwareCloudKeyDevice,
  IHardwareCloudKeyUnlock,
} from './hardwareCloudSyncCredential';
import type { IHardwareDataKeyCommitGuard } from './hardwareCloudSyncResetDownload';
import type {
  IHardwareCloudSyncDataKey,
  IHardwareCloudSyncHistory,
} from './hardwareCloudSyncSession';
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

  private keylessSyncSettingAttempts = 0;

  private async updateHardwareCloudSyncDeviceName(
    source: Pick<
      IHardwareCloudSyncKeySource,
      'credentialId' | 'deviceName' | 'deviceBleName' | 'deviceSerialNoHash'
    >,
    {
      onlyIfLabelFallback = false,
      isCurrent,
    }: { onlyIfLabelFallback?: boolean; isCurrent?: () => boolean } = {},
  ) {
    await primeCloudSyncPersistAtom.set((config) => {
      const current = config.hardwareCloudSyncKeySource;
      if (
        (isCurrent && !isCurrent()) ||
        current?.credentialId !== source.credentialId ||
        (onlyIfLabelFallback &&
          (current.deviceBleName ||
            current.deviceSerialNoHash !== source.deviceSerialNoHash)) ||
        (current.deviceName === source.deviceName &&
          current.deviceBleName === source.deviceBleName &&
          current.deviceSerialNoHash === source.deviceSerialNoHash)
      ) {
        return config;
      }
      return {
        ...config,
        hardwareCloudSyncKeySource: {
          ...current,
          deviceName: source.deviceName,
          deviceBleName: source.deviceBleName,
          deviceSerialNoHash: source.deviceSerialNoHash,
        },
      };
    });
  }

  // The eligible standard hardware wallet ID is derived from its Device ID.
  private pendingHardwareDeviceLabels = new Map<string, symbol>();

  async syncHardwareCloudSyncDeviceLabel({
    walletId,
    label,
    dbDeviceId,
  }: { walletId: string } & (
    | { label: string; dbDeviceId?: never }
    | { dbDeviceId: string; label?: never }
  )) {
    if (!accountUtils.isHwWallet({ walletId })) return;
    const token = Symbol('device-label');
    const isCurrent = () =>
      this.pendingHardwareDeviceLabels.get(walletId) === token;
    this.pendingHardwareDeviceLabels.set(walletId, token);
    try {
      const source = (await primeCloudSyncPersistAtom.get())
        .hardwareCloudSyncKeySource;
      if (!source || source.deviceBleName || !source.deviceSerialNoHash) return;
      const wallet = await localDb.getWalletSafe({
        walletId,
        withoutRefill: true,
      });
      if (
        !wallet?.xfp ||
        wallet.passphraseState ||
        !wallet.associatedDevice ||
        (dbDeviceId !== undefined && wallet.associatedDevice !== dbDeviceId)
      )
        return;
      // Cloud has no wallet record of its own; match the standard wallet identity
      // before reusing another flow's device metadata.
      let credentialId: string;
      try {
        const [{ default: appCrypto }, { normalizeHardwareCloudWalletXfp }] =
          await Promise.all([
            import('@onekeyhq/shared/src/appCrypto'),
            import('./hardwareCloudSyncCredential'),
          ]);
        credentialId = `${HARDWARE_CLOUD_SYNC_CREDENTIAL_ID_PREFIX}${Buffer.from(
          appCrypto.hash.sha256Sync(
            Buffer.from(normalizeHardwareCloudWalletXfp(wallet.xfp), 'utf8'),
          ),
        ).toString('hex')}`;
      } catch {
        return;
      }
      if (credentialId !== source.credentialId) return;
      const { getHardwareCloudSyncDeviceSerialNoHash } =
        await import('./hardwareCloudSyncDeviceName');
      const device = await localDb.getDeviceSafe(wallet.associatedDevice);
      if (!device) return;
      const deviceSerialNoHash = getHardwareCloudSyncDeviceSerialNoHash(
        device.deviceStateInfo?.identity.serialNo ||
          deviceUtils.getDeviceSerialNoFromFeatures(device.featuresInfo) ||
          device.uuid,
      );
      if (deviceSerialNoHash !== source.deviceSerialNoHash) return;
      const bleName = device.deviceStateInfo?.identity.bleName
        ? deviceUtils.getDeviceDisplayName({
            state: device.deviceStateInfo,
            preferBleName: true,
          })
        : deviceUtils.buildDeviceBleName({ features: device.featuresInfo });
      // A passive wallet refill can be older than a confirmed firmware edit.
      // Use the linked Device record, never the wallet's presentation metadata.
      let currentLabel: string | null | undefined = label;
      if (dbDeviceId !== undefined) {
        currentLabel = device.deviceStateInfo
          ? device.deviceStateInfo.identity.label
          : device.featuresInfo?.label;
        if (!bleName && !currentLabel) return;
      }
      const deviceName =
        bleName ||
        currentLabel ||
        deviceUtils.getDefaultDeviceLabel(device.deviceType) ||
        device.name;
      await this.updateHardwareCloudSyncDeviceName(
        {
          credentialId,
          deviceName,
          deviceBleName: bleName,
          deviceSerialNoHash,
        },
        { onlyIfLabelFallback: true, isCurrent },
      );
    } finally {
      if (isCurrent()) this.pendingHardwareDeviceLabels.delete(walletId);
    }
  }

  private repairCredentialMutex = new Semaphore(1);

  private cloudSyncKeyMutex = new Semaphore(1);

  private cloudAccountImportMutex = new Semaphore(1);

  runWithCloudAccountImportLock<T>(operation: () => Promise<T>): Promise<T> {
    return this.cloudAccountImportMutex.runExclusive(operation);
  }

  private cloudAccountImportGeneration = 0;

  getCloudAccountImportGeneration(): number {
    return this.hardwareCloudKeyGeneration + this.cloudAccountImportGeneration;
  }

  getKeylessWalletSelectionGeneration(): number {
    return this.cloudAccountImportGeneration;
  }

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
      if (!(await this.isCloudSyncStorageScopeCurrent())) return;
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
          const config = await primeCloudSyncPersistAtom.get();
          // Recovery is a no-op without a selected hardware key. Check before
          // importing the chunk so ordinary offline writes can acquire the lock.
          if (config.hardwareCloudSyncKeySource?.credentialId) {
            const { recoverHardwareCloudSyncMigration } =
              await import('./hardwareCloudSyncMigration');
            await this.repairCredentialMutex.runExclusive(() =>
              recoverHardwareCloudSyncMigration(this.backgroundApi),
            );
          }
        } finally {
          this.hardwareCloudMigrationRecovering = false;
        }
        this.hardwareCloudMigrationRecovered = true;
      }
      return operation();
    });
  }

  isKeylessSyncOffStateSettled(): boolean {
    return (
      this.keylessSyncSettingAttempts === 0 &&
      !this.hardwareCloudKeyPending &&
      !this.hardwareCloudKeyCommitting &&
      !this.hardwareSessionEnding
    );
  }

  async isExplicitWalletMetadataSyncOff(): Promise<boolean> {
    // This is a local settings read, never credential hydration or recovery.
    const generation = this.hardwareCloudKeyGeneration;
    const importGeneration = this.cloudAccountImportGeneration;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const config = await Promise.race([
        primeCloudSyncPersistAtom.get(),
        new Promise<undefined>((resolve) => {
          timer = setTimeout(() => resolve(undefined), 200);
        }),
      ]);
      const source = config?.hardwareCloudSyncKeySource;
      const selected = config?.currentCloudSyncKeylessWalletId;
      const settledSelection =
        (!source && !selected) ||
        (source?.type === 'hardware' &&
          !!source.credentialId &&
          selected === source.credentialId &&
          !this.cloudSyncKeyMutex.isLocked());
      return (
        generation === this.hardwareCloudKeyGeneration &&
        importGeneration === this.cloudAccountImportGeneration &&
        !this.hardwareCloudKeyPending &&
        !this.hardwareCloudKeyCommitting &&
        !this.hardwareSessionEnding &&
        config?.isCloudSyncEnabled === false &&
        config.isCloudSyncEnabledKeyless === false &&
        settledSelection
      );
    } catch {
      // Unknown is not an explicit Off choice.
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  async runWithVerifiedWalletMetadataWrite<T>(
    applyVerifiedScope: (
      credential: ICloudSyncCredential | undefined,
      claimWrite: () => boolean,
    ) => Promise<T>,
    readOrSaveLocal: () => Promise<T>,
  ): Promise<T> {
    let allowCloud = true;
    let applying = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<undefined>((resolve) => {
      timer = setTimeout(() => {
        allowCloud = false;
        resolve(undefined);
      }, 1000);
    });
    const claimWrite = () => {
      if (!allowCloud) return false;
      clearTimeout(timer);
      return true;
    };
    const write = async (credential?: ICloudSyncCredential) => {
      if (!allowCloud) return undefined;
      applying = true;
      return { value: await applyVerifiedScope(credential, claimWrite) };
    };
    const prepare = async () => {
      try {
        return await this.runWithCloudSyncKeyLock(async () => {
          if (!allowCloud) return undefined;
          const config = await primeCloudSyncPersistAtom.get();
          const source = config.hardwareCloudSyncKeySource;
          const selectedId = config.currentCloudSyncKeylessWalletId;
          if (
            !config.isCloudSyncEnabled &&
            !config.isCloudSyncEnabledKeyless &&
            !source
          )
            return write();
          if (
            config.isCloudSyncEnabled ||
            !config.isCloudSyncEnabledKeyless ||
            !selectedId
          )
            return undefined;
          const credential =
            await keylessSyncCredentialStorage.getCredential(selectedId);
          if (!credential || credential.keylessWalletId !== selectedId)
            return undefined;
          if (source) {
            return this.runWithVerifiedHardwareAccountArchiveSession(
              credential,
              () =>
                write(
                  this.buildSyncCredentialWithKeylessCredential(credential),
                ),
            );
          }
          // A software-key write also uses the current persisted credential, not
          // a repair cache that can outlive a sign-out or credential replacement.
          return this.repairCredentialMutex.runExclusive(async () => {
            const selected = await primeCloudSyncPersistAtom.get();
            if (
              selected.isCloudSyncEnabled ||
              !selected.isCloudSyncEnabledKeyless ||
              selected.hardwareCloudSyncKeySource ||
              selected.currentCloudSyncKeylessWalletId !== selectedId
            )
              return undefined;
            const stored =
              await keylessSyncCredentialStorage.getCredential(selectedId);
            if (
              !stored ||
              stored.source ||
              stored.hardwareSession ||
              stored.keylessWalletId !== selectedId ||
              !stored.pwdHash ||
              !stored.encryptionKey ||
              !stored.signingPublicKey
            )
              return undefined;
            return write(this.buildSyncCredentialWithKeylessCredential(stored));
          });
        });
      } catch (error) {
        // Errors from the local business callback are not authentication
        // failures, even if a genuine local read failed before it could start.
        if (applying) throw error;
        return undefined;
      }
    };
    try {
      const result = await Promise.race([deadline, prepare()]);
      if (result) return result.value;
      allowCloud = false;
      return await readOrSaveLocal();
    } finally {
      clearTimeout(timer);
    }
  }

  // Scene replay takes only the import gate. Key-changing commits take the key
  // lock first, then this gate; never use this around a scene replay itself.
  private runWithCloudSyncSourceLock<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    return this.runWithCloudSyncKeyLock(() =>
      this.runWithCloudAccountImportLock(operation),
    );
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
    const stored =
      !config.isCloudSyncEnabled &&
      config.isCloudSyncEnabledKeyless &&
      resignsSelectedSource
        ? await keylessSyncCredentialStorage.getCredential(targetId)
        : undefined;
    const availability = await this.getHardwareSessionAvailability(
      stored?.hardwareSession,
    );
    if (availability === 'endpoint-mismatch') throw settingsChangedError();
    if (
      config.isCloudSyncEnabled ||
      (config.isCloudSyncEnabledKeyless &&
        !(resignsSelectedSource && availability === 'missing'))
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

  private async signInHardwareCloudSync(params: {
    client: AxiosInstance;
    device: IHardwareCloudKeyDevice;
  }): Promise<IHardwareCloudSyncSession> {
    const { signInHardwareCloudSync } = await import('./hardwareCloudSyncSdk');
    return signInHardwareCloudSync(params);
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
    await this.assertCloudSyncStorageScopeCurrent();
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
    const prime = this.backgroundApi.servicePrimeCloudSync;
    const restoreGeneration = prime.getPublicAccountSnapshotImportGeneration();

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
    const expectedCredentialId = rebuildsLocalItems
      ? undefined
      : previousSource?.credentialId;
    assertCurrent();
    // Ask now so the locked commit below has no interactive step.
    const password =
      await this.backgroundApi.servicePrimeCloudSync.resolvePasswordOnlyIfHdXfpMissing();
    assertCurrent();

    // The device prompt can wait indefinitely for the user, so it runs outside
    // the Cloud key locks. Wallet reads and ordinary sync must not queue on it.
    const client = await this.getHardwareSyncClient();
    let enabledGeneration: { previous: number; current: number } | undefined;
    let previousPwdHashes: string[] = [];
    let history: IHardwareCloudSyncHistory | undefined;
    // One device session: sign in on P_auth, read the Lock, then sign the
    // salted key message for that envelope (or for a new one).
    const unlock: IHardwareCloudKeyUnlock = async (device) => {
      const session = await this.signInHardwareCloudSync({ client, device });
      const knownGeneration = await this.getHardwareKeyGeneration(
        device.credentialId,
      );
      const dataKey = await bootstrapHardwareCloudSyncDataKey({
        client,
        session,
        deriveKek: device.deriveKek,
        minGeneration: knownGeneration,
        onHistory:
          !rebuildsLocalItems &&
          previousSource?.credentialId === device.credentialId
            ? (value) => {
                history = value;
              }
            : undefined,
      });
      enabledGeneration = {
        previous: knownGeneration,
        current: dataKey.generation,
      };
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
    const {
      commitHardwareCloudSyncLocalRecovery,
      prepareHardwareResign,
      recoverVerifiedWalletCaches,
      makeWalletRecoveryEpoch,
    } = await import('./hardwareCloudSyncRecovery');
    assertCurrent();

    const restoreEpoch = makeWalletRecoveryEpoch(
      prime,
      restoreGeneration,
      isCurrent,
    );
    await this.backgroundApi.servicePrimeCloudSync.prepareLocalSyncWallets({
      password,
      askPasswordOnlyIfHdXfpMissing: true,
    });
    assertCurrent();
    let restoreWalletCaches = false;
    await this.runWithCloudSyncSourceLock(() =>
      this.repairCredentialMutex.runExclusive(async () => {
        await this.assertCloudSyncStorageScopeCurrent();
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
          const sameSelectedSource =
            current.hardwareCloudSyncKeySource?.credentialId ===
            source.credentialId;
          const sameSelectedWallet =
            current.currentCloudSyncKeylessWalletId === source.credentialId;
          const existing = sameSelectedWallet
            ? await keylessSyncCredentialStorage.getCredential(
                source.credentialId,
              )
            : null;
          const resetKey =
            !rebuildsLocalItemsNow &&
            sameSelectedSource &&
            (sameSelectedWallet || !current.currentCloudSyncKeylessWalletId)
              ? await keylessSyncCredentialStorage.getInterruptedHardwareResetKey(
                  source,
                  credential,
                )
              : undefined;
          this.assertUnknownSyncItemsCanMigrate(
            items,
            resetKey
              ? [credential.pwdHash, resetKey.pwdHash]
              : [credential.pwdHash],
          );
          const resetOriginals = resetKey
            ? items.filter(
                (item) =>
                  item.pwdHash === resetKey.pwdHash &&
                  !item.pendingPublicAccountDeletionAt,
              )
            : [];
          const resetItems =
            resetKey && resetOriginals.length
              ? await reencryptHardwareCloudSyncItems({
                  items: resetOriginals,
                  from: resetKey,
                  to: {
                    dek: credential.encryptionKey,
                    pwdHash: credential.pwdHash,
                  },
                })
              : [];
          const resetItemsById = new Map(
            resetItems.map((item) => [item.id, item]),
          );
          const { recoveredItems, restoresRotatedHardwareKey } =
            await prepareHardwareResign({
              items: resetItems.length
                ? items.map((item) => resetItemsById.get(item.id) ?? item)
                : items,
              previousPwdHashes: resetKey
                ? [...previousPwdHashes, resetKey.pwdHash]
                : previousPwdHashes,
              existing,
              credential,
              rebuildsLocalItemsNow,
              sameSelectedSource,
              sameSelectedWallet,
              makeCredential: () =>
                this.buildSyncCredentialWithKeylessCredential({
                  ...credential,
                  source,
                }),
              loadAuthoritativeItems: (syncCredential, opaqueCopies) =>
                prime.buildHardwareRestoreBusinessItems(
                  syncCredential,
                  opaqueCopies,
                ),
            });
          const adoptsOlderKey =
            enabledGeneration &&
            enabledGeneration.current < enabledGeneration.previous;
          if (
            credential.hardwareSession?.boundBaseURL &&
            !isSameServiceBaseURL(
              credential.hardwareSession.boundBaseURL,
              await this.getHardwareWalletRetryOrigin(),
            )
          )
            throw settingsChangedError();
          assertCurrent();
          this.hardwareCloudKeyCommitting = true;
          if (resetKey && resetItems.length) {
            const { preparePoolRekey } =
              await import('./hardwareCloudSyncResetDownload');
            // Keep the old key durable until all of its local writes commit.
            await localDb.updateSyncItem(
              preparePoolRekey(
                resetOriginals,
                resetItems,
                resetKey.pwdHash,
                isCurrent,
                settingsChangedError,
              ),
            );
            await this.assertCloudSyncStorageScopeCurrent();
            assertCurrent();
          }
          await keylessSyncCredentialStorage.saveCredential({
            ...credential,
            source,
          });
          await restoreEpoch.clear();
          await primeCloudSyncPersistAtom.set((value) => ({
            ...value,
            hardwareCloudSyncKeySource: source,
            currentCloudSyncKeylessWalletId: source.credentialId,
            isCloudSyncEnabled: false,
            isCloudSyncEnabledKeyless: false,
            lastSyncTimeKeyless: undefined,
          }));
          this.setKeylessCloudSyncCredentialCache({ ...credential, source });
          if (restoresRotatedHardwareKey) {
            await commitHardwareCloudSyncLocalRecovery(recoveredItems);
          }
          await this.backgroundApi.servicePrimeCloudSync.initLocalSyncItemsDB({
            syncCredential: this.buildSyncCredentialWithKeylessCredential({
              ...credential,
              source,
            }),
            password,
            askPasswordOnlyIfHdXfpMissing: true,
            onlyAddMissing: restoresRotatedHardwareKey || !!adoptsOlderKey,
            skipWalletPreparation: true,
          });
          await primeCloudSyncPersistAtom.set((value) => ({
            ...value,
            isCloudSyncEnabledKeyless: true,
            hardwareCloudSyncKeyGenerations: this.updateHardwareKeyGenerations(
              value.hardwareCloudSyncKeyGenerations,
              source.credentialId,
              enabledGeneration?.current,
              enabledGeneration?.previous,
            ),
          }));
          restoreWalletCaches = restoresRotatedHardwareKey;
        } catch (error) {
          // A key that did not end up enabled must not stay on this device;
          // turning sync on again has to ask the hardware for a new signature.
          if (
            this.hardwareCloudKeyCommitting &&
            !(await primeCloudSyncPersistAtom.get()).isCloudSyncEnabledKeyless
          ) {
            logHardwareCloudSyncDiagnostic(
              'delete_credential_after_incomplete_key_commit',
              {
                deletionAllowed: true,
              },
            );
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

    if (restoreWalletCaches && history && restoreEpoch.isCurrent()) {
      void recoverVerifiedWalletCaches({
        service: this,
        items: localItems,
        history,
        previousPwdHashes,
        key: { ...credential, source },
        isCurrent: restoreEpoch.isCurrent,
      }).catch(() => undefined);
    }

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
    await this.runWithCloudSyncSourceLock(async () => {
      await this.assertCloudSyncStorageScopeCurrent();
      const selected = (await primeCloudSyncPersistAtom.get())
        .hardwareCloudSyncKeySource;
      if (!selected) return;
      this.keylessSyncSettingAttempts += 1;
      try {
        const wallet =
          await this.backgroundApi.serviceAccount.getKeylessWallet();
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
        this.cloudAccountImportGeneration += 1;
        this.currentCloudSyncKeylessWalletIdCache = wallet.id;
      } finally {
        this.keylessSyncSettingAttempts -= 1;
      }
    });
  }

  private hardwareCloudKeySweepTimer:
    | ReturnType<typeof setInterval>
    | undefined;

  // Fallback for any path that left a hardware key behind while sync is off:
  // a turned-off hardware key must not stay on this device.
  async sweepHardwareCloudKeyIfSyncOff(): Promise<boolean> {
    return this.runWithCloudSyncSourceLock(() =>
      this.repairCredentialMutex.runExclusive(async () => {
        if (!(await this.isCloudSyncStorageScopeCurrent())) return false;
        const config = await primeCloudSyncPersistAtom.get();
        const source = config.hardwareCloudSyncKeySource;
        if (!source || config.isCloudSyncEnabledKeyless) return false;
        if (
          !(await keylessSyncCredentialStorage.hasStoredCredential(
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
    if (!(await this.isCloudSyncStorageScopeCurrent())) return false;
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

  @backgroundMethod()
  async isSelectedHardwareCloudKeyMissing(): Promise<boolean> {
    return (await this.getSelectedHardwareCloudKeyAvailability()) === 'missing';
  }

  private async getHardwareSessionAvailability(
    session: IHardwareCloudSyncSession | undefined,
  ): Promise<'available' | 'missing' | 'endpoint-mismatch'> {
    const isApiBaseURL = (value: unknown): value is string => {
      if (typeof value !== 'string' || !value || value !== value.trim())
        return false;
      try {
        const { protocol, username, password, search, hash } = new URL(value);
        return (
          (protocol === 'https:' || protocol === 'http:') &&
          !username &&
          !password &&
          !search &&
          !hash
        );
      } catch {
        return false;
      }
    };
    const boundBaseURL = session?.boundBaseURL;
    if (!isApiBaseURL(boundBaseURL)) return 'missing';
    const sessionEnvironment =
      session?.environment ?? getCloudSyncStorageEnvironmentForRuntime();
    if (
      sessionEnvironment &&
      sessionEnvironment !== (await this.getSelectedCloudSyncEnvironment())
    ) {
      return 'endpoint-mismatch';
    }
    return 'available';
  }

  @backgroundMethod()
  async getSelectedHardwareCloudKeyAvailability(): Promise<
    'available' | 'missing' | 'endpoint-mismatch' | 'selection-changed'
  > {
    const startGeneration = this.getCloudAccountImportGeneration();
    const { hardwareCloudSyncKeySource: source, isCloudSyncEnabledKeyless } =
      await primeCloudSyncPersistAtom.get();
    if (!source || !isCloudSyncEnabledKeyless) return 'available';
    const credential = await keylessSyncCredentialStorage.getCredential(
      source.credentialId,
    );
    const availability = await this.getHardwareSessionAvailability(
      credential?.hardwareSession,
    );
    const latest = await primeCloudSyncPersistAtom.get();
    if (
      startGeneration !== this.getCloudAccountImportGeneration() ||
      !latest.isCloudSyncEnabledKeyless ||
      latest.hardwareCloudSyncKeySource?.credentialId !== source.credentialId
    )
      return 'selection-changed';
    return availability;
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

  captureLocalAccountDeleteScope() {
    const storage = keylessSyncCredentialStorage.captureWriteGuard();
    const selection = this.getCloudAccountImportGeneration();
    const prime = this.backgroundApi.servicePrimeCloudSync;
    const intent = prime.getPublicAccountSnapshotImportGeneration();
    let endpointChanged = false;
    let release: () => void;
    try {
      release = devSettingsPersistAtom.sub(() => {
        endpointChanged = true;
      });
    } catch {
      return undefined;
    }
    return {
      release,
      isCurrent: () =>
        !endpointChanged &&
        storage() &&
        selection === this.getCloudAccountImportGeneration() &&
        intent === prime.getPublicAccountSnapshotImportGeneration(),
    };
  }

  private async getSelectedCloudSyncEnvironment(): Promise<'prod' | 'test'> {
    if (platformEnv.isWebEmbed) {
      return globalThis.WEB_EMBED_ONEKEY_APP_SETTINGS?.enableTestEndpoint
        ? 'test'
        : 'prod';
    }
    return getCloudSyncStorageEnvironment(
      await devSettingsPersistAtom.get(),
      false,
    );
  }

  private async isCloudSyncStorageScopeCurrent(): Promise<boolean> {
    const pinned = getCloudSyncStorageEnvironmentForRuntime();
    return !pinned || pinned === (await this.getSelectedCloudSyncEnvironment());
  }

  private async assertCloudSyncStorageScopeCurrent() {
    if (!(await this.isCloudSyncStorageScopeCurrent())) {
      throw new OneKeyLocalError({
        message: 'Cloud Sync environment changed. Restart the app to continue.',
        autoToast: false,
      });
    }
  }

  async getLocalMutationSyncCredential(): Promise<
    ICloudSyncCredential | undefined
  > {
    if (!(await this.isCloudSyncStorageScopeCurrent())) return undefined;
    // This optional read can outlive a local transaction's deadline. Never
    // enter legacy password recovery, hydrate a cache, or clear sync state.
    const generation = this.hardwareCloudKeyGeneration;
    const config = await primeCloudSyncPersistAtom.get();
    const source = config.hardwareCloudSyncKeySource;
    const id = config.currentCloudSyncKeylessWalletId;
    if (
      config.isCloudSyncEnabled ||
      !config.isCloudSyncEnabledKeyless ||
      !id ||
      (source && source.credentialId !== id)
    )
      return undefined;

    const credential = await keylessSyncCredentialStorage.getCredential(id);
    if (
      !credential ||
      credential.keylessWalletId !== id ||
      !credential.pwdHash ||
      !credential.encryptionKey ||
      credential.pendingHardwareKeyMigration ||
      credential.pendingDataKey ||
      (source
        ? credential.source?.type !== source.type ||
          credential.source.credentialId !== id ||
          credential.source.derivationVersion !== source.derivationVersion ||
          !credential.hardwareSession?.dekId
        : credential.source ||
          credential.hardwareSession ||
          !credential.signingPublicKey)
    )
      return undefined;

    const selected = await primeCloudSyncPersistAtom.get();
    if (
      this.hardwareCloudKeyGeneration !== generation ||
      selected.isCloudSyncEnabled ||
      !selected.isCloudSyncEnabledKeyless ||
      selected.currentCloudSyncKeylessWalletId !== id ||
      selected.hardwareCloudSyncKeySource?.credentialId !==
        source?.credentialId ||
      selected.hardwareCloudSyncKeySource?.derivationVersion !==
        source?.derivationVersion
    )
      return undefined;
    return this.buildSyncCredentialWithKeylessCredential(credential);
  }

  async getKeylessCloudSyncCredential(): Promise<IKeylessCloudSyncCredential | null> {
    if (!(await this.isCloudSyncStorageScopeCurrent())) return null;
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
    if (!(await this.isCloudSyncStorageScopeCurrent()))
      return ECloudSyncMode.None;
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
  private async getHardwareSyncClient() {
    await this.assertCloudSyncStorageScopeCurrent();
    const environment = await this.getSelectedCloudSyncEnvironment();
    const client = await this.getClient(
      EServiceEndpointEnum.Prime,
      endpointsMap[environment].prime,
    );
    await this.assertCloudSyncStorageScopeCurrent();
    if (environment !== (await this.getSelectedCloudSyncEnvironment()))
      throw settingsChangedError();
    return client;
  }

  async getHardwareWalletRetryOrigin() {
    return (await this.getHardwareSyncClient()).defaults.baseURL;
  }

  private hardwareSessionRefresh:
    | Promise<IKeylessCloudSyncCredential>
    | undefined;

  private hardwareSessionRefreshOrigin?: { baseURL?: string };

  private hardwareSessionEnding = false;

  private hardwareCredentialCacheGeneration = 0;

  private hardwareUploadEndGeneration = 0;

  private hardwareUploadAbortControllers = new Set<AbortController>();

  getHardwareUploadGeneration(): number | undefined {
    if (this.hardwareSessionEnding) return undefined;
    return (
      this.getCloudAccountImportGeneration() + this.hardwareUploadEndGeneration
    );
  }

  // One refresh at a time: refreshing twice with one token voids the first
  // reply's token, and later using it makes the server revoke the session.
  // A failed refresh keeps the stored token; the server accepts it once more
  // while the token from a lost reply is unused.
  private async getFreshHardwareCredential(
    credential: IKeylessCloudSyncCredential,
    { force, boundBaseURL }: { force?: boolean; boundBaseURL?: string } = {},
  ): Promise<IKeylessCloudSyncCredential> {
    if (force || this.hardwareSessionEnding || !credential.hardwareSession) {
      logHardwareCloudSyncDiagnostic('credential_refresh_precheck', {
        forceRequested: !!force,
        sessionEnding: this.hardwareSessionEnding,
        refreshInFlight: !!this.hardwareSessionRefresh,
        hasSession: !!credential.hardwareSession,
      });
    }
    const sessionEnvironment = credential.hardwareSession?.environment;
    if (
      this.hardwareSessionEnding ||
      (sessionEnvironment &&
        sessionEnvironment !== (await this.getSelectedCloudSyncEnvironment()))
    ) {
      throw settingsChangedError();
    }
    if (this.hardwareSessionRefresh) {
      if (force) {
        logHardwareCloudSyncDiagnostic(
          'credential_refresh_joined_shared_promise',
          { forceRequested: true },
        );
      }
      const origin = this.hardwareSessionRefreshOrigin;
      const refreshed = await this.hardwareSessionRefresh;
      if (
        boundBaseURL &&
        (!isSameServiceBaseURL(origin?.baseURL, boundBaseURL) ||
          (refreshed.hardwareSession?.boundBaseURL &&
            !canUseHardwareCloudSyncSessionAt(
              refreshed.hardwareSession,
              boundBaseURL,
            )))
      )
        throw settingsChangedError();
      return refreshed;
    }
    const session = credential.hardwareSession;
    if (!session) return credential;
    const prime = this.backgroundApi.servicePrimeCloudSync;
    const cacheGeneration = this.hardwareCredentialCacheGeneration;
    const cancelGeneration = prime.getPublicAccountSnapshotImportGeneration();
    const canPersist = () =>
      cacheGeneration === this.hardwareCredentialCacheGeneration;
    const canPublish = () =>
      canPersist() &&
      !this.hardwareSessionEnding &&
      cancelGeneration === prime.getPublicAccountSnapshotImportGeneration();
    const origin: { baseURL?: string } = {};
    const refreshing = (async () => {
      // A refresh that finished after this request read its credential has
      // already rotated the token; use the stored one instead of reusing it.
      const stored = await keylessSyncCredentialStorage.getCredential(
        credential.keylessWalletId,
      );
      if (!canPublish()) throw settingsChangedError();
      const client = await this.getHardwareSyncClient();
      if (!canPublish()) throw settingsChangedError();
      const actualBaseURL = client.defaults?.baseURL;
      if (
        (boundBaseURL && !isSameServiceBaseURL(actualBaseURL, boundBaseURL)) ||
        (session.boundBaseURL &&
          !canUseHardwareCloudSyncSessionAt(session, actualBaseURL)) ||
        (stored?.hardwareSession?.boundBaseURL &&
          !canUseHardwareCloudSyncSessionAt(
            stored.hardwareSession,
            actualBaseURL,
          ))
      )
        throw settingsChangedError();
      origin.baseURL = actualBaseURL;
      const matchesEndpoint = async () =>
        !actualBaseURL ||
        (isSameServiceBaseURL(client.defaults.baseURL, actualBaseURL) &&
          isSameServiceBaseURL(
            (await this.getHardwareSyncClient()).defaults?.baseURL,
            actualBaseURL,
          ) &&
          isSameServiceBaseURL(client.defaults.baseURL, actualBaseURL));
      if (
        stored?.hardwareSession?.sessionId === session.sessionId &&
        stored.hardwareSession.refreshToken !== session.refreshToken
      ) {
        logHardwareCloudSyncDiagnostic(
          'credential_refresh_reused_stored_session',
          {
            forceRequested: !!force,
          },
        );
        return stored;
      }
      let next: IHardwareCloudSyncSession | undefined;
      try {
        next = await refreshHardwareCloudSyncSessionIfNeeded({
          client,
          session,
          force,
          ...(actualBaseURL ? { boundBaseURL: actualBaseURL } : {}),
        });
      } catch (error) {
        logHardwareCloudSyncDiagnostic('credential_refresh_failed', {
          forceRequested: !!force,
          unauthorized: isHardwareCloudSyncUnauthorizedError(error),
        });
        if (
          canPublish() &&
          isHardwareCloudSyncUnauthorizedError(error) &&
          (await matchesEndpoint()) &&
          canPublish()
        ) {
          logHardwareCloudSyncDiagnostic(
            'sign_in_required_after_unauthorized_refresh',
            {},
          );
          await this.requireHardwareCloudSyncSignIn(credential);
        }
        throw error;
      }
      if (next || force) {
        logHardwareCloudSyncDiagnostic('credential_refresh_result', {
          forceRequested: !!force,
          refreshedSession: !!next,
        });
      }
      if (!next) {
        if (!canPublish()) throw settingsChangedError();
        return credential;
      }
      // A guarded request must preserve the exact outbound target as at least
      // a restriction. Only a verified final URL enables seamless resume.
      if (
        (next.boundBaseURL &&
          !isSameServiceBaseURL(next.boundBaseURL, actualBaseURL)) ||
        (boundBaseURL && !next.boundBaseURL)
      )
        throw settingsChangedError();
      const updated = { ...credential, hardwareSession: next };
      return this.saveHardwareCredential(updated, {
        expected: credential,
        refreshedSession: true,
        refreshAdmission: {
          canPersist,
          canPublish,
          ...(actualBaseURL ? { matchesEndpoint } : {}),
        },
      });
    })();
    this.hardwareSessionRefresh = refreshing;
    this.hardwareSessionRefreshOrigin = origin;
    try {
      return await refreshing;
    } finally {
      this.hardwareSessionRefresh = undefined;
      this.hardwareSessionRefreshOrigin = undefined;
    }
  }

  // Called only from ordinary Account application under the import lock.
  // Source switches hold that lock, but session revocation/refresh can write
  // credentials under the repair mutex alone. Keep both outside mutations
  // excluded until the already-prepared account transaction commits.
  async runWithVerifiedHardwareAccountArchiveSession<T>(
    expected: IKeylessCloudSyncCredential,
    apply: () => Promise<T>,
  ): Promise<T | undefined> {
    return this.repairCredentialMutex.runExclusive(async () => {
      const config = await primeCloudSyncPersistAtom.get();
      const source = config.hardwareCloudSyncKeySource;
      const session = expected.hardwareSession;
      if (
        !this.hardwareCloudMigrationRecovered ||
        this.hardwareSessionEnding ||
        config.isCloudSyncEnabled ||
        !config.isCloudSyncEnabledKeyless ||
        !source ||
        !session ||
        expected.pendingDataKey ||
        expected.pendingHardwareKeyMigration ||
        expected.source?.type !== 'hardware' ||
        source.credentialId !== expected.keylessWalletId ||
        source.credentialId !== expected.source.credentialId ||
        source.derivationVersion !== expected.source.derivationVersion
      ) {
        return undefined;
      }
      const stored = await keylessSyncCredentialStorage.getCredential(
        expected.keylessWalletId,
      );
      if (
        stored?.source?.type !== 'hardware' ||
        stored.pendingDataKey ||
        stored.pendingHardwareKeyMigration ||
        stored.source.credentialId !== source.credentialId ||
        stored.source.derivationVersion !== source.derivationVersion ||
        stored.keylessWalletId !== expected.keylessWalletId ||
        stored.pwdHash !== expected.pwdHash ||
        stored.encryptionKey !== expected.encryptionKey ||
        stored.signingPublicKey !== expected.signingPublicKey ||
        stored.hardwareSession?.sessionId !== session.sessionId ||
        stored.hardwareSession?.dekId !== session.dekId
      ) {
        return undefined;
      }
      return apply();
    });
  }

  // Returns the session credential while it is still selected:
  // a request in flight must not write back after sync was turned off or
  // switched to Keyless (saveCredential replaces the whole credential table).
  private async getStoredHardwareSessionCredential(
    credential: IKeylessCloudSyncCredential,
  ): Promise<IKeylessCloudSyncCredential | undefined> {
    const config = await primeCloudSyncPersistAtom.get();
    if (
      !config.isCloudSyncEnabledKeyless ||
      config.hardwareCloudSyncKeySource?.credentialId !==
        credential.keylessWalletId
    ) {
      return undefined;
    }
    const stored = await keylessSyncCredentialStorage.getCredential(
      credential.keylessWalletId,
    );
    return stored?.hardwareSession &&
      stored.hardwareSession.sessionId === credential.hardwareSession?.sessionId
      ? stored
      : undefined;
  }

  // The session was revoked or the key was reset elsewhere: pause this
  // device's sync until the hardware wallet signs in again.
  private async requireHardwareCloudSyncSignIn(
    credential: IKeylessCloudSyncCredential,
  ): Promise<never> {
    await this.repairCredentialMutex.runExclusive(async () => {
      if (!(await this.isCloudSyncStorageScopeCurrent())) return;
      const stored = await this.getStoredHardwareSessionCredential(credential);
      logHardwareCloudSyncDiagnostic('sign_in_credential_deletion_guard', {
        deletionAllowed: !!stored,
      });
      if (!stored) return;
      if (
        stored.source?.type === 'hardware' &&
        stored.pendingDataKey &&
        !stored.pendingHardwareKeyMigration &&
        (!stored.hardwareSession?.environment ||
          stored.hardwareSession.environment ===
            (await this.getSelectedCloudSyncEnvironment()))
      ) {
        // Re-signing can finish the local reset without reusing this session.
        await keylessSyncCredentialStorage.saveCredential({
          keylessWalletId: stored.keylessWalletId,
          source: stored.source,
          signingPrivateKey: '',
          signingPublicKey: '',
          encryptionKey: stored.encryptionKey,
          pwdHash: stored.pwdHash,
          pendingDataKey: stored.pendingDataKey,
        });
        return;
      }
      await keylessSyncCredentialStorage.removeAllCredentials();
      logHardwareCloudSyncDiagnostic('sign_in_credential_deleted', {});
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
    logHardwareCloudSyncDiagnostic('revoke_session_precheck', {
      hasSession: !!credential.hardwareSession,
      currentSession: scope === 'current',
    });
    if (!credential.hardwareSession) return;
    try {
      const client = await this.getHardwareSyncClient();
      await revokeHardwareCloudSyncSession({
        client,
        session: credential.hardwareSession,
        scope,
      });
      logHardwareCloudSyncDiagnostic('revoke_session_completed', {
        currentSession: scope === 'current',
      });
    } catch (error) {
      logHardwareCloudSyncDiagnostic('revoke_session_failed', {
        currentSession: scope === 'current',
        unauthorized: isHardwareCloudSyncUnauthorizedError(error),
      });
      logHardwareCloudSyncFailure(`Revoke ${scope} session failed`, error);
      errorUtils.autoPrintErrorIgnore(error);
    }
  }

  private async saveHardwareCredential(
    credential: IKeylessCloudSyncCredential,
    {
      expected = credential,
      refreshedSession = false,
      beforeSave,
      refreshAdmission,
    }: {
      expected?: IKeylessCloudSyncCredential;
      refreshedSession?: boolean;
      beforeSave?: (
        stored: IKeylessCloudSyncCredential,
      ) => Promise<boolean | void>;
      refreshAdmission?: {
        canPersist: () => boolean;
        canPublish: () => boolean;
        matchesEndpoint?: () => Promise<boolean>;
      };
    } = {},
  ): Promise<IKeylessCloudSyncCredential> {
    const commit = this.repairCredentialMutex.runExclusive(async () => {
      if (refreshAdmission && !refreshAdmission.canPersist()) return undefined;
      if (!(await this.getStoredHardwareSessionCredential(expected)))
        return undefined;
      const stored = await keylessSyncCredentialStorage.getCredential(
        expected.keylessWalletId,
      );
      if (
        !stored?.hardwareSession ||
        stored.pwdHash !== expected.pwdHash ||
        stored.hardwareSession.dekId !== expected.hardwareSession?.dekId ||
        (expected.hardwareSession?.boundBaseURL &&
          !isSameServiceBaseURL(
            stored.hardwareSession.boundBaseURL,
            expected.hardwareSession.boundBaseURL,
          )) ||
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
      const before = stored.hardwareSession;
      const after = updated.hardwareSession;
      const source = stored.source;
      const sameSession =
        !!source &&
        source.type === 'hardware' &&
        source.credentialId === expected.keylessWalletId &&
        source.credentialId === expected.source?.credentialId &&
        source.derivationVersion === expected.source.derivationVersion &&
        stored.keylessWalletId === expected.keylessWalletId &&
        stored.encryptionKey === expected.encryptionKey &&
        stored.signingPublicKey === expected.signingPublicKey &&
        updated.source?.type === source.type &&
        updated.source.credentialId === source.credentialId &&
        updated.source.derivationVersion === source.derivationVersion &&
        updated.keylessWalletId === stored.keylessWalletId &&
        updated.pwdHash === stored.pwdHash &&
        updated.encryptionKey === stored.encryptionKey &&
        updated.signingPublicKey === stored.signingPublicKey &&
        !!after &&
        after.sessionId === before.sessionId &&
        after.dekId === before.dekId &&
        after.environment === before.environment &&
        (!before.boundBaseURL ||
          canUseHardwareCloudSyncSessionAt(before, after.boundBaseURL)) &&
        after.deviceKeyJwk.kty === before.deviceKeyJwk.kty &&
        after.deviceKeyJwk.crv === before.deviceKeyJwk.crv &&
        after.deviceKeyJwk.x === before.deviceKeyJwk.x &&
        after.deviceKeyJwk.y === before.deviceKeyJwk.y &&
        after.deviceKeyJwk.d === before.deviceKeyJwk.d;

      const verified =
        refreshedSession &&
        sameSession &&
        !!after?.boundBaseURL &&
        after.boundBaseURLVerified === true;
      const matchesEndpoint = refreshAdmission?.matchesEndpoint;
      // Save verified rotations before checking publication scope.
      if (matchesEndpoint && !verified && !(await matchesEndpoint()))
        return undefined;
      if (
        refreshAdmission &&
        (!refreshAdmission.canPersist() ||
          (!sameSession && !refreshAdmission.canPublish()))
      )
        return undefined;
      if (beforeSave) {
        if ((await beforeSave(stored)) === false)
          return { credential: stored, preservesScope: true };
        if (refreshAdmission && !refreshAdmission.canPersist())
          return undefined;
      }
      await keylessSyncCredentialStorage.saveCredential(updated);
      if (matchesEndpoint && !(await matchesEndpoint())) return undefined;
      if (refreshAdmission && !refreshAdmission.canPersist()) return undefined;
      if (refreshAdmission && !refreshAdmission.canPublish()) {
        // A running refresh may have rotated the server token before Off.
        // Keep the same-session token for revocation, not in the memory cache.
        return sameSession
          ? { credential: updated, preservesScope: true }
          : undefined;
      }
      if (
        verified &&
        !stored.pendingDataKey &&
        !stored.pendingHardwareKeyMigration &&
        !this.hardwareSessionEnding
      ) {
        // Only replace token data in memory. Invalidating the active Cloud
        // scope here would cancel the request that just renewed its token.
        this.setKeylessCloudSyncCredentialCache(updated);
        this.backgroundApi.servicePrimeCloudSync.invalidateSyncCredentialMemo();
        return { credential: updated, preservesScope: true };
      }
      return {
        credential: updated,
        preservesScope: false,
        preservePendingHardwareRefresh:
          !refreshedSession &&
          sameSession &&
          !stored.pendingHardwareKeyMigration &&
          !updated.pendingHardwareKeyMigration &&
          !!updated.pendingDataKey,
      };
    });
    const saved = await commit;
    if (!saved) {
      throw settingsChangedError();
    }
    if (!saved.preservesScope) {
      if (refreshAdmission && !refreshAdmission.canPublish())
        throw settingsChangedError();
      this.setKeylessCloudSyncCredentialCache(saved.credential);
      const prime = this.backgroundApi.servicePrimeCloudSync;
      if (saved.preservePendingHardwareRefresh) {
        // A pending reset journal did not replace the key. Cancel active
        // sync but let the old session save the token already rotated by
        // the server, alongside the journal and without warming the cache.
        await prime.clearCachedSyncCredential({
          preservePendingHardwareRefresh: true,
        });
      } else {
        await prime.clearCachedSyncCredential();
      }
    }
    return saved.credential;
  }

  private async commitHardwareDataKey(
    credential: IKeylessCloudSyncCredential,
    next: IHardwareCloudSyncDataKey,
    guard?: IHardwareDataKeyCommitGuard,
  ): Promise<IKeylessCloudSyncCredential> {
    const { commitHardwareDataKey } =
      await import('./hardwareCloudSyncResetDownload');
    return commitHardwareDataKey({
      credential,
      next,
      guard,
      runWithSourceLock: (task) => this.runWithCloudSyncSourceLock(task),
      loadSyncItems: () =>
        this.backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems({
          includeUnsupportedDataTypes: true,
        }),
      assertUnknownSyncItemsCanMigrate: (items, hashes) =>
        this.assertUnknownSyncItemsCanMigrate(items, hashes),
      reencrypt: reencryptHardwareCloudSyncItems,
      updateSyncItems: (params) => localDb.updateSyncItem(params),
      saveCredential: (updated, options) =>
        this.saveHardwareCredential(updated, options),
      hardwareSignedOutError,
      settingsChangedError,
    });
  }

  // The server refused a stale data key: finish this device's interrupted
  // reset, or stop here because another device reset it.
  private async handleHardwareDataKeyRefused(
    credential: IKeylessCloudSyncCredential,
  ): Promise<IKeylessCloudSyncCredential | undefined> {
    const session = credential.hardwareSession;
    if (!session) return undefined;
    const generation = this.getHardwareUploadGeneration();
    const client = await this.getHardwareSyncClient();
    const requestBaseURL = client.defaults?.baseURL;
    const serverDekId = await getCurrentHardwareCloudSyncDataKeyId({
      client,
      session,
    });
    if (
      requestBaseURL &&
      !isSameServiceBaseURL(
        requestBaseURL,
        await this.getHardwareWalletRetryOrigin(),
      )
    )
      throw settingsChangedError();
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
        {
          origin: requestBaseURL,
          generation: pending.generation,
          isCurrent: () =>
            generation !== undefined &&
            generation === this.getHardwareUploadGeneration() &&
            (!requestBaseURL ||
              isSameServiceBaseURL(requestBaseURL, client.defaults?.baseURL)),
        },
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
      logHardwareCloudSyncDiagnostic(
        'sign_in_required_after_server_data_key_changed',
        {},
      );
      await this.requireHardwareCloudSyncSignIn(credential);
    }
    if (pending) {
      await this.runWithCloudSyncSourceLock(() =>
        this.saveHardwareCredential(
          { ...credential, pendingDataKey: undefined },
          {
            beforeSave: async (durable) => {
              const current = durable.pendingDataKey;
              if (
                current?.dekId !== pending.dekId ||
                current?.dek !== pending.dek ||
                current?.pwdHash !== pending.pwdHash ||
                current?.generation !== pending.generation
              )
                return false;
              const pool = await resolveBeforeTimeout(
                this.backgroundApi.servicePrimeCloudSync.getAllLocalSyncItems({
                  includeUnsupportedDataTypes: true,
                }),
                1000,
              );
              // A stalled read or an old Lock cannot retire a key still in use.
              return (
                !!pool &&
                !pool.items.some((item) => item.pwdHash === pending.pwdHash)
              );
            },
          },
        ),
      );
    }
    return undefined;
  }

  private async hardwareSyncPost<T>({
    credential,
    urlPath,
    postData,
    retryAfterKeySwitch,
    requestOptions,
    filterUpload,
    prepareWalletRetry,
    assertCanUpload,
  }: {
    credential: IKeylessCloudSyncCredential;
    urlPath: string;
    postData: Record<string, unknown>;
    // Uploads carry records encrypted with the old key, so they never retry.
    retryAfterKeySwitch?: boolean;
    requestOptions?: { signal?: AbortSignal; timeout?: number };
    assertCanUpload?: () => void;
    prepareWalletRetry?: (
      credential: IKeylessCloudSyncCredential,
      baseURL: string | undefined,
    ) => Promise<(() => ICloudSyncUploadPostData) | undefined>;
    filterUpload?: (
      baseURL: string | undefined,
      pwdHash: string,
    ) => ICloudSyncUploadPostData;
  }) {
    // An optional detached retry must not refresh or hydrate a selected
    // session as a side effect. Keep the normal request path unchanged.
    assertCanUpload?.();
    const bindUploadEndpoint = !!assertCanUpload && !prepareWalletRetry;
    const boundBaseURL = bindUploadEndpoint
      ? (await this.getHardwareSyncClient()).defaults?.baseURL
      : undefined;
    if (bindUploadEndpoint && !boundBaseURL) throw settingsChangedError();
    assertCanUpload?.();
    const fresh = prepareWalletRetry
      ? credential
      : await this.getFreshHardwareCredential(credential, { boundBaseURL });
    assertCanUpload?.();
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
    const sendBaseURL = boundBaseURL ?? client.defaults?.baseURL;
    const assertRequestScope = async () => {
      assertCanUpload?.();
      if (
        sendBaseURL &&
        !isSameServiceBaseURL(
          await this.getHardwareWalletRetryOrigin(),
          sendBaseURL,
        )
      )
        throw settingsChangedError();
      assertCanUpload?.();
    };
    const send = async (current: IKeylessCloudSyncCredential) => {
      assertCanUpload?.();
      const session = current.hardwareSession;
      if (!session) throw hardwareSignedOutError();
      if (
        session.environment &&
        session.environment !== (await this.getSelectedCloudSyncEnvironment())
      )
        throw settingsChangedError();
      if (
        (current.hardwareSession?.boundBaseURL &&
          !canUseHardwareCloudSyncSessionAt(
            current.hardwareSession,
            sendBaseURL,
          )) ||
        (sendBaseURL &&
          !isSameServiceBaseURL(client.defaults?.baseURL, sendBaseURL))
      )
        throw settingsChangedError();
      const response = await requestRawWithHardwareCloudSyncSession<T>({
        client,
        session,
        method: 'POST',
        urlPath,
        data: { ...postData, pwdHash: current.pwdHash },
        requestOptions,
        ...(sendBaseURL ? { boundBaseURL: sendBaseURL } : {}),
        ...(assertCanUpload ? { assertCanSend: assertCanUpload } : {}),
        ...(prepareWalletRetry
          ? {
              prepareWalletRetry: (baseURL) =>
                prepareWalletRetry(current, baseURL),
            }
          : {}),
        ...(filterUpload
          ? {
              prepareUpload: (baseURL: string | undefined) =>
                filterUpload(baseURL, current.pwdHash),
            }
          : {}),
      });
      await assertRequestScope();
      return response;
    };
    try {
      return await send(fresh);
    } catch (error) {
      await assertRequestScope();
      if (prepareWalletRetry) throw error;
      if (isHardwareCloudSyncUnauthorizedError(error)) {
        logHardwareCloudSyncDiagnostic(
          'business_unauthorized_response_refresh_requested',
          {
            retryAllowed: !!retryAfterKeySwitch,
          },
        );
        // A revoked session fails the refresh too, which asks for sign-in.
        const refreshed = await this.getFreshHardwareCredential(fresh, {
          force: true,
          boundBaseURL,
        });
        logHardwareCloudSyncDiagnostic(
          'business_unauthorized_response_retry_decision',
          {
            retryAllowed: !!retryAfterKeySwitch,
          },
        );
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
    await this.assertCloudSyncStorageScopeCurrent();
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
    const rotationBaseURL = client.defaults?.baseURL;
    const endpointAbort = new AbortController();
    const stopEndpointWatch = rotationBaseURL
      ? devSettingsPersistAtom.sub(() => endpointAbort.abort())
      : undefined;
    const isRotationCurrent = () =>
      isCurrent() &&
      !endpointAbort.signal.aborted &&
      (!rotationBaseURL ||
        isSameServiceBaseURL(client.defaults?.baseURL, rotationBaseURL));
    let rotated:
      | Awaited<ReturnType<typeof rotateHardwareCloudSyncDataKey>>
      | undefined;
    let committing = false;
    let committedSource: IHardwareCloudSyncKeySource | undefined;
    let replacement: IKeylessCloudSyncCredential | undefined;
    let replacementGeneration = 0;
    let knownGeneration: number | undefined;
    let migrationSource = credential;
    const beforeFlush = async () => {
      if (
        !isCurrent() ||
        !(await this.getStoredHardwareSessionCredential(credential))
      ) {
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
          const {
            prepareHardwareCloudSyncMigrationSource,
            migrateHardwareCloudSyncRecords,
          } = await import('./hardwareCloudSyncMigration');
          if (!isCurrent()) throw new HardwareCloudSyncCancelledError();
          const migrationItems = await prepareHardwareCloudSyncMigrationSource({
            backgroundApi: this.backgroundApi,
            sourcePwdHash: credential.pwdHash,
            reconcile: true,
          });
          this.assertUnknownSyncItemsCanMigrate(migrationItems, [
            credential.pwdHash,
          ]);
          const targetSession = await this.signInHardwareCloudSync({
            client,
            device,
          });
          knownGeneration = await this.getHardwareKeyGeneration(
            device.credentialId,
          );
          const targetKey = await bootstrapHardwareCloudSyncDataKey({
            client,
            session: targetSession,
            deriveKek: device.deriveKek,
            minGeneration: knownGeneration,
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
            beforeFlush: async () => {
              await prepareHardwareCloudSyncMigrationSource({
                backgroundApi: this.backgroundApi,
                sourcePwdHash: credential.pwdHash,
              });
              await beforeFlush();
            },
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
      knownGeneration = await this.getHardwareKeyGeneration(
        source.credentialId,
      );
      rotated = await rotateHardwareCloudSyncDataKey({
        client,
        session,
        deriveKek: device.deriveKek,
        minGeneration: knownGeneration,
        current: {
          dek: credential.encryptionKey,
          dekId: session.dekId,
          pwdHash: credential.pwdHash,
        },
        // Preflight every local ciphertext the old key must re-encrypt.
        // Commit re-reads local data so edits during the reset are preserved.
        localItems: items,
        isCurrent: isRotationCurrent,
        flushSignal: endpointAbort.signal,
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
        if (!isRotationCurrent()) throw new HardwareCloudSyncCancelledError();
        await this.saveHardwareCredential(
          { ...credential, pendingDataKey: undefined },
          {
            refreshAdmission: {
              canPersist: isRotationCurrent,
              canPublish: isRotationCurrent,
            },
          },
        );
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
        const { commitHardwareCloudSyncMigration } =
          await import('./hardwareCloudSyncMigration');
        const target = { ...replacement, source: derived.source };
        await this.runWithCloudSyncSourceLock(() =>
          this.repairCredentialMutex.runExclusive(async () => {
            if (
              !isCurrent() ||
              !(await this.getStoredHardwareSessionCredential(migrationSource))
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
          knownGeneration,
        );
        await this.revokeOtherHardwareSessions(migrationSource);
        await this.revokeCurrentHardwareSession(migrationSource);
        await this.backgroundApi.servicePrimeCloudSync.startServerSyncFlow({
          callerName: 'Switch hardware Cloud sync wallet',
          forceSync: true,
        });
        return;
      }
      if (!rotated) {
        throw new HardwareCloudSyncCancelledError();
      }
      const origin = rotated.verifiedFlushOrigin ?? rotationBaseURL;
      const updated = await this.commitHardwareDataKey(
        credential,
        rotated.next,
        {
          origin,
          generation: rotated.generation,
          isCurrent: () =>
            isRotationCurrent() &&
            (!origin || isSameServiceBaseURL(client.defaults?.baseURL, origin)),
        },
      );
      committedSource = derived.source;
      await this.recordHardwareKeyGeneration(
        source.credentialId,
        rotated.generation,
        knownGeneration,
      );
      await this.revokeOtherHardwareSessions(updated);
      await this.backgroundApi.servicePrimeCloudSync.startServerSyncFlow({
        callerName: 'Reset hardware Cloud sync key',
        forceSync: true,
      });
    } finally {
      stopEndpointWatch?.();
      // A committed key keeps its fresh display metadata even if synchronization
      // fails, while optional metadata storage cannot replace the original error.
      if (committedSource) {
        await this.updateHardwareCloudSyncDeviceName(committedSource).catch(
          (error: unknown) =>
            logHardwareCloudSyncFailure('Persist device name', error),
        );
      }
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
    previousGeneration?: number,
  ) {
    await primeCloudSyncPersistAtom.set((value) => {
      const generations = this.updateHardwareKeyGenerations(
        value.hardwareCloudSyncKeyGenerations,
        credentialId,
        generation,
        previousGeneration,
      );
      if (generations === value.hardwareCloudSyncKeyGenerations) return value;
      return {
        ...value,
        hardwareCloudSyncKeyGenerations: generations,
      };
    });
  }

  private updateHardwareKeyGenerations(
    generations: Record<string, number> | undefined,
    credentialId: string,
    generation: number | undefined,
    previousGeneration?: number,
  ) {
    const known = generations?.[credentialId] ?? 0;
    // Do not overwrite another operation's version with an earlier observation.
    if (
      generation === undefined ||
      generation === known ||
      (generation < known && previousGeneration !== known)
    ) {
      return generations;
    }
    return { ...generations, [credentialId]: generation };
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
    requestOptions,
  }: {
    requestOptions?: {
      signal?: AbortSignal;
      timeout?: number;
    };
    postData: ICloudSyncCheckServerStatusPostData;
  }) {
    const hardwareCredential = await this.getHardwareSessionCredential();
    if (hardwareCredential) {
      const response =
        await this.hardwareSyncPost<ICloudSyncCheckServerStatusResult>({
          credential: hardwareCredential,
          urlPath: '/prime/v1/sync/check',
          postData,
          requestOptions,
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
      requestOptions,
      signatureHeader: auth.signatureHeader,
      postData: auth.fullPostData,
    });
    return {
      response,
      pwdHash: auth.pwdHash,
    };
  }

  async resumeHardwareCloudSyncKeyRotation({
    key,
    items,
    isCurrent,
    signal,
  }: {
    key: IKeylessCloudSyncCredential;
    items: readonly IDBCloudSyncItem[];
    isCurrent: () => boolean;
    signal: AbortSignal;
  }) {
    const session = key.hardwareSession;
    if (
      key.source?.type !== 'hardware' ||
      !session?.boundBaseURLVerified ||
      key.pendingDataKey ||
      key.pendingHardwareKeyMigration
    )
      return;

    const generation = this.getHardwareUploadGeneration();
    const stillCurrent = () =>
      !signal.aborted &&
      generation !== undefined &&
      generation === this.getHardwareUploadGeneration() &&
      isCurrent();
    if (!stillCurrent()) return;

    const candidates = items.filter(
      (item) =>
        item.pwdHash.startsWith(HARDWARE_CLOUD_SYNC_DEK_PWDHASH_PREFIX) &&
        isRetainedHardwareCloudCopy(item, key.pwdHash) &&
        item.localSceneUpdated &&
        !item.isDeleted &&
        !item.pendingPublicAccountDeletionHash &&
        !!item.rawKey &&
        (item.dataType === EPrimeCloudSyncDataType.Account
          ? item.rawData === ''
          : !!item.rawData),
    );
    if (!candidates.length) return;

    const baseURL = await this.getHardwareWalletRetryOrigin();
    if (
      !baseURL ||
      !canUseHardwareCloudSyncSessionAt(session, baseURL) ||
      !stillCurrent()
    )
      return;

    // A normal check has no previous key envelopes to prove same-wallet rotation.
    const history = await this.hardwareSyncPost<
      IHardwareCloudSyncHistory['data']['data']
    >({
      credential: key,
      urlPath: '/prime/v1/sync/download',
      postData: { pwdHash: key.pwdHash },
      requestOptions: { signal, timeout: 5000 },
    });
    if (!stillCurrent()) return;

    const { recoverVerifiedWalletCaches } =
      await import('./hardwareCloudSyncRecovery');
    await recoverVerifiedWalletCaches({
      service: this,
      items: candidates,
      history,
      key,
      isCurrent: stillCurrent,
      resume: { baseURL, signal },
    });
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
    requestOptions,
    urlPath,
    filterHardwareUpload,
    prepareWalletRetry,
    canUploadHardware,
  }: {
    requestOptions?: { signal?: AbortSignal; timeout?: number };
    postData: ICloudSyncUploadPostData;
    urlPath: string;
    canUploadHardware?: () => boolean;
    prepareWalletRetry?: (
      credential: IKeylessCloudSyncCredential,
      baseURL: string | undefined,
    ) => Promise<(() => ICloudSyncUploadPostData) | undefined>;
    filterHardwareUpload?: (
      actualBaseURL: string | undefined,
      pwdHash: string,
    ) => ICloudSyncUploadPostData;
  }) {
    const assertCanUpload =
      canUploadHardware || prepareWalletRetry
        ? () => {
            if (
              this.hardwareSessionEnding ||
              requestOptions?.signal?.aborted ||
              canUploadHardware?.() === false
            )
              throw new OneKeyLocalError({
                message: 'Hardware Cloud upload cancelled',
                autoToast: false,
              });
          }
        : undefined;
    assertCanUpload?.();
    const hardwareCredential = prepareWalletRetry
      ? (await this.getLocalMutationSyncCredential())?.keylessCredential
      : await this.getHardwareSessionCredential();
    assertCanUpload?.();
    if (
      prepareWalletRetry &&
      (!hardwareCredential?.hardwareSession ||
        hardwareCredential.hardwareSession.accessTokenExpiresAt <= Date.now())
    ) {
      throw new OneKeyLocalError({
        message: 'Hardware Cloud Wallet upload retry cancelled',
        autoToast: false,
      });
    }
    if (canUploadHardware && !hardwareCredential?.hardwareSession)
      throw hardwareSignedOutError();
    if (hardwareCredential) {
      const controller = assertCanUpload ? new AbortController() : undefined;
      const callerSignal = requestOptions?.signal;
      const forwardAbort = () => controller?.abort();
      if (controller) {
        this.hardwareUploadAbortControllers.add(controller);
        if (callerSignal?.aborted) forwardAbort();
        else callerSignal?.addEventListener('abort', forwardAbort);
      }
      try {
        return (
          await this.hardwareSyncPost<ICloudSyncUploadResult>({
            credential: hardwareCredential,
            urlPath,
            postData,
            requestOptions: controller
              ? { ...requestOptions, signal: controller.signal }
              : requestOptions,
            filterUpload: filterHardwareUpload,
            prepareWalletRetry,
            assertCanUpload,
          })
        ).data.data;
      } finally {
        if (controller) {
          this.hardwareUploadAbortControllers.delete(controller);
          callerSignal?.removeEventListener('abort', forwardAbort);
        }
      }
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
      requestOptions,
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
      if (credential?.hardwareSession && credential.pwdHash !== pwdHash) {
        logHardwareCloudSyncDiagnostic('flush_push_precheck', {
          hasCredential: true,
          hasSession: true,
          hasPushedPwdHash: !!pwdHash,
          pwdHashMatches: false,
        });
      }
      if (!credential?.hardwareSession) return;
      // Same key: the flush only rewrote data, which the push leaves out.
      if (credential.pwdHash === pwdHash) {
        await this.backgroundApi.servicePrimeCloudSync.startServerSyncFlowSilently(
          { callerName: 'Hardware Cloud sync flush push', forceSync: true },
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
      logHardwareCloudSyncDiagnostic('session_revoked_push_precheck', {
        hasCredential: !!credential,
        hasSession: !!session,
        hasPushedSessionId: !!sessionId,
        sessionMatches: !!session && session.sessionId === sessionId,
      });
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

        const payload = rawDataJson.payload;
        if (
          rawDataJson.dataType === EPrimeCloudSyncDataType.Account &&
          payload &&
          'accountId' in payload &&
          typeof payload.accountId === 'string' &&
          payload.accountId.startsWith(PUBLIC_ACCOUNT_SNAPSHOT_PREFIX)
        ) {
          try {
            normalizePublicAccountSnapshotRecord(rawDataJson);
          } catch {
            throw new PublicAccountSnapshotUnsupportedError();
          }
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
        if (error instanceof PublicAccountSnapshotUnsupportedError) throw error;
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
      (item) =>
        item.dataType !== EPrimeCloudSyncDataType.Lock &&
        !item.pendingPublicAccountDeletionAt,
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
      this.cloudAccountImportGeneration += 1;
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
    if (resetUtils.getIsResetting()) return;
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
      if (resetUtils.getIsResetting()) return;
      if (!(await this.isCloudSyncStorageScopeCurrent())) return;
      if (await this.shouldPreserveHardwareCloudKey()) return;
      await this.setPersistedCurrentCloudSyncKeylessWalletId(
        currentCloudSyncKeylessWalletId,
      );
      if (!currentCloudSyncKeylessWalletId) {
        if (resetUtils.getIsResetting()) return;
        try {
          await keylessSyncCredentialStorage.removeAllCredentials();
        } catch (error) {
          if (resetUtils.isResettingError(error)) return;
          throw error;
        }
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
    preservePendingHardwareRefresh,
  }: {
    keylessWalletId?: string;
    preservePendingHardwareRefresh?: boolean;
  } = {}) {
    if (!preservePendingHardwareRefresh) {
      this.hardwareCredentialCacheGeneration += 1;
    }
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
    if (!(await this.isCloudSyncStorageScopeCurrent())) return;
    if (await this.shouldPreserveHardwareCloudKey()) {
      // Repairing a hardware credential requires the explicit hardware flow, never a local seed.
      return;
    }
    await this.repairCredentialMutex.runExclusive(async () => {
      if (!(await this.isCloudSyncStorageScopeCurrent())) return;
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
    await this.assertCloudSyncStorageScopeCurrent();
    if (!enabled) {
      await this.backgroundApi.servicePrimeCloudSync.cancelPublicAccountSnapshotImport();
    }
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
      return this.runWithCloudAccountImportLock(() =>
        this.setCloudSyncEnabledKeylessWithKeyLock(enabled),
      );
    });
  }

  private async setCloudSyncEnabledKeylessWithKeyLock(
    enabled: boolean,
  ): Promise<boolean> {
    await this.assertCloudSyncStorageScopeCurrent();
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

    // A newer explicit Keyless setting must not be restored over by an
    // earlier OneKey ID initialization, even when both are temporarily off.
    this.backgroundApi.servicePrimeCloudSync.invalidateOneKeyIdCloudSyncToggle();
    const endingHardwareSession = !shouldEnableKeyless && !!hardwareSource;
    if (endingHardwareSession) {
      this.hardwareSessionEnding = true;
      this.hardwareUploadEndGeneration += 1;
      // Axios and its selected adapter may still be awaiting preflight after
      // admitting the POST. Stop those operations with the request's signal.
      for (const controller of this.hardwareUploadAbortControllers)
        controller.abort();
    }
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
          await this.assertCloudSyncStorageScopeCurrent();
          logHardwareCloudSyncDiagnostic(
            'delete_credential_after_disabling_sync',
            {
              hasSession: !!stored?.hardwareSession,
            },
          );
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
    // Track the setting change, not the key lock shared with ordinary writers.
    this.keylessSyncSettingAttempts += 1;
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
        errorToastUtils.showLocalSecretEnvelopeRecoveryToastIfNeeded(error);
      }
      throw error;
    } finally {
      this.keylessSyncSettingAttempts -= 1;
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
      // Keyless can still be Off while an admitted migration syncs the old mode.
      this.keylessSyncSettingAttempts += 1;
      try {
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
          onlyIfSyncOff,
        });
      } finally {
        this.keylessSyncSettingAttempts -= 1;
      }
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

    await this.backgroundApi.servicePrimeCloudSync.prepareLocalSyncWallets({
      password,
    });

    // Only the local write needs the key lock. The prompt and repair above ran
    // without it, so confirm this credential is still the selected key first.
    const initLocalSyncItems = () =>
      this.runWithCloudSyncKeyLock(async () => {
        const selected = await this.getKeylessCloudSyncCredential();
        if (
          selected?.keylessWalletId !== keylessCredential.keylessWalletId ||
          selected?.source?.credentialId !==
            keylessCredential.source?.credentialId ||
          selected?.signingPublicKey !== keylessCredential.signingPublicKey ||
          selected?.pwdHash !== keylessCredential.pwdHash ||
          selected?.encryptionKey !== keylessCredential.encryptionKey
        ) {
          throw new HardwareCloudSyncError(
            ETranslations.cloud_sync_key_selection_changed__msg,
            'The encryption method for Cloud sync changed. Your data will sync with the new one next time.',
          );
        }
        await this.backgroundApi.servicePrimeCloudSync.initLocalSyncItemsDB({
          password,
          skipWalletPreparation: true,
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
