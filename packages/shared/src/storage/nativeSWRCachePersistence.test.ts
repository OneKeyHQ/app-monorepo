/* eslint-disable @typescript-eslint/no-unsafe-call */

const mockSyncMMKV = jest.fn(async () => undefined);

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

  it('rejects a logical key whose UTF-8 bytes exceed the MMKV key budget', async () => {
    const mmkv = new FakeMMKV();
    const persistence = loadPersistence(mmkv);
    await persistence.ensureMigrated();

    expect(() =>
      persistence.applyPatch({
        removePrefixes: [],
        removals: [],
        updates: [['界'.repeat(19_990), JSON.stringify({ d: 'value', t: 1 })]],
      }),
    ).toThrow('Native SWR cache patch is invalid');
  });
});
