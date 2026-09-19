import { EAppSyncStorageKeys } from '../syncStorageKeys';

import {
  WEB_SWR_CACHE_ENTRY_PREFIX,
  createWebSWRCacheEntries,
  isWebSWRCachePersistedKey,
} from './webSWRCacheEntries';

const LEGACY_KEY = EAppSyncStorageKeys.onekey_swr_cache as string;

function entry(d: unknown, t: number) {
  return JSON.stringify({ d, t });
}

function createBackend(initial: Record<string, unknown> = {}) {
  const map = new Map<string, unknown>(Object.entries(initial));
  const writes: string[] = [];
  const deletes: string[] = [];
  const entries = createWebSWRCacheEntries({
    keys: () => map.keys(),
    get: (key) => map.get(key),
    set: (key, value) => {
      writes.push(key);
      map.set(key, value);
    },
    delete: (key) => {
      deletes.push(key);
      map.delete(key);
    },
  });
  return { deletes, entries, map, writes };
}

const physical = (key: string) => `${WEB_SWR_CACHE_ENTRY_PREFIX}${key}`;

describe('web SWR cache entries', () => {
  it('recognizes only SWR records and the legacy store as SWR keys', () => {
    expect(isWebSWRCachePersistedKey(LEGACY_KEY)).toBe(true);
    expect(isWebSWRCachePersistedKey(physical('walletList:v1:0'))).toBe(true);
    expect(isWebSWRCachePersistedKey('__meta:buildHash')).toBe(false);
  });

  it('reads one serialized entry per SWR record and skips other keys', () => {
    const { entries } = createBackend({
      [physical('a')]: entry(1, 10),
      [physical('b')]: entry(2, 20),
      [physical('c')]: { notAString: true },
      '__meta:buildHash': 'hash',
    });

    expect(entries.readSWRCacheEntries()).toEqual([
      ['a', entry(1, 10)],
      ['b', entry(2, 20)],
    ]);
  });

  it('splits the legacy store once and keeps newer per-entry records', () => {
    const { entries, map } = createBackend({
      [LEGACY_KEY]: JSON.stringify({
        older: { d: 'legacy', t: 5 },
        newer: { d: 'legacy', t: 50 },
        only: { d: 'legacy', t: 7 },
        invalid: { d: 'no timestamp' },
      }),
      [physical('older')]: entry('record', 9),
      [physical('newer')]: entry('record', 30),
    });

    const read = new Map(entries.readSWRCacheEntries());

    expect(map.has(LEGACY_KEY)).toBe(false);
    expect(read.get('older')).toBe(entry('record', 9));
    expect(read.get('newer')).toBe(entry('legacy', 50));
    expect(read.get('only')).toBe(entry('legacy', 7));
    expect(read.has('invalid')).toBe(false);
  });

  it('drops an unreadable legacy store without touching records', () => {
    const { entries, map } = createBackend({
      [LEGACY_KEY]: '{broken',
      [physical('a')]: entry(1, 10),
    });

    expect(entries.readSWRCacheEntries()).toEqual([['a', entry(1, 10)]]);
    expect(map.has(LEGACY_KEY)).toBe(false);
  });

  it('writes and removes only the records a patch names', () => {
    const { entries, map, writes, deletes } = createBackend({
      [physical('keep')]: entry('keep', 10),
      [physical('stale')]: entry('stale', 10),
      [physical('newer')]: entry('newer', 100),
      [physical('update')]: entry('old', 10),
    });

    entries.applySWRCachePatch({
      removePrefixes: [],
      removals: [
        ['stale', 20],
        ['newer', 20],
      ],
      updates: [
        ['update', entry('new', 30)],
        ['added', entry('added', 30)],
      ],
    });

    expect(writes).toEqual([physical('update'), physical('added')]);
    expect(deletes).toEqual([physical('stale')]);
    expect(map.get(physical('keep'))).toBe(entry('keep', 10));
    expect(map.get(physical('newer'))).toBe(entry('newer', 100));
    expect(map.get(physical('update'))).toBe(entry('new', 30));
  });

  it('keeps a newer record over an older incoming update', () => {
    const { entries, map, writes } = createBackend({
      [physical('a')]: entry('newer', 50),
    });

    entries.applySWRCachePatch({
      removePrefixes: [],
      removals: [],
      updates: [
        ['a', entry('older', 40)],
        ['bad', '{broken'],
      ],
    });

    expect(writes).toEqual([]);
    expect(map.get(physical('a'))).toBe(entry('newer', 50));
  });

  it('applies prefix and clear-all deletions by timestamp', () => {
    const { entries, map } = createBackend({
      [physical('accSelList:v1:hd-1')]: entry(1, 10),
      [physical('accSelList:v1:hd-2')]: entry(2, 40),
      [physical('walletList:v1:0')]: entry(3, 10),
      [physical('market:v1')]: entry(4, 60),
      [physical('broken')]: '{broken',
    });

    entries.applySWRCachePatch({
      removePrefixes: [{ prefix: 'accSelList:', at: 20 }],
      removals: [],
      updates: [],
    });
    expect([...map.keys()].toSorted()).toEqual(
      [
        physical('accSelList:v1:hd-2'),
        physical('broken'),
        physical('market:v1'),
        physical('walletList:v1:0'),
      ].toSorted(),
    );

    entries.applySWRCachePatch({
      clearBefore: 50,
      removePrefixes: [],
      removals: [],
      updates: [['after', entry('after', 70)]],
    });
    expect([...map.keys()].toSorted()).toEqual(
      [physical('after'), physical('market:v1')].toSorted(),
    );
  });

  it('notifies subscribers that the entries must be read again', () => {
    const { entries } = createBackend();
    const listener = jest.fn();
    const unsubscribe = entries.subscribeSWRCacheEntries(listener);

    entries.notifyEntriesReplaced();
    unsubscribe();
    entries.notifyEntriesReplaced();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(null);
  });
});
