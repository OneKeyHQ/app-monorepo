/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, onekey/no-raw-error */

import { createMMKV } from 'react-native-mmkv';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

const mmkvInstance = createMMKV({ id: 'onekey-jotai-states-test' });
const legacyData = new Map<string, string>();
const migrationLedger = new Map<string, string>();
const mockSetMigrationLedger = jest.fn(async (key: string, value: string) => {
  migrationLedger.set(key, value);
});
const mockSetMigrationLedgerComplete = jest.fn(async (key: string) => {
  migrationLedger.set(key, 'complete-v1');
});
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
jest.mock('@onekeyhq/shared/src/storage/legacyAsyncStorageMigration', () => ({
  getLegacyAsyncStorageForMigration: () => legacyStorage,
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
  syncNativeStorageMMKV: jest.fn(async () => undefined),
}));
jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/react-native-file-logger',
  () => ({
    NativeLogger: { write: jest.fn() },
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
const PROBE_KEY = 'g_states_v5:settingsPersistAtom';

function createStorage() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('./jotaiStorage') as typeof import('./jotaiStorage');
  return mod.onekeyJotaiStorage as any;
}

describe('JotaiStorageNativeMMKV migration barrier', () => {
  beforeEach(() => {
    legacyData.clear();
    migrationLedger.clear();
    mmkvInstance.clearAll();
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

  it('copies every value and publishes the marker only after verification', async () => {
    legacyData.set('g_states_v5:aAtom', JSON.stringify({ a: 1 }));
    legacyData.set('g_states_v5:bAtom', JSON.stringify({ b: 2 }));
    const storage = createStorage();

    await storage.migrateFromAsyncStorage(
      ['g_states_v5:aAtom', 'g_states_v5:bAtom', 'g_states_v5:cAtom'],
      PROBE_KEY,
    );

    expect(storage.isMigrationComplete()).toBe(true);
    expect(mmkvInstance.getString(MIGRATION_KEY)).toBe('1');
    expect(migrationLedger.get('jotai-storage-v1')).toBe('complete-v1');
    expect(await storage.getItem('g_states_v5:aAtom', null)).toEqual({ a: 1 });
    expect(mmkvInstance.getString('g_states_v5:cAtom')).toBeUndefined();
  });

  it('rejects on migration failure and retries cleanly', async () => {
    legacyData.set('g_states_v5:aAtom', '"fresh"');
    mmkvInstance.set('g_states_v5:aAtom', '"partial"');
    legacyStorage.multiGet.mockRejectedValueOnce(
      new OneKeyLocalError('legacy disk unavailable'),
    );
    const storage = createStorage();

    await expect(
      storage.migrateFromAsyncStorage(['g_states_v5:aAtom'], PROBE_KEY),
    ).rejects.toThrow('legacy disk unavailable');
    expect(mmkvInstance.getString(MIGRATION_KEY)).toBeUndefined();

    await storage.migrateFromAsyncStorage(['g_states_v5:aAtom'], PROBE_KEY);
    expect(await storage.getItem('g_states_v5:aAtom', null)).toBe('fresh');
    expect(mmkvInstance.getString(MIGRATION_KEY)).toBe('1');
  });

  it('validates the legacy snapshot before publishing the migration gate', async () => {
    legacyData.set('g_states_v5:aAtom', '"fresh"');
    mmkvInstance.set('g_states_v5:aAtom', '"partial"');
    legacyStorage.multiGet.mockResolvedValueOnce([]);
    const storage = createStorage();

    await expect(
      storage.migrateFromAsyncStorage(['g_states_v5:aAtom'], PROBE_KEY),
    ).rejects.toThrow('incomplete batch for key=g_states_v5:aAtom');
    expect(mockSetMigrationLedger).not.toHaveBeenCalled();
    expect(migrationLedger.get('jotai-storage-v1')).toBeUndefined();
    expect(mmkvInstance.getString('g_states_v5:aAtom')).toBe('"partial"');
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

  it('does not reopen legacy storage after the marker exists', async () => {
    mmkvInstance.set(MIGRATION_KEY, '1');
    mmkvInstance.set('g_states_v5:aAtom', '42');
    const storage = createStorage();

    await storage.migrateFromAsyncStorage(['g_states_v5:aAtom'], PROBE_KEY);
    expect(await storage.getItem('g_states_v5:aAtom', 0)).toBe(42);
    expect(legacyStorage.multiGet).not.toHaveBeenCalled();
    expect(migrationLedger.get('jotai-storage-v1')).toBe('complete-v1');
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
    mmkvInstance.set(MIGRATION_KEY, '1');
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
    mmkvInstance.set(MIGRATION_KEY, '1');
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
