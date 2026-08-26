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
import {
  NATIVE_STORAGE_MIGRATION_LEDGER_COMPLETE,
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
      .filter((key) => key !== MMKV_MIGRATION_COMPLETE_KEY);
  }

  private async finishInterruptedReset(): Promise<void> {
    const legacy = this.getLegacyAsyncStorage();
    const legacyKeys = (await legacy.getAllKeys()).filter((key) =>
      key.startsWith('g_states_v5:'),
    );
    if (legacyKeys.length > 0) {
      await legacy.multiRemove(legacyKeys);
    }
    this.mmkv.clearAll();
    this.mmkv.set(MMKV_MIGRATION_COMPLETE_KEY, '1');
    if (this.mmkv.getString(MMKV_MIGRATION_COMPLETE_KEY) !== '1') {
      throw new OneKeyLocalError(
        'Jotai reset migration marker verification failed',
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

  /** Copies and verifies the complete legacy namespace before publishing. */
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
        this.log('migration already complete, skip');
        return;
      }
      if (ledger === NATIVE_STORAGE_MIGRATION_LEDGER_COMPLETE) {
        throw new OneKeyLocalError(
          createNativeStorageMigrationInconsistentErrorMessage('jotai'),
        );
      }

      const entries = await this.getLegacyAsyncStorage().multiGet(expectedKeys);
      const valuesByKey = new Map(entries);

      // A killed process may leave only part of a previous copy behind.
      expectedKeys.forEach((key) => {
        void this.store.delete(key as any);
      });

      let migratedCount = 0;
      for (const key of expectedKeys) {
        if (!valuesByKey.has(key)) {
          throw new OneKeyLocalError(
            `Jotai migration returned an incomplete batch for key=${key}`,
          );
        }
        const value = valuesByKey.get(key);
        if (typeof value === 'string') {
          void this.store.set(key as any, value);
          if (this.mmkv.getString(key) !== value) {
            throw new OneKeyLocalError(
              `Jotai migration verification failed for key=${key}`,
            );
          }
          migratedCount += 1;
        }
      }

      void this.store.set(MMKV_MIGRATION_COMPLETE_KEY as any, '1');
      if (this.mmkv.getString(MMKV_MIGRATION_COMPLETE_KEY) !== '1') {
        throw new OneKeyLocalError(
          'Jotai migration completion marker verification failed',
        );
      }
      await syncNativeStorageMMKV('onekey-jotai-states');
      await setNativeStorageMigrationLedgerComplete(JOTAI_MIGRATION_LEDGER_KEY);
      this.migrationReady = true;
      this.log(
        `migration complete: ${migratedCount} migrated, ${expectedKeys.length - migratedCount} absent`,
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
