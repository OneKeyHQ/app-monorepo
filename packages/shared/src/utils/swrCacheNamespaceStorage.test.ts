/**
 * What a namespace may hold as a key is narrower than what an SWR key may be.
 * A key that does not fit used to be dropped on the way in and again on the
 * way out, silently, so the entry simply never existed.
 */
import {
  __resetSwrCacheNamespaceStorageForTests,
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
});
