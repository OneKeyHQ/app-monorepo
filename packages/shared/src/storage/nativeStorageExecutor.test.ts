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
jest.mock('./legacyAsyncStorageMigration', () => ({
  getLegacyAsyncStorageForMigration: () => mockLegacyStorage,
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
  mockAppMMKV.set(LEGACY_CLEANUP_KEY, '1');
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
    mockMigrationLedger.clear();
    mockRecoveryAction = undefined;
    mockLegacyStorage.getAllKeys.mockImplementation(async () => [
      ...mockLegacyData.keys(),
    ]);
    mockLegacyStorage.multiGet.mockImplementation(async (keys: string[]) =>
      keys.map(
        (key) =>
          [key, mockLegacyData.get(key) ?? null] as [string, string | null],
      ),
    );
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
    expect(mockAppMMKV.getString(LEGACY_CLEANUP_KEY)).toBe('1');
    expect(mockMigrationLedger.get('app-storage-v1')).toBe('complete-v1');
    expect(mockLegacyData.has('business-key')).toBe(false);
    expect(mockLegacyData.get('g_states_v5:settingsPersistAtom')).toBe(
      'jotai-value',
    );
    expect(mockSyncNativeStorageMMKV.mock.invocationCallOrder[0]).toBeLessThan(
      mockLegacyStorage.multiRemove.mock.invocationCallOrder[0],
    );
    expect(
      mockAppMMKV.getString('app:g_states_v5:settingsPersistAtom'),
    ).toBeUndefined();
  });

  it('does not publish a marker on failure and retries from an empty namespace', async () => {
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
    ).rejects.toThrow('disk error');
    expect(mockAppMMKV.getString(MIGRATION_KEY)).toBeUndefined();
    expect(mockMigrationLedger.get('app-storage-v1')).toBe('migrating-v1');

    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: 'key',
      }),
    ).resolves.toBe('fresh');
    expect(mockAppMMKV.getString('app:key')).toBe('fresh');
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
    expect(mockLegacyStorage.getAllKeys).toHaveBeenCalledTimes(2);
    expect(mockLegacyStorage.multiGet).not.toHaveBeenCalled();
    expect(mockLegacyData.size).toBe(0);
    expect(mockAppMMKV.getString(LEGACY_CLEANUP_KEY)).toBe('1');
    expect(mockMigrationLedger.get('app-storage-v1')).toBe('complete-v1');
  });

  it('checks free disk before clearing or copying legacy data', async () => {
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
    ).rejects.toThrow('Not enough free device storage');
    expect(mockAppMMKV.getString('app:key')).toBe('untouched-partial');
    expect(mockLegacyStorage.getAllKeys).not.toHaveBeenCalled();
  });

  it('fails closed when legacy multiGet omits a requested key', async () => {
    const sensitiveLookingKey = 'session:user-secret-shaped-key';
    mockLegacyData.set(sensitiveLookingKey, 'value');
    mockLegacyStorage.multiGet.mockResolvedValueOnce([]);
    const { executeNativeStorageRequest } = loadExecutor();

    const error = await executeNativeStorageRequest({
      scope: 'asyncStorage',
      operation: 'getItem',
      key: sensitiveLookingKey,
    }).catch((reason: unknown) => reason as Error);
    expect(error).toBeInstanceOf(Error);
    const errorMessage = (error as Error).message;
    expect(errorMessage).toContain('incomplete batch at index=0');
    expect(errorMessage).not.toContain(sensitiveLookingKey);
    expect(mockAppMMKV.getString(MIGRATION_KEY)).toBeUndefined();
  });

  it('skips an unreadable legacy key while migrating readable entries', async () => {
    mockLegacyData.set('readable', 'value');
    mockLegacyData.set('unreadable', 'stale-placeholder');
    mockLegacyStorage.multiGet.mockResolvedValueOnce([
      ['readable', 'value'],
      ['unreadable', null],
    ]);
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
    expect(mockAppMMKV.getString(LEGACY_CLEANUP_KEY)).toBe('1');
    expect(mockMigrationLedger.get('app-storage-v1')).toBe('complete-v1');
    expect(mockLegacyData.size).toBe(0);
    expect(mockNativeMigrationLog).toHaveBeenCalledWith(
      'info',
      expect.stringContaining('skippedUnreadableKeyCount=1'),
    );
  });

  it('never opens legacy storage after migration and cleanup are complete', async () => {
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

  it('cleans legacy data retained by an already migrated build', async () => {
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

    expect(mockLegacyData.has('key')).toBe(false);
    expect(mockLegacyData.get('g_states_v5:aAtom')).toBe(
      'keep-for-jotai-cleanup',
    );
    expect(mockAppMMKV.getString(LEGACY_CLEANUP_KEY)).toBe('1');
    expect(mockLegacyStorage.multiGet).not.toHaveBeenCalled();
  });

  it('retries legacy cleanup without recopying verified MMKV data', async () => {
    mockLegacyData.set('key', 'legacy-value');
    mockLegacyStorage.multiRemove.mockRejectedValueOnce(
      new Error('legacy cleanup interrupted'),
    );
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
    expect(mockMigrationLedger.get('app-storage-v1')).toBe('complete-v1');
    expect(mockNativeMigrationLog).toHaveBeenCalledWith(
      'info',
      expect.stringContaining('legacy app-storage cleanup deferred'),
    );

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
    expect(mockLegacyData.has('key')).toBe(false);
    expect(mockAppMMKV.getString(LEGACY_CLEANUP_KEY)).toBe('1');
    expect(mockMigrationLedger.get('app-storage-v1')).toBe('complete-v1');
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

  it('resets an inconsistent app-storage target without restoring stale legacy data', async () => {
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
    expect(mockLegacyData.size).toBe(0);
    expect(mockAppMMKV.getAllKeys()).toEqual([
      MIGRATION_KEY,
      LEGACY_CLEANUP_KEY,
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

  it('finishes an interrupted app-storage reset before serving business reads', async () => {
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
    expect(mockLegacyData.size).toBe(0);
    expect(mockAppMMKV.getAllKeys()).toEqual([
      MIGRATION_KEY,
      LEGACY_CLEANUP_KEY,
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
      LEGACY_CLEANUP_KEY,
    ]);
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
