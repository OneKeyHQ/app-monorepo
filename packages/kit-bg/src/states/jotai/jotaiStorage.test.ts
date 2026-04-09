/**
 * Unit tests for JotaiStorageNativeMMKV migration-aware read/write logic.
 */

import { createMMKV } from 'react-native-mmkv';

// Shared MMKV instance — must be created before jest.mock factories run
const mmkvInstance = createMMKV({ id: 'onekey-jotai-states-test' });

// Shared AsyncStorage mock data
const asyncStorageData = new Map<string, string>();
const asyncStorageMock = {
  getItem: jest.fn(async (key: string) => asyncStorageData.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    asyncStorageData.set(key, value);
  }),
  removeItem: jest.fn(async (key: string) => {
    asyncStorageData.delete(key);
  }),
};

// ---- Module mocks ----

jest.mock(
  '@onekeyhq/shared/src/storage/instance/jotaiMMKVStorageInstance',
  () => ({ __esModule: true, default: mmkvInstance }),
);

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: asyncStorageMock,
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
  default: { isNative: true, isExtensionUi: false },
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

// ---- Helpers ----

const MIGRATION_KEY = '__mmkv_migration_v1__';

function resetAll() {
  asyncStorageData.clear();
  mmkvInstance.clearAll();
  asyncStorageMock.getItem.mockImplementation(
    async (key: string) => asyncStorageData.get(key) ?? null,
  );
  asyncStorageMock.setItem.mockImplementation(
    async (key: string, value: string) => {
      asyncStorageData.set(key, value);
    },
  );
  jest.clearAllMocks();
}

/**
 * Create a fresh storage instance by re-requiring the module.
 * The constructor reads migration flag from MMKV, so MMKV state
 * must be set BEFORE calling this.
 */
function createStorage() {
  jest.resetModules();
  // Re-apply mocks after resetModules
  jest.mock(
    '@onekeyhq/shared/src/storage/instance/jotaiMMKVStorageInstance',
    () => ({ __esModule: true, default: mmkvInstance }),
  );
  jest.mock('@react-native-async-storage/async-storage', () => ({
    __esModule: true,
    default: asyncStorageMock,
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
    default: { isNative: true, isExtensionUi: false },
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

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('./jotaiStorage') as typeof import('./jotaiStorage');
  return mod.onekeyJotaiStorage as any;
}

// ==============================================================
// Tests
// ==============================================================

describe('JotaiStorageNativeMMKV', () => {
  beforeEach(resetAll);

  // ------ Before migration ------

  describe('before migration', () => {
    it('getItem reads from AsyncStorage, not MMKV', async () => {
      asyncStorageData.set('g_states_v5:fooAtom', JSON.stringify({ a: 1 }));
      mmkvInstance.set('g_states_v5:fooAtom', JSON.stringify({ a: 999 }));

      const s = createStorage();
      expect(s.isMigrationComplete()).toBe(false);
      expect(await s.getItem('g_states_v5:fooAtom', {})).toEqual({ a: 1 });
    });

    it('getItem returns initialValue when key absent', async () => {
      const s = createStorage();
      expect(await s.getItem('g_states_v5:missing', 'def')).toBe('def');
    });

    it('setItem dual-writes to MMKV and AsyncStorage', async () => {
      const s = createStorage();
      await s.setItem('g_states_v5:fooAtom', { b: 2 });

      expect(mmkvInstance.getString('g_states_v5:fooAtom')).toBe(
        JSON.stringify({ b: 2 }),
      );
      expect(asyncStorageMock.setItem).toHaveBeenCalledWith(
        'g_states_v5:fooAtom',
        JSON.stringify({ b: 2 }),
      );
    });

    it('removeItem removes from both storages', async () => {
      mmkvInstance.set('g_states_v5:fooAtom', '"x"');
      asyncStorageData.set('g_states_v5:fooAtom', '"x"');

      const s = createStorage();
      await s.removeItem('g_states_v5:fooAtom');

      expect(mmkvInstance.getString('g_states_v5:fooAtom')).toBeUndefined();
      expect(asyncStorageMock.removeItem).toHaveBeenCalledWith(
        'g_states_v5:fooAtom',
      );
    });

    it('getAllEntries returns null', async () => {
      const s = createStorage();
      expect(await s.getAllEntries()).toBeNull();
    });
  });

  // ------ Migration ------

  describe('migrateFromAsyncStorage', () => {
    it('migrates all keys and sets flag on success', async () => {
      asyncStorageData.set('g_states_v5:aAtom', JSON.stringify({ a: 1 }));
      asyncStorageData.set('g_states_v5:bAtom', JSON.stringify({ b: 2 }));

      const s = createStorage();
      await s.migrateFromAsyncStorage([
        'g_states_v5:aAtom',
        'g_states_v5:bAtom',
        'g_states_v5:cAtom', // absent
      ]);

      expect(s.isMigrationComplete()).toBe(true);
      expect(mmkvInstance.getString(MIGRATION_KEY)).toBe('1');
      expect(JSON.parse(mmkvInstance.getString('g_states_v5:aAtom')!)).toEqual({
        a: 1,
      });
      expect(JSON.parse(mmkvInstance.getString('g_states_v5:bAtom')!)).toEqual({
        b: 2,
      });
      expect(mmkvInstance.getString('g_states_v5:cAtom')).toBeUndefined();
    });

    it('overwrites existing MMKV keys', async () => {
      mmkvInstance.set('g_states_v5:aAtom', JSON.stringify({ stale: true }));
      asyncStorageData.set(
        'g_states_v5:aAtom',
        JSON.stringify({ fresh: true }),
      );

      const s = createStorage();
      await s.migrateFromAsyncStorage(['g_states_v5:aAtom']);

      expect(JSON.parse(mmkvInstance.getString('g_states_v5:aAtom')!)).toEqual({
        fresh: true,
      });
    });

    it('does NOT set flag if any key fails', async () => {
      asyncStorageData.set('g_states_v5:okAtom', JSON.stringify('ok'));
      asyncStorageMock.getItem.mockImplementation(async (key: string) => {
        if (key === 'g_states_v5:badAtom') throw new Error('disk error');
        return asyncStorageData.get(key) ?? null;
      });

      const s = createStorage();
      await s.migrateFromAsyncStorage([
        'g_states_v5:okAtom',
        'g_states_v5:badAtom',
      ]);

      expect(s.isMigrationComplete()).toBe(false);
      expect(mmkvInstance.getString(MIGRATION_KEY)).toBeUndefined();
      expect(mmkvInstance.getString('g_states_v5:okAtom')).toBe('"ok"');
    });

    it('skips entirely if already migrated', async () => {
      mmkvInstance.set(MIGRATION_KEY, '1');
      const s = createStorage();
      await s.migrateFromAsyncStorage(['g_states_v5:aAtom']);
      expect(asyncStorageMock.getItem).not.toHaveBeenCalled();
    });

    it('retry after failure completes migration', async () => {
      asyncStorageData.set('g_states_v5:aAtom', JSON.stringify('a'));
      asyncStorageData.set('g_states_v5:bAtom', JSON.stringify('b'));

      // First attempt: bAtom fails
      asyncStorageMock.getItem.mockImplementation(async (key: string) => {
        if (key === 'g_states_v5:bAtom') throw new Error('fail');
        return asyncStorageData.get(key) ?? null;
      });

      const s1 = createStorage();
      await s1.migrateFromAsyncStorage([
        'g_states_v5:aAtom',
        'g_states_v5:bAtom',
      ]);
      expect(s1.isMigrationComplete()).toBe(false);

      // Fix error, retry
      asyncStorageMock.getItem.mockImplementation(
        async (key: string) => asyncStorageData.get(key) ?? null,
      );
      const s2 = createStorage();
      await s2.migrateFromAsyncStorage([
        'g_states_v5:aAtom',
        'g_states_v5:bAtom',
      ]);
      expect(s2.isMigrationComplete()).toBe(true);
      expect(JSON.parse(mmkvInstance.getString('g_states_v5:bAtom')!)).toBe(
        'b',
      );
    });
  });

  // ------ After migration ------

  describe('after migration', () => {
    beforeEach(() => {
      mmkvInstance.set(MIGRATION_KEY, '1');
    });

    it('getItem reads from MMKV only', async () => {
      mmkvInstance.set('g_states_v5:fooAtom', JSON.stringify({ mmkv: true }));
      asyncStorageData.set(
        'g_states_v5:fooAtom',
        JSON.stringify({ async: true }),
      );

      const s = createStorage();
      expect(await s.getItem('g_states_v5:fooAtom', {})).toEqual({
        mmkv: true,
      });
      expect(asyncStorageMock.getItem).not.toHaveBeenCalled();
    });

    it('getItem returns initialValue when MMKV key absent', async () => {
      const s = createStorage();
      expect(await s.getItem('g_states_v5:nope', 'fb')).toBe('fb');
    });

    it('setItem writes to MMKV only', async () => {
      const s = createStorage();
      await s.setItem('g_states_v5:fooAtom', 42);
      expect(mmkvInstance.getString('g_states_v5:fooAtom')).toBe('42');
      expect(asyncStorageMock.setItem).not.toHaveBeenCalled();
    });

    it('removeItem removes from MMKV only', async () => {
      mmkvInstance.set('g_states_v5:fooAtom', '"x"');
      const s = createStorage();
      await s.removeItem('g_states_v5:fooAtom');
      expect(mmkvInstance.getString('g_states_v5:fooAtom')).toBeUndefined();
      expect(asyncStorageMock.removeItem).not.toHaveBeenCalled();
    });

    it('getAllEntries returns MMKV data (excludes migration key)', async () => {
      mmkvInstance.set('g_states_v5:aAtom', JSON.stringify({ a: 1 }));
      mmkvInstance.set('g_states_v5:bAtom', JSON.stringify({ b: 2 }));

      const s = createStorage();
      const entries = await s.getAllEntries();

      expect(entries).not.toBeNull();
      expect(entries!.size).toBe(2);
      expect(entries!.get('g_states_v5:aAtom')).toEqual({ a: 1 });
      expect(entries!.has(MIGRATION_KEY)).toBe(false);
    });
  });
});
