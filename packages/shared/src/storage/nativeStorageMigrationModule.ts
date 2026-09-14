import { NativeModules } from 'react-native';

import { OneKeyLocalError } from '../errors';
import platformEnv from '../platformEnv';

export const NATIVE_STORAGE_MIGRATION_LEDGER_COMPLETE = 'complete-v1';
export const NATIVE_STORAGE_MIGRATION_LEDGER_MIGRATING = 'migrating-v1';
export const NATIVE_STORAGE_MIGRATION_LEDGER_RESETTING = 'resetting-v1';

export type INativeStorageMigrationLedgerKey =
  | 'app-storage-v1'
  | 'jotai-storage-v1';

export type INativeStorageRecoveryAction = 'auto_repair' | 'try_again';

export type INativeStorageMigrationLedgerValue =
  | typeof NATIVE_STORAGE_MIGRATION_LEDGER_COMPLETE
  | typeof NATIVE_STORAGE_MIGRATION_LEDGER_MIGRATING
  | typeof NATIVE_STORAGE_MIGRATION_LEDGER_RESETTING;

export type INativeStorageMMKVId =
  | 'onekey-app-storage-v1'
  | 'onekey-app-setting'
  | 'onekey-cold-start-cache'
  | 'onekey-app-dev-setting'
  | 'onekey-jotai-states';

interface INativeStorageMigrationModule {
  acknowledgeRecoveryAction(
    expectedAction: INativeStorageRecoveryAction,
  ): Promise<boolean>;
  getMigrationLedger(
    key: INativeStorageMigrationLedgerKey,
  ): Promise<string | null>;
  getMigrationStorageCapacity(): Promise<{
    availableBytes: number;
    legacyBytes: number;
  }>;
  peekRecoveryAction(): Promise<string>;
  readLegacyAsyncStorageValue(key: string): Promise<string | null>;
  setTravelModePushSuppressed(suppressed: boolean): Promise<void>;
  setMigrationLedger(
    key: INativeStorageMigrationLedgerKey,
    value: INativeStorageMigrationLedgerValue,
  ): Promise<void>;
  syncMMKV(mmapId: INativeStorageMMKVId): Promise<void>;
}

let nativeModule: INativeStorageMigrationModule | undefined;
const scheduledMMKVSyncs = new Map<
  INativeStorageMMKVId,
  { dirty: boolean; running: boolean }
>();

function getNativeStorageMigrationModule() {
  if (!platformEnv.isNativeBackgroundThread) {
    throw new OneKeyLocalError(
      'Native storage migration metadata is restricted to the native background runtime',
    );
  }
  const module = NativeModules.OneKeyNativeStorageMigration as
    | INativeStorageMigrationModule
    | undefined;
  if (!module) {
    throw new OneKeyLocalError(
      'The native storage migration module is unavailable; install a native build that supports MMKV migration',
    );
  }
  nativeModule ??= module;
  return nativeModule;
}

export function getNativeStorageMigrationLedger(
  key: INativeStorageMigrationLedgerKey,
) {
  return getNativeStorageMigrationModule().getMigrationLedger(key);
}

export async function getNativeStorageMigrationCapacity() {
  const result =
    await getNativeStorageMigrationModule().getMigrationStorageCapacity();
  if (
    !Number.isFinite(result?.availableBytes) ||
    result.availableBytes < 0 ||
    !Number.isFinite(result?.legacyBytes) ||
    result.legacyBytes < 0
  ) {
    throw new OneKeyLocalError(
      'The native storage migration capacity response is invalid',
    );
  }
  return result;
}

export function setNativeStorageMigrationLedgerComplete(
  key: INativeStorageMigrationLedgerKey,
) {
  return setNativeStorageMigrationLedger(
    key,
    NATIVE_STORAGE_MIGRATION_LEDGER_COMPLETE,
  );
}

export function setNativeStorageMigrationLedger(
  key: INativeStorageMigrationLedgerKey,
  value: INativeStorageMigrationLedgerValue,
) {
  return getNativeStorageMigrationModule().setMigrationLedger(key, value);
}

export function readLegacyAsyncStorageValueChunked(key: string) {
  return getNativeStorageMigrationModule().readLegacyAsyncStorageValue(key);
}

export async function peekNativeStorageRecoveryAction(): Promise<
  INativeStorageRecoveryAction | undefined
> {
  const action = await getNativeStorageMigrationModule().peekRecoveryAction();
  if (!action) {
    return undefined;
  }
  if (action === 'auto_repair' || action === 'try_again') {
    return action;
  }
  throw new OneKeyLocalError(
    'The native recovery action is not supported by this JavaScript build',
  );
}

export function acknowledgeNativeStorageRecoveryAction(
  action: INativeStorageRecoveryAction,
) {
  return getNativeStorageMigrationModule().acknowledgeRecoveryAction(action);
}

export function syncNativeStorageMMKV(mmapId: INativeStorageMMKVId) {
  return getNativeStorageMigrationModule().syncMMKV(mmapId);
}

export function setNativeTravelModePushSuppressed(suppressed: boolean) {
  return getNativeStorageMigrationModule().setTravelModePushSuppressed(
    suppressed,
  );
}

/**
 * Sync-storage APIs cannot await durability without changing their public
 * contract. Coalesce their native flushes while guaranteeing that a write
 * arriving during an in-flight flush triggers one more barrier.
 */
export function scheduleNativeStorageMMKVSync(mmapId: INativeStorageMMKVId) {
  let state = scheduledMMKVSyncs.get(mmapId);
  if (!state) {
    state = { dirty: false, running: false };
    scheduledMMKVSyncs.set(mmapId, state);
  }
  state.dirty = true;
  if (state.running) {
    return;
  }
  state.running = true;
  void (async () => {
    try {
      while (state.dirty) {
        state.dirty = false;
        await syncNativeStorageMMKV(mmapId);
      }
    } catch (error) {
      state.dirty = true;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { NativeLogger, LogLevel } =
          require('../modules3rdParty/react-native-file-logger') as typeof import('../modules3rdParty/react-native-file-logger');
        NativeLogger.write(
          LogLevel.Error,
          `[NativeStorage] MMKV durability barrier failed: ${
            error instanceof Error ? error.name : typeof error
          }`,
        );
      } catch {
        // A sync API cannot surface an asynchronous durability diagnostic.
      }
    } finally {
      state.running = false;
    }
  })();
}
