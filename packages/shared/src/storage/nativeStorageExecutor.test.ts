/* eslint-disable @typescript-eslint/no-unsafe-call, onekey/no-raw-error */

type IScalar = string | number | boolean;

class FakeMMKV {
  values = new Map<string, IScalar>();

  failOnSetKey: string | undefined;

  getString(key: string) {
    const value = this.values.get(key);
    return typeof value === 'string' ? value : undefined;
  }

  getNumber(key: string) {
    const value = this.values.get(key);
    return typeof value === 'number' ? value : undefined;
  }

  getBoolean(key: string) {
    const value = this.values.get(key);
    return typeof value === 'boolean' ? value : undefined;
  }

  set(key: string, value: IScalar) {
    if (key === this.failOnSetKey) {
      this.failOnSetKey = undefined;
      throw new Error(`set failed for ${key}`);
    }
    this.values.set(key, value);
  }

  remove(key: string) {
    this.values.delete(key);
  }

  clearAll() {
    this.values.clear();
  }

  getAllKeys() {
    return [...this.values.keys()];
  }

  trim() {}
}

const mockAppMMKV = new FakeMMKV();
const mockSettingsMMKV = new FakeMMKV();
const mockColdStartMMKV = new FakeMMKV();
const mockDevSettingsMMKV = new FakeMMKV();
const mockLegacyData = new Map<string, string>();
const mockMigrationLedger = new Map<string, string>();
let mockLegacySourceError: Error | undefined;
let mockRecoveryAction: 'auto_repair' | 'try_again' | undefined;
const mockLegacyStorage = {
  getAllKeys: jest.fn(async () => [...mockLegacyData.keys()]),
  multiGet: jest.fn(async (keys: string[]) =>
    keys.map(
      (key) =>
        [key, mockLegacyData.get(key) ?? null] as [string, string | null],
    ),
  ),
  multiRemove: jest.fn(async (keys: string[]) => {
    keys.forEach((key) => mockLegacyData.delete(key));
  }),
};
const mockSetMigrationLedgerComplete = jest.fn(async (key: string) => {
  mockMigrationLedger.set(key, 'complete-v1');
});
const mockSetMigrationLedger = jest.fn(async (key: string, value: string) => {
  mockMigrationLedger.set(key, value);
});
const mockSyncNativeStorageMMKV = jest.fn(async () => undefined);
const mockLegacyRetryWait = jest.fn(async (_delayMs: number) => undefined);
const mockSWRCacheCapacityLimit = jest.fn();
const mockNativeMigrationLog = jest.fn();
const mockAcknowledgeRecoveryAction = jest.fn(async (action: string) => {
  if (mockRecoveryAction !== action) {
    return false;
  }
  mockRecoveryAction = undefined;
  return true;
});
const mockGetMigrationStorageCapacity = jest.fn(async () => ({
  availableBytes: 1024 * 1024 * 1024,
  legacyBytes: mockLegacyData.size === 0 ? 0 : 6 * 1024 * 1024,
}));

jest.mock('../platformEnv', () => ({
  __esModule: true,
  default: { isNativeBackgroundThread: true },
}));
jest.mock('../utils/timerUtils', () => ({
  __esModule: true,
  default: { wait: mockLegacyRetryWait },
}));
jest.mock('./legacyAsyncStorageMigration', () => ({
  getLegacyAsyncStorageForMigration: () => {
    if (mockLegacySourceError) {
      throw new Error(mockLegacySourceError.message);
    }
    return mockLegacyStorage;
  },
}));
jest.mock('./nativeStorageMigrationModule', () => ({
  NATIVE_STORAGE_MIGRATION_LEDGER_COMPLETE: 'complete-v1',
  NATIVE_STORAGE_MIGRATION_LEDGER_MIGRATING: 'migrating-v1',
  NATIVE_STORAGE_MIGRATION_LEDGER_RESETTING: 'resetting-v1',
  acknowledgeNativeStorageRecoveryAction: mockAcknowledgeRecoveryAction,
  getNativeStorageMigrationCapacity: mockGetMigrationStorageCapacity,
  getNativeStorageMigrationLedger: jest.fn(
    async (key: string) => mockMigrationLedger.get(key) ?? null,
  ),
  peekNativeStorageRecoveryAction: jest.fn(async () => mockRecoveryAction),
  setNativeStorageMigrationLedger: mockSetMigrationLedger,
  setNativeStorageMigrationLedgerComplete: mockSetMigrationLedgerComplete,
  syncNativeStorageMMKV: mockSyncNativeStorageMMKV,
}));
jest.mock('../logger/logger', () => ({
  defaultLogger: {
    app: {
      perf: {
        swrCacheCapacityLimit: (params: unknown) => {
          mockSWRCacheCapacityLimit(params);
        },
      },
    },
  },
}));
jest.mock('../modules3rdParty/react-native-file-logger', () => ({
  LogLevel: { Info: 'info' },
  NativeLogger: {
    write: (...args: unknown[]) => {
      mockNativeMigrationLog(...args);
    },
  },
}));
jest.mock('./instance/appStorageMMKVInstance', () => ({
  __esModule: true,
  default: mockAppMMKV,
}));
jest.mock('./instance/mmkvStorageInstance', () => ({
  __esModule: true,
  default: mockSettingsMMKV,
}));
jest.mock('./instance/coldStartCacheMMKVInstance', () => ({
  __esModule: true,
  default: mockColdStartMMKV,
}));
jest.mock('./instance/mmkvDevSettingStorageInstance', () => ({
  __esModule: true,
  default: mockDevSettingsMMKV,
}));

const MIGRATION_KEY = '__onekey_internal_app_storage_migration_v1__';
const LEGACY_CLEANUP_KEY = '__onekey_internal_app_storage_legacy_cleanup_v1__';
const LEGACY_RETENTION_KEY =
  '__onekey_internal_app_storage_legacy_retention_v1__';
const MIGRATION_REPORT_KEY =
  '__onekey_internal_app_storage_migration_report_v1__';
const BATCH_JOURNAL_KEY = '__onekey_internal_app_storage_batch_journal_v1__';
const nativeStorageGlobal = globalThis as typeof globalThis & {
  __onekeyNativeSyncStorageBroadcast?: jest.Mock;
};

function loadExecutor() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./nativeStorageExecutor') as typeof import('./nativeStorageExecutor');
}

function markAppStorageMigrated() {
  mockAppMMKV.set(MIGRATION_KEY, '1');
  mockAppMMKV.set(LEGACY_RETENTION_KEY, 'retained-v1');
  mockMigrationLedger.set('app-storage-v1', 'complete-v1');
}

function readPersistedSWRCache() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getNativeSWRCachePersistence } =
    require('./nativeSWRCachePersistence') as typeof import('./nativeSWRCachePersistence');
  return JSON.parse(
    getNativeSWRCachePersistence(mockColdStartMMKV).readSerialized(),
  ) as Record<string, unknown>;
}

describe('nativeStorageExecutor', () => {
  beforeEach(() => {
    jest.resetModules();
    mockAppMMKV.clearAll();
    mockAppMMKV.failOnSetKey = undefined;
    mockSettingsMMKV.clearAll();
    mockColdStartMMKV.clearAll();
    mockDevSettingsMMKV.clearAll();
    mockSWRCacheCapacityLimit.mockReset();
    mockNativeMigrationLog.mockReset();
    mockLegacyData.clear();
    mockLegacySourceError = undefined;
    mockMigrationLedger.clear();
    mockRecoveryAction = undefined;
    mockLegacyStorage.getAllKeys.mockReset();
    mockLegacyStorage.getAllKeys.mockImplementation(async () => [
      ...mockLegacyData.keys(),
    ]);
    mockLegacyStorage.multiGet.mockReset();
    mockLegacyStorage.multiGet.mockImplementation(async (keys: string[]) =>
      keys.map(
        (key) =>
          [key, mockLegacyData.get(key) ?? null] as [string, string | null],
      ),
    );
    mockLegacyStorage.multiRemove.mockReset();
    mockLegacyStorage.multiRemove.mockImplementation(async (keys: string[]) => {
      keys.forEach((key) => mockLegacyData.delete(key));
    });
    mockGetMigrationStorageCapacity.mockImplementation(async () => ({
      availableBytes: 1024 * 1024 * 1024,
      legacyBytes: mockLegacyData.size === 0 ? 0 : 6 * 1024 * 1024,
    }));
    nativeStorageGlobal.__onekeyNativeSyncStorageBroadcast = jest.fn(
      () => true,
    );
    jest.clearAllMocks();
  });

  it('holds business reads behind one migration promise', async () => {
    mockLegacyData.set('business-key', 'legacy-value');
    mockLegacyData.set('g_states_v5:settingsPersistAtom', 'jotai-value');
    let releaseMigration: (() => void) | undefined;
    let markMigrationStarted: (() => void) | undefined;
    const migrationStarted = new Promise<void>((resolve) => {
      markMigrationStarted = resolve;
    });
    mockLegacyStorage.multiGet.mockImplementationOnce(
      (keys: string[]) =>
        new Promise((resolve) => {
          markMigrationStarted?.();
          releaseMigration = () =>
            resolve(
              keys.map(
                (key) =>
                  [key, mockLegacyData.get(key) ?? null] as [
                    string,
                    string | null,
                  ],
              ),
            );
        }),
    );
    const { executeNativeStorageRequest } = loadExecutor();
    let settled = false;
    const readPromise = executeNativeStorageRequest({
      scope: 'asyncStorage',
      operation: 'getItem',
      key: 'business-key',
    }).finally(() => {
      settled = true;
    });

    await migrationStarted;
    expect(settled).toBe(false);
    releaseMigration?.();
    await expect(readPromise).resolves.toBe('legacy-value');
    expect(mockAppMMKV.getString(MIGRATION_KEY)).toBe('1');
    expect(mockAppMMKV.getString(LEGACY_RETENTION_KEY)).toBe('retained-v1');
    expect(mockMigrationLedger.get('app-storage-v1')).toBe('complete-v1');
    expect(mockLegacyData.get('business-key')).toBe('legacy-value');
    expect(mockLegacyData.get('g_states_v5:settingsPersistAtom')).toBe(
      'jotai-value',
    );
    expect(mockSyncNativeStorageMMKV.mock.invocationCallOrder[0]).toBeLessThan(
      mockSetMigrationLedgerComplete.mock.invocationCallOrder[0],
    );
    expect(mockLegacyStorage.multiRemove).not.toHaveBeenCalled();
    expect(mockAppMMKV.getString('app:g_states_v5:settingsPersistAtom')).toBe(
      'jotai-value',
    );
  });

  it('migrates every third-party and Jotai key into AppStorage MMKV', async () => {
    const thirdPartyKey = '@third-party/sdk:persisted-session';
    const jotaiKey = 'g_states_v5:removedHistoricalAtom';
    mockLegacyData.set(thirdPartyKey, 'third-party-value');
    mockLegacyData.set(jotaiKey, 'jotai-value');
    const { executeNativeStorageRequest } = loadExecutor();

    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getAllKeys',
      }),
    ).resolves.toEqual(expect.arrayContaining([thirdPartyKey, jotaiKey]));

    expect(mockAppMMKV.getString(`app:${thirdPartyKey}`)).toBe(
      'third-party-value',
    );
    expect(mockAppMMKV.getString(`app:${jotaiKey}`)).toBe('jotai-value');
    expect(mockLegacyData.get(thirdPartyKey)).toBe('third-party-value');
    expect(mockLegacyData.get(jotaiKey)).toBe('jotai-value');
  });

  it('bounds legacy value retention by reading migration keys in chunks', async () => {
    for (let index = 0; index < 101; index += 1) {
      mockLegacyData.set(`key-${String(index).padStart(3, '0')}`, `${index}`);
    }
    let releaseLastKeyInFirstChunk: (() => void) | undefined;
    let markLastKeyInFirstChunkStarted: (() => void) | undefined;
    const lastKeyInFirstChunkStarted = new Promise<void>((resolve) => {
      markLastKeyInFirstChunkStarted = resolve;
    });
    mockLegacyStorage.multiGet.mockImplementation(async (keys: string[]) => {
      if (keys[0] === 'key-099') {
        markLastKeyInFirstChunkStarted?.();
        await new Promise<void>((resolve) => {
          releaseLastKeyInFirstChunk = resolve;
        });
      }
      return keys.map(
        (key) =>
          [key, mockLegacyData.get(key) ?? null] as [string, string | null],
      );
    });
    const { executeNativeStorageRequest } = loadExecutor();

    const migration = executeNativeStorageRequest({
      scope: 'asyncStorage',
      operation: 'getItem',
      key: 'key-100',
    });
    await lastKeyInFirstChunkStarted;

    expect(mockLegacyStorage.multiGet).toHaveBeenCalledTimes(100);
    releaseLastKeyInFirstChunk?.();
    await expect(migration).resolves.toBe('100');
    expect(mockLegacyStorage.multiGet).toHaveBeenCalledTimes(103);
  });

  it('retries a transient key failure before publishing MMKV', async () => {
    mockLegacyData.set('key', 'fresh');
    mockAppMMKV.set('app:key', 'partial');
    mockLegacyStorage.multiGet.mockRejectedValueOnce(new Error('disk error'));
    const { executeNativeStorageRequest } = loadExecutor();

    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: 'key',
      }),
    ).resolves.toBe('fresh');
    expect(mockAppMMKV.getString('app:key')).toBe('fresh');
    expect(mockAppMMKV.getString(MIGRATION_KEY)).toBe('1');
    expect(mockMigrationLedger.get('app-storage-v1')).toBe('complete-v1');
    expect(mockLegacyRetryWait.mock.calls).toEqual([[50]]);
  });

  it('publishes the OTA gate before MMKV mutation and recovers after marker write', async () => {
    mockLegacyData.set('key', 'fresh');
    mockAppMMKV.set('app:key', 'partial');
    const removeSpy = jest.spyOn(mockAppMMKV, 'remove');
    mockSetMigrationLedgerComplete.mockRejectedValueOnce(
      new Error('process killed before ledger completion'),
    );
    const { executeNativeStorageRequest } = loadExecutor();

    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: 'key',
      }),
    ).rejects.toThrow('process killed before ledger completion');
    const migrationGateOrder =
      mockSetMigrationLedger.mock.invocationCallOrder[0];
    const firstMMKVMutationOrder = removeSpy.mock.invocationCallOrder[0];
    removeSpy.mockRestore();

    expect(mockSetMigrationLedger).toHaveBeenCalledWith(
      'app-storage-v1',
      'migrating-v1',
    );
    expect(migrationGateOrder).toBeLessThan(firstMMKVMutationOrder);
    expect(mockMigrationLedger.get('app-storage-v1')).toBe('migrating-v1');
    expect(mockAppMMKV.getString(MIGRATION_KEY)).toBe('1');
    expect(mockAppMMKV.getString('app:key')).toBe('fresh');

    mockLegacyStorage.getAllKeys.mockClear();
    mockLegacyStorage.multiGet.mockClear();
    jest.resetModules();
    const recoveredExecutor = loadExecutor();
    await expect(
      recoveredExecutor.executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: 'key',
      }),
    ).resolves.toBe('fresh');
    expect(mockLegacyStorage.getAllKeys).not.toHaveBeenCalled();
    expect(mockLegacyStorage.multiGet).not.toHaveBeenCalled();
    expect(mockLegacyData.get('key')).toBe('fresh');
    expect(mockAppMMKV.getString(LEGACY_RETENTION_KEY)).toBe('retained-v1');
    expect(mockMigrationLedger.get('app-storage-v1')).toBe('complete-v1');
  });

  it('enters an empty MMKV fallback when migration capacity is insufficient', async () => {
    mockLegacyData.set('key', 'legacy');
    mockAppMMKV.set('app:key', 'untouched-partial');
    mockGetMigrationStorageCapacity.mockResolvedValueOnce({
      availableBytes: 1024,
      legacyBytes: 6 * 1024 * 1024,
    });
    const { executeNativeStorageRequest } = loadExecutor();

    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: 'key',
      }),
    ).resolves.toBeNull();
    expect(mockAppMMKV.getString('app:key')).toBeUndefined();
    expect(mockAppMMKV.getString(MIGRATION_KEY)).toBe('1');
    expect(mockLegacyStorage.getAllKeys).toHaveBeenCalledTimes(1);
    expect(mockLegacyStorage.multiGet).not.toHaveBeenCalled();
    expect(
      JSON.parse(mockAppMMKV.getString(MIGRATION_REPORT_KEY) || '{}'),
    ).toMatchObject({
      migratedKeyCount: 0,
      status: 'degraded',
    });
  });

  it('enters an empty MMKV fallback when the legacy module stays unavailable', async () => {
    mockLegacySourceError = new Error('legacy module unavailable');
    const { executeNativeStorageRequest } = loadExecutor();

    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: 'key',
      }),
    ).resolves.toBeNull();
    expect(mockAppMMKV.getString(MIGRATION_KEY)).toBe('1');
    expect(mockMigrationLedger.get('app-storage-v1')).toBe('complete-v1');
    expect(mockLegacyRetryWait.mock.calls).toEqual([[50], [500], [1000]]);
    expect(
      JSON.parse(mockAppMMKV.getString(MIGRATION_REPORT_KEY) || '{}'),
    ).toMatchObject({
      enumerationStatus: 'failed',
      sourceAccessAttemptCount: 4,
      status: 'degraded',
    });
  });

  it('skips a permanently unreadable key and records its raw key locally', async () => {
    const sensitiveLookingKey = 'session:user-secret-shaped-key';
    mockLegacyData.set(sensitiveLookingKey, 'value');
    mockLegacyStorage.multiGet.mockResolvedValue([]);
    const { executeNativeStorageRequest } = loadExecutor();

    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: sensitiveLookingKey,
      }),
    ).resolves.toBeNull();
    expect(mockAppMMKV.getString(MIGRATION_KEY)).toBe('1');
    const report = JSON.parse(
      mockAppMMKV.getString(MIGRATION_REPORT_KEY) || '{}',
    ) as { failures?: Array<{ key: string }>; status?: string };
    expect(report.status).toBe('degraded');
    expect(
      report.failures?.some(({ key }) => key === sensitiveLookingKey),
    ).toBe(true);
    const serializedLogs = JSON.stringify(mockNativeMigrationLog.mock.calls);
    expect(serializedLogs).toContain('result=skipped');
    expect(serializedLogs).not.toContain(sensitiveLookingKey);
  });

  it('logs migration shape without exposing unknown keys or values', async () => {
    const sensitiveLookingKey = 'session:user-secret-shaped-key';
    const sensitiveLookingValue = 'sensitive-value';
    mockLegacyData.set(sensitiveLookingKey, sensitiveLookingValue);
    const { executeNativeStorageRequest } = loadExecutor();

    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: sensitiveLookingKey,
      }),
    ).resolves.toBe(sensitiveLookingValue);

    const serializedLogs = JSON.stringify(mockNativeMigrationLog.mock.calls);
    expect(serializedLogs).not.toContain(sensitiveLookingKey);
    expect(serializedLogs).not.toContain(sensitiveLookingValue);
    expect(serializedLogs).toContain('<redacted:');
    expect(serializedLogs).toContain('result=migrated');
    expect(serializedLogs).toContain('sourceBytes=');
  });

  it('migrates readable keys and skips a persistently unreadable key', async () => {
    mockLegacyData.set('readable', 'value');
    mockLegacyData.set('unreadable', 'stale-placeholder');
    mockLegacyStorage.multiGet.mockImplementation(async (keys: string[]) =>
      keys.map((key): [string, string | null] => [
        key,
        key === 'unreadable' ? null : (mockLegacyData.get(key) ?? null),
      ]),
    );
    const { executeNativeStorageRequest } = loadExecutor();

    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: 'unreadable',
      }),
    ).resolves.toBeNull();
    expect(mockAppMMKV.getString('app:readable')).toBe('value');
    expect(mockAppMMKV.getString('app:unreadable')).toBeUndefined();
    expect(mockAppMMKV.getString(MIGRATION_KEY)).toBe('1');
    expect(mockMigrationLedger.get('app-storage-v1')).toBe('complete-v1');
    expect(mockLegacyData.get('readable')).toBe('value');
    expect(mockLegacyData.get('unreadable')).toBe('stale-placeholder');
    expect(mockNativeMigrationLog).toHaveBeenCalledWith(
      'info',
      expect.stringContaining('result=skipped'),
    );
  });

  it('does not reopen legacy storage during normal reads after migration', async () => {
    markAppStorageMigrated();
    mockAppMMKV.set('app:key', 'mmkv');
    const { executeNativeStorageRequest } = loadExecutor();

    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: 'key',
      }),
    ).resolves.toBe('mmkv');
    expect(mockLegacyStorage.getAllKeys).not.toHaveBeenCalled();
    expect(mockMigrationLedger.get('app-storage-v1')).toBe('complete-v1');
  });

  it('keeps normal mutations on MMKV and leaves the retained backup untouched', async () => {
    markAppStorageMigrated();
    mockAppMMKV.set('app:key', 'old-mmkv');
    mockLegacyData.set('key', 'legacy-backup');
    const { executeNativeStorageRequest } = loadExecutor();

    await executeNativeStorageRequest({
      scope: 'asyncStorage',
      operation: 'setItem',
      key: 'key',
      value: 'new-mmkv',
    });
    expect(mockAppMMKV.getString('app:key')).toBe('new-mmkv');
    expect(mockLegacyData.get('key')).toBe('legacy-backup');

    await executeNativeStorageRequest({
      scope: 'asyncStorage',
      operation: 'removeItem',
      key: 'key',
    });
    expect(mockAppMMKV.getString('app:key')).toBeUndefined();
    expect(mockLegacyData.get('key')).toBe('legacy-backup');
    expect(mockLegacyStorage.getAllKeys).not.toHaveBeenCalled();
    expect(mockLegacyStorage.multiGet).not.toHaveBeenCalled();
    expect(mockLegacyStorage.multiRemove).not.toHaveBeenCalled();
  });

  it('preserves legacy data retained by an already migrated build', async () => {
    mockAppMMKV.set(MIGRATION_KEY, '1');
    mockAppMMKV.set('app:key', 'mmkv');
    mockMigrationLedger.set('app-storage-v1', 'complete-v1');
    mockLegacyData.set('key', 'retained-legacy-value');
    mockLegacyData.set('g_states_v5:aAtom', 'keep-for-jotai-cleanup');
    const { executeNativeStorageRequest } = loadExecutor();

    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: 'key',
      }),
    ).resolves.toBe('mmkv');

    expect(mockLegacyData.get('key')).toBe('retained-legacy-value');
    expect(mockLegacyData.get('g_states_v5:aAtom')).toBe(
      'keep-for-jotai-cleanup',
    );
    expect(mockAppMMKV.getString(LEGACY_CLEANUP_KEY)).toBeUndefined();
    expect(mockLegacyStorage.multiRemove).not.toHaveBeenCalled();
    expect(mockLegacyStorage.multiGet).not.toHaveBeenCalled();
  });

  it('retains the source after a successful migration', async () => {
    mockLegacyData.set('key', 'legacy-value');
    const { executeNativeStorageRequest } = loadExecutor();

    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: 'key',
      }),
    ).resolves.toBe('legacy-value');
    expect(mockAppMMKV.getString(MIGRATION_KEY)).toBe('1');
    expect(mockAppMMKV.getString(LEGACY_CLEANUP_KEY)).toBeUndefined();
    expect(mockAppMMKV.getString(LEGACY_RETENTION_KEY)).toBe('retained-v1');
    expect(mockMigrationLedger.get('app-storage-v1')).toBe('complete-v1');
    expect(mockLegacyData.get('key')).toBe('legacy-value');

    mockLegacyStorage.multiGet.mockClear();
    jest.resetModules();
    const recoveredExecutor = loadExecutor();
    await expect(
      recoveredExecutor.executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: 'key',
      }),
    ).resolves.toBe('legacy-value');

    expect(mockLegacyStorage.multiGet).not.toHaveBeenCalled();
    expect(mockLegacyData.get('key')).toBe('legacy-value');
    expect(mockAppMMKV.getString(LEGACY_CLEANUP_KEY)).toBeUndefined();
    expect(mockMigrationLedger.get('app-storage-v1')).toBe('complete-v1');
  });

  it('retries source enumeration before migrating every discovered key', async () => {
    mockLegacyData.set('a', 'one');
    mockLegacyData.set('b', 'two');
    mockLegacyStorage.getAllKeys.mockRejectedValueOnce(
      new Error('manifest unavailable'),
    );
    const { executeNativeStorageRequest } = loadExecutor();

    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: 'b',
      }),
    ).resolves.toBe('two');

    expect(mockAppMMKV.getString('app:a')).toBe('one');
    expect(mockAppMMKV.getString('app:b')).toBe('two');
    expect(mockAppMMKV.getString(MIGRATION_KEY)).toBe('1');
    expect(mockNativeMigrationLog).toHaveBeenCalledWith(
      'info',
      expect.stringContaining('source enumeration retry=1 delayMs=50'),
    );
    expect(mockLegacyRetryWait.mock.calls).toEqual([[50]]);
  });

  it('migrates and diagnoses address book and local history as critical keys', async () => {
    const addressBookKey = 'simple_db_v5:addressBookItems';
    const localHistoryKey = 'simple_db_v5:localHistory';
    mockLegacyData.set(addressBookKey, 'address-book');
    mockLegacyData.set(localHistoryKey, 'pending-history');
    const { executeNativeStorageRequest } = loadExecutor();

    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: localHistoryKey,
      }),
    ).resolves.toBe('pending-history');

    expect(mockAppMMKV.getString(`app:${addressBookKey}`)).toBe('address-book');
    expect(mockAppMMKV.getString(`app:${localHistoryKey}`)).toBe(
      'pending-history',
    );
    const serializedLogs = JSON.stringify(mockNativeMigrationLog.mock.calls);
    expect(serializedLogs).toContain(
      `key=${addressBookKey} enumerated=true present=true`,
    );
    expect(serializedLogs).toContain(
      `key=${localHistoryKey} enumerated=true present=true`,
    );
  });

  it('recovers a critical key even when enumeration omits it', async () => {
    const addressBookKey = 'simple_db_v5:addressBookItems';
    mockLegacyData.set(addressBookKey, 'address-book');
    mockLegacyStorage.getAllKeys.mockResolvedValue([]);
    const { executeNativeStorageRequest } = loadExecutor();

    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: addressBookKey,
      }),
    ).resolves.toBe('address-book');

    expect(mockAppMMKV.getString(MIGRATION_KEY)).toBe('1');
    expect(mockAppMMKV.getString(`app:${addressBookKey}`)).toBe('address-book');
    expect(mockLegacyData.get(addressBookKey)).toBe('address-book');
    expect(mockNativeMigrationLog).toHaveBeenCalledWith(
      'info',
      expect.stringContaining(
        `key=${addressBookKey} enumerated=false present=true`,
      ),
    );
    expect(
      JSON.parse(mockAppMMKV.getString(MIGRATION_REPORT_KEY) || '{}'),
    ).toMatchObject({
      recoveredUnlistedKeyCount: 1,
      status: 'degraded',
    });
  });

  it('logs and skips a critical key after all retries fail', async () => {
    const addressBookKey = 'simple_db_v5:addressBookItems';
    mockLegacyData.set(addressBookKey, 'retained-address-book');
    mockLegacyStorage.multiGet.mockImplementation(async (keys: string[]) =>
      keys.map((key): [string, string | null] => [
        key,
        key === addressBookKey ? null : (mockLegacyData.get(key) ?? null),
      ]),
    );
    const { executeNativeStorageRequest } = loadExecutor();

    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: addressBookKey,
      }),
    ).resolves.toBeNull();
    expect(mockLegacyData.get(addressBookKey)).toBe('retained-address-book');
    expect(mockAppMMKV.getString(`app:${addressBookKey}`)).toBeUndefined();
    const serializedLogs = JSON.stringify(mockNativeMigrationLog.mock.calls);
    expect(serializedLogs).toContain(
      `result=skipped index=0 key=${addressBookKey} stage=read attempts=4`,
    );
    expect(mockLegacyRetryWait.mock.calls).toEqual([[50], [500], [1000]]);
  });

  it('fails closed instead of resurrecting legacy data when MMKV loses its marker', async () => {
    mockMigrationLedger.set('app-storage-v1', 'complete-v1');
    mockLegacyData.set('key', 'stale-legacy-value');
    const { executeNativeStorageRequest } = loadExecutor();

    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: 'key',
      }),
    ).rejects.toThrow('MMKV migration marker is missing');
    expect(mockLegacyStorage.getAllKeys).not.toHaveBeenCalled();
  });

  it('resets an inconsistent app-storage target while retaining legacy backup data', async () => {
    mockMigrationLedger.set('app-storage-v1', 'complete-v1');
    mockAppMMKV.set('app:key', 'partial-mmkv-value');
    mockLegacyData.set('key', 'stale-legacy-value');
    const { executeNativeStorageRequest } = loadExecutor();

    await executeNativeStorageRequest({
      scope: 'recovery',
      operation: 'resetMigrationTarget',
      target: 'appStorage',
    });

    expect(mockSetMigrationLedger).toHaveBeenCalledWith(
      'app-storage-v1',
      'resetting-v1',
    );
    expect(mockLegacyData.get('key')).toBe('stale-legacy-value');
    expect(mockAppMMKV.getAllKeys()).toEqual([
      MIGRATION_KEY,
      LEGACY_RETENTION_KEY,
    ]);
    expect(mockMigrationLedger.get('app-storage-v1')).toBe('complete-v1');
    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: 'key',
      }),
    ).resolves.toBeNull();
  });

  it('finishes an interrupted app-storage reset without deleting its backup', async () => {
    mockMigrationLedger.set('app-storage-v1', 'resetting-v1');
    mockAppMMKV.set('app:key', 'partial-mmkv-value');
    mockLegacyData.set('key', 'stale-legacy-value');
    const { executeNativeStorageRequest } = loadExecutor();

    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: 'key',
      }),
    ).resolves.toBeNull();
    expect(mockLegacyData.get('key')).toBe('stale-legacy-value');
    expect(mockAppMMKV.getAllKeys()).toEqual([
      MIGRATION_KEY,
      LEGACY_RETENTION_KEY,
    ]);
    expect(mockMigrationLedger.get('app-storage-v1')).toBe('complete-v1');
  });

  it('supports empty keys and removes legacy data during explicit clear', async () => {
    mockLegacyData.set('', 'empty-key');
    mockLegacyData.set('other', 'value');
    const { executeNativeStorageRequest } = loadExecutor();

    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: '',
      }),
    ).resolves.toBe('empty-key');
    await executeNativeStorageRequest({
      scope: 'asyncStorage',
      operation: 'clear',
    });

    expect(mockAppMMKV.getString(MIGRATION_KEY)).toBe('1');
    expect(mockAppMMKV.getAllKeys()).toEqual([
      MIGRATION_KEY,
      LEGACY_RETENTION_KEY,
      LEGACY_CLEANUP_KEY,
    ]);
    expect(mockAppMMKV.getString(LEGACY_RETENTION_KEY)).toBe('cleared-v1');
    expect(mockLegacyData.size).toBe(0);
  });

  it('keeps explicit clear strict when legacy cleanup fails', async () => {
    markAppStorageMigrated();
    mockAppMMKV.set('app:key', 'mmkv-value');
    mockLegacyData.set('key', 'legacy-value');
    mockLegacyStorage.multiRemove.mockRejectedValueOnce(
      new Error('legacy cleanup failed'),
    );
    const { executeNativeStorageRequest } = loadExecutor();

    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'clear',
      }),
    ).rejects.toThrow('legacy cleanup failed');
    expect(mockAppMMKV.getString('app:key')).toBeUndefined();
    expect(mockLegacyData.get('key')).toBe('legacy-value');
  });

  it('serializes business writes behind an in-progress clear', async () => {
    markAppStorageMigrated();
    mockAppMMKV.set('app:key', 'old');
    mockLegacyData.set('key', 'old');
    let releaseLegacyClear: (() => void) | undefined;
    let markLegacyClearStarted: (() => void) | undefined;
    const legacyClearStarted = new Promise<void>((resolve) => {
      markLegacyClearStarted = resolve;
    });
    mockLegacyStorage.multiRemove.mockImplementationOnce(
      (keys: string[]) =>
        new Promise((resolve) => {
          markLegacyClearStarted?.();
          releaseLegacyClear = () => {
            keys.forEach((key) => mockLegacyData.delete(key));
            resolve(undefined);
          };
        }),
    );
    const { executeNativeStorageRequest } = loadExecutor();

    const clearPromise = executeNativeStorageRequest({
      scope: 'asyncStorage',
      operation: 'clear',
    });
    await legacyClearStarted;
    expect(mockLegacyStorage.multiRemove).toHaveBeenCalledTimes(1);

    const writePromise = executeNativeStorageRequest({
      scope: 'asyncStorage',
      operation: 'setItem',
      key: 'key',
      value: 'new',
    });
    await Promise.resolve();
    expect(mockAppMMKV.getString('app:key')).toBeUndefined();

    releaseLegacyClear?.();
    await Promise.all([clearPromise, writePromise]);
    expect(mockAppMMKV.getString('app:key')).toBe('new');
  });

  it('rolls back an AsyncStorage-compatible batch when an MMKV write fails', async () => {
    markAppStorageMigrated();
    mockAppMMKV.set('app:a', 'old-a');
    mockAppMMKV.set('app:b', 'old-b');
    mockAppMMKV.failOnSetKey = 'app:b';
    const { executeNativeStorageRequest } = loadExecutor();

    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'multiSet',
        entries: [
          ['a', 'new-a'],
          ['b', 'new-b'],
        ],
      }),
    ).rejects.toThrow('set failed for app:b');
    expect(mockAppMMKV.getString('app:a')).toBe('old-a');
    expect(mockAppMMKV.getString('app:b')).toBe('old-b');
    expect(mockAppMMKV.getString(BATCH_JOURNAL_KEY)).toBeUndefined();
  });

  it('recovers an interrupted batch before exposing MMKV business data', async () => {
    markAppStorageMigrated();
    mockAppMMKV.set('app:a', 'partially-applied');
    mockAppMMKV.set('app:new-key', 'partial-new-value');
    mockAppMMKV.set(
      BATCH_JOURNAL_KEY,
      JSON.stringify({
        version: 1,
        previousValues: [
          ['app:a', 'before-batch'],
          ['app:new-key', null],
        ],
      }),
    );
    const { executeNativeStorageRequest } = loadExecutor();

    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'multiGet',
        keys: ['a', 'new-key'],
      }),
    ).resolves.toEqual([
      ['a', 'before-batch'],
      ['new-key', null],
    ]);
    expect(mockAppMMKV.getString(BATCH_JOURNAL_KEY)).toBeUndefined();
  });

  it.each([
    ['malformed JSON', '{'],
    [
      'invalid schema',
      JSON.stringify({
        version: 1,
        previousValues: [['unexpected-key', 'before-batch']],
      }),
    ],
  ])(
    'discards an invalid batch journal with %s and keeps current MMKV data',
    async (_caseName, journal) => {
      markAppStorageMigrated();
      mockAppMMKV.set('app:a', 'current-value');
      mockAppMMKV.set(BATCH_JOURNAL_KEY, journal);
      const { executeNativeStorageRequest } = loadExecutor();

      await expect(
        executeNativeStorageRequest({
          scope: 'asyncStorage',
          operation: 'getItem',
          key: 'a',
        }),
      ).resolves.toBe('current-value');

      expect(mockAppMMKV.getString(BATCH_JOURNAL_KEY)).toBeUndefined();
      expect(mockSyncNativeStorageMMKV).toHaveBeenCalledWith(
        'onekey-app-storage-v1',
      );
    },
  );

  it('merges stale main-runtime SWR writes without deleting newer bg entries', async () => {
    const previous = JSON.stringify({ a: { d: 'old', t: 1 } });
    mockColdStartMMKV.set(
      'onekey_swr_cache',
      JSON.stringify({
        a: { d: 'new-bg', t: 3 },
        b: { d: 'bg-only', t: 2 },
      }),
    );
    const { executeNativeStorageRequest } = loadExecutor();

    await executeNativeStorageRequest({
      scope: 'syncStorage',
      operation: 'set',
      store: 'coldStart',
      key: 'onekey_swr_cache',
      value: JSON.stringify({ c: { d: 'ui', t: 4 } }),
      previousValue: previous,
    });

    expect(readPersistedSWRCache()).toEqual({
      a: { d: 'new-bg', t: 3 },
      b: { d: 'bg-only', t: 2 },
      c: { d: 'ui', t: 4 },
    });
    expect(
      nativeStorageGlobal.__onekeyNativeSyncStorageBroadcast,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        store: 'coldStart',
        operation: 'patchSWR',
      }),
    );
  });

  it('retains a large legacy SWR entry within the overall budgets', async () => {
    markAppStorageMigrated();
    const homeKey = 'home-overview-perps-worth:account-1';
    const largeValue = 'x'.repeat(1024 * 1024);
    mockColdStartMMKV.set(
      'onekey_swr_cache',
      JSON.stringify({
        [homeKey]: { d: 'small', t: 2 },
        'non-home': { d: 'keep-on-disk', t: 1 },
        large: { d: largeValue, t: 3 },
      }),
    );
    const { executeNativeStorageRequest } = loadExecutor();

    const snapshot = (await executeNativeStorageRequest({
      scope: 'bootstrap',
    })) as {
      coldStart: Array<[string, IScalar]>;
    };
    const snapshotValue = new Map(snapshot.coldStart).get('onekey_swr_cache');
    const snapshotStore = JSON.parse(snapshotValue as string) as Record<
      string,
      { d: unknown; t: number }
    >;
    const persistedStore = readPersistedSWRCache() as Record<
      string,
      { d: unknown; t: number }
    >;

    expect(snapshotStore).toMatchObject({
      [homeKey]: { d: 'small', t: 2 },
      'non-home': { d: 'keep-on-disk', t: 1 },
    });
    expect(snapshotStore.large).toEqual({ d: largeValue, t: 3 });
    expect(persistedStore).toMatchObject({
      [homeKey]: { d: 'small', t: 2 },
      'non-home': { d: 'keep-on-disk', t: 1 },
    });
    expect(persistedStore.large).toEqual({ d: largeValue, t: 3 });
    expect(mockColdStartMMKV.getString('onekey_swr_cache')).toBeUndefined();
  });

  it('bounds steady-state SWR bootstrap across business namespaces', async () => {
    markAppStorageMigrated();
    const {
      executeNativeStorageRequest,
      NATIVE_SWR_CACHE_BOOTSTRAP_MAX_ENTRIES,
      NATIVE_SWR_CACHE_BOOTSTRAP_MAX_SERIALIZED_CHARS,
    } = loadExecutor();
    const sourceEntryCount = NATIVE_SWR_CACHE_BOOTSTRAP_MAX_ENTRIES + 6;
    const entries = Object.fromEntries(
      Array.from({ length: sourceEntryCount }, (_, index) => [
        `${index % 2 === 0 ? 'marketHomeTokenList' : 'disHomePage'}:entry-${index}`,
        { d: String(index), t: index + 1 },
      ]),
    );
    mockColdStartMMKV.set('onekey_swr_cache', JSON.stringify(entries));

    await executeNativeStorageRequest({ scope: 'bootstrap' });
    const snapshot = (await executeNativeStorageRequest({
      scope: 'bootstrap',
    })) as {
      coldStart: Array<[string, IScalar]>;
    };
    const snapshotValue = new Map(snapshot.coldStart).get('onekey_swr_cache');
    const bootstrapStore = JSON.parse(snapshotValue as string) as Record<
      string,
      unknown
    >;

    expect(NATIVE_SWR_CACHE_BOOTSTRAP_MAX_SERIALIZED_CHARS).toBe(
      10 * 1024 * 1024,
    );
    expect(NATIVE_SWR_CACHE_BOOTSTRAP_MAX_ENTRIES).toBe(100);
    expect(Object.keys(bootstrapStore)).toHaveLength(
      NATIVE_SWR_CACHE_BOOTSTRAP_MAX_ENTRIES,
    );
    expect(Object.keys(bootstrapStore)).toEqual(
      Array.from(
        { length: NATIVE_SWR_CACHE_BOOTSTRAP_MAX_ENTRIES },
        (_, index) => {
          const entryIndex =
            sourceEntryCount - NATIVE_SWR_CACHE_BOOTSTRAP_MAX_ENTRIES + index;
          return `${
            entryIndex % 2 === 0 ? 'marketHomeTokenList' : 'disHomePage'
          }:entry-${entryIndex}`;
        },
      ),
    );
    expect((snapshotValue as string).length).toBeLessThanOrEqual(
      NATIVE_SWR_CACHE_BOOTSTRAP_MAX_SERIALIZED_CHARS,
    );
    expect(mockSWRCacheCapacityLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        affectedEntryCount: 6,
        maxEntries: NATIVE_SWR_CACHE_BOOTSTRAP_MAX_ENTRIES,
        namespaces: expect.arrayContaining([
          'disHomePage',
          'marketHomeTokenList',
        ]),
        reason: 'bootstrapEntryCountLimit',
      }),
    );
    expect(readPersistedSWRCache()).toEqual(entries);
  });

  it('applies and acknowledges native recovery intent in bg before snapshot', async () => {
    markAppStorageMigrated();
    mockSettingsMMKV.set('onekey_pending_install_task', 'pending');
    mockSettingsMMKV.set('onekey_whats_new_shown', true);
    mockSettingsMMKV.set('unrelated', 'keep');
    mockRecoveryAction = 'auto_repair';
    const { executeNativeStorageRequest } = loadExecutor();

    const snapshot = (await executeNativeStorageRequest({
      scope: 'bootstrap',
    })) as { settings: Array<[string, IScalar]> };

    expect(new Map(snapshot.settings)).toEqual(
      new Map([['unrelated', 'keep']]),
    );
    expect(mockRecoveryAction).toBeUndefined();
    expect(mockAcknowledgeRecoveryAction).toHaveBeenCalledWith('auto_repair');
  });

  it('exposes recovery as an early bg startup barrier', async () => {
    mockSettingsMMKV.set('last_valid_server_time', 123);
    mockSettingsMMKV.set('unrelated', 'keep');
    mockRecoveryAction = 'auto_repair';
    const { prepareNativeStorageForBackgroundStartup } = loadExecutor();

    await prepareNativeStorageForBackgroundStartup();

    expect(
      mockSettingsMMKV.getNumber('last_valid_server_time'),
    ).toBeUndefined();
    expect(mockSettingsMMKV.getString('unrelated')).toBe('keep');
    expect(mockAcknowledgeRecoveryAction).toHaveBeenCalledWith('auto_repair');
  });

  it('deduplicates a main mutation replay after its RPC response times out', async () => {
    const setSpy = jest.spyOn(mockSettingsMMKV, 'set');
    const { executeNativeStorageRequest } = loadExecutor();
    const request = {
      scope: 'syncStorage' as const,
      operation: 'set' as const,
      store: 'settings' as const,
      key: 'setting',
      value: true,
      sourceMutationId: 1,
      sourceRuntimeId: 'main-runtime-1',
    };

    const firstResult = await executeNativeStorageRequest(request);
    const replayResult = await executeNativeStorageRequest(request);

    expect(replayResult).toEqual(firstResult);
    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(
      nativeStorageGlobal.__onekeyNativeSyncStorageBroadcast,
    ).not.toHaveBeenCalled();
    setSpy.mockRestore();
  });

  it('masks native storage in bg without mutating physical stores', async () => {
    mockAppMMKV.set('business-key', 'persisted');
    mockSettingsMMKV.set('setting', true);
    const { executeNativeStorageRequest } = loadExecutor();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { travelModeManager } =
      require('../travelMode') as typeof import('../travelMode');
    const beginSpy = jest
      .spyOn(travelModeManager, 'beginProtectedOperation')
      .mockResolvedValue(undefined);
    const bootstrapSpy = jest
      .spyOn(travelModeManager, 'getBootstrapControlValue')
      .mockResolvedValue(
        JSON.stringify({
          enabled: true,
          verifyString: '|VS|verifier',
          version: 1,
        }),
      );

    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: 'business-key',
      }),
    ).resolves.toBeNull();
    await executeNativeStorageRequest({
      scope: 'asyncStorage',
      operation: 'setItem',
      key: 'business-key',
      value: 'changed',
    });
    const snapshot = (await executeNativeStorageRequest({
      scope: 'bootstrap',
    })) as { settings: Array<[string, IScalar]> };

    expect(mockAppMMKV.getString('business-key')).toBe('persisted');
    expect(mockSettingsMMKV.getBoolean('setting')).toBe(true);
    expect(snapshot.settings).toEqual([
      [
        'onekey_travel_mode_control_v1',
        JSON.stringify({
          enabled: true,
          verifyString: '|VS|verifier',
          version: 1,
        }),
      ],
    ]);

    beginSpy.mockRestore();
    bootstrapSpy.mockRestore();
  });

  it('holds the Travel Mode permit until async native work settles', async () => {
    markAppStorageMigrated();
    let releaseSync: (() => void) | undefined;
    let signalSyncStarted: (() => void) | undefined;
    const syncStarted = new Promise<void>((resolve) => {
      signalSyncStarted = resolve;
    });
    mockSyncNativeStorageMMKV.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          signalSyncStarted?.();
          releaseSync = () => resolve(undefined);
        }),
    );
    const { executeNativeStorageRequest } = loadExecutor();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { travelModeManager } =
      require('../travelMode') as typeof import('../travelMode');
    const releasePermit = jest.fn();
    const beginSpy = jest
      .spyOn(travelModeManager, 'beginProtectedOperation')
      .mockResolvedValue(releasePermit);

    const request = executeNativeStorageRequest({
      scope: 'syncStorage',
      operation: 'set',
      store: 'settings',
      key: 'setting',
      value: true,
      sourceMutationId: 1,
      sourceRuntimeId: 'main-runtime',
    });
    await syncStarted;

    expect(releasePermit).not.toHaveBeenCalled();
    releaseSync?.();
    await request;
    expect(releasePermit).toHaveBeenCalledTimes(1);
    beginSpy.mockRestore();
  });

  it('bounds replay acknowledgements retained across main runtime restarts', async () => {
    const setSpy = jest.spyOn(mockSettingsMMKV, 'set');
    const { executeNativeStorageRequest } = loadExecutor();
    const requests = Array.from({ length: 33 }, (_, index) => ({
      scope: 'syncStorage' as const,
      operation: 'set' as const,
      store: 'settings' as const,
      key: `setting-${index}`,
      value: true,
      sourceMutationId: 1,
      sourceRuntimeId: `main-runtime-${index}`,
    }));

    for (const request of requests) {
      await executeNativeStorageRequest(request);
    }
    expect(setSpy).toHaveBeenCalledTimes(33);

    await executeNativeStorageRequest(requests[0]);
    expect(setSpy).toHaveBeenCalledTimes(34);
    await executeNativeStorageRequest(requests[requests.length - 1]);
    expect(setSpy).toHaveBeenCalledTimes(34);
    setSpy.mockRestore();
  });
});
