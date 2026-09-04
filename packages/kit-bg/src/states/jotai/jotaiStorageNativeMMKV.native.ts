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

import { MMKV_MIGRATION_COMPLETE_KEY } from './jotaiStorageConsts';

import type { AsyncStorage } from './types';

const JOTAI_MIGRATION_LEDGER_KEY = 'jotai-storage-v1';
const JOTAI_LEGACY_CLEANUP_COMPLETE_KEY = '__mmkv_legacy_cleanup_v1__';
const JOTAI_LEGACY_RETENTION_POLICY_KEY = '__mmkv_legacy_retention_v1__';
const JOTAI_LEGACY_RETENTION_POLICY_RETAINED = 'retained-v1';
const JOTAI_MIGRATION_REPORT_KEY = '__mmkv_migration_report_v1__';
const JOTAI_STORAGE_KEY_PREFIX = 'g_states_v5:';

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
  private store: ISyncStorage;

  private mmkv: {
    getString(key: string): string | undefined;
    getAllKeys(): string[];
    clearAll(): void;
    set(key: string, value: string): void;
  };

  /** Business access opens only after both migration markers are reconciled. */
  private migrationReady = false;

  private migrationPromise: Promise<void> | undefined;

  constructor() {
    if (!platformEnv.isNativeBackgroundThread) {
      throw new OneKeyLocalError(
        'Jotai MMKV storage is restricted to the native background runtime',
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { default: instance } =
      require('@onekeyhq/shared/src/storage/instance/jotaiMMKVStorageInstance') as typeof import('@onekeyhq/shared/src/storage/instance/jotaiMMKVStorageInstance');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createMMKVSyncStorage } =
      require('@onekeyhq/shared/src/storage/instance/syncStorageInstance') as typeof import('@onekeyhq/shared/src/storage/instance/syncStorageInstance');
    this.store = createMMKVSyncStorage(instance, { checkResetting: true });
    this.mmkv = instance;
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

  private async enumerateLegacyKeysWithRetry(expectedKeys: string[]) {
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
      const keys = [...new Set(expectedKeys)].toSorted();
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
      ...new Set([...uniqueSourceKeys, ...expectedKeys]),
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

  private async readLegacyKeyWithRetry({
    enumerated,
    index,
    key,
  }: {
    enumerated: boolean;
    index: number;
    key: string;
  }) {
    const keyLabel = this.getLegacyKeyDiagnosticLabel(key);
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
      `source key result=read index=${index} key=${keyLabel} present=${result.value !== null} attempts=${result.attemptCount} sourceChars=${result.value?.length ?? 0}`,
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
  }

  async setItem(key: string, newValue: any): Promise<void> {
    this.assertMigrated();
    if (newValue === undefined || newValue === null) {
      await this.removeItem(key);
      return;
    }
    void this.store.set(key as any, JSON.stringify(newValue));
    await syncNativeStorageMMKV('onekey-jotai-states');
  }

  async removeItem(key: string): Promise<void> {
    this.assertMigrated();
    void this.store.delete(key as any);
    await syncNativeStorageMMKV('onekey-jotai-states');
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

      const enumeration = await this.enumerateLegacyKeysWithRetry(expectedKeys);
      const candidateKeys = enumeration.keys;

      if (ledger !== NATIVE_STORAGE_MIGRATION_LEDGER_MIGRATING) {
        await setNativeStorageMigrationLedger(
          JOTAI_MIGRATION_LEDGER_KEY,
          NATIVE_STORAGE_MIGRATION_LEDGER_MIGRATING,
        );
      }

      // A killed process may leave only part of a previous copy behind.
      candidateKeys.forEach((key) => {
        void this.store.delete(key as any);
      });

      const readResults = await Promise.all(
        candidateKeys.map((key, index) =>
          this.readLegacyKeyWithRetry({
            enumerated: enumeration.enumeratedKeys.has(key),
            index,
            key,
          }),
        ),
      );
      const failures: IJotaiMigrationFailure[] = [];
      let migratedCount = 0;
      for (let index = 0; index < candidateKeys.length; index += 1) {
        const key = candidateKeys[index];
        const readResult = readResults[index];
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
  }

  subscribe = undefined;
}

export function createJotaiStorageNativeMMKV(): JotaiStorageNativeMMKV {
  return new JotaiStorageNativeMMKV();
}
