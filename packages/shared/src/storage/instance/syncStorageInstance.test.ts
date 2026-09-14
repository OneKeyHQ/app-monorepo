/**
 * Unit tests for createMMKVSyncStorage safe-write wrapper.
 */

import { createMMKV } from 'react-native-mmkv';

import { RuntimeEnvironment } from '../../travelMode/runtimeEnvironment';
import { getTravelModeRuntimeProfile } from '../../travelMode/runtimeProfile';
import { EAppSyncStorageKeys } from '../syncStorageKeys';

// Mock platformEnv before importing module.
// isNative: true keeps coldStartCacheStorage bound to the real MMKV-backed
// variant; on non-native it would be a no-op stub and tests below would be
// vacuously passing.
jest.mock('../../platformEnv', () => ({
  __esModule: true,
  default: {
    isExtensionBackgroundServiceWorker: false,
    isNative: true,
    isNativeBackgroundThread: true,
  },
}));

// Mock resetUtils
const mockCheckNotInResetting = jest.fn();
jest.mock('../../utils/resetUtils', () => ({
  __esModule: true,
  default: { checkNotInResetting: mockCheckNotInResetting },
}));

// Use real MMKV mock (provided by jest-setup.js)
const testMMKV = createMMKV({ id: 'test-sync-storage' });
const coldStartMMKV = createMMKV({ id: 'test-cold-start-cache' });

jest.mock('./mmkvStorageInstance', () => ({
  __esModule: true,
  default: testMMKV,
}));

jest.mock('./coldStartCacheMMKVInstance', () => ({
  __esModule: true,
  default: coldStartMMKV,
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createMMKVSyncStorage, syncStorage, coldStartCacheStorage } =
  require('./syncStorageInstance') as typeof import('./syncStorageInstance');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { travelModeManager } =
  require('../../travelMode') as typeof import('../../travelMode');
const maskedEnvironment = RuntimeEnvironment.create(
  getTravelModeRuntimeProfile(true),
);

function resetAll() {
  testMMKV.clearAll();
  coldStartMMKV.clearAll();
  jest.restoreAllMocks();
  jest.clearAllMocks();
}

describe('createMMKVSyncStorage', () => {
  beforeEach(resetAll);

  describe('safe set — null/undefined guard', () => {
    it('set(key, string) writes normally', () => {
      const store = createMMKVSyncStorage(testMMKV);
      void store.set('testKey', 'hello');
      expect(testMMKV.getString('testKey')).toBe('hello');
    });

    it('set(key, number) writes normally', () => {
      const store = createMMKVSyncStorage(testMMKV);
      void store.set('testKey', 42);
      expect(testMMKV.getNumber('testKey')).toBe(42);
    });

    it('set(key, boolean) writes normally', () => {
      const store = createMMKVSyncStorage(testMMKV);
      void store.set('testKey', true);
      expect(testMMKV.getBoolean('testKey')).toBe(true);
    });

    it('set(key, undefined) writes empty string instead of crashing', () => {
      const store = createMMKVSyncStorage(testMMKV);
      void store.set('testKey', undefined as any);
      expect(testMMKV.getString('testKey')).toBe('');
    });

    it('set(key, null) writes empty string instead of crashing', () => {
      const store = createMMKVSyncStorage(testMMKV);
      void store.set('testKey', null as any);
      expect(testMMKV.getString('testKey')).toBe('');
    });
  });

  describe('setObject', () => {
    it('writes JSON-serialized object', () => {
      const store = createMMKVSyncStorage(testMMKV);
      void store.setObject('testKey', { a: 1, b: 'two' });
      expect(testMMKV.getString('testKey')).toBe('{"a":1,"b":"two"}');
    });

    it('throws on non-plain object', () => {
      const store = createMMKVSyncStorage(testMMKV);
      expect(() => store.setObject('testKey', 'not-object' as any)).toThrow(
        'value must be a plain object',
      );
    });
  });

  describe('getObject', () => {
    it('reads and parses JSON', () => {
      testMMKV.set('testKey', '{"x":99}');
      const store = createMMKVSyncStorage(testMMKV);
      expect(store.getObject('testKey')).toEqual({ x: 99 });
    });

    it('returns undefined for missing key', () => {
      const store = createMMKVSyncStorage(testMMKV);
      expect(store.getObject('nope')).toBeUndefined();
    });

    it('returns undefined for corrupted JSON', () => {
      testMMKV.set('testKey', '{bad');
      const store = createMMKVSyncStorage(testMMKV);
      expect(store.getObject('testKey')).toBeUndefined();
    });
  });

  describe('delete / clearAll / getAllKeys', () => {
    it('delete removes key', () => {
      testMMKV.set('a', 'val');
      const store = createMMKVSyncStorage(testMMKV);
      void store.delete('a');
      expect(testMMKV.getString('a')).toBeUndefined();
    });

    it('clearAll removes all keys', () => {
      testMMKV.set('a', '1');
      testMMKV.set('b', '2');
      const store = createMMKVSyncStorage(testMMKV);
      void store.clearAll();
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
      void store.set('k', 'v');
      expect(mockCheckNotInResetting).toHaveBeenCalled();
    });

    it('does not call resetUtils when disabled', () => {
      const store = createMMKVSyncStorage(testMMKV);
      void store.set('k', 'v');
      expect(mockCheckNotInResetting).not.toHaveBeenCalled();
    });

    it('checkResetting also applies to setObject', () => {
      const store = createMMKVSyncStorage(testMMKV, { checkResetting: true });
      void store.setObject('k', { a: 1 });
      expect(mockCheckNotInResetting).toHaveBeenCalled();
    });
  });
});

describe('syncStorage export', () => {
  it('has checkResetting enabled', () => {
    void syncStorage.set(EAppSyncStorageKeys.perf_switch, 'val');
    expect(mockCheckNotInResetting).toHaveBeenCalled();
  });
});

describe('coldStartCacheStorage export', () => {
  it('does not have checkResetting', () => {
    mockCheckNotInResetting.mockClear();
    void coldStartCacheStorage.set(EAppSyncStorageKeys.perf_switch, 'val');
    expect(mockCheckNotInResetting).not.toHaveBeenCalled();
  });
});

describe('Travel Mode masking', () => {
  it('hides settings and skips settings writes', () => {
    testMMKV.set(EAppSyncStorageKeys.perf_switch, 'persisted');
    jest
      .spyOn(travelModeManager, 'getRuntimeEnvironmentSync')
      .mockReturnValue(maskedEnvironment);

    expect(
      syncStorage.getString(EAppSyncStorageKeys.perf_switch),
    ).toBeUndefined();
    expect(syncStorage.getAllKeys()).toEqual([]);
    void syncStorage.set(EAppSyncStorageKeys.perf_switch, 'changed');

    expect(testMMKV.getString(EAppSyncStorageKeys.perf_switch)).toBe(
      'persisted',
    );
  });

  it('hides cold-start values and skips cold-start writes', () => {
    coldStartMMKV.set(EAppSyncStorageKeys.perf_switch, 'persisted');
    jest
      .spyOn(travelModeManager, 'getRuntimeEnvironmentSync')
      .mockReturnValue(maskedEnvironment);

    expect(
      coldStartCacheStorage.getString(EAppSyncStorageKeys.perf_switch),
    ).toBeUndefined();
    void coldStartCacheStorage.delete(EAppSyncStorageKeys.perf_switch);

    expect(coldStartMMKV.getString(EAppSyncStorageKeys.perf_switch)).toBe(
      'persisted',
    );
  });
});
