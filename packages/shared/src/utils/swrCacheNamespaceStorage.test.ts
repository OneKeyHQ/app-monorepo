/**
 * What a namespace may hold as a key is narrower than what an SWR key may be.
 * A key that does not fit used to be dropped on the way in and again on the
 * way out, silently, so the entry simply never existed.
 */
import {
  __resetSwrCacheNamespaceStorageForTests,
  clearAllSwrCacheNamespaces,
  readSwrCacheEntry,
  removeSwrCacheByPrefix,
  removeSwrCacheEntries,
  writeSwrCacheEntries,
} from './swrCacheNamespaceStorage';

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('fake-indexeddb/auto');
} catch {
  // IndexedDB integration is skipped when the test polyfill is unavailable.
}

const hasIndexedDB =
  typeof indexedDB !== 'undefined' && typeof indexedDB.open === 'function';
const describeIfIndexedDB = hasIndexedDB ? describe : describe.skip;

describeIfIndexedDB('swrCacheNamespaceStorage', () => {
  beforeEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { __resetWebUiSnapshotStoreForTests } =
      require('../storage/DisplaySnapshotStorage/webUiSnapshotStore') as typeof import('../storage/DisplaySnapshotStorage/webUiSnapshotStore');
    __resetWebUiSnapshotStoreForTests();
    __resetSwrCacheNamespaceStorageForTests();
  });

  it('round-trips an ordinary key', () => {
    writeSwrCacheEntries([
      ['marketTokenDetail:v1:evm--1:0xabc', { d: 'plain', t: 1 }],
    ]);

    expect(readSwrCacheEntry('marketTokenDetail:v1:evm--1:0xabc')).toEqual({
      d: 'plain',
      t: 1,
    });
  });

  it('round-trips a key the record store would refuse', () => {
    // A token symbol is part of the key, and a symbol can be anything.
    const key = 'marketTokenDetail:v1:evm--56:$牛马 (天才)';
    writeSwrCacheEntries([[key, { d: 'unicode', t: 2 }]]);

    expect(readSwrCacheEntry(key)).toEqual({ d: 'unicode', t: 2 });
  });

  it('round-trips a key past the record key length limit', () => {
    const key = `bulkCopyAccounts:v1:${'a'.repeat(900)}`;
    writeSwrCacheEntries([[key, { d: 'long', t: 3 }]]);

    expect(readSwrCacheEntry(key)).toEqual({ d: 'long', t: 3 });
  });

  it('keeps two refused keys apart', () => {
    const first = `bulkCopyAccounts:v1:${'a'.repeat(900)}`;
    const second = `bulkCopyAccounts:v1:${'a'.repeat(899)}b`;
    writeSwrCacheEntries([
      [first, { d: 'first', t: 4 }],
      [second, { d: 'second', t: 5 }],
    ]);

    expect(readSwrCacheEntry(first)).toEqual({ d: 'first', t: 4 });
    expect(readSwrCacheEntry(second)).toEqual({ d: 'second', t: 5 });
  });

  it('removes a refused key by its own name', () => {
    const key = 'walletList:v1:名前';
    writeSwrCacheEntries([[key, { d: 'gone', t: 6 }]]);

    removeSwrCacheEntries([key]);

    expect(readSwrCacheEntry(key)).toBeUndefined();
  });

  it('drops a refused key when its namespace is invalidated', () => {
    const key = 'walletList:v1:名前';
    writeSwrCacheEntries([
      [key, { d: 'gone', t: 7 }],
      ['walletList:v1:plain', { d: 'also gone', t: 7 }],
    ]);

    removeSwrCacheByPrefix('walletList:');

    expect(readSwrCacheEntry(key)).toBeUndefined();
    expect(readSwrCacheEntry('walletList:v1:plain')).toBeUndefined();
  });

  it('drops a refused key even when the prefix is narrower than its namespace', () => {
    // A digested key carries nothing of the original past its namespace, so
    // the namespace is cleared rather than leaving the key the caller named.
    const key = 'walletList:v1:名前';
    writeSwrCacheEntries([[key, { d: 'gone', t: 8 }]]);

    removeSwrCacheByPrefix('walletList:v1:');

    expect(readSwrCacheEntry(key)).toBeUndefined();
  });

  it('clears the fallback namespace a key with an undeclared prefix lands in', () => {
    // `swrKeys.defiEnabled` is a literal prefix that names no declared
    // namespace, so its records live in the fallback namespace. A wipe
    // assembled from the key registry cannot reach them.
    writeSwrCacheEntries([
      ['defiEnabled:evm--1', { d: 'fallback', t: 9 }],
      ['perpsUnifoldSourceSelection:v1:evm:1:ETH', { d: 'fallback', t: 9 }],
      ['walletList:v1:plain', { d: 'declared', t: 9 }],
    ]);

    clearAllSwrCacheNamespaces();

    expect(readSwrCacheEntry('defiEnabled:evm--1')).toBeUndefined();
    expect(
      readSwrCacheEntry('perpsUnifoldSourceSelection:v1:evm:1:ETH'),
    ).toBeUndefined();
    expect(readSwrCacheEntry('walletList:v1:plain')).toBeUndefined();
  });

  it('spares the namespaces named in exceptSwrPrefixes', () => {
    writeSwrCacheEntries([
      ['perpsL2Book:v1:ETH:5:1', { d: 'from-bg', t: 10 }],
      ['walletList:v1:plain', { d: 'from-ui', t: 10 }],
    ]);

    clearAllSwrCacheNamespaces({ exceptSwrPrefixes: ['perpsL2Book'] });

    // Clearing a store bg is writing would put two writers on one file.
    expect(readSwrCacheEntry('perpsL2Book:v1:ETH:5:1')).toEqual({
      d: 'from-bg',
      t: 10,
    });
    expect(readSwrCacheEntry('walletList:v1:plain')).toBeUndefined();
  });
});
