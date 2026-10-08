import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  SNAPSHOT_CACHE_MANIFEST_KEY,
  createSnapshotCacheSync,
} from './createSnapshotCacheSync';
import {
  parseSnapshotCacheManifest,
  planSnapshotCacheSweep,
  planSnapshotCacheWrite,
} from './snapshotCacheManifest';

import type { IDisplaySnapshotStorageSync } from '../DisplaySnapshotStorage/types';

function createFakeStorage() {
  const records = new Map<string, string>();
  const compactCalls = { count: 0 };
  const storage: IDisplaySnapshotStorageSync = {
    read: (key) => records.get(key),
    readMany: (keys) => {
      const result = new Map<string, string>();
      keys.forEach((key) => {
        const value = records.get(key);
        if (value !== undefined) result.set(key, value);
      });
      return result;
    },
    commit: (input) => {
      if (input.expectedCommitMarker) {
        const current = records.get(input.expectedCommitMarker.key);
        if (current !== input.expectedCommitMarker.value) {
          throw new OneKeyLocalError('marker changed');
        }
      }
      input.entries.forEach(({ key, value }) => records.set(key, value));
      records.set(input.commitMarker.key, input.commitMarker.value);
      input.removeKeys?.forEach((key) => records.delete(key));
    },
    remove: (keys) => keys.forEach((key) => records.delete(key)),
    clearNamespace: () => records.clear(),
    compact: () => {
      compactCalls.count += 1;
    },
  };
  return { storage, records, compactCalls };
}

const HOUR = 60 * 60 * 1000;

describe('snapshotCacheManifest', () => {
  const config = { maxEntries: 3, maxAgeMs: 24 * HOUR };

  it('falls back to an empty manifest for unreadable or foreign payloads', () => {
    expect(parseSnapshotCacheManifest(undefined).e).toEqual({});
    expect(parseSnapshotCacheManifest('not json').e).toEqual({});
    expect(parseSnapshotCacheManifest('{"v":99,"e":{"a":1}}').e).toEqual({});
    expect(parseSnapshotCacheManifest('{"v":1,"e":{"a":"x"}}').e).toEqual({});
    expect(parseSnapshotCacheManifest('{"v":1,"e":{"a":5}}').e).toEqual({
      a: 5,
    });
  });

  it('evicts the oldest entry once the namespace is full', () => {
    const plan = planSnapshotCacheWrite({
      manifest: { v: 1, e: { a: 10, b: 20, c: 30 } },
      key: 'd',
      updatedAt: 40,
      config,
      now: 40,
    });
    expect(plan.removeKeys).toEqual(['a']);
    expect(Object.keys(plan.manifest.e).toSorted()).toEqual(['b', 'c', 'd']);
  });

  it('never evicts the key being written, even when it is the oldest', () => {
    const now = 100 * HOUR;
    const plan = planSnapshotCacheWrite({
      manifest: { v: 1, e: { b: now - 1, c: now - 2, d: now - 3 } },
      key: 'a',
      updatedAt: now - 100,
      config,
      now,
    });
    expect(plan.removeKeys).toEqual(['d']);
    expect(plan.manifest.e.a).toBe(now - 100);
    expect(Object.keys(plan.manifest.e).toSorted()).toEqual(['a', 'b', 'c']);
  });

  it('drops entries past the max age before applying the count limit', () => {
    const now = 100 * HOUR;
    const plan = planSnapshotCacheSweep({
      manifest: {
        v: 1,
        e: { stale: now - 25 * HOUR, fresh: now - 1 * HOUR },
      },
      config,
      now,
    });
    expect(plan.removeKeys).toEqual(['stale']);
    expect(plan.changed).toBe(true);
  });

  it('reports no change when nothing needs dropping', () => {
    expect(
      planSnapshotCacheSweep({
        manifest: { v: 1, e: { fresh: 100 * HOUR } },
        config,
        now: 100 * HOUR,
      }).changed,
    ).toBe(false);
  });
});

describe('createSnapshotCacheSync', () => {
  const retention = { maxEntries: 3, maxAgeMs: 24 * HOUR };

  it('round-trips a value and keeps the manifest as the commit marker', () => {
    const { storage, records } = createFakeStorage();
    const clock = { value: 1000 };
    const cache = createSnapshotCacheSync<{ symbol: string }>({
      storage,
      retention,
      now: () => clock.value,
    });

    cache.set('MSFT:en-us', { symbol: 'MSFT' });

    expect(cache.get('MSFT:en-us')).toEqual({
      data: { symbol: 'MSFT' },
      updatedAt: 1000,
    });
    expect(records.has('d:MSFT:en-us')).toBe(true);
    expect(
      parseSnapshotCacheManifest(records.get(SNAPSHOT_CACHE_MANIFEST_KEY)).e,
    ).toEqual({ 'MSFT:en-us': 1000 });
  });

  it('reads a single record and never the manifest', () => {
    const { storage } = createFakeStorage();
    const cache = createSnapshotCacheSync<number>({ storage, retention });
    cache.set('a', 1);

    const readKeys: string[] = [];
    const spied = {
      ...storage,
      read: (key: string) => {
        readKeys.push(key);
        return storage.read(key);
      },
    };
    const reader = createSnapshotCacheSync<number>({
      storage: spied,
      retention,
    });
    expect(reader.get('a')).toEqual({ data: 1, updatedAt: expect.any(Number) });
    expect(readKeys).toEqual(['d:a']);
  });

  it('treats a record past the max age as a miss even while the manifest lists it', () => {
    const { storage, records } = createFakeStorage();
    const clock = { value: 100 * HOUR };
    const cache = createSnapshotCacheSync<number>({
      storage,
      retention,
      now: () => clock.value,
    });
    cache.set('a', 1);
    expect(cache.get('a')).toBeDefined();

    clock.value += 24 * HOUR;
    expect(cache.get('a')).toBeUndefined();
    // The record is still on disk; the sweep is what reclaims it.
    expect(records.has('d:a')).toBe(true);
  });

  it('removes the oldest record once the namespace is full', () => {
    const { storage, records } = createFakeStorage();
    const clock = { value: 1000 };
    const cache = createSnapshotCacheSync<number>({
      storage,
      retention,
      now: () => clock.value,
    });
    ['a', 'b', 'c'].forEach((key) => {
      cache.set(key, 1);
      clock.value += 1000;
    });
    cache.set('d', 1);

    expect(records.has('d:a')).toBe(false);
    expect([...records.keys()].toSorted()).toEqual([
      'd:b',
      'd:c',
      'd:d',
      SNAPSHOT_CACHE_MANIFEST_KEY,
    ]);
  });

  it('touch keeps a revisited record resident without rewriting its payload', () => {
    const { storage, records } = createFakeStorage();
    const clock = { value: 1000 };
    const cache = createSnapshotCacheSync<number>({
      storage,
      retention,
      now: () => clock.value,
    });
    ['a', 'b', 'c'].forEach((key) => {
      cache.set(key, 1);
      clock.value += 1000;
    });
    const payloadBefore = records.get('d:a');
    // Reading 'a' again is a revisit: bump its recency only.
    cache.touch('a');
    clock.value += 1000;
    cache.set('d', 1);

    // 'b' was the least recently used, not 'a'.
    expect(records.has('d:b')).toBe(false);
    expect(records.get('d:a')).toBe(payloadBefore);
    expect([...records.keys()].toSorted()).toEqual([
      'd:a',
      'd:c',
      'd:d',
      SNAPSHOT_CACHE_MANIFEST_KEY,
    ]);
    // Unknown keys are ignored.
    cache.touch('zzz');
    expect(records.has('d:zzz')).toBe(false);
  });

  it('ignores keys the backing store would reject', () => {
    const { storage, records } = createFakeStorage();
    const cache = createSnapshotCacheSync<number>({ storage, retention });
    cache.set('_leading-underscore', 1);
    cache.set('has space', 1);
    expect(records.size).toBe(0);
    expect(cache.get('_leading-underscore')).toBeUndefined();
  });

  it('retries once when another writer moved the marker', () => {
    const { storage, records } = createFakeStorage();
    const clock = { value: 100 * HOUR };
    let firstCommit = true;
    const racing: IDisplaySnapshotStorageSync = {
      ...storage,
      commit: (input) => {
        if (firstCommit) {
          firstCommit = false;
          // Simulate the other writer landing between our read and commit.
          records.set(
            SNAPSHOT_CACHE_MANIFEST_KEY,
            `{"v":1,"e":{"other":${clock.value - 1000}}}`,
          );
        }
        storage.commit(input);
      },
    };
    const cache = createSnapshotCacheSync<number>({
      storage: racing,
      retention,
      now: () => clock.value,
    });
    cache.set('a', 1);

    expect(cache.get('a')).toBeDefined();
    expect(
      Object.keys(
        parseSnapshotCacheManifest(records.get(SNAPSHOT_CACHE_MANIFEST_KEY)).e,
      ).toSorted(),
    ).toEqual(['a', 'other']);
  });

  it('sweeps expired records and compacts only when something was dropped', () => {
    const { storage, records, compactCalls } = createFakeStorage();
    const clock = { value: 100 * HOUR };
    const cache = createSnapshotCacheSync<number>({
      storage,
      retention,
      now: () => clock.value,
    });
    cache.set('stale', 1);
    clock.value += 1 * HOUR;
    cache.set('fresh', 1);

    cache.sweep();
    expect(compactCalls.count).toBe(0);
    expect(records.has('d:stale')).toBe(true);

    clock.value += 24 * HOUR;
    cache.sweep();
    expect(compactCalls.count).toBe(1);
    expect(records.has('d:stale')).toBe(false);
    expect(records.has('d:fresh')).toBe(false);
  });
});
