/**
 * Native background runtime Jotai storage backed by MMKV.
 *
 * This file is resolved ONLY on iOS/Android (`.native.ts`). Web, desktop and
 * extension builds resolve the sibling `jotaiStorageNativeMMKV.ts` stub, which
 * keeps the native migration module chain (and its `react-native` imports)
 * out of non-native startup graphs. Jest maps this module to the `.native`
 * implementation via `moduleNameMapper`.
 */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ISyncStorage } from '@onekeyhq/shared/src/storage/instance/createMMKVSyncStorage';
import { retryLegacyAsyncStorageOperation } from '@onekeyhq/shared/src/storage/legacyAsyncStorageRetry';
import {
  NATIVE_STORAGE_MIGRATION_LEDGER_COMPLETE,
  NATIVE_STORAGE_MIGRATION_LEDGER_MIGRATING,
  NATIVE_STORAGE_MIGRATION_LEDGER_RESETTING,
  getNativeStorageMigrationLedger,
  setNativeStorageMigrationLedger,
  setNativeStorageMigrationLedgerComplete,
  syncNativeStorageMMKV,
} from '@onekeyhq/shared/src/storage/nativeStorageMigrationModule';
import { createNativeStorageMigrationInconsistentErrorMessage } from '@onekeyhq/shared/src/storage/nativeStorageTypes';
import {
  buildTravelModeCurrencyReferenceView,
  buildTravelModeManualLockPersistView,
  buildTravelModePasswordPersistView,
  buildTravelModeSettingsPersistView,
  mergeTravelModeManualLockPersistWrite,
  mergeTravelModePasswordPersistWrite,
  mergeTravelModeSettingsPersistWrite,
  travelModeManager,
} from '@onekeyhq/shared/src/travelMode';

import {
  CURRENCY_REFERENCE_STORAGE_KEY,
  MANUAL_LOCK_CONTROL_STORAGE_KEY,
  MMKV_MIGRATION_COMPLETE_KEY,
  PASSWORD_CONTROL_STORAGE_KEY,
  SETTINGS_CONTROL_STORAGE_KEY,
} from './jotaiStorageConsts';

import type { AsyncStorage } from './types';

const JOTAI_MIGRATION_LEDGER_KEY = 'jotai-storage-v1';
const JOTAI_LEGACY_CLEANUP_COMPLETE_KEY = '__mmkv_legacy_cleanup_v1__';
const JOTAI_LEGACY_RETENTION_POLICY_KEY = '__mmkv_legacy_retention_v1__';
const JOTAI_LEGACY_RETENTION_POLICY_RETAINED = 'retained-v1';
const JOTAI_MIGRATION_REPORT_KEY = '__mmkv_migration_report_v1__';
const JOTAI_STORAGE_KEY_PREFIX = 'g_states_v5:';
const APP_STORAGE_KEY_PREFIX = 'app:';
const JOTAI_MIGRATION_CHUNK_SIZE = 100;

type IJotaiMigrationFailure = {
  attemptCount: number;
  key: string;
  reason: 'read' | 'write';
};

type IJotaiMigrationReport = {
  candidateKeyCount: number;
  enumerationAttemptCount: number;
  enumerationStatus: 'complete' | 'failed';
  failures: IJotaiMigrationFailure[];
  migratedKeyCount: number;
  snapshotKeyCount: number;
  sourceKeyCount: number;
  status: 'complete' | 'degraded';
  version: 1;
};

type IJotaiLegacyKeyEnumeration = {
  attemptCount: number;
  enumeratedKeys: Set<string>;
  enumerationStatus: 'complete' | 'failed';
  keys: string[];
  sourceKeyCount: number;
};

export class JotaiStorageNativeMMKV implements AsyncStorage<any> {
  /** Safe MMKV wrapper — null/undefined guarded via createMMKVSyncStorage */
  private storeInstance: ISyncStorage<string> | undefined;

  private mmkvInstance:
    | {
        getString(key: string): string | undefined;
        getAllKeys(): string[];
        clearAll(): void;
        set(key: string, value: string): void;
      }
    | undefined;

  /** Business access opens only after both migration markers are reconciled. */
  private migrationReady = false;

  private migrationPromise: Promise<void> | undefined;

  constructor() {
    if (!platformEnv.isNativeBackgroundThread) {
      throw new OneKeyLocalError(
        'Jotai MMKV storage is restricted to the native background runtime',
      );
    }
  }

  private initializeStorageBackend() {
    if (this.storeInstance && this.mmkvInstance) {
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: instance } =
      require('@onekeyhq/shared/src/storage/instance/jotaiMMKVStorageInstance') as typeof import('@onekeyhq/shared/src/storage/instance/jotaiMMKVStorageInstance');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createMMKVSyncStorage } =
      require('@onekeyhq/shared/src/storage/instance/syncStorageInstance') as typeof import('@onekeyhq/shared/src/storage/instance/syncStorageInstance');
    this.storeInstance = createMMKVSyncStorage<string>(instance, {
      checkResetting: true,
    });
    this.mmkvInstance = instance;
  }

  private get store(): ISyncStorage<string> {
    this.initializeStorageBackend();
    return this.storeInstance as ISyncStorage<string>;
  }

  private get mmkv() {
    this.initializeStorageBackend();
    return this.mmkvInstance as NonNullable<
      JotaiStorageNativeMMKV['mmkvInstance']
    >;
  }

  private log(msg: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { NativeLogger, LogLevel } =
        require('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger') as typeof import('@onekeyhq/shared/src/modules3rdParty/react-native-file-logger');
      NativeLogger.write(LogLevel.Info, `[JotaiStorageMMKV] ${msg}`);
    } catch {
      /* noop */
    }
  }

  private getLegacyAsyncStorage() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLegacyAsyncStorageForMigration } =
      require('@onekeyhq/shared/src/storage/legacyAsyncStorageMigration') as typeof import('@onekeyhq/shared/src/storage/legacyAsyncStorageMigration');
    return getLegacyAsyncStorageForMigration();
  }

  private getAppStorageSnapshot() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@onekeyhq/shared/src/storage/instance/appStorageMMKVInstance')
      .default as {
      getAllKeys(): string[];
      getString(key: string): string | undefined;
    };
  }

  private getAppStorageSnapshotKeys() {
    try {
      const keys = this.getAppStorageSnapshot()
        .getAllKeys()
        .filter((key) =>
          key.startsWith(
            `${APP_STORAGE_KEY_PREFIX}${JOTAI_STORAGE_KEY_PREFIX}`,
          ),
        )
        .map((key) => key.slice(APP_STORAGE_KEY_PREFIX.length));
      return [...new Set(keys)].toSorted();
    } catch (error) {
      this.log(
        `app-storage snapshot enumeration result=failed errorType=${this.getLegacyOperationErrorType(
          error,
        )}`,
      );
      return [];
    }
  }

  private readAppStorageSnapshotValue(key: string) {
    try {
      return this.getAppStorageSnapshot().getString(
        `${APP_STORAGE_KEY_PREFIX}${key}`,
      );
    } catch (error) {
      this.log(
        `app-storage snapshot read result=failed key=${this.getLegacyKeyDiagnosticLabel(
          key,
        )} errorType=${this.getLegacyOperationErrorType(error)}`,
      );
      return undefined;
    }
  }

  private assertMigrated() {
    if (!this.migrationReady) {
      throw new OneKeyLocalError(
        'Jotai storage cannot be accessed before legacy migration completes',
      );
    }
  }

  private getBusinessKeys() {
    return this.mmkv
      .getAllKeys()
      .filter(
        (key) =>
          key !== MMKV_MIGRATION_COMPLETE_KEY &&
          key !== JOTAI_LEGACY_CLEANUP_COMPLETE_KEY &&
          key !== JOTAI_LEGACY_RETENTION_POLICY_KEY &&
          key !== JOTAI_MIGRATION_REPORT_KEY,
      );
  }

  private getLegacyKeyDiagnosticLabel(key: string) {
    if (/^g_states_v5:[A-Za-z0-9_.:-]+$/.test(key)) {
      return key;
    }
    return `<redacted:${key.length}-chars>`;
  }

  private getLegacyOperationErrorType(error: unknown) {
    return error instanceof Error && error.name ? error.name : 'UnknownError';
  }

  private async enumerateLegacyKeysWithRetry(
    expectedKeys: string[],
    snapshotKeys: string[],
  ) {
    const result = await retryLegacyAsyncStorageOperation({
      operation: async () => {
        const legacy = this.getLegacyAsyncStorage();
        const rawKeys = (await legacy.getAllKeys()) as unknown;
        if (!Array.isArray(rawKeys)) {
          throw new OneKeyLocalError(
            'Jotai migration returned an invalid key list',
          );
        }
        return [...rawKeys] as unknown[];
      },
      onRetry: ({ delayMs, error, retryCount }) => {
        this.log(
          `source enumeration retry=${retryCount} delayMs=${delayMs} errorType=${this.getLegacyOperationErrorType(
            error,
          )}`,
        );
      },
    });
    if (!result.ok) {
      const keys = [...new Set([...snapshotKeys, ...expectedKeys])].toSorted();
      this.log(
        `source enumeration result=failed attempts=${result.attemptCount} fallbackKeyCount=${keys.length} errorType=${this.getLegacyOperationErrorType(
          result.error,
        )}`,
      );
      return {
        attemptCount: result.attemptCount,
        enumeratedKeys: new Set<string>(),
        enumerationStatus: 'failed',
        keys,
        sourceKeyCount: 0,
      } satisfies IJotaiLegacyKeyEnumeration;
    }

    const sourceKeys = result.value.filter(
      (key): key is string =>
        typeof key === 'string' && key.startsWith(JOTAI_STORAGE_KEY_PREFIX),
    );
    const uniqueSourceKeys = [...new Set(sourceKeys)].toSorted();
    const keys = [
      ...new Set([...uniqueSourceKeys, ...snapshotKeys, ...expectedKeys]),
    ].toSorted();
    this.log(
      `source enumeration result=complete attempts=${result.attemptCount} sourceKeyCount=${uniqueSourceKeys.length} candidateKeyCount=${keys.length}`,
    );
    return {
      attemptCount: result.attemptCount,
      enumeratedKeys: new Set(uniqueSourceKeys),
      enumerationStatus: 'complete',
      keys,
      sourceKeyCount: uniqueSourceKeys.length,
    } satisfies IJotaiLegacyKeyEnumeration;
  }

  private async readMigrationKeyWithRetry({
    enumerated,
    index,
    key,
  }: {
    enumerated: boolean;
    index: number;
    key: string;
  }) {
    const keyLabel = this.getLegacyKeyDiagnosticLabel(key);
    const snapshotValue = this.readAppStorageSnapshotValue(key);
    if (snapshotValue !== undefined) {
      this.log(
        `source key result=read index=${index} key=${keyLabel} source=app-storage-mmkv present=true attempts=0 sourceChars=${snapshotValue.length}`,
      );
      return { attemptCount: 0, value: snapshotValue };
    }
    const result = await retryLegacyAsyncStorageOperation({
      operation: async () => {
        const legacy = this.getLegacyAsyncStorage();
        const entries = await legacy.multiGet([key]);
        if (entries.length !== 1 || entries[0]?.[0] !== key) {
          throw new OneKeyLocalError(
            'Jotai migration returned an incomplete key read',
          );
        }
        const value = entries[0][1];
        if (value === null && enumerated) {
          throw new OneKeyLocalError(
            'Jotai migration returned no value for an enumerated key',
          );
        }
        if (value !== null && typeof value !== 'string') {
          throw new OneKeyLocalError(
            'Jotai migration returned an invalid key value',
          );
        }
        return value;
      },
      onRetry: ({ delayMs, error, retryCount }) => {
        this.log(
          `source key retry index=${index} key=${keyLabel} retry=${retryCount} delayMs=${delayMs} errorType=${this.getLegacyOperationErrorType(
            error,
          )}`,
        );
      },
    });
    if (!result.ok) {
      this.log(
        `source key result=skipped index=${index} key=${keyLabel} stage=read attempts=${result.attemptCount} errorType=${this.getLegacyOperationErrorType(
          result.error,
        )}`,
      );
      return undefined;
    }
    this.log(
      `source key result=read index=${index} key=${keyLabel} source=legacy-async-storage present=${result.value !== null} attempts=${result.attemptCount} sourceChars=${result.value?.length ?? 0}`,
    );
    return { attemptCount: result.attemptCount, value: result.value };
  }

  private async writeMigratedKeyWithRetry({
    index,
    key,
    value,
  }: {
    index: number;
    key: string;
    value: string;
  }) {
    const keyLabel = this.getLegacyKeyDiagnosticLabel(key);
    const result = await retryLegacyAsyncStorageOperation({
      operation: async () => {
        void this.store.set(key as any, value);
        if (this.mmkv.getString(key) !== value) {
          throw new OneKeyLocalError(
            'Jotai migration target value verification failed',
          );
        }
      },
      onRetry: ({ delayMs, error, retryCount }) => {
        this.log(
          `target key retry index=${index} key=${keyLabel} retry=${retryCount} delayMs=${delayMs} errorType=${this.getLegacyOperationErrorType(
            error,
          )}`,
        );
      },
    });
    if (!result.ok) {
      void this.store.delete(key as any);
      this.log(
        `target key result=skipped index=${index} key=${keyLabel} stage=write attempts=${result.attemptCount} sourceChars=${value.length} errorType=${this.getLegacyOperationErrorType(
          result.error,
        )}`,
      );
      return false;
    }
    this.log(
      `target key result=migrated index=${index} key=${keyLabel} attempts=${result.attemptCount} sourceChars=${value.length} targetChars=${value.length}`,
    );
    return true;
  }

  private persistMigrationReport(report: IJotaiMigrationReport) {
    const serializedReport = JSON.stringify(report);
    try {
      this.mmkv.set(JOTAI_MIGRATION_REPORT_KEY, serializedReport);
      if (
        this.mmkv.getString(JOTAI_MIGRATION_REPORT_KEY) !== serializedReport
      ) {
        throw new OneKeyLocalError(
          'Jotai migration report verification failed',
        );
      }
    } catch (error) {
      this.log(
        `migration report result=failed errorType=${this.getLegacyOperationErrorType(
          error,
        )}`,
      );
    }
  }

  private async clearLegacyJotaiData(): Promise<void> {
    const legacy = this.getLegacyAsyncStorage();
    const legacyKeys = (await legacy.getAllKeys()).filter((key) =>
      key.startsWith(JOTAI_STORAGE_KEY_PREFIX),
    );
    if (legacyKeys.length > 0) {
      await legacy.multiRemove(legacyKeys);
    }
    const remainingLegacyKeys = (await legacy.getAllKeys()).filter((key) =>
      key.startsWith(JOTAI_STORAGE_KEY_PREFIX),
    );
    if (remainingLegacyKeys.length > 0) {
      throw new OneKeyLocalError('Legacy Jotai cleanup verification failed');
    }
  }

  private async finishInterruptedReset(): Promise<void> {
    await this.clearLegacyJotaiData();
    this.mmkv.clearAll();
    this.mmkv.set(MMKV_MIGRATION_COMPLETE_KEY, '1');
    this.mmkv.set(JOTAI_LEGACY_CLEANUP_COMPLETE_KEY, '1');
    if (this.mmkv.getString(MMKV_MIGRATION_COMPLETE_KEY) !== '1') {
      throw new OneKeyLocalError(
        'Jotai reset migration marker verification failed',
      );
    }
    if (this.mmkv.getString(JOTAI_LEGACY_CLEANUP_COMPLETE_KEY) !== '1') {
      throw new OneKeyLocalError(
        'Jotai reset legacy cleanup marker verification failed',
      );
    }
    await syncNativeStorageMMKV('onekey-jotai-states');
    await setNativeStorageMigrationLedgerComplete(JOTAI_MIGRATION_LEDGER_KEY);
    this.migrationReady = true;
  }

  async getItem(key: string, initialValue: any): Promise<any> {
    const environment = await travelModeManager.getRuntimeEnvironment();
    const read = async () => {
      this.assertMigrated();
      const raw = this.mmkv.getString(key);
      if (raw !== undefined) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed !== null) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return parsed;
          }
        } catch (e) {
          this.log(`MMKV parse failed for ${key}: ${(e as Error)?.message}`);
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return initialValue;
    };
    return environment.persistence.run({
      operation: read,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      onBlocked: () => initialValue,
    });
  }

  async setItem(key: string, newValue: any): Promise<void> {
    const environment = await travelModeManager.getRuntimeEnvironment();
    const write = async () => {
      this.assertMigrated();
      if (newValue === undefined || newValue === null) {
        void this.store.delete(key);
      } else {
        void this.store.set(key, JSON.stringify(newValue));
      }
      await syncNativeStorageMMKV('onekey-jotai-states');
    };
    return environment.persistence.run({
      operation: write,
      onBlocked: () => undefined,
    });
  }

  async removeItem(key: string): Promise<void> {
    const environment = await travelModeManager.getRuntimeEnvironment();
    const remove = async () => {
      this.assertMigrated();
      void this.store.delete(key);
      await syncNativeStorageMMKV('onekey-jotai-states');
    };
    return environment.persistence.run({
      operation: remove,
      onBlocked: () => undefined,
    });
  }

  async getPasswordControlState(initialValue: unknown): Promise<unknown> {
    const raw = this.mmkv.getString(PASSWORD_CONTROL_STORAGE_KEY);
    if (raw === undefined) {
      return initialValue;
    }
    try {
      return buildTravelModePasswordPersistView({
        initialValue,
        persistedValue: JSON.parse(raw),
      });
    } catch {
      return initialValue;
    }
  }

  async setPasswordControlState(newValue: unknown): Promise<void> {
    const environment = await travelModeManager.getRuntimeEnvironment();
    if (environment.persistence.kind === 'real') {
      return this.setItem(PASSWORD_CONTROL_STORAGE_KEY, newValue);
    }
    const rawPersistedValue = this.mmkv.getString(PASSWORD_CONTROL_STORAGE_KEY);
    if (!rawPersistedValue) {
      return;
    }
    try {
      const persistedValue: unknown = JSON.parse(rawPersistedValue);
      const mergedValue = mergeTravelModePasswordPersistWrite({
        persistedValue,
        proposedValue: newValue,
      });
      void this.store.set(
        PASSWORD_CONTROL_STORAGE_KEY,
        JSON.stringify(mergedValue),
      );
      await syncNativeStorageMMKV('onekey-jotai-states');
    } catch (error) {
      this.log(
        `Travel Mode password state write skipped: ${
          (error as Error)?.message
        }`,
      );
    }
  }

  async removePasswordControlState(): Promise<void> {
    const environment = await travelModeManager.getRuntimeEnvironment();
    if (environment.persistence.kind === 'real') {
      await this.removeItem(PASSWORD_CONTROL_STORAGE_KEY);
    }
  }

  async getManualLockControlState(initialValue: unknown): Promise<unknown> {
    const raw = this.mmkv.getString(MANUAL_LOCK_CONTROL_STORAGE_KEY);
    if (raw === undefined) {
      return initialValue;
    }
    try {
      return buildTravelModeManualLockPersistView({
        initialValue,
        persistedValue: JSON.parse(raw),
      });
    } catch {
      return initialValue;
    }
  }

  async setManualLockControlState(newValue: unknown): Promise<void> {
    const environment = await travelModeManager.getRuntimeEnvironment();
    if (environment.persistence.kind === 'real') {
      return this.setItem(MANUAL_LOCK_CONTROL_STORAGE_KEY, newValue);
    }
    const rawPersistedValue = this.mmkv.getString(
      MANUAL_LOCK_CONTROL_STORAGE_KEY,
    );
    try {
      const persistedValue: unknown = rawPersistedValue
        ? JSON.parse(rawPersistedValue)
        : undefined;
      const mergedValue = mergeTravelModeManualLockPersistWrite({
        persistedValue,
        proposedValue: newValue,
      });
      const serializedValue = JSON.stringify(mergedValue);
      if (!serializedValue) {
        return;
      }
      void this.store.set(MANUAL_LOCK_CONTROL_STORAGE_KEY, serializedValue);
      await syncNativeStorageMMKV('onekey-jotai-states');
    } catch (error) {
      this.log(
        `Travel Mode manual lock state write skipped: ${
          (error as Error)?.message
        }`,
      );
    }
  }

  async removeManualLockControlState(): Promise<void> {
    const environment = await travelModeManager.getRuntimeEnvironment();
    if (environment.persistence.kind === 'real') {
      await this.removeItem(MANUAL_LOCK_CONTROL_STORAGE_KEY);
    }
  }

  async getSettingsControlState(initialValue: unknown): Promise<unknown> {
    const raw = this.mmkv.getString(SETTINGS_CONTROL_STORAGE_KEY);
    if (raw === undefined) {
      return initialValue;
    }
    try {
      return buildTravelModeSettingsPersistView({
        initialValue,
        persistedValue: JSON.parse(raw),
      });
    } catch {
      return initialValue;
    }
  }

  async setSettingsControlState(newValue: unknown): Promise<void> {
    const environment = await travelModeManager.getRuntimeEnvironment();
    if (environment.persistence.kind === 'real') {
      return this.setItem(SETTINGS_CONTROL_STORAGE_KEY, newValue);
    }
    const rawPersistedValue = this.mmkv.getString(SETTINGS_CONTROL_STORAGE_KEY);
    try {
      const persistedValue: unknown = rawPersistedValue
        ? JSON.parse(rawPersistedValue)
        : undefined;
      const mergedValue = mergeTravelModeSettingsPersistWrite({
        persistedValue,
        proposedValue: newValue,
      });
      void this.store.set(
        SETTINGS_CONTROL_STORAGE_KEY,
        JSON.stringify(mergedValue),
      );
      await syncNativeStorageMMKV('onekey-jotai-states');
    } catch (error) {
      this.log(
        `Travel Mode settings state write skipped: ${(error as Error)?.message}`,
      );
    }
  }

  async removeSettingsControlState(): Promise<void> {
    const environment = await travelModeManager.getRuntimeEnvironment();
    if (environment.persistence.kind === 'real') {
      await this.removeItem(SETTINGS_CONTROL_STORAGE_KEY);
    }
  }

  async getCurrencyReferenceState(initialValue: unknown): Promise<unknown> {
    const raw = this.mmkv.getString(CURRENCY_REFERENCE_STORAGE_KEY);
    if (raw === undefined) {
      return initialValue;
    }
    try {
      return buildTravelModeCurrencyReferenceView({
        initialValue,
        persistedValue: JSON.parse(raw),
      });
    } catch {
      return initialValue;
    }
  }

  isMigrationComplete(): boolean {
    return this.migrationReady;
  }

  /** Migrates every discovered legacy key independently before publishing. */
  async migrateFromAsyncStorage(
    expectedKeys: string[],
    _probeKey: string,
  ): Promise<void> {
    this.migrationPromise ??= (async () => {
      const ledger = await getNativeStorageMigrationLedger(
        JOTAI_MIGRATION_LEDGER_KEY,
      );
      if (
        ledger !== null &&
        ledger !== NATIVE_STORAGE_MIGRATION_LEDGER_COMPLETE &&
        ledger !== NATIVE_STORAGE_MIGRATION_LEDGER_MIGRATING &&
        ledger !== NATIVE_STORAGE_MIGRATION_LEDGER_RESETTING
      ) {
        throw new OneKeyLocalError(
          'Jotai migration ledger has an unsupported version',
        );
      }
      if (ledger === NATIVE_STORAGE_MIGRATION_LEDGER_RESETTING) {
        this.log('resuming interrupted reset');
        await this.finishInterruptedReset();
        this.log('interrupted reset complete');
        return;
      }
      const targetMarkerComplete =
        this.mmkv.getString(MMKV_MIGRATION_COMPLETE_KEY) === '1';
      if (targetMarkerComplete) {
        await syncNativeStorageMMKV('onekey-jotai-states');
        if (ledger !== NATIVE_STORAGE_MIGRATION_LEDGER_COMPLETE) {
          await setNativeStorageMigrationLedgerComplete(
            JOTAI_MIGRATION_LEDGER_KEY,
          );
          this.log('backfilled independent migration ledger');
        }
        this.migrationReady = true;
        let legacyBackupState = 'unknown';
        if (this.mmkv.getString(JOTAI_LEGACY_CLEANUP_COMPLETE_KEY) === '1') {
          legacyBackupState = 'cleanup-attempted-by-previous-version';
        } else if (
          this.mmkv.getString(JOTAI_LEGACY_RETENTION_POLICY_KEY) ===
          JOTAI_LEGACY_RETENTION_POLICY_RETAINED
        ) {
          legacyBackupState = 'retained';
        }
        this.log(
          `migration already complete, skip; legacyBackup=${legacyBackupState}`,
        );
        return;
      }
      if (ledger === NATIVE_STORAGE_MIGRATION_LEDGER_COMPLETE) {
        throw new OneKeyLocalError(
          createNativeStorageMigrationInconsistentErrorMessage('jotai'),
        );
      }

      const snapshotKeys = this.getAppStorageSnapshotKeys();
      const enumeration = await this.enumerateLegacyKeysWithRetry(
        expectedKeys,
        snapshotKeys,
      );
      const candidateKeys = enumeration.keys;

      if (ledger !== NATIVE_STORAGE_MIGRATION_LEDGER_MIGRATING) {
        await setNativeStorageMigrationLedger(
          JOTAI_MIGRATION_LEDGER_KEY,
          NATIVE_STORAGE_MIGRATION_LEDGER_MIGRATING,
        );
      }

      const existingTargetKeys = this.getBusinessKeys();
      if (enumeration.enumerationStatus === 'complete') {
        // A killed process may leave target keys that are no longer discoverable
        // from the current source. Only a complete enumeration can prove that
        // these values are orphaned and safe to remove before rebuilding.
        existingTargetKeys.forEach((key) => {
          void this.store.delete(key as any);
        });
        this.log(
          `target cleanup result=cleared targetKeyCount=${existingTargetKeys.length} sourceEnumeration=complete`,
        );
      } else {
        // Preserve the last recoverable MMKV state when the source key set is
        // unknown. Known candidates can still overwrite it during this pass.
        this.log(
          `target cleanup result=preserved targetKeyCount=${existingTargetKeys.length} sourceEnumeration=failed`,
        );
      }

      const failures: IJotaiMigrationFailure[] = [];
      let migratedCount = 0;
      for (
        let offset = 0;
        offset < candidateKeys.length;
        offset += JOTAI_MIGRATION_CHUNK_SIZE
      ) {
        const keys = candidateKeys.slice(
          offset,
          offset + JOTAI_MIGRATION_CHUNK_SIZE,
        );
        const readResults = await Promise.all(
          keys.map((key, chunkIndex) =>
            this.readMigrationKeyWithRetry({
              enumerated: enumeration.enumeratedKeys.has(key),
              index: offset + chunkIndex,
              key,
            }),
          ),
        );
        for (
          let chunkIndex = 0;
          chunkIndex < readResults.length;
          chunkIndex += 1
        ) {
          const index = offset + chunkIndex;
          const key = keys[chunkIndex];
          const readResult = readResults[chunkIndex];
          if (!readResult) {
            failures.push({ attemptCount: 4, key, reason: 'read' });
          } else if (readResult.value !== null) {
            const migrated = await this.writeMigratedKeyWithRetry({
              index,
              key,
              value: readResult.value,
            });
            if (!migrated) {
              failures.push({ attemptCount: 4, key, reason: 'write' });
            } else {
              migratedCount += 1;
            }
          }
        }
      }

      const status =
        enumeration.enumerationStatus === 'failed' || failures.length > 0
          ? 'degraded'
          : 'complete';
      this.persistMigrationReport({
        candidateKeyCount: candidateKeys.length,
        enumerationAttemptCount: enumeration.attemptCount,
        enumerationStatus: enumeration.enumerationStatus,
        failures,
        migratedKeyCount: migratedCount,
        snapshotKeyCount: snapshotKeys.length,
        sourceKeyCount: enumeration.sourceKeyCount,
        status,
        version: 1,
      });

      void this.store.set(MMKV_MIGRATION_COMPLETE_KEY as any, '1');
      void this.store.set(
        JOTAI_LEGACY_RETENTION_POLICY_KEY as any,
        JOTAI_LEGACY_RETENTION_POLICY_RETAINED,
      );
      if (this.mmkv.getString(MMKV_MIGRATION_COMPLETE_KEY) !== '1') {
        throw new OneKeyLocalError(
          'Jotai migration completion marker verification failed',
        );
      }
      if (
        this.mmkv.getString(JOTAI_LEGACY_RETENTION_POLICY_KEY) !==
        JOTAI_LEGACY_RETENTION_POLICY_RETAINED
      ) {
        throw new OneKeyLocalError(
          'Jotai migration legacy retention marker verification failed',
        );
      }
      await syncNativeStorageMMKV('onekey-jotai-states');
      await setNativeStorageMigrationLedgerComplete(JOTAI_MIGRATION_LEDGER_KEY);
      this.migrationReady = true;
      this.log(
        `migration complete status=${status} candidateKeyCount=${candidateKeys.length} migratedKeyCount=${migratedCount} failedKeyCount=${failures.length} absentKeyCount=${candidateKeys.length - migratedCount - failures.length} legacyBackup=retained`,
      );
    })().catch((error: unknown) => {
      this.migrationPromise = undefined;
      throw error;
    });
    return this.migrationPromise;
  }

  async clearAllForReset(): Promise<number> {
    const clearedKeysCount = this.getBusinessKeys().length;
    this.migrationReady = false;
    this.migrationPromise = undefined;
    try {
      await setNativeStorageMigrationLedger(
        JOTAI_MIGRATION_LEDGER_KEY,
        NATIVE_STORAGE_MIGRATION_LEDGER_RESETTING,
      );
      await this.finishInterruptedReset();
      this.migrationPromise = Promise.resolve();
      return clearedKeysCount;
    } catch (error) {
      this.migrationPromise = undefined;
      throw error;
    }
  }

  async resetAfterMigrationMismatch(): Promise<void> {
    const ledger = await getNativeStorageMigrationLedger(
      JOTAI_MIGRATION_LEDGER_KEY,
    );
    const markerComplete =
      this.mmkv.getString(MMKV_MIGRATION_COMPLETE_KEY) === '1';
    if (ledger !== NATIVE_STORAGE_MIGRATION_LEDGER_COMPLETE || markerComplete) {
      throw new OneKeyLocalError(
        'Jotai migration repair is no longer applicable',
      );
    }
    await this.clearAllForReset();
  }

  async getAllEntries(): Promise<Map<string, any> | null> {
    const environment = await travelModeManager.getRuntimeEnvironment();
    return environment.persistence.run({
      operation: async () => {
        this.assertMigrated();
        const map = new Map<string, any>();
        const keys = this.getBusinessKeys();
        for (const key of keys) {
          const raw = this.mmkv.getString(key);
          if (raw !== undefined) {
            try {
              map.set(key, JSON.parse(raw));
            } catch {
              map.set(key, undefined);
            }
          }
        }
        return map;
      },
      onBlocked: () => {
        return new Map<string, any>();
      },
    });
  }

  subscribe = undefined;
}

export function createJotaiStorageNativeMMKV(): JotaiStorageNativeMMKV {
  return new JotaiStorageNativeMMKV();
}
