import { SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS } from '../utils/swrCacheUtils';

import {
  parseNativeSWRCachePatchIntent,
  parseNativeSyncStorageMutation,
} from './nativeStorageTypes';

describe('nativeStorageTypes SWR patch parsing', () => {
  it('accepts more than the former patch item limit', () => {
    const serializedEntry = JSON.stringify({ d: 'value', t: 1 });
    const patch = {
      removePrefixes: [],
      removals: [],
      updates: Array.from(
        { length: 601 },
        (_, index) => [`key-${index}`, serializedEntry] as const,
      ),
    };

    expect(parseNativeSWRCachePatchIntent(patch)).toBe(patch);
  });

  it('accepts patch content larger than the former total payload limit', () => {
    const serializedEntry = JSON.stringify({
      d: 'x'.repeat(17 * 1024),
      t: 1,
    });
    const patch = {
      removePrefixes: [],
      removals: [],
      updates: Array.from(
        { length: 512 },
        (_, index) => [`key-${index}`, serializedEntry] as const,
      ),
    };

    expect(parseNativeSWRCachePatchIntent(patch)).toBe(patch);
  });

  it('accepts an entry larger than the former per-entry limit', () => {
    const patch = {
      removePrefixes: [],
      removals: [],
      updates: [
        [
          'large',
          JSON.stringify({ d: 'x'.repeat(1024 * 1024), t: 1 }),
        ] as const,
      ],
    };

    expect(parseNativeSWRCachePatchIntent(patch)).toBe(patch);
  });

  it('rejects an entry beyond the current per-entry limit', () => {
    const oversizedEntry = 'x'.repeat(SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS + 1);
    const patch = {
      removePrefixes: [],
      removals: [],
      updates: [['large', oversizedEntry] as const],
    };

    expect(parseNativeSWRCachePatchIntent(patch)).toBeUndefined();
    expect(
      parseNativeSyncStorageMutation({
        entries: [['large', oversizedEntry]],
        operation: 'patchSWR',
        store: 'coldStart',
      }),
    ).toBeUndefined();
  });

  it('accepts a canonical mutation beyond the former item limit', () => {
    const serializedEntry = JSON.stringify({ d: 'value', t: 1 });
    const mutation = {
      entries: Array.from(
        { length: 601 },
        (_, index) => [`key-${index}`, serializedEntry] as const,
      ),
      operation: 'patchSWR',
      store: 'coldStart',
    } as const;

    expect(parseNativeSyncStorageMutation(mutation)).toEqual(mutation);
  });
});
