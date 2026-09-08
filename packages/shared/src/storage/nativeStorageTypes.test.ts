import {
  SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS,
  SWR_CACHE_MAX_KEY_CHARS,
  SWR_CACHE_MAX_KEY_UTF8_BYTES,
} from '../utils/swrCacheUtils';

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

  it('drops an oversized entry without rejecting the remaining patch', () => {
    const oversizedEntry = 'x'.repeat(SWR_CACHE_MAX_ENTRY_SERIALIZED_CHARS + 1);
    const serializedEntry = JSON.stringify({ d: 'value', t: 1 });
    const patch = {
      removePrefixes: [],
      removals: [],
      updates: [
        ['large', oversizedEntry] as const,
        ['valid', serializedEntry] as const,
      ],
    };

    expect(parseNativeSWRCachePatchIntent(patch)).toEqual({
      removePrefixes: [],
      removals: [],
      updates: [['valid', serializedEntry]],
    });
    expect(
      parseNativeSyncStorageMutation({
        entries: [
          ['large', oversizedEntry],
          ['valid', serializedEntry],
        ],
        operation: 'patchSWR',
        sourceMutationId: 7,
        store: 'coldStart',
      }),
    ).toEqual({
      entries: [['valid', serializedEntry]],
      operation: 'patchSWR',
      sourceMutationId: 7,
      store: 'coldStart',
    });
  });

  it('drops only keys beyond the character or UTF-8 budgets', () => {
    const serializedEntry = JSON.stringify({ d: 'value', t: 1 });
    const tooManyChars = 'x'.repeat(SWR_CACHE_MAX_KEY_CHARS + 1);
    const tooManyUtf8Bytes = '界'.repeat(
      Math.floor(SWR_CACHE_MAX_KEY_UTF8_BYTES / 3) + 1,
    );

    expect(
      parseNativeSWRCachePatchIntent({
        removePrefixes: [
          { at: 1, prefix: tooManyUtf8Bytes },
          { at: 2, prefix: 'wallet:' },
        ],
        removals: [
          [tooManyChars, 1],
          ['removed', 2],
        ],
        updates: [
          [tooManyChars, serializedEntry],
          [tooManyUtf8Bytes, serializedEntry],
          ['valid', serializedEntry],
        ],
      }),
    ).toEqual({
      removePrefixes: [{ at: 2, prefix: 'wallet:' }],
      removals: [['removed', 2]],
      updates: [['valid', serializedEntry]],
    });
    expect(
      parseNativeSyncStorageMutation({
        entries: [
          [tooManyChars, serializedEntry],
          [tooManyUtf8Bytes, serializedEntry],
          ['valid', serializedEntry],
        ],
        operation: 'patchSWR',
        sourceMutationId: 9,
        store: 'coldStart',
      }),
    ).toEqual({
      entries: [['valid', serializedEntry]],
      operation: 'patchSWR',
      sourceMutationId: 9,
      store: 'coldStart',
    });
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
