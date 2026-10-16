/* eslint-disable @typescript-eslint/no-unsafe-call, onekey/no-raw-error */

import { NATIVE_STORAGE_RECOVERY_TEST_LEGACY_KEY_PREFIX } from './nativeStorageRecoveryTestTypes';

import type {
  INativeAppStorageRepairSummary,
  INativeAsyncStorageRequest,
} from './nativeStorageTypes';

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
const mockNativeModule = {
  getMigrationLedger: jest.fn(
    async (key: string) => mockMigrationLedger.get(key) ?? null,
  ),
  setMigrationLedger: jest.fn(async (key: string, value: string) => {
    if (!['complete-v1', 'migrating-v1', 'resetting-v1'].includes(value)) {
      throw new Error('Unsupported migration ledger entry');
    }
    if (value === 'complete-v1') return mockSetMigrationLedgerComplete(key);
    return mockSetMigrationLedger(key, value);
  }),
  syncMMKV: mockSyncNativeStorageMMKV,
  getMigrationStorageCapacity: mockGetMigrationStorageCapacity,
  peekRecoveryAction: jest.fn(async () => mockRecoveryAction),
  acknowledgeRecoveryAction: mockAcknowledgeRecoveryAction,
  readLegacyAsyncStorageValue: jest.fn(
    async (key: string) => mockLegacyData.get(key) ?? null,
  ),
  setTravelModePushSuppressed: jest.fn(async () => undefined),
};

// Exercise the unchanged JS bridge against only the previously shipped APIs.
jest.mock('react-native', () => ({
  NativeModules: { OneKeyNativeStorageMigration: mockNativeModule },
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
jest.mock('./instance/appStorageMMKVInstance', () => {
  return { __esModule: true, default: mockAppMMKV };
});
jest.mock('./instance/mmkvStorageInstance', () => {
  return { __esModule: true, default: mockSettingsMMKV };
});
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
const REPAIR_JOURNAL_BACKUP_PREFIX =
  '__onekey_internal_app_storage_repair_journal_backup_v1__:';
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
    mockSyncNativeStorageMMKV.mockReset();
    mockSyncNativeStorageMMKV.mockResolvedValue(undefined);
    nativeStorageGlobal.__onekeyNativeSyncStorageBroadcast = jest.fn(
      () => true,
    );
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(['ledger read failure', 'inapplicable ledger'])(
    'releases the repair guard after %s',
    async (failure) => {
      markAppStorageMigrated();
      mockAppMMKV.set('app:healthy', 'current');
      if (failure === 'ledger read failure')
        mockNativeModule.getMigrationLedger.mockRejectedValueOnce(
          new Error('ledger unavailable'),
        );
      else mockMigrationLedger.set('app-storage-v1', 'migrating-v1');
      const { executeNativeStorageRequest } = loadExecutor();
      await expect(
        executeNativeStorageRequest({
          scope: 'recovery',
          operation: 'prepareMigrationRepair',
          target: 'appStorage',
        }),
      ).rejects.toThrow();
      mockMigrationLedger.set('app-storage-v1', 'complete-v1');
      await expect(
        executeNativeStorageRequest({
          scope: 'asyncStorage',
          operation: 'getItem',
          key: 'healthy',
        }),
      ).resolves.toBe('current');
    },
  );

  it('preserves an unreadable current value during preparation and requires rescan if it becomes readable', async () => {
    mockMigrationLedger.set('app-storage-v1', 'complete-v1');
    mockLegacyData.set('newer', 'stale-legacy');
    mockLegacyData.set('later', 'recover-later');
    mockAppMMKV.set('app:newer', 'newer-current');
    const get = mockAppMMKV.getString.bind(mockAppMMKV);
    const read = jest
      .spyOn(mockAppMMKV, 'getString')
      .mockImplementation((key) => {
        if (key === 'app:newer') throw new Error('temporary read failure');
        return get(key);
      });
    const originalSet = mockAppMMKV.set.bind(mockAppMMKV);
    const set = jest
      .spyOn(mockAppMMKV, 'set')
      .mockImplementation((key, value) => {
        if (key === 'app:newer') throw new Error('copy write failure');
        originalSet(key, value);
      });
    const remove = jest.spyOn(mockAppMMKV, 'remove');
    const { executeNativeStorageRequest } = loadExecutor();
    const summary = (await executeNativeStorageRequest({
      scope: 'recovery',
      operation: 'prepareMigrationRepair',
      target: 'appStorage',
    })) as INativeAppStorageRepairSummary;
    expect(summary).toMatchObject({ successfulCount: 1, failedCount: 1 });
    expect(mockAppMMKV.values.get('app:newer')).toBe('newer-current');
    expect(set.mock.calls.some(([key]) => key === 'app:newer')).toBe(false);
    expect(remove).not.toHaveBeenCalledWith('app:newer');
    expect(get('app:later')).toBe('recover-later');
    read.mockImplementation(get);
    await expect(
      executeNativeStorageRequest({
        scope: 'recovery',
        operation: 'completeMigrationRepair',
        target: 'appStorage',
        repairId: summary.repairId,
        force: true,
      }),
    ).rejects.toThrow('results changed');
    expect(get('app:newer')).toBe('newer-current');
    expect(mockLegacyData.get('newer')).toBe('stale-legacy');
    const nextSummary = (await executeNativeStorageRequest({
      scope: 'recovery',
      operation: 'prepareMigrationRepair',
      target: 'appStorage',
    })) as INativeAppStorageRepairSummary;
    expect(nextSummary).toMatchObject({ failedCount: 0, preservedCount: 2 });
    await executeNativeStorageRequest({
      scope: 'recovery',
      operation: 'completeMigrationRepair',
      target: 'appStorage',
      repairId: nextSummary.repairId,
      force: false,
    });
    expect(get('app:newer')).toBe('newer-current');
  });

  it.each([
    'both',
    'pending only',
    'backup write fails',
    'backup sync fails',
    'backup verification fails',
    'backup already exists',
  ])(
    'preserves unfinished rollback evidence before forced completion: %s',
    async (mode) => {
      const { createNativeAppStorageRepairController } = loadExecutor();
      const target = new FakeMMKV();
      target.set('app:half-applied', 'current-partial');
      if (mode !== 'pending only')
        target.set(BATCH_JOURNAL_KEY, 'disk-rollback-evidence');
      let pending: string | undefined = 'heap-rollback-evidence';
      const clearPending = jest.fn(() => {
        pending = undefined;
      });
      const sync = jest.fn(async () => {
        if (mode === 'backup sync fails') throw new Error('backup sync failed');
      });
      const controller = createNativeAppStorageRepairController({
        getMMKV: () => target,
        getLedger: async () => 'complete-v1',
        getLegacy: () => ({
          ...mockLegacyStorage,
          multiSet: async () => undefined,
          reloadManifest: async () => undefined,
        }),
        sync,
        recoverJournal: async () => {
          throw new Error('rollback failed');
        },
        getPendingRecovery: () => pending,
        completeLedger: async () => undefined,
        log: () => {},
        onPrepare: () => {},
        onComplete: () => {},
        clearPendingRecovery: clearPending,
      });
      const prepared = await controller.prepare();
      expect(prepared.scanComplete).toBe(false);
      const key = REPAIR_JOURNAL_BACKUP_PREFIX + prepared.repairId;
      if (mode === 'backup write fails') target.failOnSetKey = key;
      if (mode === 'backup already exists') target.set(key, 'previous-archive');
      if (mode === 'backup verification fails') {
        const get = target.getString.bind(target);
        jest
          .spyOn(target, 'getString')
          .mockImplementation((input) =>
            input === key ? undefined : get(input),
          );
      }
      if (mode.includes('fails') || mode === 'backup already exists') {
        await expect(
          controller.complete(prepared.repairId, true),
        ).rejects.toThrow();
        expect(target.values.get(BATCH_JOURNAL_KEY)).toBe(
          'disk-rollback-evidence',
        );
        expect(pending).toBe('heap-rollback-evidence');
        expect(clearPending).not.toHaveBeenCalled();
        expect(target.getString(MIGRATION_KEY)).toBeUndefined();
        if (mode === 'backup already exists')
          expect(target.getString(key)).toBe('previous-archive');
      } else {
        await controller.complete(prepared.repairId, true);
        expect(JSON.parse(target.getString(key) ?? '')).toEqual({
          version: 1,
          ...(mode === 'both' ? { journal: 'disk-rollback-evidence' } : {}),
          pendingRecovery: 'heap-rollback-evidence',
        });
        expect(sync).toHaveBeenCalled();
        expect(target.getString(BATCH_JOURNAL_KEY)).toBeUndefined();
        expect(pending).toBeUndefined();
        expect(target.getString(MIGRATION_KEY)).toBe('1');
      }
    },
  );

  it('keeps rollback archives out of normal reads and removes them only on explicit app clear', async () => {
    markAppStorageMigrated();
    const key = `${REPAIR_JOURNAL_BACKUP_PREFIX}historical-attempt`;
    mockAppMMKV.set(key, 'retained-rollback');
    mockAppMMKV.set('app:healthy', 'new-data');
    const { executeNativeStorageRequest } = loadExecutor();
    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getAllKeys',
      }),
    ).resolves.toEqual(['healthy']);
    expect(mockAppMMKV.getString(key)).toBe('retained-rollback');
    await executeNativeStorageRequest({
      scope: 'asyncStorage',
      operation: 'clear',
    });
    expect(mockAppMMKV.getString(key)).toBeUndefined();
  });

  it.each(['rollback write', 'journal deletion sync'])(
    'archives actual interrupted batch recovery after %s fails and does not replay it after restart',
    async (failure) => {
      mockMigrationLedger.set('app-storage-v1', 'complete-v1');
      mockLegacyData.set('source-check', 'legacy-kept');
      const journal = JSON.stringify({
        version: 1,
        previousValues: [
          ['app:first', 'old-one'],
          ['app:second', 'old-two'],
        ],
      });
      mockAppMMKV.set(BATCH_JOURNAL_KEY, journal);
      mockAppMMKV.set('app:first', 'partial-one');
      mockAppMMKV.set('app:second', 'partial-two');
      if (failure === 'rollback write') mockAppMMKV.failOnSetKey = 'app:second';
      else
        mockSyncNativeStorageMMKV
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(new Error('journal deletion sync failed'));
      let { executeNativeStorageRequest } = loadExecutor();
      const prepared = (await executeNativeStorageRequest({
        scope: 'recovery',
        operation: 'prepareMigrationRepair',
        target: 'appStorage',
      })) as INativeAppStorageRepairSummary;
      expect(prepared.scanComplete).toBe(false);
      await executeNativeStorageRequest({
        scope: 'recovery',
        operation: 'completeMigrationRepair',
        target: 'appStorage',
        repairId: prepared.repairId,
        force: true,
      });
      const key = REPAIR_JOURNAL_BACKUP_PREFIX + prepared.repairId;
      expect(JSON.parse(mockAppMMKV.getString(key) ?? '')).toEqual({
        version: 1,
        ...(failure === 'rollback write' ? { journal } : {}),
        pendingRecovery: journal,
      });
      expect(mockLegacyData.get('source-check')).toBe('legacy-kept');
      jest.resetModules();
      ({ executeNativeStorageRequest } = loadExecutor());
      await executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'setItem',
        key: 'second',
        value: 'new-after-repair',
      });
      await expect(
        executeNativeStorageRequest({
          scope: 'asyncStorage',
          operation: 'getItem',
          key: 'second',
        }),
      ).resolves.toBe('new-after-repair');
      expect(mockAppMMKV.getString(key)).toBeDefined();
      expect(mockLegacyStorage.multiRemove).not.toHaveBeenCalled();
    },
  );

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

  it('keeps a healthy native store without clearing values or restoring legacy data', async () => {
    mockMigrationLedger.set('app-storage-v1', 'complete-v1');
    mockAppMMKV.set('app:key', 'current-value');
    mockLegacyData.set('key', 'stale-value');
    mockAppMMKV.set(MIGRATION_KEY, '1');
    const { executeNativeStorageRequest } = loadExecutor();
    await executeNativeStorageRequest({
      scope: 'recovery',
      operation: 'retryMigrationTarget',
      target: 'appStorage',
    });
    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: 'key',
      }),
    ).resolves.toBe('current-value');
    expect(mockLegacyStorage.getAllKeys).not.toHaveBeenCalled();
    expect(mockLegacyData.get('key')).toBe('stale-value');
    expect(mockSetMigrationLedger).not.toHaveBeenCalled();
  });

  it('skips individual read/write failures, preserves newer MMKV values, and confirms partial completion without deleting the source', async () => {
    mockMigrationLedger.set('app-storage-v1', 'complete-v1');
    mockAppMMKV.set('app:current', 'newer');
    mockLegacyData.set('current', 'older');
    mockLegacyData.set('bad-read', 'unreadable');
    mockLegacyData.set('bad-write', 'unwritable');
    mockLegacyData.set('last', 'recover-last');
    const sourceBefore = [...mockLegacyData.entries()];
    mockLegacyStorage.multiGet.mockImplementation(async (keys) => {
      if (keys.includes('bad-read')) throw new Error('read failed');
      return keys.map((key) => [key, mockLegacyData.get(key) ?? null]);
    });
    const originalSet = mockAppMMKV.set.bind(mockAppMMKV);
    jest.spyOn(mockAppMMKV, 'set').mockImplementation((key, value) => {
      if (key === 'app:bad-write') throw new Error('write failed');
      originalSet(key, value);
    });
    const { executeNativeStorageRequest } = loadExecutor();
    const summary = (await executeNativeStorageRequest({
      scope: 'recovery',
      operation: 'prepareMigrationRepair',
      target: 'appStorage',
    })) as INativeAppStorageRepairSummary;
    expect(summary).toMatchObject({
      successfulCount: 2,
      failedCount: 2,
      preservedCount: 1,
      recoveredCount: 1,
      scanComplete: true,
    });
    expect(mockAppMMKV.getString('app:current')).toBe('newer');
    expect(mockAppMMKV.getString('app:last')).toBe('recover-last');
    expect(mockAppMMKV.getString(MIGRATION_KEY)).toBeUndefined();
    expect(mockSetMigrationLedgerComplete).not.toHaveBeenCalled();
    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getAllKeys',
      }),
    ).rejects.toThrow('MMKV migration marker is missing');
    await expect(
      executeNativeStorageRequest({
        scope: 'recovery',
        operation: 'completeMigrationRepair',
        target: 'appStorage',
        repairId: summary.repairId,
        force: false,
      }),
    ).rejects.toThrow('explicit confirmation');
    await executeNativeStorageRequest({
      scope: 'recovery',
      operation: 'completeMigrationRepair',
      target: 'appStorage',
      repairId: summary.repairId,
      force: true,
    });
    expect(mockAppMMKV.getString(MIGRATION_KEY)).toBe('1');
    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getAllKeys',
      }),
    ).resolves.toEqual(['current', 'last']);
    await executeNativeStorageRequest({
      scope: 'asyncStorage',
      operation: 'setItem',
      key: 'after-repair',
      value: 'works',
    });
    expect(mockAppMMKV.getString('app:after-repair')).toBe('works');
    expect([...mockLegacyData.entries()]).toEqual(sourceBefore);
    expect(mockLegacyStorage.multiRemove).not.toHaveBeenCalled();
  });

  it('requires confirmation after complete recovery and invalidates results from earlier attempts', async () => {
    mockMigrationLedger.set('app-storage-v1', 'complete-v1');
    mockLegacyData.set('key', 'backup');
    const { executeNativeStorageRequest } = loadExecutor();
    const prepare = () =>
      executeNativeStorageRequest({
        scope: 'recovery',
        operation: 'prepareMigrationRepair',
        target: 'appStorage',
      }) as Promise<INativeAppStorageRepairSummary>;
    const first = await prepare();
    expect(first).toMatchObject({
      successfulCount: 1,
      failedCount: 0,
      recoveredCount: 1,
      scanComplete: true,
    });
    expect(mockAppMMKV.getString(MIGRATION_KEY)).toBeUndefined();
    const second = await prepare();
    await expect(
      executeNativeStorageRequest({
        scope: 'recovery',
        operation: 'completeMigrationRepair',
        target: 'appStorage',
        repairId: first.repairId,
        force: false,
      }),
    ).rejects.toThrow('expired');
    await executeNativeStorageRequest({
      scope: 'recovery',
      operation: 'completeMigrationRepair',
      target: 'appStorage',
      repairId: second.repairId,
      force: false,
    });
    expect(mockAppMMKV.getString(MIGRATION_KEY)).toBe('1');
    expect(mockLegacyData.get('key')).toBe('backup');
    expect(mockLegacyStorage.multiRemove).not.toHaveBeenCalled();
  });

  it('keeps sandbox attempts independent from the production pending result and access gate', async () => {
    mockMigrationLedger.set('app-storage-v1', 'complete-v1');
    mockLegacyData.set('business', 'production-value');
    const {
      executeNativeStorageRequest,
      createNativeAppStorageRepairController,
    } = loadExecutor();
    const production = (await executeNativeStorageRequest({
      scope: 'recovery',
      operation: 'prepareMigrationRepair',
      target: 'appStorage',
    })) as INativeAppStorageRepairSummary;
    const sandbox = new FakeMMKV();
    const controller = createNativeAppStorageRepairController({
      getMMKV: () => sandbox,
      getLedger: async () => 'complete-v1',
      getLegacy: () => ({
        getAllKeys: async () => ['sandbox'],
        multiGet: async (keys) =>
          keys.map(
            (key) =>
              [key, key === 'sandbox' ? 'sandbox-value' : null] as [
                string,
                string | null,
              ],
          ),
        multiSet: async () => undefined,
        multiRemove: async () => undefined,
        reloadManifest: async () => undefined,
      }),
      sync: async () => undefined,
      recoverJournal: async () => undefined,
      completeLedger: async () => undefined,
      log: () => undefined,
      onPrepare: () => undefined,
      onComplete: () => undefined,
      clearPendingRecovery: () => undefined,
    });
    const fixture = await controller.prepare();
    await controller.complete(fixture.repairId, false);
    expect(sandbox.getString('app:sandbox')).toBe('sandbox-value');
    expect(sandbox.getString('app:business')).toBeUndefined();
    expect(mockAppMMKV.getString('app:sandbox')).toBeUndefined();
    expect(mockAppMMKV.getString(MIGRATION_KEY)).toBeUndefined();
    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: 'business',
      }),
    ).rejects.toThrow('migration marker is missing');
    await executeNativeStorageRequest({
      scope: 'recovery',
      operation: 'completeMigrationRepair',
      target: 'appStorage',
      repairId: production.repairId,
      force: false,
    });
    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: 'business',
      }),
    ).resolves.toBe('production-value');
    expect(mockLegacyStorage.multiRemove).not.toHaveBeenCalled();
  });

  it('labels an unavailable source as an incomplete scan and allows a confirmed empty writable target', async () => {
    mockMigrationLedger.set('app-storage-v1', 'complete-v1');
    mockLegacySourceError = new Error('legacy unavailable');
    const { executeNativeStorageRequest } = loadExecutor();
    const summary = (await executeNativeStorageRequest({
      scope: 'recovery',
      operation: 'prepareMigrationRepair',
      target: 'appStorage',
    })) as INativeAppStorageRepairSummary;
    expect(summary).toMatchObject({
      successfulCount: 0,
      failedCount: 0,
      scanComplete: false,
    });
    await expect(
      executeNativeStorageRequest({
        scope: 'recovery',
        operation: 'completeMigrationRepair',
        target: 'appStorage',
        repairId: summary.repairId,
        force: false,
      }),
    ).rejects.toThrow('explicit confirmation');
    await executeNativeStorageRequest({
      scope: 'recovery',
      operation: 'completeMigrationRepair',
      target: 'appStorage',
      repairId: summary.repairId,
      force: true,
    });
    await executeNativeStorageRequest({
      scope: 'asyncStorage',
      operation: 'setItem',
      key: 'new',
      value: 'works',
    });
    expect(mockAppMMKV.getString('app:new')).toBe('works');
    expect(mockLegacyStorage.multiRemove).not.toHaveBeenCalled();
  });

  it('allows forced completion when every legacy record fails, retaining all source records', async () => {
    mockMigrationLedger.set('app-storage-v1', 'complete-v1');
    mockLegacyData.set('bad', 'keep-original');
    mockLegacyStorage.multiGet.mockImplementation(async (keys) => {
      if (keys.includes('bad')) throw new Error('record unreadable');
      return keys.map((key) => [key, null]);
    });
    const { executeNativeStorageRequest } = loadExecutor();
    const summary = (await executeNativeStorageRequest({
      scope: 'recovery',
      operation: 'prepareMigrationRepair',
      target: 'appStorage',
    })) as INativeAppStorageRepairSummary;
    expect(summary).toMatchObject({
      successfulCount: 0,
      failedCount: 1,
      scanComplete: true,
    });
    await executeNativeStorageRequest({
      scope: 'recovery',
      operation: 'completeMigrationRepair',
      target: 'appStorage',
      repairId: summary.repairId,
      force: true,
    });
    await expect(
      executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getAllKeys',
      }),
    ).resolves.toEqual([]);
    expect(mockLegacyData.get('bad')).toBe('keep-original');
  });

  it('does not auto-complete an interrupted repair after bg restarts', async () => {
    mockMigrationLedger.set('app-storage-v1', 'complete-v1');
    mockLegacyData.set('key', 'backup');
    const firstExecutor = loadExecutor();
    await firstExecutor.executeNativeStorageRequest({
      scope: 'recovery',
      operation: 'prepareMigrationRepair',
      target: 'appStorage',
    });
    jest.resetModules();
    const restartedExecutor = loadExecutor();
    await expect(
      restartedExecutor.executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getAllKeys',
      }),
    ).rejects.toThrow('MMKV migration marker is missing');
    expect(mockAppMMKV.getString(MIGRATION_KEY)).toBeUndefined();
    expect(mockLegacyData.get('key')).toBe('backup');
  });

  it('does not bypass a durability failure during forced completion', async () => {
    mockMigrationLedger.set('app-storage-v1', 'complete-v1');
    mockLegacyData.set('key', 'backup');
    const { executeNativeStorageRequest } = loadExecutor();
    const summary = (await executeNativeStorageRequest({
      scope: 'recovery',
      operation: 'prepareMigrationRepair',
      target: 'appStorage',
    })) as INativeAppStorageRepairSummary;
    mockSyncNativeStorageMMKV.mockRejectedValueOnce(
      new Error('disk unavailable'),
    );
    await expect(
      executeNativeStorageRequest({
        scope: 'recovery',
        operation: 'completeMigrationRepair',
        target: 'appStorage',
        repairId: summary.repairId,
        force: true,
      }),
    ).rejects.toThrow('disk unavailable');
    expect(mockSetMigrationLedgerComplete).not.toHaveBeenCalled();
    expect(mockAppMMKV.getString(MIGRATION_KEY)).toBeUndefined();
    expect(mockLegacyData.get('key')).toBe('backup');
    expect(mockLegacyStorage.multiRemove).not.toHaveBeenCalled();
  });

  it.each(['sync', 'ledger'])(
    'preserves an existing healthy marker when finalization fails at %s',
    async (stage) => {
      mockMigrationLedger.set('app-storage-v1', 'complete-v1');
      mockAppMMKV.set('app:current', 'latest');
      mockLegacyData.set('deleted', 'stale');
      mockAppMMKV.set(MIGRATION_KEY, '1');
      const { executeNativeStorageRequest } = loadExecutor();
      const summary = (await executeNativeStorageRequest({
        scope: 'recovery',
        operation: 'prepareMigrationRepair',
        target: 'appStorage',
      })) as INativeAppStorageRepairSummary;
      expect(summary).toMatchObject({ successfulCount: 1, recoveredCount: 0 });
      expect(mockLegacyStorage.multiGet).not.toHaveBeenCalled();
      const failure = new Error(`finalization ${stage} failed`);
      if (stage === 'sync')
        mockSyncNativeStorageMMKV.mockRejectedValueOnce(failure);
      else mockSetMigrationLedgerComplete.mockRejectedValueOnce(failure);
      await expect(
        executeNativeStorageRequest({
          scope: 'recovery',
          operation: 'completeMigrationRepair',
          target: 'appStorage',
          repairId: summary.repairId,
          force: false,
        }),
      ).rejects.toThrow(failure.message);
      expect(mockAppMMKV.getString(MIGRATION_KEY)).toBe('1');
      jest.resetModules();
      const restarted = loadExecutor();
      await expect(
        restarted.executeNativeStorageRequest({
          scope: 'asyncStorage',
          operation: 'getItem',
          key: 'current',
        }),
      ).resolves.toBe('latest');
      await expect(
        restarted.executeNativeStorageRequest({
          scope: 'asyncStorage',
          operation: 'getItem',
          key: 'deleted',
        }),
      ).resolves.toBeNull();
      expect(mockLegacyData.get('deleted')).toBe('stale');
      expect(mockLegacyStorage.multiGet).not.toHaveBeenCalled();
    },
  );

  it.each(['sync', 'ledger'])(
    'rolls back its newly published marker after final %s failure',
    async (stage) => {
      mockMigrationLedger.set('app-storage-v1', 'complete-v1');
      mockLegacyData.set('key', 'backup');
      const { executeNativeStorageRequest } = loadExecutor();
      const summary = (await executeNativeStorageRequest({
        scope: 'recovery',
        operation: 'prepareMigrationRepair',
        target: 'appStorage',
      })) as INativeAppStorageRepairSummary;
      const failure = new Error('final persistence failed');
      if (stage === 'sync') {
        mockSyncNativeStorageMMKV
          .mockResolvedValueOnce(undefined)
          .mockRejectedValueOnce(failure);
      } else mockSetMigrationLedgerComplete.mockRejectedValueOnce(failure);
      await expect(
        executeNativeStorageRequest({
          scope: 'recovery',
          operation: 'completeMigrationRepair',
          target: 'appStorage',
          repairId: summary.repairId,
          force: false,
        }),
      ).rejects.toThrow(failure.message);
      expect(mockAppMMKV.getString(MIGRATION_KEY)).toBeUndefined();
      expect(mockLegacyData.get('key')).toBe('backup');
    },
  );

  it.each([false, true])(
    'excludes synthetic legacy records from production storage with manual repair=%s',
    async (manualRepair) => {
      const testKey = `${NATIVE_STORAGE_RECOVERY_TEST_LEGACY_KEY_PREFIX}test:01-current`;
      mockLegacyData.set(testKey, 'synthetic-value');
      mockLegacyData.set('real-key', 'real-value');
      if (manualRepair) {
        mockMigrationLedger.set('app-storage-v1', 'complete-v1');
      }
      const { executeNativeStorageRequest } = loadExecutor();
      if (manualRepair) {
        const summary = (await executeNativeStorageRequest({
          scope: 'recovery',
          operation: 'prepareMigrationRepair',
          target: 'appStorage',
        })) as INativeAppStorageRepairSummary;
        expect(summary).toMatchObject({ successfulCount: 1, failedCount: 0 });
        await executeNativeStorageRequest({
          scope: 'recovery',
          operation: 'completeMigrationRepair',
          target: 'appStorage',
          repairId: summary.repairId,
          force: false,
        });
      }
      await expect(
        executeNativeStorageRequest({
          scope: 'asyncStorage',
          operation: 'getAllKeys',
        }),
      ).resolves.toEqual(['real-key']);
      expect(mockAppMMKV.getString(`app:${testKey}`)).toBeUndefined();
      expect(mockLegacyData.get(testKey)).toBe('synthetic-value');
    },
  );

  it('rejects newly discovered records before removing any failed records during forced completion', async () => {
    mockMigrationLedger.set('app-storage-v1', 'complete-v1');
    mockAppMMKV.set('app:invalid', 42);
    mockAppMMKV.set('app:valid', 'current');
    const { executeNativeStorageRequest } = loadExecutor();
    const summary = (await executeNativeStorageRequest({
      scope: 'recovery',
      operation: 'prepareMigrationRepair',
      target: 'appStorage',
    })) as INativeAppStorageRepairSummary;
    mockAppMMKV.set('app:late', 'new-current');
    await expect(
      executeNativeStorageRequest({
        scope: 'recovery',
        operation: 'completeMigrationRepair',
        target: 'appStorage',
        repairId: summary.repairId,
        force: true,
      }),
    ).rejects.toThrow('results changed');
    expect(mockAppMMKV.getString('app:late')).toBe('new-current');
    expect(mockAppMMKV.getNumber('app:invalid')).toBe(42);
    expect(mockAppMMKV.getString(MIGRATION_KEY)).toBeUndefined();
    const freshSummary = (await executeNativeStorageRequest({
      scope: 'recovery',
      operation: 'prepareMigrationRepair',
      target: 'appStorage',
    })) as INativeAppStorageRepairSummary;
    expect(freshSummary).toMatchObject({ successfulCount: 2, failedCount: 1 });
    await executeNativeStorageRequest({
      scope: 'recovery',
      operation: 'completeMigrationRepair',
      target: 'appStorage',
      repairId: freshSummary.repairId,
      force: true,
    });
    expect(mockAppMMKV.getString('app:late')).toBe('new-current');
    expect(mockAppMMKV.getNumber('app:invalid')).toBeUndefined();
  });

  it.each(['absent', 'unreadable'] as const)(
    'preserves a failed %s record that becomes readable before forced completion',
    async (initialState) => {
      mockMigrationLedger.set('app-storage-v1', 'complete-v1');
      mockAppMMKV.set('app:still-invalid', 42);
      mockAppMMKV.set('app:valid', 'current');
      mockLegacyData.set('failed', 'old-backup');
      mockLegacyStorage.multiGet.mockImplementation(async (keys) => {
        if (keys.includes('failed')) throw new Error('source read failed');
        return keys.map((key) => [key, mockLegacyData.get(key) ?? null]);
      });
      let readable = initialState !== 'unreadable';
      if (initialState === 'unreadable') {
        mockAppMMKV.set('app:failed', 'latest-current');
        const originalGet = mockAppMMKV.getString.bind(mockAppMMKV);
        jest.spyOn(mockAppMMKV, 'getString').mockImplementation((key) => {
          if (key === 'app:failed' && !readable) {
            throw new Error('target read failed');
          }
          return originalGet(key);
        });
      }
      const { executeNativeStorageRequest } = loadExecutor();
      const summary = (await executeNativeStorageRequest({
        scope: 'recovery',
        operation: 'prepareMigrationRepair',
        target: 'appStorage',
      })) as INativeAppStorageRepairSummary;
      expect(summary).toMatchObject({ successfulCount: 1, failedCount: 2 });
      readable = true;
      if (initialState === 'absent')
        mockAppMMKV.set('app:failed', 'latest-current');
      await expect(
        executeNativeStorageRequest({
          scope: 'recovery',
          operation: 'completeMigrationRepair',
          target: 'appStorage',
          repairId: summary.repairId,
          force: true,
        }),
      ).rejects.toThrow('results changed');
      expect(mockAppMMKV.getString('app:failed')).toBe('latest-current');
      expect(mockAppMMKV.getNumber('app:still-invalid')).toBe(42);
      expect(mockAppMMKV.getString(MIGRATION_KEY)).toBeUndefined();
      expect(mockLegacyData.get('failed')).toBe('old-backup');
      const freshSummary = (await executeNativeStorageRequest({
        scope: 'recovery',
        operation: 'prepareMigrationRepair',
        target: 'appStorage',
      })) as INativeAppStorageRepairSummary;
      expect(freshSummary).toMatchObject({
        successfulCount: 2,
        failedCount: 1,
      });
      await executeNativeStorageRequest({
        scope: 'recovery',
        operation: 'completeMigrationRepair',
        target: 'appStorage',
        repairId: freshSummary.repairId,
        force: true,
      });
      expect(mockAppMMKV.getString('app:failed')).toBe('latest-current');
      expect(mockAppMMKV.getNumber('app:still-invalid')).toBeUndefined();
      expect(mockLegacyStorage.multiRemove).not.toHaveBeenCalled();
    },
  );

  it.each([false, true])(
    'only removes an unchanged failed partial write with changed=%s',
    async (changed) => {
      mockMigrationLedger.set('app-storage-v1', 'complete-v1');
      mockAppMMKV.set('app:valid', 'current');
      mockLegacyData.set('failed', 'expected-backup');
      const originalSet = mockAppMMKV.set.bind(mockAppMMKV);
      jest.spyOn(mockAppMMKV, 'set').mockImplementation((key, value) => {
        originalSet(key, key === 'app:failed' ? 'invalid-partial' : value);
      });
      const { executeNativeStorageRequest } = loadExecutor();
      const summary = (await executeNativeStorageRequest({
        scope: 'recovery',
        operation: 'prepareMigrationRepair',
        target: 'appStorage',
      })) as INativeAppStorageRepairSummary;
      expect(summary).toMatchObject({ successfulCount: 1, failedCount: 1 });
      if (changed) originalSet('app:failed', 'latest-current');
      const completion = executeNativeStorageRequest({
        scope: 'recovery',
        operation: 'completeMigrationRepair',
        target: 'appStorage',
        repairId: summary.repairId,
        force: true,
      });
      if (changed) {
        await expect(completion).rejects.toThrow('results changed');
        expect(mockAppMMKV.getString('app:failed')).toBe('latest-current');
        expect(mockAppMMKV.getString(MIGRATION_KEY)).toBeUndefined();
      } else {
        await completion;
        expect(mockAppMMKV.getString('app:failed')).toBeUndefined();
        expect(mockAppMMKV.getString(MIGRATION_KEY)).toBe('1');
      }
      expect(mockAppMMKV.getString('app:valid')).toBe('current');
      expect(mockLegacyData.get('failed')).toBe('expected-backup');
      expect(mockLegacyStorage.multiRemove).not.toHaveBeenCalled();
    },
  );

  it('blocks a previously marked store when forced deletion fails finalization', async () => {
    mockMigrationLedger.set('app-storage-v1', 'complete-v1');
    mockAppMMKV.set(MIGRATION_KEY, '1');
    mockAppMMKV.set('app:invalid', 42);
    mockAppMMKV.set('app:valid', 'current');
    const { executeNativeStorageRequest } = loadExecutor();
    const summary = (await executeNativeStorageRequest({
      scope: 'recovery',
      operation: 'prepareMigrationRepair',
      target: 'appStorage',
    })) as INativeAppStorageRepairSummary;
    mockSyncNativeStorageMMKV.mockRejectedValueOnce(new Error('sync failed'));
    await expect(
      executeNativeStorageRequest({
        scope: 'recovery',
        operation: 'completeMigrationRepair',
        target: 'appStorage',
        repairId: summary.repairId,
        force: true,
      }),
    ).rejects.toThrow('sync failed');
    expect(mockAppMMKV.getString('app:valid')).toBe('current');
    expect(mockAppMMKV.getString(MIGRATION_KEY)).toBeUndefined();
    jest.resetModules();
    const restarted = loadExecutor();
    await expect(
      restarted.executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'getItem',
        key: 'valid',
      }),
    ).rejects.toThrow('MMKV migration marker is missing');
  });

  it('rejects changed results before finalization instead of publishing misleading counts', async () => {
    mockMigrationLedger.set('app-storage-v1', 'complete-v1');
    mockLegacyData.set('key', 'backup');
    const { executeNativeStorageRequest } = loadExecutor();
    const summary = (await executeNativeStorageRequest({
      scope: 'recovery',
      operation: 'prepareMigrationRepair',
      target: 'appStorage',
    })) as INativeAppStorageRepairSummary;
    mockAppMMKV.remove('app:key');
    await expect(
      executeNativeStorageRequest({
        scope: 'recovery',
        operation: 'completeMigrationRepair',
        target: 'appStorage',
        repairId: summary.repairId,
        force: true,
      }),
    ).rejects.toThrow('results changed');
    expect(mockAppMMKV.getString(MIGRATION_KEY)).toBeUndefined();
    expect(mockLegacyData.get('key')).toBe('backup');
  });

  it('detects changed values before finalization even when the set of keys is unchanged', async () => {
    mockMigrationLedger.set('app-storage-v1', 'complete-v1');
    mockLegacyData.set('key', 'backup');
    const { executeNativeStorageRequest } = loadExecutor();
    const summary = (await executeNativeStorageRequest({
      scope: 'recovery',
      operation: 'prepareMigrationRepair',
      target: 'appStorage',
    })) as INativeAppStorageRepairSummary;
    mockAppMMKV.set('app:key', 'changed');
    await expect(
      executeNativeStorageRequest({
        scope: 'recovery',
        operation: 'completeMigrationRepair',
        target: 'appStorage',
        repairId: summary.repairId,
        force: true,
      }),
    ).rejects.toThrow('record verification failed');
    expect(mockAppMMKV.getString(MIGRATION_KEY)).toBeUndefined();
    expect(mockLegacyData.get('key')).toBe('backup');
  });

  it('removes an unrecoverable target record only on forced confirmation and preserves verified records', async () => {
    mockMigrationLedger.set('app-storage-v1', 'complete-v1');
    mockAppMMKV.set('app:invalid', 42);
    mockAppMMKV.set('app:valid', 'current');
    const { executeNativeStorageRequest } = loadExecutor();
    const summary = (await executeNativeStorageRequest({
      scope: 'recovery',
      operation: 'prepareMigrationRepair',
      target: 'appStorage',
    })) as INativeAppStorageRepairSummary;
    expect(summary).toMatchObject({
      successfulCount: 1,
      failedCount: 1,
      scanComplete: true,
    });
    expect(mockAppMMKV.getNumber('app:invalid')).toBe(42);
    await executeNativeStorageRequest({
      scope: 'recovery',
      operation: 'completeMigrationRepair',
      target: 'appStorage',
      repairId: summary.repairId,
      force: true,
    });
    expect(mockAppMMKV.getNumber('app:invalid')).toBeUndefined();
    expect(mockAppMMKV.getString('app:valid')).toBe('current');
    expect(mockLegacyStorage.multiRemove).not.toHaveBeenCalled();
  });

  it('cannot force completion if the target refuses to remove failed records', async () => {
    mockMigrationLedger.set('app-storage-v1', 'complete-v1');
    mockAppMMKV.set('app:invalid', 42);
    const { executeNativeStorageRequest } = loadExecutor();
    const summary = (await executeNativeStorageRequest({
      scope: 'recovery',
      operation: 'prepareMigrationRepair',
      target: 'appStorage',
    })) as INativeAppStorageRepairSummary;
    const originalRemove = mockAppMMKV.remove.bind(mockAppMMKV);
    jest.spyOn(mockAppMMKV, 'remove').mockImplementation((key) => {
      if (key !== 'app:invalid') originalRemove(key);
    });
    await expect(
      executeNativeStorageRequest({
        scope: 'recovery',
        operation: 'completeMigrationRepair',
        target: 'appStorage',
        repairId: summary.repairId,
        force: true,
      }),
    ).rejects.toThrow('results changed');
    expect(mockAppMMKV.getString(MIGRATION_KEY)).toBeUndefined();
    expect(mockSetMigrationLedgerComplete).not.toHaveBeenCalled();
    expect(mockLegacyStorage.multiRemove).not.toHaveBeenCalled();
  });

  it('keeps an unrecoverable target blocked until an explicit reset request', async () => {
    mockMigrationLedger.set('app-storage-v1', 'complete-v1');
    mockAppMMKV.set('app:key', 'current-value');
    const { executeNativeStorageRequest } = loadExecutor();
    await expect(
      executeNativeStorageRequest({
        scope: 'recovery',
        operation: 'retryMigrationTarget',
        target: 'appStorage',
      }),
    ).rejects.toThrow('MMKV migration marker is missing');
    expect(mockAppMMKV.getString('app:key')).toBe('current-value');
    expect(mockAppMMKV.getString(MIGRATION_KEY)).toBeUndefined();
    expect(mockSetMigrationLedger).not.toHaveBeenCalled();
  });

  it('holds queued business writes behind repair preparation and keeps them blocked until confirmation', async () => {
    mockMigrationLedger.set('app-storage-v1', 'complete-v1');
    mockLegacyData.set('key', 'backup');
    let finishPreparation: (() => void) | undefined;
    let reportStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      reportStarted = resolve;
    });
    mockLegacyStorage.getAllKeys.mockImplementationOnce(async () => {
      reportStarted?.();
      await new Promise<void>((resolve) => {
        finishPreparation = resolve;
      });
      return ['key'];
    });
    const { executeNativeStorageRequest } = loadExecutor();
    const preparation = executeNativeStorageRequest({
      scope: 'recovery',
      operation: 'prepareMigrationRepair',
      target: 'appStorage',
    });
    await started;
    const blockedWrite = executeNativeStorageRequest({
      scope: 'asyncStorage',
      operation: 'setItem',
      key: 'key',
      value: 'new-value',
    }).catch((error: unknown) => error);
    expect(mockAppMMKV.getString('app:key')).toBeUndefined();
    finishPreparation?.();
    const summary = (await preparation) as INativeAppStorageRepairSummary;
    await expect(blockedWrite).resolves.toMatchObject({
      message: expect.stringContaining('MMKV migration marker is missing'),
    });
    await executeNativeStorageRequest({
      scope: 'recovery',
      operation: 'completeMigrationRepair',
      target: 'appStorage',
      repairId: summary.repairId,
      force: false,
    });
    await executeNativeStorageRequest({
      scope: 'asyncStorage',
      operation: 'setItem',
      key: 'key',
      value: 'new-value',
    });
    expect(mockAppMMKV.getString('app:key')).toBe('new-value');
  });

  it('does not advance the completion ledger when rebuilding cannot sync', async () => {
    mockMigrationLedger.set('app-storage-v1', 'complete-v1');
    mockSyncNativeStorageMMKV.mockRejectedValueOnce(
      new Error('durability barrier failed'),
    );
    const { executeNativeStorageRequest } = loadExecutor();
    await expect(
      executeNativeStorageRequest({
        scope: 'recovery',
        operation: 'resetMigrationTarget',
        target: 'appStorage',
      }),
    ).rejects.toThrow('durability barrier failed');
    expect(mockMigrationLedger.get('app-storage-v1')).toBe('resetting-v1');
    expect(mockSetMigrationLedgerComplete).not.toHaveBeenCalled();
  });

  it('rejects a rebuild if its marker disappears during sync', async () => {
    mockMigrationLedger.set('app-storage-v1', 'complete-v1');
    mockSyncNativeStorageMMKV
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(async () => {
        mockAppMMKV.remove(MIGRATION_KEY);
      });
    const { executeNativeStorageRequest } = loadExecutor();
    await expect(
      executeNativeStorageRequest({
        scope: 'recovery',
        operation: 'resetMigrationTarget',
        target: 'appStorage',
      }),
    ).rejects.toThrow('MMKV migration marker is missing');
  });

  it('logs bounded mismatch metadata without business keys, values or invalid marker contents', async () => {
    mockMigrationLedger.set('app-storage-v1', 'complete-v1');
    mockAppMMKV.set(MIGRATION_KEY, 'private-marker-value');
    mockAppMMKV.set('app:private-business-key', 'private-business-value');
    const { executeNativeStorageRequest } = loadExecutor();
    for (let index = 0; index < 2; index += 1) {
      await expect(
        executeNativeStorageRequest({
          scope: 'asyncStorage',
          operation: 'getAllKeys',
        }),
      ).rejects.toThrow('MMKV migration marker is missing');
    }
    const logs = JSON.stringify(mockNativeMigrationLog.mock.calls);
    expect(logs).not.toContain('private-');
    expect(logs).toContain('migration-mismatch');
    expect(
      mockNativeMigrationLog.mock.calls.filter((call) =>
        String(call[1]).includes('migration-mismatch'),
      ),
    ).toHaveLength(1);
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

  it('persists successful batches without leaving recovery metadata', async () => {
    markAppStorageMigrated();
    const { executeNativeStorageRequest } = loadExecutor();
    const batches: INativeAsyncStorageRequest[] = [
      {
        scope: 'asyncStorage',
        operation: 'multiSet',
        entries: [
          ['a', '{"old":true}'],
          ['b', 'remove-me'],
        ],
      },
      {
        scope: 'asyncStorage',
        operation: 'multiMerge',
        entries: [['a', '{"new":true}']],
      },
      { scope: 'asyncStorage', operation: 'multiRemove', keys: ['b'] },
    ];
    for (const request of batches) {
      await executeNativeStorageRequest(request);
      expect(mockAppMMKV.getString(BATCH_JOURNAL_KEY)).toBeUndefined();
    }
    jest.resetModules();
    await expect(
      loadExecutor().executeNativeStorageRequest({
        scope: 'asyncStorage',
        operation: 'multiGet',
        keys: ['a', 'b'],
      }),
    ).resolves.toEqual([
      ['a', '{"old":true,"new":true}'],
      ['b', null],
    ]);
  });

  it.each(['write', 'sync'])(
    'rolls back an initial journal %s failure immediately',
    async (failure) => {
      markAppStorageMigrated();
      mockAppMMKV.set('app:a', 'old-a');
      const { ensureNativeAppStorageMigrated, executeNativeStorageRequest } =
        loadExecutor();
      await ensureNativeAppStorageMigrated();
      if (failure === 'write') {
        mockAppMMKV.failOnSetKey = BATCH_JOURNAL_KEY;
      } else {
        mockSyncNativeStorageMMKV.mockRejectedValueOnce(
          new Error('journal sync failed'),
        );
      }

      await expect(
        executeNativeStorageRequest({
          scope: 'asyncStorage',
          operation: 'multiSet',
          entries: [['a', 'new-a']],
        }),
      ).rejects.toThrow('failed');
      expect(mockAppMMKV.getString('app:a')).toBe('old-a');
      expect(mockAppMMKV.getString(BATCH_JOURNAL_KEY)).toBeUndefined();
    },
  );

  describe.each(['multiSet', 'multiRemove', 'multiMerge'] as const)(
    '%s pending recovery',
    (batchOperation) => {
      it.each(
        ['journal sync', 'rollback', 'journal deletion sync'].flatMap(
          (failure) =>
            (['clear', 'setItem'] as const).map((operation) => ({
              failure,
              operation,
            })),
        ),
      )(
        'blocks business access after $failure and preserves $operation across restart',
        async ({ failure, operation }) => {
          markAppStorageMigrated();
          const oldValue = '{"old":true}';
          mockAppMMKV.set('app:a', oldValue);
          mockAppMMKV.set('app:untouched', 'keep');
          mockLegacyData.set('a', oldValue);
          const {
            ensureNativeAppStorageMigrated,
            executeNativeStorageRequest,
          } = loadExecutor();
          await ensureNativeAppStorageMigrated();

          // Keep the live MMKV view separate from the last successful flush.
          let durableValues = new Map(mockAppMMKV.values);
          let unavailable = true;
          let syncCount = 0;
          const set = mockAppMMKV.set.bind(mockAppMMKV);
          jest.spyOn(mockAppMMKV, 'set').mockImplementation((key, value) => {
            if (
              unavailable &&
              failure === 'rollback' &&
              key === 'app:a' &&
              value === oldValue
            ) {
              throw new Error('rollback failed');
            }
            set(key, value);
          });
          mockSyncNativeStorageMMKV.mockImplementation(async () => {
            syncCount += 1;
            if (unavailable) {
              if (failure === 'journal sync') {
                // A rejected flush may still have persisted the journal.
                durableValues = new Map(mockAppMMKV.values);
                throw new Error('journal sync failed');
              }
              if (failure === 'rollback' && syncCount === 2) {
                throw new Error('batch sync failed');
              }
              if (
                failure === 'journal deletion sync' &&
                mockAppMMKV.getString(BATCH_JOURNAL_KEY) === undefined
              ) {
                throw new Error('journal deletion sync failed');
              }
            }
            durableValues = new Map(mockAppMMKV.values);
          });
          const batch: INativeAsyncStorageRequest =
            batchOperation === 'multiRemove'
              ? {
                  scope: 'asyncStorage',
                  operation: batchOperation,
                  keys: ['a'],
                }
              : {
                  scope: 'asyncStorage',
                  operation: batchOperation,
                  entries: [['a', '{"batch":true}']],
                };
          await expect(executeNativeStorageRequest(batch)).rejects.toThrow(
            'failed',
          );
          expect(durableValues.has(BATCH_JOURNAL_KEY)).toBe(true);
          expect(mockAppMMKV.getString(BATCH_JOURNAL_KEY) === undefined).toBe(
            failure === 'journal deletion sync',
          );

          const blockedRequests: INativeAsyncStorageRequest[] = [
            { scope: 'asyncStorage', operation: 'getItem', key: 'untouched' },
            { scope: 'asyncStorage', operation: 'getAllKeys' },
            {
              scope: 'asyncStorage',
              operation: 'multiGet',
              keys: ['untouched'],
            },
            {
              scope: 'asyncStorage',
              operation: 'setItem',
              key: 'untouched',
              value: '{}',
            },
            {
              scope: 'asyncStorage',
              operation: 'removeItem',
              key: 'untouched',
            },
            {
              scope: 'asyncStorage',
              operation: 'mergeItem',
              key: 'new',
              value: '{}',
            },
            {
              scope: 'asyncStorage',
              operation: 'multiSet',
              entries: [['untouched', '{}']],
            },
            {
              scope: 'asyncStorage',
              operation: 'multiRemove',
              keys: ['untouched'],
            },
            {
              scope: 'asyncStorage',
              operation: 'multiMerge',
              entries: [['new', '{}']],
            },
            { scope: 'asyncStorage', operation: 'clear' },
          ];
          // Submit together to exercise rejection and retry inside the queue.
          await Promise.all(
            blockedRequests.map((request) =>
              expect(executeNativeStorageRequest(request)).rejects.toThrow(
                'failed',
              ),
            ),
          );
          expect(mockAppMMKV.getString('app:untouched')).toBe('keep');
          expect(mockAppMMKV.getString('app:new')).toBeUndefined();
          expect(mockLegacyStorage.getAllKeys).not.toHaveBeenCalled();
          expect(mockLegacyData.get('a')).toBe(oldValue);

          unavailable = false;
          await executeNativeStorageRequest(
            operation === 'clear'
              ? { scope: 'asyncStorage', operation }
              : { scope: 'asyncStorage', operation, key: 'a', value: 'latest' },
          );
          expect(durableValues.has(BATCH_JOURNAL_KEY)).toBe(false);
          expect(mockAppMMKV.getString(MIGRATION_KEY)).toBe('1');
          expect(mockLegacyData.has('a')).toBe(operation !== 'clear');

          mockAppMMKV.values = new Map(durableValues);
          jest.resetModules();
          await expect(
            loadExecutor().executeNativeStorageRequest({
              scope: 'asyncStorage',
              operation: 'getItem',
              key: 'a',
            }),
          ).resolves.toBe(operation === 'clear' ? null : 'latest');
        },
      );
    },
  );

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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RuntimeEnvironment } =
      require('../travelMode/runtimeEnvironment') as typeof import('../travelMode/runtimeEnvironment');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getTravelModeRuntimeProfile } =
      require('../travelMode/runtimeProfile') as typeof import('../travelMode/runtimeProfile');
    const environmentSpy = jest
      .spyOn(travelModeManager, 'getRuntimeEnvironment')
      .mockResolvedValue(
        RuntimeEnvironment.create(getTravelModeRuntimeProfile(true)),
      );
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

    environmentSpy.mockRestore();
    bootstrapSpy.mockRestore();
  });

  it('waits for async native work to settle before resolving', async () => {
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
    let settled = false;
    const request = executeNativeStorageRequest({
      scope: 'syncStorage',
      operation: 'set',
      store: 'settings',
      key: 'setting',
      value: true,
      sourceMutationId: 1,
      sourceRuntimeId: 'main-runtime',
    }).finally(() => {
      settled = true;
    });
    await syncStarted;

    expect(settled).toBe(false);
    releaseSync?.();
    await request;
    expect(settled).toBe(true);
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
