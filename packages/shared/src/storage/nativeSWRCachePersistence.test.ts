/* eslint-disable @typescript-eslint/no-unsafe-call */

import {
  SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS,
  SWR_CACHE_MAX_KEY_CHARS,
  SWR_CACHE_MAX_KEY_UTF8_BYTES,
} from '../utils/swrCacheUtils';

const mockSyncMMKV = jest.fn(async () => undefined);
const mockSWRCacheCapacityLimit = jest.fn();

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

jest.mock('./nativeStorageMigrationModule', () => ({
  syncNativeStorageMMKV: mockSyncMMKV,
}));

class FakeMMKV {
  values = new Map<string, string>();

  getAllKeys() {
    return [...this.values.keys()];
  }

  getString(key: string) {
    return this.values.get(key);
  }

  remove(key: string) {
    this.values.delete(key);
  }

  set(key: string, value: string) {
    this.values.set(key, value);
  }
}

function loadPersistence(mmkv: FakeMMKV) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getNativeSWRCachePersistence } =
    require('./nativeSWRCachePersistence') as typeof import('./nativeSWRCachePersistence');
  return getNativeSWRCachePersistence(mmkv);
}

describe('nativeSWRCachePersistence', () => {
  beforeEach(() => {
    jest.resetModules();
    mockSyncMMKV.mockClear();
    mockSWRCacheCapacityLimit.mockReset();
  });

  it('migrates the legacy blob to independently stored entries', async () => {
    const mmkv = new FakeMMKV();
    mmkv.set(
      'onekey_swr_cache',
      JSON.stringify({
        first: { d: 'one', t: 1 },
        second: { d: 'two', t: 2 },
      }),
    );
    const persistence = loadPersistence(mmkv);

    await expect(persistence.ensureMigrated()).resolves.toBeUndefined();

    expect(mmkv.getString('onekey_swr_cache')).toBeUndefined();
    expect(
      mmkv.getAllKeys().filter((key) => key.includes('swr_cache_v2_entry')),
    ).toHaveLength(2);
    expect(mockSyncMMKV).toHaveBeenCalledTimes(2);
  });

  it('logs and removes a legacy entry beyond the per-entry limit', async () => {
    const mmkv = new FakeMMKV();
    mmkv.set(
      'onekey_swr_cache',
      JSON.stringify({
        'marketHomeTokenList:account-1': {
          d: 'x'.repeat(SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS),
          t: 1,
        },
      }),
    );
    const persistence = loadPersistence(mmkv);

    await persistence.ensureMigrated();

    expect(JSON.parse(persistence.readSerialized())).toEqual({});
    expect(mockSWRCacheCapacityLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        affectedEntryCount: 1,
        namespaces: ['marketHomeTokenList'],
        reason: 'entryLimit',
      }),
    );
    expect(JSON.stringify(mockSWRCacheCapacityLimit.mock.calls)).not.toContain(
      'account-1',
    );
  });

  it('removes an overlong key while migrating the legacy blob', async () => {
    const mmkv = new FakeMMKV();
    const invalidKey = 'x'.repeat(SWR_CACHE_MAX_KEY_CHARS + 1);
    mmkv.set(
      'onekey_swr_cache',
      JSON.stringify({
        [invalidKey]: { d: 'discarded', t: 1 },
        valid: { d: 'kept', t: 2 },
      }),
    );
    const persistence = loadPersistence(mmkv);

    await persistence.ensureMigrated();

    expect(JSON.parse(persistence.readSerialized())).toEqual({
      valid: { d: 'kept', t: 2 },
    });
    expect(mmkv.getAllKeys().some((key) => key.includes(invalidKey))).toBe(
      false,
    );
    expect(mockSWRCacheCapacityLimit).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'keyLimit' }),
    );
  });

  it('reads a bounded key subset without loading unrelated physical values', async () => {
    const mmkv = new FakeMMKV();
    mmkv.set(
      'onekey_swr_cache',
      JSON.stringify({
        'home-overview-perps-worth:old': { d: '1', t: 1 },
        unrelated: { d: 'x'.repeat(128 * 1024), t: 2 },
        'home-overview-perps-worth:new': { d: '2', t: 3 },
        'home-overview-perps-worth:too-large': {
          d: 'y'.repeat(2 * 1024),
          t: 4,
        },
      }),
    );
    const persistence = loadPersistence(mmkv);
    await persistence.ensureMigrated();
    persistence.invalidate();
    const unrelatedPhysicalKey = mmkv
      .getAllKeys()
      .find((key) => key.endsWith(':unrelated'));
    const oversizedPhysicalKey = mmkv
      .getAllKeys()
      .find((key) => key.endsWith(':home-overview-perps-worth:too-large'));
    expect(unrelatedPhysicalKey).toBeDefined();
    expect(oversizedPhysicalKey).toBeDefined();
    const getStringSpy = jest.spyOn(mmkv, 'getString');

    await persistence.ensureMigrated();
    const serialized = persistence.readSerializedSubset({
      keyPrefixes: ['home-overview-perps-worth:'],
      maxEntries: 1,
      maxSerializedChars: 1024,
    });

    expect(JSON.parse(serialized)).toEqual({
      'home-overview-perps-worth:new': { d: '2', t: 3 },
    });
    expect(getStringSpy).not.toHaveBeenCalledWith(unrelatedPhysicalKey);
    expect(mmkv.getString(unrelatedPhysicalKey ?? '')).toBe(
      JSON.stringify({ d: 'x'.repeat(128 * 1024), t: 2 }),
    );
    expect(mmkv.getString(oversizedPhysicalKey ?? '')).toBe(
      JSON.stringify({ d: 'y'.repeat(2 * 1024), t: 4 }),
    );
  });

  it('persists only affected keys and keeps newer entries on stale removal', async () => {
    const mmkv = new FakeMMKV();
    const persistence = loadPersistence(mmkv);
    await persistence.ensureMigrated();
    persistence.applyPatch({
      removePrefixes: [],
      removals: [],
      updates: [
        ['newer', JSON.stringify({ d: 'new', t: 20 })],
        ['kept', JSON.stringify({ d: 'kept', t: 10 })],
      ],
    });
    const setSpy = jest.spyOn(mmkv, 'set');

    const canonical = persistence.applyPatch({
      removePrefixes: [],
      removals: [['newer', 15]],
      updates: [['changed', JSON.stringify({ d: 'changed', t: 30 })]],
    });

    expect(JSON.parse(persistence.readSerialized())).toEqual({
      newer: { d: 'new', t: 20 },
      kept: { d: 'kept', t: 10 },
      changed: { d: 'changed', t: 30 },
    });
    expect(canonical).toEqual([
      ['newer', JSON.stringify({ d: 'new', t: 20 })],
      ['changed', JSON.stringify({ d: 'changed', t: 30 })],
    ]);
    expect(setSpy).toHaveBeenCalledTimes(2);
    expect(
      setSpy.mock.calls.some(([key]) => String(key).endsWith(':kept')),
    ).toBe(false);
  });

  it('applies clear and prefix tombstones by entry timestamp', async () => {
    const mmkv = new FakeMMKV();
    const persistence = loadPersistence(mmkv);
    await persistence.ensureMigrated();
    persistence.applyPatch({
      removePrefixes: [],
      removals: [],
      updates: [
        ['wallet:a', JSON.stringify({ d: 1, t: 10 })],
        ['wallet:b', JSON.stringify({ d: 2, t: 30 })],
        ['other', JSON.stringify({ d: 3, t: 5 })],
      ],
    });

    persistence.applyPatch({
      clearBefore: 8,
      removePrefixes: [{ prefix: 'wallet:', at: 20 }],
      removals: [],
      updates: [],
    });

    expect(JSON.parse(persistence.readSerialized())).toEqual({
      'wallet:b': { d: 2, t: 30 },
    });
  });

  it('drops a logical key whose UTF-8 bytes exceed the MMKV key budget', async () => {
    const mmkv = new FakeMMKV();
    const persistence = loadPersistence(mmkv);
    await persistence.ensureMigrated();
    const invalidKey = '界'.repeat(
      Math.floor(SWR_CACHE_MAX_KEY_UTF8_BYTES / 3) + 1,
    );

    expect(
      persistence.applyPatch({
        removePrefixes: [],
        removals: [],
        updates: [[invalidKey, JSON.stringify({ d: 'value', t: 1 })]],
      }),
    ).toEqual([]);
    expect(JSON.parse(persistence.readSerialized())).toEqual({});
  });

  it('removes an invalid physical key while reading a subset', () => {
    const mmkv = new FakeMMKV();
    const invalidKey = 'x'.repeat(SWR_CACHE_MAX_KEY_CHARS + 1);
    const invalidPhysicalKey = `__onekey_internal_swr_cache_v2_entry__:${invalidKey}`;
    mmkv.set('__onekey_internal_swr_cache_v2_migrated__', '1');
    mmkv.set(invalidPhysicalKey, JSON.stringify({ d: 'discarded', t: 1 }));
    mmkv.set(
      '__onekey_internal_swr_cache_v2_entry__:valid',
      JSON.stringify({ d: 'kept', t: 2 }),
    );
    const persistence = loadPersistence(mmkv);

    expect(
      JSON.parse(
        persistence.readSerializedSubset({
          keyPrefixes: ['valid'],
          maxEntries: 10,
          maxSerializedChars: 1024,
        }),
      ),
    ).toEqual({ valid: { d: 'kept', t: 2 } });
    expect(mmkv.getString(invalidPhysicalKey)).toBeUndefined();
    expect(mockSWRCacheCapacityLimit).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'keyLimit' }),
    );
  });
});
