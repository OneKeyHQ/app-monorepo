import { createMMKV } from 'react-native-mmkv';

import { createNamespacedSnapshotCache } from './createNamespacedSnapshotCache.native';

let travelModeMasking = false;

jest.mock('../travelModeMaskingGate', () => ({
  isTravelModeMaskingSync: () => travelModeMasking,
}));

// Keyed by id, the way MMKV itself hands back one instance per file: two
// caches over the same namespace have to see each other's writes.
const mockStores = new Map<string, Map<string, string>>();

jest.mock('react-native-mmkv', () => ({
  createMMKV: jest.fn(({ id }: { id: string }) => {
    const values = mockStores.get(id) ?? new Map<string, string>();
    mockStores.set(id, values);
    const operations: string[] = [];
    (
      globalThis as typeof globalThis & { __snapshotCacheOps?: string[] }
    ).__snapshotCacheOps = operations;
    return {
      getString: (key: string) => values.get(key),
      set: (key: string, value: string) => {
        operations.push(`set:${key}`);
        values.set(key, value);
      },
      remove: (key: string) => {
        operations.push(`remove:${key}`);
        values.delete(key);
      },
      clearAll: () => values.clear(),
      trim: () => operations.push('trim'),
    };
  }),
}));

const mockCreateMMKV = createMMKV as jest.MockedFunction<typeof createMMKV>;
const ops = () =>
  (globalThis as typeof globalThis & { __snapshotCacheOps?: string[] })
    .__snapshotCacheOps ?? [];

describe('createNamespacedSnapshotCache (native)', () => {
  beforeEach(() => {
    mockCreateMMKV.mockClear();
    (
      globalThis as typeof globalThis & { __snapshotCacheOps?: string[] }
    ).__snapshotCacheOps = [];
    travelModeMasking = false;
    mockStores.clear();
  });

  it('costs nothing until the namespace is actually used', () => {
    createNamespacedSnapshotCache<number>({
      namespace: 'market-token-detail',
      maxAgeMs: 1000,
      maxEntries: 2,
    });
    expect(mockCreateMMKV).not.toHaveBeenCalled();
  });

  it('gives the namespace its own file and applies its retention', () => {
    const cache = createNamespacedSnapshotCache<number>({
      namespace: 'market-token-detail',
      maxAgeMs: 60_000,
      maxEntries: 2,
    });

    cache.set('a', 1);
    expect(mockCreateMMKV).toHaveBeenCalledWith({
      id: 'onekey-display-snapshot-market-token-detail',
    });
    expect(cache.get('a')).toEqual({ data: 1, updatedAt: expect.any(Number) });

    cache.set('b', 2);
    cache.set('c', 3);
    // Oldest write goes once the namespace is full — its own budget, not one
    // shared with every other feature.
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('c')).toEqual({ data: 3, updatedAt: expect.any(Number) });
    expect(ops()).toContain('remove:d:a');
  });

  it('refuses a record past the namespace max age', () => {
    let now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    try {
      const cache = createNamespacedSnapshotCache<number>({
        namespace: 'market-token-detail',
        maxAgeMs: 60_000,
        maxEntries: 10,
      });
      cache.set('a', 1);
      expect(cache.get('a')).toBeDefined();

      now += 60_000;
      expect(cache.get('a')).toBeUndefined();
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('holds nothing while Travel Mode is masking, and drops what the last launch left', () => {
    const real = createNamespacedSnapshotCache<number>({
      namespace: 'market-token-detail',
      maxAgeMs: 60_000,
      maxEntries: 10,
    });
    real.set('a', 1);
    expect(real.get('a')).toBeDefined();

    travelModeMasking = true;
    const masked = createNamespacedSnapshotCache<number>({
      namespace: 'market-token-detail',
      maxAgeMs: 60_000,
      maxEntries: 10,
    });

    // Declaring the namespace under masking is what empties it: nothing else
    // will read it this launch, so nothing else would notice the leftovers.
    expect(real.get('a')).toBeUndefined();
    masked.set('b', 2);
    expect(masked.get('b')).toBeUndefined();
    expect(ops()).not.toContain('set:d:b');
  });

  it('isolates SimpleDb cache entities into per-entity snapshot namespaces and compacts on remove/shrink', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const simpleDbSnapshot = require('../instance/simpleDbSnapshotMMKVInstance')
      .default as typeof import('../instance/simpleDbSnapshotMMKVInstance').default;

    simpleDbSnapshot.set('app:simple_db_v5:localTokens', '{"tokens":[1,2]}');
    simpleDbSnapshot.set('app:simple_db_v5:perp', '{"universe":[]}');

    expect(mockCreateMMKV).toHaveBeenCalledWith({
      id: 'onekey-display-snapshot-sdb-local-tokens',
    });
    expect(mockCreateMMKV).toHaveBeenCalledWith({
      id: 'onekey-display-snapshot-sdb-perp',
    });
    expect(simpleDbSnapshot.getString('app:simple_db_v5:localTokens')).toBe(
      '{"tokens":[1,2]}',
    );
    expect(simpleDbSnapshot.getString('app:simple_db_v5:perp')).toBe(
      '{"universe":[]}',
    );
    expect(
      mockStores
        .get('onekey-display-snapshot-sdb-local-tokens')
        ?.has('manifest'),
    ).toBe(true);
    expect(
      mockStores
        .get('onekey-display-snapshot-sdb-local-tokens')
        ?.has('d:app:simple_db_v5:localTokens'),
    ).toBe(true);

    simpleDbSnapshot.remove('app:simple_db_v5:localTokens');
    simpleDbSnapshot.remove('app:simple_db_v5:perp');
    expect(
      simpleDbSnapshot.getString('app:simple_db_v5:localTokens'),
    ).toBeUndefined();
    expect(simpleDbSnapshot.getString('app:simple_db_v5:perp')).toBeUndefined();
    expect(ops()).toContain('trim');
  });

  it('persists Jotai cache atoms through the jotai-cache snapshot namespace with manifest and TTL', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const jotaiSnapshot =
      require('../instance/jotaiSnapshotMMKVStorageInstance')
        .default as typeof import('../instance/jotaiSnapshotMMKVStorageInstance').default;

    jotaiSnapshot.set(
      'g_states_v5:perpsAccountDisplaySnapshotAtom',
      '{"entries":{}}',
    );
    expect(mockCreateMMKV).toHaveBeenCalledWith({
      id: 'onekey-display-snapshot-jotai-cache',
    });
    expect(
      jotaiSnapshot.getString('g_states_v5:perpsAccountDisplaySnapshotAtom'),
    ).toBe('{"entries":{}}');
    expect(
      mockStores.get('onekey-display-snapshot-jotai-cache')?.has('manifest'),
    ).toBe(true);
    expect(jotaiSnapshot.getAllKeys()).toEqual([
      'g_states_v5:perpsAccountDisplaySnapshotAtom',
    ]);
  });
});
