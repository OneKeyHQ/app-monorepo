/* cspell:ignore IMMKV */
import { isPlainObject } from 'lodash';

import { OneKeyLocalError } from '../errors';
import platformEnv from '../platformEnv';
import { travelModeManager } from '../travelMode';

import { getLegacyAsyncStorageForMigration } from './legacyAsyncStorageMigration';
import { retryLegacyAsyncStorageOperation } from './legacyAsyncStorageRetry';
import {
  NATIVE_STORAGE_MIGRATION_LEDGER_COMPLETE,
  NATIVE_STORAGE_MIGRATION_LEDGER_MIGRATING,
  NATIVE_STORAGE_MIGRATION_LEDGER_RESETTING,
  acknowledgeNativeStorageRecoveryAction,
  getNativeStorageMigrationCapacity,
  getNativeStorageMigrationLedger,
  peekNativeStorageRecoveryAction,
  setNativeStorageMigrationLedger,
  setNativeStorageMigrationLedgerComplete,
  syncNativeStorageMMKV,
} from './nativeStorageMigrationModule';
import {
  NATIVE_STORAGE_BOOTSTRAP_DEFAULT_STORES,
  createNativeStorageMigrationInconsistentErrorMessage,
} from './nativeStorageTypes';
import { broadcastNativeSyncStorageMutation } from './nativeSyncStorageBroadcast';
import { EAppSyncStorageKeys } from './syncStorageKeys';

import type { ILegacyAsyncStorageNativeModule } from './legacyAsyncStorageMigration';
import type {
  INativeAsyncStorageRequest,
  INativeStorageBootstrapSnapshot,
  INativeStorageRequest,
  INativeStorageScalar,
  INativeSyncStorageEntry,
  INativeSyncStorageMutation,
  INativeSyncStorageName,
  INativeSyncStorageRequest,
} from './nativeStorageTypes';

type IMMKVInstance = {
  readonly size?: number;
  getString(key: string): string | undefined;
  getNumber(key: string): number | undefined;
  getBoolean(key: string): boolean | undefined;
  set(key: string, value: INativeStorageScalar): void;
  remove(key: string): void;
  clearAll(): void;
  getAllKeys(): string[];
  trim(): void;
};

const APP_STORAGE_KEY_PREFIX = 'app:';
const APP_STORAGE_MIGRATION_COMPLETE_KEY =
  '__onekey_internal_app_storage_migration_v1__';
const APP_STORAGE_LEGACY_CLEANUP_COMPLETE_KEY =
  '__onekey_internal_app_storage_legacy_cleanup_v1__';
const APP_STORAGE_LEGACY_RETENTION_POLICY_KEY =
  '__onekey_internal_app_storage_legacy_retention_v1__';
const APP_STORAGE_LEGACY_RETENTION_POLICY_RETAINED = 'retained-v1';
const APP_STORAGE_LEGACY_RETENTION_POLICY_CLEARED = 'cleared-v1';
const APP_STORAGE_MIGRATION_LEDGER_KEY = 'app-storage-v1';
const APP_STORAGE_MMKV_ID = 'onekey-app-storage-v1';
const APP_STORAGE_TRANSACTION_JOURNAL_KEY =
  '__onekey_internal_app_storage_batch_journal_v1__';
const APP_STORAGE_MIGRATION_REPORT_KEY =
  '__onekey_internal_app_storage_migration_report_v1__';
const APP_STORAGE_JOURNAL_TRIM_THRESHOLD_CHARS = 1024 * 1024;
const APP_STORAGE_MIGRATION_DISK_RESERVE_BYTES = 32 * 1024 * 1024;
const APP_STORAGE_MIGRATION_SIZE_OVERHEAD_RATIO = 1.15;
const LEGACY_READ_CHUNK_SIZE = 100;
const MAX_MMKV_KEY_BYTE_LENGTH = 60_000;
const SYNC_STORAGE_QUEUE_RESULT_CACHE_LIMIT = 32;
const SYNC_STORAGE_QUEUE_RESULT_CACHE_MAX_VALUE_CHARS = 8 * 1024 * 1024;
const SYNC_STORAGE_QUEUE_RESULT_CACHE_TTL_MS = 5 * 60_000;
const UTF8_ONE_BYTE_LIMIT = 128;
const UTF8_TWO_BYTE_LIMIT = 2048;
const HIGH_SURROGATE_START = 55_296;
const HIGH_SURROGATE_END = 56_319;
const LOW_SURROGATE_START = 56_320;
const LOW_SURROGATE_END = 57_343;
const AUTO_REPAIR_SETTINGS_KEYS = [
  'onekey_pending_install_task',
  'onekey_whats_new_shown',
  'last_valid_server_time',
  'last_valid_local_time',
] as const;
const CRITICAL_LEGACY_APP_STORAGE_KEYS = [
  'simple_db_v5:addressBookItems',
  'simple_db_v5:localHistory',
] as const;

type ILegacyAppStorageMigrationFailure = {
  attemptCount: number;
  key: string;
  reason: 'capacity' | 'read' | 'write';
};

type ILegacyAppStorageMigrationReport = {
  candidateKeyCount: number;
  duplicateSourceKeyCount: number;
  enumerationAttemptCount: number;
  enumerationStatus: 'complete' | 'failed';
  failures: ILegacyAppStorageMigrationFailure[];
  invalidSourceKeyCount: number;
  migratedKeyCount: number;
  recoveredUnlistedKeyCount: number;
  sourceAccessAttemptCount: number;
  sourceBytes: number;
  sourceKeyCount: number;
  status: 'complete' | 'degraded';
  version: 1;
};

type ILegacyAppStorageEnumeration = {
  attemptCount: number;
  duplicateSourceKeyCount: number;
  enumeratedKeys: Set<string>;
  enumerationStatus: 'complete' | 'failed';
  invalidSourceKeyCount: number;
  keys: string[];
  sourceKeyCount: number;
};

type ILegacyAppStorageReadResult = {
  attemptCount: number;
  key: string;
  value: string | null;
};

type ILegacyAppStorageCopyResult = {
  failures: ILegacyAppStorageMigrationFailure[];
  migratedKeyCount: number;
  recoveredUnlistedKeyCount: number;
  totalBytes: number;
};

let appStorageMigrationPromise: Promise<void> | undefined;
let recoveryActionPromise: Promise<void> | undefined;
let asyncStorageRequestChain: Promise<void> = Promise.resolve();
// Main drains one request at a time per store, so only the latest acknowledgement
// for each main-runtime/store pair is needed to deduplicate a timed-out replay.
const completedSyncStorageResults = new Map<
  string,
  {
    completedAt: number;
    mutationId: number;
    result: INativeSyncStorageMutation;
    valueChars: number;
  }
>();

function pruneCompletedSyncStorageResults() {
  const now = Date.now();
  let totalValueChars = 0;
  completedSyncStorageResults.forEach((completed, sourceQueueId) => {
    if (
      now - completed.completedAt < 0 ||
      now - completed.completedAt > SYNC_STORAGE_QUEUE_RESULT_CACHE_TTL_MS
    ) {
      completedSyncStorageResults.delete(sourceQueueId);
      return;
    }
    totalValueChars += completed.valueChars;
  });
  while (
    completedSyncStorageResults.size > 1 &&
    (completedSyncStorageResults.size > SYNC_STORAGE_QUEUE_RESULT_CACHE_LIMIT ||
      totalValueChars > SYNC_STORAGE_QUEUE_RESULT_CACHE_MAX_VALUE_CHARS)
  ) {
    const oldestSourceQueueId = completedSyncStorageResults.keys().next()
      .value as string | undefined;
    if (!oldestSourceQueueId) {
      return;
    }
    const oldest = completedSyncStorageResults.get(oldestSourceQueueId);
    totalValueChars -= oldest?.valueChars ?? 0;
    completedSyncStorageResults.delete(oldestSourceQueueId);
  }
}

function logMigration(message: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NativeLogger, LogLevel } =
      require('../modules3rdParty/react-native-file-logger') as typeof import('../modules3rdParty/react-native-file-logger');
    NativeLogger.write(LogLevel.Info, `[NativeStorageMigration] ${message}`);
  } catch {
    // Migration correctness must not depend on diagnostics being available.
  }
}

function assertBackgroundRuntime() {
  if (!platformEnv.isNativeBackgroundThread) {
    throw new OneKeyLocalError(
      'Native storage execution is restricted to the native background runtime',
    );
  }
}

function getAppStorageMMKV(): IMMKVInstance {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./instance/appStorageMMKVInstance').default as IMMKVInstance;
}

function getSyncStorageMMKV(store: INativeSyncStorageName): IMMKVInstance {
  switch (store) {
    case 'settings': {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('./instance/mmkvStorageInstance').default as IMMKVInstance;
    }
    case 'devSettings': {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      return require('./instance/mmkvDevSettingStorageInstance')
        .default as IMMKVInstance;
    }
    default: {
      const exhaustive: never = store;
      throw new OneKeyLocalError(
        `Unknown native sync storage: ${String(exhaustive)}`,
      );
    }
  }
}

function getUtf8ByteLength(value: string) {
  let length = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < UTF8_ONE_BYTE_LIMIT) {
      length += 1;
    } else if (code < UTF8_TWO_BYTE_LIMIT) {
      length += 2;
    } else if (
      code >= HIGH_SURROGATE_START &&
      code <= HIGH_SURROGATE_END &&
      value.charCodeAt(index + 1) >= LOW_SURROGATE_START &&
      value.charCodeAt(index + 1) <= LOW_SURROGATE_END
    ) {
      length += 4;
      index += 1;
    } else {
      length += 3;
    }
  }
  return length;
}

function encodeAppStorageKey(key: string) {
  if (typeof key !== 'string') {
    throw new OneKeyLocalError('AsyncStorage key must be a string');
  }
  const targetKey = `${APP_STORAGE_KEY_PREFIX}${key}`;
  if (getUtf8ByteLength(targetKey) > MAX_MMKV_KEY_BYTE_LENGTH) {
    throw new OneKeyLocalError(
      'AsyncStorage key exceeds the MMKV key-size limit',
    );
  }
  return targetKey;
}

function decodeAppStorageKey(key: string) {
  return key.slice(APP_STORAGE_KEY_PREFIX.length);
}

function getLegacyKeyDiagnosticFingerprint(key: string) {
  let hash = 2_166_136_261;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function getLegacyKeyDiagnosticLabel(key: string) {
  if (
    key.startsWith('simple_db_v5:') &&
    /^simple_db_v5:[A-Za-z0-9_-]+$/.test(key)
  ) {
    return key;
  }
  return `<redacted:${getUtf8ByteLength(
    key,
  )}-bytes:fingerprint=${getLegacyKeyDiagnosticFingerprint(key)}>`;
}

function getLegacyOperationErrorType(error: unknown) {
  return error instanceof Error && error.name ? error.name : 'UnknownError';
}

async function enumerateLegacyAppStorageKeys(
  legacy: ILegacyAsyncStorageNativeModule,
): Promise<ILegacyAppStorageEnumeration> {
  const result = await retryLegacyAsyncStorageOperation({
    operation: async () => {
      const rawKeys = (await legacy.getAllKeys()) as unknown;
      if (!Array.isArray(rawKeys)) {
        throw new OneKeyLocalError(
          'AsyncStorage migration returned an invalid key list',
        );
      }
      return [...rawKeys] as unknown[];
    },
    onRetry: ({ delayMs, error, retryCount }) => {
      logMigration(
        `source enumeration retry=${retryCount} delayMs=${delayMs} errorType=${getLegacyOperationErrorType(
          error,
        )}`,
      );
    },
  });

  if (!result.ok) {
    logMigration(
      `source enumeration result=failed attempts=${result.attemptCount} errorType=${getLegacyOperationErrorType(
        result.error,
      )}`,
    );
    return {
      attemptCount: result.attemptCount,
      duplicateSourceKeyCount: 0,
      enumeratedKeys: new Set(),
      enumerationStatus: 'failed',
      invalidSourceKeyCount: 0,
      keys: [...CRITICAL_LEGACY_APP_STORAGE_KEYS],
      sourceKeyCount: 0,
    };
  }

  const stringKeys = result.value.filter(
    (key): key is string => typeof key === 'string',
  );
  const invalidSourceKeyCount = result.value.length - stringKeys.length;
  const uniqueSourceKeys = [...new Set(stringKeys)].toSorted();
  const duplicateSourceKeyCount = stringKeys.length - uniqueSourceKeys.length;
  const enumeratedKeys = new Set(uniqueSourceKeys);
  const keys = [
    ...uniqueSourceKeys,
    ...CRITICAL_LEGACY_APP_STORAGE_KEYS.filter(
      (key) => !enumeratedKeys.has(key),
    ),
  ];

  logMigration(
    `source enumeration result=complete attempts=${result.attemptCount} rawKeyCount=${result.value.length} sourceKeyCount=${uniqueSourceKeys.length} candidateKeyCount=${keys.length} duplicateKeyCount=${duplicateSourceKeyCount} invalidKeyCount=${invalidSourceKeyCount}`,
  );
  return {
    attemptCount: result.attemptCount,
    duplicateSourceKeyCount,
    enumeratedKeys,
    enumerationStatus: 'complete',
    invalidSourceKeyCount,
    keys,
    sourceKeyCount: uniqueSourceKeys.length,
  };
}

async function getLegacyAppStorageSourceWithRetry() {
  const result = await retryLegacyAsyncStorageOperation({
    operation: async () => getLegacyAsyncStorageForMigration(),
    onRetry: ({ delayMs, error, retryCount }) => {
      logMigration(
        `source module retry=${retryCount} delayMs=${delayMs} errorType=${getLegacyOperationErrorType(
          error,
        )}`,
      );
    },
  });
  if (!result.ok) {
    logMigration(
      `source module result=failed attempts=${result.attemptCount} errorType=${getLegacyOperationErrorType(
        result.error,
      )}`,
    );
  }
  return result;
}

async function readLegacyAppStorageKey({
  enumerated,
  index,
  key,
  legacy,
}: {
  enumerated: boolean;
  index: number;
  key: string;
  legacy: ILegacyAsyncStorageNativeModule;
}): Promise<ILegacyAppStorageReadResult | undefined> {
  const keyLabel = getLegacyKeyDiagnosticLabel(key);
  const result = await retryLegacyAsyncStorageOperation({
    operation: async () => {
      const entries = await legacy.multiGet([key]);
      if (entries.length !== 1 || entries[0]?.[0] !== key) {
        throw new OneKeyLocalError(
          'AsyncStorage migration returned an incomplete key read',
        );
      }
      const value = entries[0][1];
      if (value === null && enumerated) {
        throw new OneKeyLocalError(
          'AsyncStorage migration returned no value for an enumerated key',
        );
      }
      if (value !== null && typeof value !== 'string') {
        throw new OneKeyLocalError(
          'AsyncStorage migration returned an invalid key value',
        );
      }
      return value;
    },
    onRetry: ({ delayMs, error, retryCount }) => {
      logMigration(
        `source key retry index=${index} key=${keyLabel} retry=${retryCount} delayMs=${delayMs} errorType=${getLegacyOperationErrorType(
          error,
        )}`,
      );
    },
  });

  if (!result.ok) {
    logMigration(
      `source key result=skipped index=${index} key=${keyLabel} stage=read attempts=${result.attemptCount} errorType=${getLegacyOperationErrorType(
        result.error,
      )}`,
    );
    return undefined;
  }

  const valueBytes =
    result.value === null ? 0 : getUtf8ByteLength(result.value);
  logMigration(
    `source key result=read index=${index} key=${keyLabel} enumerated=${enumerated} present=${result.value !== null} attempts=${result.attemptCount} sourceBytes=${valueBytes}`,
  );
  return {
    attemptCount: result.attemptCount,
    key,
    value: result.value,
  };
}

async function writeAppStorageKeyWithRetry({
  index,
  key,
  mmkv,
  value,
}: {
  index: number;
  key: string;
  mmkv: IMMKVInstance;
  value: string;
}) {
  const keyLabel = getLegacyKeyDiagnosticLabel(key);
  const sourceBytes = getUtf8ByteLength(value);
  const result = await retryLegacyAsyncStorageOperation({
    operation: async () => {
      const targetKey = encodeAppStorageKey(key);
      mmkv.set(targetKey, value);
      const copiedValue = mmkv.getString(targetKey);
      if (copiedValue !== value) {
        throw new OneKeyLocalError(
          'AsyncStorage migration target value verification failed',
        );
      }
      return getUtf8ByteLength(copiedValue);
    },
    onRetry: ({ delayMs, error, retryCount }) => {
      logMigration(
        `target key retry index=${index} key=${keyLabel} retry=${retryCount} delayMs=${delayMs} errorType=${getLegacyOperationErrorType(
          error,
        )}`,
      );
    },
  });

  if (!result.ok) {
    try {
      mmkv.remove(encodeAppStorageKey(key));
    } catch {
      // The exact target set is verified after every key has been attempted.
    }
    logMigration(
      `target key result=skipped index=${index} key=${keyLabel} stage=write attempts=${result.attemptCount} sourceBytes=${sourceBytes} errorType=${getLegacyOperationErrorType(
        result.error,
      )}`,
    );
    return false;
  }

  logMigration(
    `target key result=migrated index=${index} key=${keyLabel} attempts=${result.attemptCount} sourceBytes=${sourceBytes} targetBytes=${result.value}`,
  );
  return true;
}

async function copyLegacyAppStorageKeys({
  enumeration,
  legacy,
  mmkv,
  skipReason,
}: {
  enumeration: ILegacyAppStorageEnumeration;
  legacy: ILegacyAsyncStorageNativeModule | undefined;
  mmkv: IMMKVInstance;
  skipReason: 'capacity' | 'read' | undefined;
}): Promise<ILegacyAppStorageCopyResult> {
  clearAppStorageUserKeys(mmkv);
  mmkv.remove(APP_STORAGE_TRANSACTION_JOURNAL_KEY);
  mmkv.remove(APP_STORAGE_MIGRATION_REPORT_KEY);

  if (skipReason) {
    const failures = enumeration.keys.map((key) => ({
      attemptCount: 0,
      key,
      reason: skipReason,
    }));
    failures.forEach(({ key }, index) => {
      logMigration(
        `target key result=skipped index=${index} key=${getLegacyKeyDiagnosticLabel(
          key,
        )} stage=${skipReason} attempts=0`,
      );
    });
    return {
      failures,
      migratedKeyCount: 0,
      recoveredUnlistedKeyCount: 0,
      totalBytes: 0,
    };
  }
  if (!legacy) {
    throw new OneKeyLocalError(
      'Legacy AsyncStorage migration source is unexpectedly unavailable',
    );
  }

  const failures: ILegacyAppStorageMigrationFailure[] = [];
  const migratedKeys: string[] = [];
  let recoveredUnlistedKeyCount = 0;
  let totalBytes = 0;

  for (
    let offset = 0;
    offset < enumeration.keys.length;
    offset += LEGACY_READ_CHUNK_SIZE
  ) {
    const keys = enumeration.keys.slice(
      offset,
      offset + LEGACY_READ_CHUNK_SIZE,
    );
    const readResults = await Promise.all(
      keys.map((key, chunkIndex) =>
        readLegacyAppStorageKey({
          enumerated: enumeration.enumeratedKeys.has(key),
          index: offset + chunkIndex,
          key,
          legacy,
        }),
      ),
    );
    for (let chunkIndex = 0; chunkIndex < readResults.length; chunkIndex += 1) {
      const index = offset + chunkIndex;
      const readResult = readResults[chunkIndex];
      const key = keys[chunkIndex];
      if (!readResult) {
        failures.push({ attemptCount: 4, key, reason: 'read' });
      } else if (readResult.value !== null) {
        totalBytes += getUtf8ByteLength(readResult.value);
        const migrated = await writeAppStorageKeyWithRetry({
          index,
          key,
          mmkv,
          value: readResult.value,
        });
        if (migrated) {
          migratedKeys.push(key);
          if (!enumeration.enumeratedKeys.has(key)) {
            recoveredUnlistedKeyCount += 1;
          }
        } else {
          failures.push({ attemptCount: 4, key, reason: 'write' });
        }
      }
    }
  }

  const targetKeys = mmkv
    .getAllKeys()
    .filter((key) => key.startsWith(APP_STORAGE_KEY_PREFIX))
    .map(decodeAppStorageKey)
    .toSorted();
  const expectedTargetKeys = migratedKeys.toSorted();
  const exactTargetSet =
    targetKeys.length === expectedTargetKeys.length &&
    targetKeys.every((key, index) => key === expectedTargetKeys[index]);
  if (!exactTargetSet) {
    logMigration(
      `target key-set mismatch expected=${expectedTargetKeys.length} actual=${targetKeys.length}; falling back to empty MMKV app-storage`,
    );
    clearAppStorageUserKeys(mmkv);
    const remainingTargetKeyCount = mmkv
      .getAllKeys()
      .filter((key) => key.startsWith(APP_STORAGE_KEY_PREFIX)).length;
    if (remainingTargetKeyCount > 0) {
      throw new OneKeyLocalError(
        'MMKV app-storage could not establish a safe fallback target',
      );
    }
    const failedKeys = new Set(failures.map(({ key }) => key));
    migratedKeys.forEach((key) => {
      if (!failedKeys.has(key)) {
        failures.push({ attemptCount: 4, key, reason: 'write' });
      }
    });
    return {
      failures,
      migratedKeyCount: 0,
      recoveredUnlistedKeyCount,
      totalBytes,
    };
  }

  return {
    failures,
    migratedKeyCount: migratedKeys.length,
    recoveredUnlistedKeyCount,
    totalBytes,
  };
}

function clearAppStorageUserKeys(mmkv: IMMKVInstance) {
  for (const key of mmkv.getAllKeys()) {
    if (key.startsWith(APP_STORAGE_KEY_PREFIX)) {
      mmkv.remove(key);
    }
  }
}

type IAppStorageTransactionJournal = {
  previousValues: Array<[string, string | null]>;
  version: 1;
};

// Retain recovery metadata even when journal removal succeeds in memory but
// its durability barrier fails. Only bg owns this JS state.
let pendingAppStorageRecovery: string | undefined;

function parseAppStorageTransactionJournal(
  raw: string,
): IAppStorageTransactionJournal {
  const parsed = JSON.parse(raw) as unknown;
  if (!isPlainObject(parsed)) {
    throw new OneKeyLocalError('App-storage batch journal is invalid');
  }
  const journal = parsed as Partial<IAppStorageTransactionJournal>;
  if (journal.version !== 1 || !Array.isArray(journal.previousValues)) {
    throw new OneKeyLocalError('App-storage batch journal is invalid');
  }
  const seenKeys = new Set<string>();
  for (const entry of journal.previousValues) {
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      typeof entry[0] !== 'string' ||
      !entry[0].startsWith(APP_STORAGE_KEY_PREFIX) ||
      (entry[1] !== null && typeof entry[1] !== 'string') ||
      seenKeys.has(entry[0])
    ) {
      throw new OneKeyLocalError('App-storage batch journal is invalid');
    }
    seenKeys.add(entry[0]);
  }
  return journal as IAppStorageTransactionJournal;
}

function restoreAppStoragePreviousValues(
  mmkv: IMMKVInstance,
  previousValues: IAppStorageTransactionJournal['previousValues'],
) {
  previousValues.forEach(([key, value]) => {
    if (value === null) {
      mmkv.remove(key);
    } else {
      mmkv.set(key, value);
    }
  });
}

async function recoverInterruptedAppStorageBatch(mmkv: IMMKVInstance) {
  const raw =
    pendingAppStorageRecovery ??
    mmkv.getString(APP_STORAGE_TRANSACTION_JOURNAL_KEY);
  if (raw === undefined) {
    return;
  }
  pendingAppStorageRecovery = raw;
  let journal: IAppStorageTransactionJournal;
  try {
    journal = parseAppStorageTransactionJournal(raw);
  } catch {
    // Invalid rollback metadata cannot restore a trustworthy prior state. Keep
    // the current business values and remove only the internal recovery key so
    // a malformed journal cannot trap every later startup in the same failure.
    mmkv.remove(APP_STORAGE_TRANSACTION_JOURNAL_KEY);
    await syncNativeStorageMMKV(APP_STORAGE_MMKV_ID);
    pendingAppStorageRecovery = undefined;
    logMigration('discarded invalid app-storage batch journal');
    return;
  }
  restoreAppStoragePreviousValues(mmkv, journal.previousValues);
  await syncNativeStorageMMKV(APP_STORAGE_MMKV_ID);
  mmkv.remove(APP_STORAGE_TRANSACTION_JOURNAL_KEY);
  await syncNativeStorageMMKV(APP_STORAGE_MMKV_ID);
  pendingAppStorageRecovery = undefined;
  logMigration(
    `recovered interrupted app-storage batch keyCount=${journal.previousValues.length}`,
  );
}

async function canCopyLegacyAppStorageWithinCapacity(mmkv: IMMKVInstance) {
  let capacity: Awaited<ReturnType<typeof getNativeStorageMigrationCapacity>>;
  try {
    capacity = await getNativeStorageMigrationCapacity();
  } catch (error) {
    logMigration(
      `capacity check result=unavailable errorType=${getLegacyOperationErrorType(
        error,
      )}; continuing with per-key migration`,
    );
    return true;
  }
  const { availableBytes, legacyBytes } = capacity;
  if (legacyBytes === 0) {
    return true;
  }
  const reusableTargetBytes = Math.max(0, mmkv.size ?? 0);
  const estimatedTargetBytes = Math.ceil(
    legacyBytes * APP_STORAGE_MIGRATION_SIZE_OVERHEAD_RATIO,
  );
  const requiredFreeBytes =
    Math.max(0, estimatedTargetBytes - reusableTargetBytes) +
    APP_STORAGE_MIGRATION_DISK_RESERVE_BYTES;
  logMigration(
    `capacity legacyBytes=${legacyBytes} availableBytes=${availableBytes} requiredFreeBytes=${requiredFreeBytes}`,
  );
  if (availableBytes < requiredFreeBytes) {
    logMigration(
      'capacity result=insufficient; entering empty MMKV app-storage fallback',
    );
    return false;
  }
  return true;
}

async function finishInterruptedAppStorageReset(mmkv: IMMKVInstance) {
  clearAppStorageUserKeys(mmkv);
  mmkv.remove(APP_STORAGE_TRANSACTION_JOURNAL_KEY);
  mmkv.remove(APP_STORAGE_MIGRATION_REPORT_KEY);
  await syncNativeStorageMMKV(APP_STORAGE_MMKV_ID);
  mmkv.trim();

  mmkv.set(APP_STORAGE_MIGRATION_COMPLETE_KEY, '1');
  mmkv.set(
    APP_STORAGE_LEGACY_RETENTION_POLICY_KEY,
    APP_STORAGE_LEGACY_RETENTION_POLICY_RETAINED,
  );
  if (mmkv.getString(APP_STORAGE_MIGRATION_COMPLETE_KEY) !== '1') {
    throw new OneKeyLocalError(
      'App-storage reset migration marker verification failed',
    );
  }
  if (
    mmkv.getString(APP_STORAGE_LEGACY_RETENTION_POLICY_KEY) !==
    APP_STORAGE_LEGACY_RETENTION_POLICY_RETAINED
  ) {
    throw new OneKeyLocalError(
      'App-storage reset legacy retention marker verification failed',
    );
  }
  await syncNativeStorageMMKV(APP_STORAGE_MMKV_ID);
  await setNativeStorageMigrationLedgerComplete(
    APP_STORAGE_MIGRATION_LEDGER_KEY,
  );
}

function persistAppStorageMigrationReport(
  mmkv: IMMKVInstance,
  report: ILegacyAppStorageMigrationReport,
) {
  const serializedReport = JSON.stringify(report);
  try {
    mmkv.set(APP_STORAGE_MIGRATION_REPORT_KEY, serializedReport);
    if (mmkv.getString(APP_STORAGE_MIGRATION_REPORT_KEY) !== serializedReport) {
      throw new OneKeyLocalError(
        'MMKV app-storage migration report verification failed',
      );
    }
  } catch (error) {
    logMigration(
      `migration report result=failed errorType=${getLegacyOperationErrorType(
        error,
      )}`,
    );
  }
}

async function migrateAppStorageFromLegacy() {
  const startedAt = Date.now();
  const mmkv = getAppStorageMMKV();
  const ledger = await getNativeStorageMigrationLedger(
    APP_STORAGE_MIGRATION_LEDGER_KEY,
  );
  if (
    ledger !== null &&
    ledger !== NATIVE_STORAGE_MIGRATION_LEDGER_COMPLETE &&
    ledger !== NATIVE_STORAGE_MIGRATION_LEDGER_MIGRATING &&
    ledger !== NATIVE_STORAGE_MIGRATION_LEDGER_RESETTING
  ) {
    throw new OneKeyLocalError(
      'AsyncStorage migration ledger has an unsupported version',
    );
  }
  if (ledger === NATIVE_STORAGE_MIGRATION_LEDGER_RESETTING) {
    logMigration('resuming interrupted app-storage reset');
    await finishInterruptedAppStorageReset(mmkv);
    return;
  }
  const targetMarkerComplete =
    mmkv.getString(APP_STORAGE_MIGRATION_COMPLETE_KEY) === '1';
  if (targetMarkerComplete) {
    await syncNativeStorageMMKV(APP_STORAGE_MMKV_ID);
    await recoverInterruptedAppStorageBatch(mmkv);
    if (ledger !== NATIVE_STORAGE_MIGRATION_LEDGER_COMPLETE) {
      await setNativeStorageMigrationLedgerComplete(
        APP_STORAGE_MIGRATION_LEDGER_KEY,
      );
      logMigration('backfilled independent app-storage migration ledger');
    }
    let legacyBackupState = 'unknown';
    if (mmkv.getString(APP_STORAGE_LEGACY_CLEANUP_COMPLETE_KEY) === '1') {
      legacyBackupState = 'cleanup-attempted-by-previous-version';
    } else if (
      mmkv.getString(APP_STORAGE_LEGACY_RETENTION_POLICY_KEY) ===
      APP_STORAGE_LEGACY_RETENTION_POLICY_RETAINED
    ) {
      legacyBackupState = 'retained';
    }
    logMigration(
      `migration already complete legacyBackup=${legacyBackupState}`,
    );
    return;
  }
  if (ledger === NATIVE_STORAGE_MIGRATION_LEDGER_COMPLETE) {
    throw new OneKeyLocalError(
      createNativeStorageMigrationInconsistentErrorMessage('appStorage'),
    );
  }

  const canCopy = await canCopyLegacyAppStorageWithinCapacity(mmkv);
  const sourceResult = await getLegacyAppStorageSourceWithRetry();
  const legacy = sourceResult.ok ? sourceResult.value : undefined;
  const enumeration = legacy
    ? await enumerateLegacyAppStorageKeys(legacy)
    : {
        attemptCount: 0,
        duplicateSourceKeyCount: 0,
        enumeratedKeys: new Set<string>(),
        enumerationStatus: 'failed' as const,
        invalidSourceKeyCount: 0,
        keys: [...CRITICAL_LEGACY_APP_STORAGE_KEYS],
        sourceKeyCount: 0,
      };

  if (ledger !== NATIVE_STORAGE_MIGRATION_LEDGER_MIGRATING) {
    await setNativeStorageMigrationLedger(
      APP_STORAGE_MIGRATION_LEDGER_KEY,
      NATIVE_STORAGE_MIGRATION_LEDGER_MIGRATING,
    );
  }

  let skipReason: 'capacity' | 'read' | undefined;
  if (!legacy) {
    skipReason = 'read';
  } else if (!canCopy) {
    skipReason = 'capacity';
  }
  const copyResult = await copyLegacyAppStorageKeys({
    enumeration,
    legacy,
    mmkv,
    skipReason,
  });
  const status =
    enumeration.enumerationStatus === 'failed' ||
    enumeration.invalidSourceKeyCount > 0 ||
    copyResult.recoveredUnlistedKeyCount > 0 ||
    copyResult.failures.length > 0
      ? 'degraded'
      : 'complete';
  const report: ILegacyAppStorageMigrationReport = {
    candidateKeyCount: enumeration.keys.length,
    duplicateSourceKeyCount: enumeration.duplicateSourceKeyCount,
    enumerationAttemptCount: enumeration.attemptCount,
    enumerationStatus: enumeration.enumerationStatus,
    failures: copyResult.failures,
    invalidSourceKeyCount: enumeration.invalidSourceKeyCount,
    migratedKeyCount: copyResult.migratedKeyCount,
    recoveredUnlistedKeyCount: copyResult.recoveredUnlistedKeyCount,
    sourceAccessAttemptCount: sourceResult.attemptCount,
    sourceBytes: copyResult.totalBytes,
    sourceKeyCount: enumeration.sourceKeyCount,
    status,
    version: 1,
  };
  persistAppStorageMigrationReport(mmkv, report);

  mmkv.set(APP_STORAGE_MIGRATION_COMPLETE_KEY, '1');
  mmkv.set(
    APP_STORAGE_LEGACY_RETENTION_POLICY_KEY,
    APP_STORAGE_LEGACY_RETENTION_POLICY_RETAINED,
  );
  if (mmkv.getString(APP_STORAGE_MIGRATION_COMPLETE_KEY) !== '1') {
    throw new OneKeyLocalError(
      'AsyncStorage migration completion marker verification failed',
    );
  }
  if (
    mmkv.getString(APP_STORAGE_LEGACY_RETENTION_POLICY_KEY) !==
    APP_STORAGE_LEGACY_RETENTION_POLICY_RETAINED
  ) {
    throw new OneKeyLocalError(
      'AsyncStorage migration legacy retention marker verification failed',
    );
  }
  await syncNativeStorageMMKV(APP_STORAGE_MMKV_ID);
  await setNativeStorageMigrationLedgerComplete(
    APP_STORAGE_MIGRATION_LEDGER_KEY,
  );
  logMigration(
    `complete status=${status} sourceKeyCount=${enumeration.sourceKeyCount} candidateKeyCount=${enumeration.keys.length} migratedKeyCount=${copyResult.migratedKeyCount} failedKeyCount=${copyResult.failures.length} sourceBytes=${copyResult.totalBytes} legacyBackup=retained durationMs=${Date.now() - startedAt}`,
  );
}

async function processRecoveryAction() {
  const action = await peekNativeStorageRecoveryAction();
  if (!action) {
    return;
  }
  if (action === 'auto_repair') {
    const settings = getSyncStorageMMKV('settings');
    AUTO_REPAIR_SETTINGS_KEYS.forEach((key) => settings.remove(key));
    const remainingKeys = new Set(settings.getAllKeys());
    if (AUTO_REPAIR_SETTINGS_KEYS.some((key) => remainingKeys.has(key))) {
      throw new OneKeyLocalError(
        'Native recovery could not clear all requested MMKV settings',
      );
    }
    await syncNativeStorageMMKV('onekey-app-setting');
  }
  logMigration(`processed native recovery action=${action}`);
  const acknowledged = await acknowledgeNativeStorageRecoveryAction(action);
  if (!acknowledged) {
    throw new OneKeyLocalError(
      'Native recovery action changed before it could be acknowledged',
    );
  }
}

export async function prepareNativeStorageForBackgroundStartup() {
  assertBackgroundRuntime();
  const environment = travelModeManager.getRuntimeEnvironmentSync();
  return environment.persistence.run({
    operation: () => {
      recoveryActionPromise ??= processRecoveryAction().catch(
        (error: unknown) => {
          recoveryActionPromise = undefined;
          throw error;
        },
      );
      return recoveryActionPromise;
    },
    onBlocked: () => undefined,
  });
}

export function ensureNativeAppStorageMigrated() {
  assertBackgroundRuntime();
  const environment = travelModeManager.getRuntimeEnvironmentSync();
  return environment.persistence.run({
    operation: () => {
      appStorageMigrationPromise ??= migrateAppStorageFromLegacy().catch(
        (error: unknown) => {
          appStorageMigrationPromise = undefined;
          logMigration(
            `failed error=${(error as Error)?.message || 'unknown'}`,
          );
          throw error;
        },
      );
      return appStorageMigrationPromise;
    },
    onBlocked: () => undefined,
  });
}

async function resetAppStorageAfterMigrationMismatch() {
  const mmkv = getAppStorageMMKV();
  const ledger = await getNativeStorageMigrationLedger(
    APP_STORAGE_MIGRATION_LEDGER_KEY,
  );
  const markerComplete =
    mmkv.getString(APP_STORAGE_MIGRATION_COMPLETE_KEY) === '1';
  if (ledger !== NATIVE_STORAGE_MIGRATION_LEDGER_COMPLETE || markerComplete) {
    throw new OneKeyLocalError(
      'App-storage migration repair is no longer applicable',
    );
  }

  await setNativeStorageMigrationLedger(
    APP_STORAGE_MIGRATION_LEDGER_KEY,
    NATIVE_STORAGE_MIGRATION_LEDGER_RESETTING,
  );
  await finishInterruptedAppStorageReset(mmkv);
  appStorageMigrationPromise = Promise.resolve();
}

function enqueueAppStorageMigrationReset() {
  const execution = asyncStorageRequestChain.then(
    () => resetAppStorageAfterMigrationMismatch(),
    () => resetAppStorageAfterMigrationMismatch(),
  );
  asyncStorageRequestChain = execution.then(
    () => undefined,
    () => undefined,
  );
  return execution;
}

function defineEnumerableValue(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
) {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });
}

function mergeJsonValues(current: unknown, incoming: unknown): unknown {
  if (!isPlainObject(current) || !isPlainObject(incoming)) {
    return incoming;
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(
    current as Record<string, unknown>,
  )) {
    defineEnumerableValue(result, key, value);
  }
  for (const [key, value] of Object.entries(
    incoming as Record<string, unknown>,
  )) {
    defineEnumerableValue(result, key, mergeJsonValues(result[key], value));
  }
  return result;
}

function mergeAppStorageValue(current: string | undefined, incoming: string) {
  if (typeof incoming !== 'string') {
    throw new OneKeyLocalError('AsyncStorage value must be a string');
  }
  const incomingValue = JSON.parse(incoming) as unknown;
  if (current === undefined) {
    return incoming;
  }
  const currentValue = JSON.parse(current) as unknown;
  const merged = JSON.stringify(mergeJsonValues(currentValue, incomingValue));
  if (typeof merged !== 'string') {
    throw new OneKeyLocalError('AsyncStorage merged value is not serializable');
  }
  return merged;
}

async function applyAppStorageChanges(
  mmkv: IMMKVInstance,
  changes: Array<{ key: string; value?: string }>,
) {
  if (changes.length === 0) {
    return;
  }
  const previousValues = new Map<string, string | null>();
  changes.forEach(({ key }) => {
    if (!previousValues.has(key)) {
      previousValues.set(key, mmkv.getString(key) ?? null);
    }
  });
  const journal: IAppStorageTransactionJournal = {
    previousValues: [...previousValues],
    version: 1,
  };
  const serializedJournal = JSON.stringify(journal);
  const trimRemovedJournal = () => {
    if (serializedJournal.length >= APP_STORAGE_JOURNAL_TRIM_THRESHOLD_CHARS) {
      try {
        mmkv.trim();
      } catch {
        logMigration('app-storage batch journal trim failed');
      }
    }
  };
  try {
    // Journal creation is part of the same recovery boundary as the batch.
    mmkv.set(APP_STORAGE_TRANSACTION_JOURNAL_KEY, serializedJournal);
    await syncNativeStorageMMKV(APP_STORAGE_MMKV_ID);
    changes.forEach(({ key, value }) => {
      if (value === undefined) {
        mmkv.remove(key);
      } else {
        mmkv.set(key, value);
      }
    });
    await syncNativeStorageMMKV(APP_STORAGE_MMKV_ID);
    mmkv.remove(APP_STORAGE_TRANSACTION_JOURNAL_KEY);
    await syncNativeStorageMMKV(APP_STORAGE_MMKV_ID);
    trimRemovedJournal();
  } catch (error) {
    // Keep the journal until rollback is durably complete. If rollback itself
    // fails, the next queued request retries before allowing business access.
    pendingAppStorageRecovery = serializedJournal;
    try {
      await recoverInterruptedAppStorageBatch(mmkv);
      trimRemovedJournal();
    } catch {
      logMigration('app-storage batch rollback deferred to next request');
    }
    throw error;
  }
}

async function clearLegacyAppStorageData() {
  const legacy = getLegacyAsyncStorageForMigration();
  const legacyKeys = await legacy.getAllKeys();
  for (
    let offset = 0;
    offset < legacyKeys.length;
    offset += LEGACY_READ_CHUNK_SIZE
  ) {
    await legacy.multiRemove(
      legacyKeys.slice(offset, offset + LEGACY_READ_CHUNK_SIZE),
    );
  }
  const remainingLegacyKeys = await legacy.getAllKeys();
  if (remainingLegacyKeys.length > 0) {
    throw new OneKeyLocalError('Legacy AppStorage cleanup verification failed');
  }
}

async function clearAppStorageAndLegacyData(mmkv: IMMKVInstance) {
  clearAppStorageUserKeys(mmkv);
  mmkv.remove(APP_STORAGE_MIGRATION_REPORT_KEY);
  await syncNativeStorageMMKV(APP_STORAGE_MMKV_ID);

  // clear() is used by the explicit app-reset flow. Remove the legacy copy as
  // well so clearing MMKV cannot be followed by stale-data resurrection.
  await clearLegacyAppStorageData();
  mmkv.set(APP_STORAGE_LEGACY_CLEANUP_COMPLETE_KEY, '1');
  mmkv.set(
    APP_STORAGE_LEGACY_RETENTION_POLICY_KEY,
    APP_STORAGE_LEGACY_RETENTION_POLICY_CLEARED,
  );
  await syncNativeStorageMMKV(APP_STORAGE_MMKV_ID);
}

async function executeAsyncStorageRequest(request: INativeAsyncStorageRequest) {
  await ensureNativeAppStorageMigrated();
  const mmkv = getAppStorageMMKV();
  await recoverInterruptedAppStorageBatch(mmkv);

  switch (request.operation) {
    case 'getItem':
      return mmkv.getString(encodeAppStorageKey(request.key)) ?? null;
    case 'setItem': {
      if (typeof request.value !== 'string') {
        throw new OneKeyLocalError('AsyncStorage value must be a string');
      }
      mmkv.set(encodeAppStorageKey(request.key), request.value);
      await syncNativeStorageMMKV(APP_STORAGE_MMKV_ID);
      return undefined;
    }
    case 'removeItem':
      mmkv.remove(encodeAppStorageKey(request.key));
      await syncNativeStorageMMKV(APP_STORAGE_MMKV_ID);
      return undefined;
    case 'mergeItem': {
      const key = encodeAppStorageKey(request.key);
      mmkv.set(key, mergeAppStorageValue(mmkv.getString(key), request.value));
      await syncNativeStorageMMKV(APP_STORAGE_MMKV_ID);
      return undefined;
    }
    case 'clear':
      await clearAppStorageAndLegacyData(mmkv);
      return undefined;
    case 'getAllKeys':
      return mmkv
        .getAllKeys()
        .filter((key) => key.startsWith(APP_STORAGE_KEY_PREFIX))
        .map(decodeAppStorageKey);
    case 'multiGet':
      return request.keys.map(
        (key) =>
          [key, mmkv.getString(encodeAppStorageKey(key)) ?? null] as const,
      );
    case 'multiSet':
      await applyAppStorageChanges(
        mmkv,
        request.entries.map(([key, value]) => {
          const targetKey = encodeAppStorageKey(key);
          if (typeof value !== 'string') {
            throw new OneKeyLocalError('AsyncStorage value must be a string');
          }
          return { key: targetKey, value };
        }),
      );
      return undefined;
    case 'multiRemove':
      await applyAppStorageChanges(
        mmkv,
        request.keys.map((key) => ({ key: encodeAppStorageKey(key) })),
      );
      return undefined;
    case 'multiMerge': {
      const pendingValues = new Map<string, string | undefined>();
      const changes = request.entries.map(([entryKey, value]) => {
        const key = encodeAppStorageKey(entryKey);
        const current = pendingValues.has(key)
          ? pendingValues.get(key)
          : mmkv.getString(key);
        const merged = mergeAppStorageValue(current, value);
        pendingValues.set(key, merged);
        return { key, value: merged };
      });
      await applyAppStorageChanges(mmkv, changes);
      return undefined;
    }
    default: {
      const exhaustive: never = request;
      throw new OneKeyLocalError(
        `Unknown native AsyncStorage request: ${String(exhaustive)}`,
      );
    }
  }
}

function enqueueAsyncStorageRequest(request: INativeAsyncStorageRequest) {
  const execution = asyncStorageRequestChain.then(
    () => executeAsyncStorageRequest(request),
    () => executeAsyncStorageRequest(request),
  );
  asyncStorageRequestChain = execution.then(
    () => undefined,
    () => undefined,
  );
  return execution;
}

async function syncDurableSyncStorageMutation(store: INativeSyncStorageName) {
  if (store === 'settings') {
    await syncNativeStorageMMKV('onekey-app-setting');
  } else if (store === 'devSettings') {
    await syncNativeStorageMMKV('onekey-app-dev-setting');
  }
}

async function executeSyncStorageRequest(request: INativeSyncStorageRequest) {
  const sourceMutationId =
    typeof request.sourceRuntimeId === 'string' &&
    request.sourceRuntimeId.length > 0 &&
    request.sourceRuntimeId.length <= 128 &&
    Number.isSafeInteger(request.sourceMutationId) &&
    (request.sourceMutationId as number) > 0
      ? (request.sourceMutationId as number)
      : undefined;
  const sourceQueueId =
    sourceMutationId === undefined
      ? undefined
      : `${request.sourceRuntimeId as string}:${request.store}`;
  pruneCompletedSyncStorageResults();
  const completedResult = sourceQueueId
    ? completedSyncStorageResults.get(sourceQueueId)
    : undefined;
  if (completedResult && completedResult.mutationId === sourceMutationId) {
    return completedResult.result;
  }

  const mmkv = getSyncStorageMMKV(request.store);
  const publishMutation = (mutation: INativeSyncStorageMutation) => {
    // Main-origin mutations return their canonical value in the RPC response.
    // Bg-owned mutations use the broadcast path to update the UI mirror.
    if (request.sourceMutationId === undefined) {
      broadcastNativeSyncStorageMutation(mutation);
    }
    if (
      sourceQueueId &&
      sourceMutationId !== undefined &&
      (completedResult === undefined ||
        sourceMutationId >= completedResult.mutationId)
    ) {
      let valueChars = 0;
      if (mutation.operation === 'set' && typeof mutation.value === 'string') {
        valueChars = mutation.value.length;
      }
      completedSyncStorageResults.delete(sourceQueueId);
      completedSyncStorageResults.set(sourceQueueId, {
        completedAt: Date.now(),
        mutationId: sourceMutationId,
        result: mutation,
        valueChars,
      });
      pruneCompletedSyncStorageResults();
    }
    return mutation;
  };
  switch (request.operation) {
    case 'set': {
      const { value } = request;
      mmkv.set(request.key, value);
      await syncDurableSyncStorageMutation(request.store);
      return publishMutation({
        store: request.store,
        operation: 'set',
        key: request.key,
        value,
        ...(request.sourceMutationId === undefined
          ? {}
          : { sourceMutationId: request.sourceMutationId }),
      });
    }
    case 'remove':
      mmkv.remove(request.key);
      await syncDurableSyncStorageMutation(request.store);
      return publishMutation({
        store: request.store,
        operation: 'remove',
        key: request.key,
        ...(request.sourceMutationId === undefined
          ? {}
          : { sourceMutationId: request.sourceMutationId }),
      });
    case 'clear':
      mmkv.clearAll();
      await syncDurableSyncStorageMutation(request.store);
      return publishMutation({
        store: request.store,
        operation: 'clear',
        ...(request.sourceMutationId === undefined
          ? {}
          : { sourceMutationId: request.sourceMutationId }),
      });
    default: {
      const exhaustive: never = request;
      throw new OneKeyLocalError(
        `Unknown native sync storage request: ${String(exhaustive)}`,
      );
    }
  }
}

function readSyncStorageEntries(mmkv: IMMKVInstance) {
  const entries: INativeSyncStorageEntry[] = [];
  for (const key of mmkv.getAllKeys()) {
    const stringValue = mmkv.getString(key);
    let value: INativeStorageScalar | undefined = stringValue;
    if (stringValue === undefined) {
      const numberValue = mmkv.getNumber(key);
      value = numberValue === undefined ? mmkv.getBoolean(key) : numberValue;
    }
    if (value !== undefined) {
      entries.push([key, value]);
    }
  }
  return entries;
}

async function buildBootstrapSnapshot(
  stores: INativeSyncStorageName[] = NATIVE_STORAGE_BOOTSTRAP_DEFAULT_STORES,
): Promise<INativeStorageBootstrapSnapshot> {
  const startedAt = Date.now();
  await prepareNativeStorageForBackgroundStartup();
  const syncStoresReadyAt = Date.now();
  await ensureNativeAppStorageMigrated();
  const appStorageReadyAt = Date.now();
  const readStore = (store: INativeSyncStorageName) =>
    stores.includes(store)
      ? readSyncStorageEntries(getSyncStorageMMKV(store))
      : [];
  const snapshot = {
    settings: readStore('settings'),
    devSettings: readStore('devSettings'),
  };
  logBootstrapSnapshotTiming({
    startedAt,
    syncStoresReadyAt,
    appStorageReadyAt,
  });
  return snapshot;
}

/** Where bg's half of the cold-start gate goes. Migration is one-time; the
 *  reads are paid on every launch. */
function logBootstrapSnapshotTiming({
  startedAt,
  syncStoresReadyAt,
  appStorageReadyAt,
}: {
  startedAt: number;
  syncStoresReadyAt: number;
  appStorageReadyAt: number;
}) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NativeLogger, LogLevel } =
      require('../modules3rdParty/react-native-file-logger') as typeof import('../modules3rdParty/react-native-file-logger');
    NativeLogger.write(
      LogLevel.Info,
      [
        '[StartupTiming] bg bootstrap snapshot built:',
        `sync stores ${syncStoresReadyAt - startedAt}ms,`,
        `app storage ${appStorageReadyAt - syncStoresReadyAt}ms,`,
        `read ${Date.now() - appStorageReadyAt}ms,`,
        `total ${Date.now() - startedAt}ms`,
      ].join(' '),
    );
  } catch {
    // Logging is best-effort during bootstrap.
  }
}

async function executeMaskedNativeStorageRequest(
  request: INativeStorageRequest,
): Promise<unknown> {
  if (request.scope === 'bootstrap') {
    const controlValue = await travelModeManager.getBootstrapControlValue();
    const settings: INativeSyncStorageEntry[] = controlValue
      ? [[EAppSyncStorageKeys.onekey_travel_mode_control_v1, controlValue]]
      : [];
    return {
      settings,
      devSettings: [],
    };
  }
  if (request.scope === 'recovery') {
    return undefined;
  }
  if (request.scope === 'asyncStorage') {
    switch (request.operation) {
      case 'getItem':
        return null;
      case 'getAllKeys':
        return [];
      case 'multiGet':
        return request.keys.map((key) => [key, null]);
      default:
        return undefined;
    }
  }
  if (request.operation === 'clear') {
    return {
      operation: 'clear',
      store: request.store,
      sourceMutationId: request.sourceMutationId,
    };
  }
  return {
    key: request.key,
    operation: 'remove',
    store: request.store,
    sourceMutationId: request.sourceMutationId,
  };
}

async function executeRealNativeStorageRequest(
  request: INativeStorageRequest,
): Promise<unknown> {
  switch (request.scope) {
    case 'asyncStorage': {
      const result = await enqueueAsyncStorageRequest(request);
      return result;
    }
    case 'syncStorage': {
      const result = await executeSyncStorageRequest(request);
      return result;
    }
    case 'recovery':
      if (
        request.operation === 'resetMigrationTarget' &&
        request.target === 'appStorage'
      ) {
        const result = await enqueueAppStorageMigrationReset();
        return result;
      }
      throw new OneKeyLocalError(
        'Jotai migration recovery must be handled by its storage owner',
      );
    case 'bootstrap': {
      const result = await buildBootstrapSnapshot(request.stores);
      return result;
    }
    default: {
      const exhaustive: never = request;
      throw new OneKeyLocalError(
        `Unknown native storage request: ${String(exhaustive)}`,
      );
    }
  }
}

export async function executeNativeStorageRequest(
  request: INativeStorageRequest,
): Promise<unknown> {
  assertBackgroundRuntime();
  const environment = await travelModeManager.getRuntimeEnvironment();
  return environment.persistence.run({
    operation: () => executeRealNativeStorageRequest(request),
    onBlocked: () => executeMaskedNativeStorageRequest(request),
  });
}
