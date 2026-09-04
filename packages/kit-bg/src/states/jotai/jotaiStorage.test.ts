/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, onekey/no-raw-error */

import { createMMKV } from 'react-native-mmkv';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const mmkvInstance = createMMKV({ id: 'onekey-jotai-states-test' });
const appStorageMMKVInstance = createMMKV({
  id: 'onekey-app-storage-snapshot-test',
});
const legacyData = new Map<string, string>();
const migrationLedger = new Map<string, string>();
const mockSetMigrationLedger = jest.fn(async (key: string, value: string) => {
  migrationLedger.set(key, value);
});
const mockSetMigrationLedgerComplete = jest.fn(async (key: string) => {
  migrationLedger.set(key, 'complete-v1');
});
const mockSyncNativeStorageMMKV = jest.fn(async () => undefined);
const mockLegacyRetryWait = jest.fn(async (_delayMs: number) => undefined);
const mockNativeLoggerWrite = jest.fn();
const legacyStorage = {
  multiGet: jest.fn(async (keys: string[]) =>
    keys.map(
      (key) => [key, legacyData.get(key) ?? null] as [string, string | null],
    ),
  ),
  getAllKeys: jest.fn(async () => [...legacyData.keys()]),
  multiRemove: jest.fn(async (keys: string[]) => {
    keys.forEach((key) => legacyData.delete(key));
  }),
};

jest.mock(
  '@onekeyhq/shared/src/storage/instance/jotaiMMKVStorageInstance',
  () => ({ __esModule: true, default: mmkvInstance }),
);
jest.mock(
  '@onekeyhq/shared/src/storage/instance/appStorageMMKVInstance',
  () => ({ __esModule: true, default: appStorageMMKVInstance }),
);
jest.mock('@onekeyhq/shared/src/storage/legacyAsyncStorageMigration', () => ({
  getLegacyAsyncStorageForMigration: () => legacyStorage,
}));
jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: { wait: mockLegacyRetryWait },
}));
jest.mock('@onekeyhq/shared/src/storage/nativeStorageMigrationModule', () => ({
  NATIVE_STORAGE_MIGRATION_LEDGER_COMPLETE: 'complete-v1',
  NATIVE_STORAGE_MIGRATION_LEDGER_MIGRATING: 'migrating-v1',
  NATIVE_STORAGE_MIGRATION_LEDGER_RESETTING: 'resetting-v1',
  getNativeStorageMigrationLedger: jest.fn(
    async (key: string) => migrationLedger.get(key) ?? null,
  ),
  setNativeStorageMigrationLedger: mockSetMigrationLedger,
  setNativeStorageMigrationLedgerComplete: mockSetMigrationLedgerComplete,
  syncNativeStorageMMKV: mockSyncNativeStorageMMKV,
}));
jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger',
  () => ({
    NativeLogger: { write: mockNativeLoggerWrite },
    LogLevel: { Info: 0, Error: 3 },
  }),
);
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: true,
    isNativeBackgroundThread: true,
    isNativeMainThread: false,
    isExtensionUi: false,
  },
}));
jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  storageHub: {
    $webStorageGlobalStates: undefined,
    appStorage: {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    },
    _mockStorage: {},
  },
}));
jest.mock('@onekeyhq/shared/src/storage/appStorageUtils', () => ({
  __esModule: true,
  default: { canSaveAsObject: () => false },
}));

const MIGRATION_KEY = '__mmkv_migration_v1__';
const LEGACY_CLEANUP_KEY = '__mmkv_legacy_cleanup_v1__';
const LEGACY_RETENTION_KEY = '__mmkv_legacy_retention_v1__';
const MIGRATION_REPORT_KEY = '__mmkv_migration_report_v1__';
const PROBE_KEY = 'g_states_v5:settingsPersistAtom';

function createStorage() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('./jotaiStorage') as typeof import('./jotaiStorage');
  return mod.onekeyJotaiStorage as any;
}

function markJotaiStorageMigrated() {
  mmkvInstance.set(MIGRATION_KEY, '1');
  mmkvInstance.set(LEGACY_RETENTION_KEY, 'retained-v1');
  migrationLedger.set('jotai-storage-v1', 'complete-v1');
}

describe('JotaiStorageNativeMMKV migration barrier', () => {
  beforeEach(() => {
    legacyData.clear();
    migrationLedger.clear();
    mmkvInstance.clearAll();
    appStorageMMKVInstance.clearAll();
    legacyStorage.multiGet.mockImplementation(async (keys: string[]) =>
      keys.map(
        (key) => [key, legacyData.get(key) ?? null] as [string, string | null],
      ),
    );
    legacyStorage.getAllKeys.mockImplementation(async () => [
      ...legacyData.keys(),
    ]);
    legacyStorage.multiRemove.mockImplementation(async (keys: string[]) => {
      keys.forEach((key) => legacyData.delete(key));
    });
    mockSetMigrationLedger.mockImplementation(
      async (key: string, value: string) => {
        migrationLedger.set(key, value);
      },
    );
    mockSetMigrationLedgerComplete.mockImplementation(async (key: string) => {
      migrationLedger.set(key, 'complete-v1');
    });
    jest.clearAllMocks();
  });

  it('fails closed before migration without touching legacy storage', async () => {
    const storage = createStorage();

    await expect(storage.getItem('g_states_v5:aAtom', null)).rejects.toThrow(
      'before legacy migration completes',
    );
    await expect(storage.setItem('g_states_v5:aAtom', 1)).rejects.toThrow(
      'before legacy migration completes',
    );
    expect(legacyStorage.multiGet).not.toHaveBeenCalled();
  });

  it('copies every value, verifies it, and retains the legacy source', async () => {
    legacyData.set('g_states_v5:aAtom', JSON.stringify({ a: 1 }));
    legacyData.set('g_states_v5:bAtom', JSON.stringify({ b: 2 }));
    legacyData.set(
      'g_states_v5:removedHistoricalAtom',
      '"sensitive-jotai-value"',
    );
    const storage = createStorage();

    await storage.migrateFromAsyncStorage(
      ['g_states_v5:aAtom', 'g_states_v5:bAtom', 'g_states_v5:cAtom'],
      PROBE_KEY,
    );

    expect(storage.isMigrationComplete()).toBe(true);
    expect(mmkvInstance.getString(MIGRATION_KEY)).toBe('1');
    expect(mmkvInstance.getString(LEGACY_CLEANUP_KEY)).toBeUndefined();
    expect(mmkvInstance.getString(LEGACY_RETENTION_KEY)).toBe('retained-v1');
    expect(migrationLedger.get('jotai-storage-v1')).toBe('complete-v1');
    expect(legacyData.get('g_states_v5:aAtom')).toBe(JSON.stringify({ a: 1 }));
    expect(legacyData.get('g_states_v5:bAtom')).toBe(JSON.stringify({ b: 2 }));
    expect(legacyStorage.multiRemove).not.toHaveBeenCalled();
    expect(await storage.getItem('g_states_v5:aAtom', null)).toEqual({ a: 1 });
    expect(
      await storage.getItem('g_states_v5:removedHistoricalAtom', null),
    ).toBe('sensitive-jotai-value');
    expect(mmkvInstance.getString('g_states_v5:cAtom')).toBeUndefined();
    const serializedLogs = JSON.stringify(mockNativeLoggerWrite.mock.calls);
    expect(serializedLogs).toContain(
      'target key result=migrated index=0 key=g_states_v5:aAtom',
    );
    expect(serializedLogs).toContain('key=g_states_v5:removedHistoricalAtom');
    expect(serializedLogs).not.toContain('sensitive-jotai-value');
  });

  it('retries enumeration and falls back to known keys when it stays unavailable', async () => {
    legacyData.set('g_states_v5:aAtom', '"fresh"');
    legacyData.set('g_states_v5:unknownHistoricalAtom', '"not-discovered"');
    legacyStorage.getAllKeys.mockRejectedValue(
      new OneKeyLocalError('legacy manifest unavailable'),
    );
    const storage = createStorage();

    await storage.migrateFromAsyncStorage(['g_states_v5:aAtom'], PROBE_KEY);

    expect(await storage.getItem('g_states_v5:aAtom', null)).toBe('fresh');
    expect(
      mmkvInstance.getString('g_states_v5:unknownHistoricalAtom'),
    ).toBeUndefined();
    expect(
      JSON.parse(mmkvInstance.getString(MIGRATION_REPORT_KEY) || '{}'),
    ).toMatchObject({
      enumerationAttemptCount: 4,
      enumerationStatus: 'failed',
      failures: [],
      status: 'degraded',
    });
    expect(mockLegacyRetryWait.mock.calls).toEqual([[50], [500], [1000]]);
  });

  it('retries a transient source failure and completes migration', async () => {
    legacyData.set('g_states_v5:aAtom', '"fresh"');
    mmkvInstance.set('g_states_v5:aAtom', '"partial"');
    legacyStorage.multiGet.mockRejectedValueOnce(
      new OneKeyLocalError('legacy disk unavailable'),
    );
    const storage = createStorage();

    await storage.migrateFromAsyncStorage(['g_states_v5:aAtom'], PROBE_KEY);
    expect(await storage.getItem('g_states_v5:aAtom', null)).toBe('fresh');
    expect(mmkvInstance.getString(MIGRATION_KEY)).toBe('1');
    expect(mockLegacyRetryWait.mock.calls).toEqual([[50]]);
  });

  it('removes orphaned target values before rebuilding the Jotai store', async () => {
    legacyData.set('g_states_v5:aAtom', '"fresh"');
    mmkvInstance.set('g_states_v5:orphanedAtom', '"stale"');
    const storage = createStorage();

    await storage.migrateFromAsyncStorage(['g_states_v5:aAtom'], PROBE_KEY);

    expect(await storage.getItem('g_states_v5:aAtom', null)).toBe('fresh');
    expect(await storage.getItem('g_states_v5:orphanedAtom', 'fallback')).toBe(
      'fallback',
    );
    expect(mmkvInstance.getString('g_states_v5:orphanedAtom')).toBeUndefined();
    expect(JSON.stringify(mockNativeLoggerWrite.mock.calls)).toContain(
      'target cleanup result=cleared staleKeyCount=1',
    );
  });

  it('uses the AppStorage MMKV snapshot when legacy Jotai reads fail', async () => {
    const key = 'g_states_v5:historicalAtom';
    appStorageMMKVInstance.set(`app:${key}`, '"from-app-storage"');
    legacyStorage.getAllKeys.mockRejectedValue(
      new OneKeyLocalError('legacy manifest unavailable'),
    );
    legacyStorage.multiGet.mockRejectedValue(
      new OneKeyLocalError('legacy value unavailable'),
    );
    const storage = createStorage();

    await storage.migrateFromAsyncStorage([], PROBE_KEY);

    expect(await storage.getItem(key, null)).toBe('from-app-storage');
    expect(legacyStorage.multiGet).not.toHaveBeenCalledWith([key]);
    expect(
      JSON.parse(mmkvInstance.getString(MIGRATION_REPORT_KEY) || '{}'),
    ).toMatchObject({
      snapshotKeyCount: 1,
      status: 'degraded',
    });
    expect(JSON.stringify(mockNativeLoggerWrite.mock.calls)).toContain(
      'source=app-storage-mmkv',
    );
  });

  it('bounds legacy Jotai value retention by reading migration keys in chunks', async () => {
    for (let index = 0; index < 101; index += 1) {
      legacyData.set(
        `g_states_v5:atom${String(index).padStart(3, '0')}`,
        `${index}`,
      );
    }
    let releaseLastKeyInFirstChunk: (() => void) | undefined;
    let markLastKeyInFirstChunkStarted: (() => void) | undefined;
    const lastKeyInFirstChunkStarted = new Promise<void>((resolve) => {
      markLastKeyInFirstChunkStarted = resolve;
    });
    legacyStorage.multiGet.mockImplementation(async (keys: string[]) => {
      if (keys[0] === 'g_states_v5:atom099') {
        markLastKeyInFirstChunkStarted?.();
        await new Promise<void>((resolve) => {
          releaseLastKeyInFirstChunk = resolve;
        });
      }
      return keys.map(
        (key) => [key, legacyData.get(key) ?? null] as [string, string | null],
      );
    });
    const storage = createStorage();

    const migration = storage.migrateFromAsyncStorage([], PROBE_KEY);
    await lastKeyInFirstChunkStarted;

    expect(legacyStorage.multiGet).toHaveBeenCalledTimes(100);
    releaseLastKeyInFirstChunk?.();
    await migration;
    expect(legacyStorage.multiGet).toHaveBeenCalledTimes(101);
    expect(await storage.getItem('g_states_v5:atom100', null)).toBe(100);
  });

  it('skips a permanently unreadable key and publishes a degraded report', async () => {
    legacyData.set('g_states_v5:aAtom', '"fresh"');
    mmkvInstance.set('g_states_v5:aAtom', '"partial"');
    legacyStorage.multiGet.mockImplementation(async (keys: string[]) =>
      keys.map((key) => [key, null] as [string, string | null]),
    );
    const storage = createStorage();

    await storage.migrateFromAsyncStorage(['g_states_v5:aAtom'], PROBE_KEY);
    expect(mockSetMigrationLedger).toHaveBeenCalledWith(
      'jotai-storage-v1',
      'migrating-v1',
    );
    expect(migrationLedger.get('jotai-storage-v1')).toBe('complete-v1');
    expect(mmkvInstance.getString('g_states_v5:aAtom')).toBeUndefined();
    expect(mmkvInstance.getString(MIGRATION_KEY)).toBe('1');
    expect(
      JSON.parse(mmkvInstance.getString(MIGRATION_REPORT_KEY) || '{}'),
    ).toMatchObject({
      failures: [{ attemptCount: 4, key: 'g_states_v5:aAtom', reason: 'read' }],
      status: 'degraded',
    });
    expect(mockLegacyRetryWait.mock.calls).toEqual([[50], [500], [1000]]);
  });

  it('publishes the OTA gate before MMKV mutation and recovers after marker write', async () => {
    legacyData.set('g_states_v5:aAtom', '"fresh"');
    mmkvInstance.set('g_states_v5:aAtom', '"partial"');
    const removeSpy = jest.spyOn(mmkvInstance, 'remove');
    mockSetMigrationLedgerComplete.mockRejectedValueOnce(
      new OneKeyLocalError('process killed before ledger completion'),
    );
    const storage = createStorage();

    await expect(
      storage.migrateFromAsyncStorage(['g_states_v5:aAtom'], PROBE_KEY),
    ).rejects.toThrow('process killed before ledger completion');
    const migrationGateOrder =
      mockSetMigrationLedger.mock.invocationCallOrder[0];
    const firstMMKVMutationOrder = removeSpy.mock.invocationCallOrder[0];
    removeSpy.mockRestore();

    expect(mockSetMigrationLedger).toHaveBeenCalledWith(
      'jotai-storage-v1',
      'migrating-v1',
    );
    expect(migrationGateOrder).toBeLessThan(firstMMKVMutationOrder);
    expect(migrationLedger.get('jotai-storage-v1')).toBe('migrating-v1');
    expect(mmkvInstance.getString(MIGRATION_KEY)).toBe('1');
    expect(mmkvInstance.getString('g_states_v5:aAtom')).toBe('"fresh"');

    legacyStorage.multiGet.mockClear();
    const recoveredStorage = createStorage();
    await recoveredStorage.migrateFromAsyncStorage(
      ['g_states_v5:aAtom'],
      PROBE_KEY,
    );
    expect(legacyStorage.multiGet).not.toHaveBeenCalled();
    expect(migrationLedger.get('jotai-storage-v1')).toBe('complete-v1');
    expect(await recoveredStorage.getItem('g_states_v5:aAtom', null)).toBe(
      'fresh',
    );
  });

  it('does not reopen legacy storage after migration completes', async () => {
    markJotaiStorageMigrated();
    mmkvInstance.set('g_states_v5:aAtom', '42');
    const storage = createStorage();

    await storage.migrateFromAsyncStorage(['g_states_v5:aAtom'], PROBE_KEY);
    expect(await storage.getItem('g_states_v5:aAtom', 0)).toBe(42);
    expect(legacyStorage.multiGet).not.toHaveBeenCalled();
    expect(legacyStorage.getAllKeys).not.toHaveBeenCalled();
    expect(legacyStorage.multiRemove).not.toHaveBeenCalled();
    expect(migrationLedger.get('jotai-storage-v1')).toBe('complete-v1');
  });

  it('preserves legacy data retained by an already migrated build', async () => {
    mmkvInstance.set(MIGRATION_KEY, '1');
    mmkvInstance.set('g_states_v5:aAtom', '42');
    migrationLedger.set('jotai-storage-v1', 'complete-v1');
    legacyData.set('g_states_v5:aAtom', '"retained"');
    legacyData.set('third-party-key', 'keep');
    const storage = createStorage();

    await storage.migrateFromAsyncStorage(['g_states_v5:aAtom'], PROBE_KEY);

    expect(await storage.getItem('g_states_v5:aAtom', 0)).toBe(42);
    expect(legacyData.get('g_states_v5:aAtom')).toBe('"retained"');
    expect(legacyData.get('third-party-key')).toBe('keep');
    expect(mmkvInstance.getString(LEGACY_CLEANUP_KEY)).toBeUndefined();
    expect(legacyStorage.multiGet).not.toHaveBeenCalled();
    expect(legacyStorage.getAllKeys).not.toHaveBeenCalled();
    expect(legacyStorage.multiRemove).not.toHaveBeenCalled();
  });

  it('fails closed when the independent ledger outlives the MMKV marker', async () => {
    migrationLedger.set('jotai-storage-v1', 'complete-v1');
    legacyData.set('g_states_v5:aAtom', '"stale"');
    const storage = createStorage();

    await expect(
      storage.migrateFromAsyncStorage(['g_states_v5:aAtom'], PROBE_KEY),
    ).rejects.toThrow('MMKV migration marker is missing');
    expect(legacyStorage.multiGet).not.toHaveBeenCalled();
  });

  it('resets an inconsistent Jotai target without restoring stale legacy data', async () => {
    migrationLedger.set('jotai-storage-v1', 'complete-v1');
    mmkvInstance.set('g_states_v5:aAtom', '"partial"');
    legacyData.set('g_states_v5:aAtom', '"stale"');
    const storage = createStorage();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('./jotaiStorage') as typeof import('./jotaiStorage');

    await expect(
      storage.migrateFromAsyncStorage(['g_states_v5:aAtom'], PROBE_KEY),
    ).rejects.toThrow('MMKV migration marker is missing');
    await mod.resetNativeJotaiStorageAfterMigrationMismatch();

    expect(mockSetMigrationLedger).toHaveBeenCalledWith(
      'jotai-storage-v1',
      'resetting-v1',
    );
    expect(legacyData.has('g_states_v5:aAtom')).toBe(false);
    expect(mmkvInstance.getString('g_states_v5:aAtom')).toBeUndefined();
    expect(mmkvInstance.getString(MIGRATION_KEY)).toBe('1');
    expect(migrationLedger.get('jotai-storage-v1')).toBe('complete-v1');
  });

  it('reset removes legacy Jotai keys and leaves an empty migrated store', async () => {
    mmkvInstance.set(MIGRATION_KEY, '1');
    mmkvInstance.set('g_states_v5:aAtom', '1');
    legacyData.set('g_states_v5:aAtom', '1');
    legacyData.set('third-party-key', 'keep');
    const storage = createStorage();

    await storage.clearAllForReset();

    expect(legacyData.has('g_states_v5:aAtom')).toBe(false);
    expect(legacyData.get('third-party-key')).toBe('keep');
    expect(mmkvInstance.getString('g_states_v5:aAtom')).toBeUndefined();
    expect(mmkvInstance.getString(MIGRATION_KEY)).toBe('1');
    expect(mockSetMigrationLedger).toHaveBeenCalledWith(
      'jotai-storage-v1',
      'resetting-v1',
    );
    expect(migrationLedger.get('jotai-storage-v1')).toBe('complete-v1');
  });

  it('resumes reset after legacy deletion but before MMKV clear', async () => {
    mmkvInstance.set(MIGRATION_KEY, '1');
    mmkvInstance.set('g_states_v5:aAtom', '"stale-mmkv"');
    legacyData.set('g_states_v5:aAtom', '"legacy"');
    const storage = createStorage();
    const clearSpy = jest
      .spyOn(mmkvInstance, 'clearAll')
      .mockImplementationOnce(() => {
        throw new OneKeyLocalError('process killed before MMKV clear');
      });

    await expect(storage.clearAllForReset()).rejects.toThrow(
      'process killed before MMKV clear',
    );
    expect(migrationLedger.get('jotai-storage-v1')).toBe('resetting-v1');
    expect(legacyData.has('g_states_v5:aAtom')).toBe(false);
    expect(mmkvInstance.getString('g_states_v5:aAtom')).toBe('"stale-mmkv"');
    clearSpy.mockRestore();

    const recoveredStorage = createStorage();
    await recoveredStorage.migrateFromAsyncStorage(
      ['g_states_v5:aAtom'],
      PROBE_KEY,
    );

    expect(mmkvInstance.getString('g_states_v5:aAtom')).toBeUndefined();
    expect(mmkvInstance.getString(MIGRATION_KEY)).toBe('1');
    expect(migrationLedger.get('jotai-storage-v1')).toBe('complete-v1');
  });

  it('resumes reset when the MMKV marker was written before ledger completion', async () => {
    mmkvInstance.set(MIGRATION_KEY, '1');
    mmkvInstance.set('g_states_v5:aAtom', '"stale-mmkv"');
    legacyData.set('g_states_v5:aAtom', '"legacy"');
    mockSetMigrationLedgerComplete.mockRejectedValueOnce(
      new OneKeyLocalError('process killed before ledger completion'),
    );
    const storage = createStorage();

    await expect(storage.clearAllForReset()).rejects.toThrow(
      'process killed before ledger completion',
    );
    expect(migrationLedger.get('jotai-storage-v1')).toBe('resetting-v1');
    expect(mmkvInstance.getString(MIGRATION_KEY)).toBe('1');

    const recoveredStorage = createStorage();
    await recoveredStorage.migrateFromAsyncStorage([], PROBE_KEY);

    expect(mmkvInstance.getString('g_states_v5:aAtom')).toBeUndefined();
    expect(migrationLedger.get('jotai-storage-v1')).toBe('complete-v1');
  });

  it('uses MMKV exclusively after migration', async () => {
    markJotaiStorageMigrated();
    const storage = createStorage();

    await storage.migrateFromAsyncStorage([], PROBE_KEY);

    await storage.setItem('g_states_v5:aAtom', { value: true });
    expect(await storage.getItem('g_states_v5:aAtom', null)).toEqual({
      value: true,
    });
    await storage.removeItem('g_states_v5:aAtom');
    expect(await storage.getItem('g_states_v5:aAtom', 'fallback')).toBe(
      'fallback',
    );
    expect(legacyStorage.multiGet).not.toHaveBeenCalled();
  });

  it('enumerates and clears native entries through the Jotai storage owner', async () => {
    markJotaiStorageMigrated();
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('./jotaiStorage') as typeof import('./jotaiStorage');
    const storage = mod.onekeyJotaiStorage as any;
    await storage.migrateFromAsyncStorage([], PROBE_KEY);
    await storage.setItem('g_states_v5:aAtom', { value: true });
    await storage.setItem('g_states_v5:bAtom', 2);

    const entries = await mod.getNativeJotaiStorageEntries();

    expect(entries).toEqual(
      new Map<string, unknown>([
        ['g_states_v5:aAtom', { value: true }],
        ['g_states_v5:bAtom', 2],
      ]),
    );
    await expect(mod.clearNativeJotaiStorageForReset()).resolves.toBe(2);
    expect(mmkvInstance.getString('g_states_v5:aAtom')).toBeUndefined();
    expect(mmkvInstance.getString('g_states_v5:bAtom')).toBeUndefined();
    expect(mmkvInstance.getString(MIGRATION_KEY)).toBe('1');
  });
});

describe('mergeStoredValue', () => {
  const { mergeStoredValue } =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./jotaiStorage') as typeof import('./jotaiStorage');

  it('leaves primitive values untouched', () => {
    expect(mergeStoredValue('perp', 'spot', true)).toBe('spot');
    expect(mergeStoredValue(undefined, 1_712_345_678, true)).toBe(
      1_712_345_678,
    );
    expect(mergeStoredValue(true, false, true)).toBe(false);
  });

  it('deep merges plain objects onto the initial value', () => {
    expect(mergeStoredValue({ a: 1, b: 2 }, { b: 3 }, true)).toEqual({
      a: 1,
      b: 3,
    });
    expect(
      mergeStoredValue(undefined, { deviceA: { hasUpgrade: true } }, true),
    ).toEqual({ deviceA: { hasUpgrade: true } });
  });

  it('skips merging when the atom opted out', () => {
    expect(mergeStoredValue({ a: 1 }, { b: 2 }, false)).toEqual({ b: 2 });
  });

  it('preserves non-plain object identity', () => {
    expect(mergeStoredValue([], [1, 2], true)).toEqual([1, 2]);
  });

  // lodash merge skips empty source arrays, so turning a force target off
  // would leave the previous items in place. The firmware atom opts out of
  // this merge; this test pins the default-on behavior.
  it('keeps previous nested array items when merging onto empty', () => {
    expect(
      mergeStoredValue(
        { pro2ForceUpdateTargets: ['boot'] },
        { pro2ForceUpdateTargets: [] },
        true,
      ),
    ).toEqual({ pro2ForceUpdateTargets: ['boot'] });
  });

  // merge({}, init, new Date()) collapses to {}.
  it('leaves a Date value untouched', () => {
    const date = new Date(1_712_345_678_000);
    expect(mergeStoredValue(undefined, date, true)).toBe(date);
  });
});
