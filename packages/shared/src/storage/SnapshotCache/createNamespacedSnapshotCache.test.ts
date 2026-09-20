/**
 * Web/desktop namespaced snapshot caches.
 *
 * They read and write synchronously through one shared map, so the two things
 * worth pinning are that a namespace only ever sees its own keys, and that
 * what the map holds actually reaches IndexedDB.
 */
import { createNamespacedSnapshotCache } from './createNamespacedSnapshotCache';

import type { ISnapshotCacheNamespace } from './snapshotCacheNamespaces';

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('fake-indexeddb/auto');
} catch {
  // IndexedDB integration is skipped when the test polyfill is unavailable.
}

const hasIndexedDB =
  typeof indexedDB !== 'undefined' && typeof indexedDB.open === 'function';
const describeIfIndexedDB = hasIndexedDB ? describe : describe.skip;

// The second namespace here is hypothetical: the isolation it proves has to
// hold for namespaces that do not exist yet.
function makeCache(namespace: string) {
  return createNamespacedSnapshotCache<number>({
    namespace: namespace as ISnapshotCacheNamespace,
    keyPrefix: `${namespace}:`,
    maxAgeMs: 60_000,
    maxEntries: 2,
  });
}

describeIfIndexedDB('createNamespacedSnapshotCache (web)', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { __resetWebUiSnapshotStoreForTests } =
      require('../DisplaySnapshotStorage/webUiSnapshotStore') as typeof import('../DisplaySnapshotStorage/webUiSnapshotStore');
    __resetWebUiSnapshotStoreForTests();
  });

  it('round-trips a value without waiting for storage', () => {
    const cache = makeCache('market-token-detail');

    cache.set('a', 1);

    expect(cache.get('a')).toEqual({ data: 1, updatedAt: expect.any(Number) });
  });

  it('keeps namespaces apart even though they share one database', () => {
    const market = makeCache('market-token-detail');
    const swap = makeCache('swap-quote');

    market.set('same-key', 1);
    swap.set('same-key', 2);

    expect(market.get('same-key')?.data).toBe(1);
    expect(swap.get('same-key')?.data).toBe(2);

    market.clear();

    expect(market.get('same-key')).toBeUndefined();
    expect(swap.get('same-key')?.data).toBe(2);
  });

  it('applies the namespace count limit, oldest write first', () => {
    const cache = makeCache('market-token-detail');

    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')?.data).toBe(2);
    expect(cache.get('c')?.data).toBe(3);
  });

  it('treats a record past the max age as a miss', () => {
    let now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    try {
      const cache = makeCache('market-token-detail');
      cache.set('a', 1);
      expect(cache.get('a')).toBeDefined();

      now += 60_000;
      expect(cache.get('a')).toBeUndefined();
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('persists what it holds, and loads it back on the next launch', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const store =
      require('../DisplaySnapshotStorage/webUiSnapshotStore') as typeof import('../DisplaySnapshotStorage/webUiSnapshotStore');
    const cache = makeCache('market-token-detail');
    cache.set('a', 1);

    await store.flushUiSnapshotStoreNow();
    const persisted = await store.readWebUiSnapshotEntriesFromIdb();
    expect([...persisted.keys()]).toEqual(
      expect.arrayContaining([
        'market-token-detail:d:a',
        'market-token-detail:manifest',
      ]),
    );

    // A fresh launch: empty map, primed from what is on disk.
    const entries = [...persisted.entries()];
    store.__resetWebUiSnapshotStoreForTests();
    expect(makeCache('market-token-detail').get('a')).toBeUndefined();

    store.primeWebUiSnapshotStore(entries);
    expect(makeCache('market-token-detail').get('a')?.data).toBe(1);
  });
});
