/**
 * Unit tests for createMMKVSyncStorage safe-write wrapper.
 */

import { createMMKV } from 'react-native-mmkv';

// Mock platformEnv before importing module
jest.mock('../../platformEnv', () => ({
  __esModule: true,
  default: { isExtensionBackgroundServiceWorker: false },
}));

// Mock resetUtils
const mockCheckNotInResetting = jest.fn();
jest.mock('../../utils/resetUtils', () => ({
  __esModule: true,
  default: { checkNotInResetting: mockCheckNotInResetting },
}));

// Use real MMKV mock (provided by jest-setup.js)
const testMMKV = createMMKV({ id: 'test-sync-storage' });

jest.mock('./mmkvStorageInstance', () => ({
  __esModule: true,
  default: testMMKV,
}));

jest.mock('./coldStartCacheMMKVInstance', () => ({
  __esModule: true,
  default: createMMKV({ id: 'test-cold-start-cache' }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createMMKVSyncStorage, syncStorage, coldStartCacheStorage } =
  require('./syncStorageInstance') as typeof import('./syncStorageInstance');

function resetAll() {
  testMMKV.clearAll();
  jest.clearAllMocks();
}

describe('createMMKVSyncStorage', () => {
  beforeEach(resetAll);

  describe('safe set — null/undefined guard', () => {
    it('set(key, string) writes normally', () => {
      const store = createMMKVSyncStorage(testMMKV);
      store.set('testKey' as any, 'hello');
      expect(testMMKV.getString('testKey')).toBe('hello');
    });

    it('set(key, number) writes normally', () => {
      const store = createMMKVSyncStorage(testMMKV);
      store.set('testKey' as any, 42);
      expect(testMMKV.getNumber('testKey')).toBe(42);
    });

    it('set(key, boolean) writes normally', () => {
      const store = createMMKVSyncStorage(testMMKV);
      store.set('testKey' as any, true);
      expect(testMMKV.getBoolean('testKey')).toBe(true);
    });

    it('set(key, undefined) writes empty string instead of crashing', () => {
      const store = createMMKVSyncStorage(testMMKV);
      store.set('testKey' as any, undefined as any);
      expect(testMMKV.getString('testKey')).toBe('');
    });

    it('set(key, null) writes empty string instead of crashing', () => {
      const store = createMMKVSyncStorage(testMMKV);
      store.set('testKey' as any, null as any);
      expect(testMMKV.getString('testKey')).toBe('');
    });
  });

  describe('setObject', () => {
    it('writes JSON-serialized object', () => {
      const store = createMMKVSyncStorage(testMMKV);
      store.setObject('testKey' as any, { a: 1, b: 'two' });
      expect(testMMKV.getString('testKey')).toBe('{"a":1,"b":"two"}');
    });

    it('throws on non-plain object', () => {
      const store = createMMKVSyncStorage(testMMKV);
      expect(() =>
        store.setObject('testKey' as any, 'not-object' as any),
      ).toThrow('value must be a plain object');
    });
  });

  describe('getObject', () => {
    it('reads and parses JSON', () => {
      testMMKV.set('testKey', '{"x":99}');
      const store = createMMKVSyncStorage(testMMKV);
      expect(store.getObject('testKey' as any)).toEqual({ x: 99 });
    });

    it('returns undefined for missing key', () => {
      const store = createMMKVSyncStorage(testMMKV);
      expect(store.getObject('nope' as any)).toBeUndefined();
    });

    it('returns undefined for corrupted JSON', () => {
      testMMKV.set('testKey', '{bad');
      const store = createMMKVSyncStorage(testMMKV);
      expect(store.getObject('testKey' as any)).toBeUndefined();
    });
  });

  describe('delete / clearAll / getAllKeys', () => {
    it('delete removes key', () => {
      testMMKV.set('a', 'val');
      const store = createMMKVSyncStorage(testMMKV);
      store.delete('a' as any);
      expect(testMMKV.getString('a')).toBeUndefined();
    });

    it('clearAll removes all keys', () => {
      testMMKV.set('a', '1');
      testMMKV.set('b', '2');
      const store = createMMKVSyncStorage(testMMKV);
      store.clearAll();
      expect(testMMKV.getAllKeys()).toEqual([]);
    });

    it('getAllKeys returns all keys', () => {
      testMMKV.set('x', '1');
      testMMKV.set('y', '2');
      const store = createMMKVSyncStorage(testMMKV);
      expect(store.getAllKeys().toSorted()).toEqual(['x', 'y']);
    });
  });

  describe('checkResetting option', () => {
    it('calls resetUtils.checkNotInResetting when enabled', () => {
      const store = createMMKVSyncStorage(testMMKV, { checkResetting: true });
      store.set('k' as any, 'v');
      expect(mockCheckNotInResetting).toHaveBeenCalled();
    });

    it('does not call resetUtils when disabled', () => {
      const store = createMMKVSyncStorage(testMMKV);
      store.set('k' as any, 'v');
      expect(mockCheckNotInResetting).not.toHaveBeenCalled();
    });

    it('checkResetting also applies to setObject', () => {
      const store = createMMKVSyncStorage(testMMKV, { checkResetting: true });
      store.setObject('k' as any, { a: 1 });
      expect(mockCheckNotInResetting).toHaveBeenCalled();
    });
  });
});

describe('syncStorage export', () => {
  it('has checkResetting enabled', () => {
    syncStorage.set('test' as any, 'val');
    expect(mockCheckNotInResetting).toHaveBeenCalled();
  });
});

describe('coldStartCacheStorage export', () => {
  it('does not have checkResetting', () => {
    mockCheckNotInResetting.mockClear();
    coldStartCacheStorage.set('test' as any, 'val');
    expect(mockCheckNotInResetting).not.toHaveBeenCalled();
  });
});
