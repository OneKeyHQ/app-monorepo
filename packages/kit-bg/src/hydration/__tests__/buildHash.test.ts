// Regression tests for the BUILD_HASH fallback used by the cold-start
// hydration gate. The helper must prefer the per-commit SHA over the
// coarser version/buildNumber pair, and must return undefined only when
// no signal is available — anything else would silently disable the
// schema-invalidation gate across deploys.

import { CONTEXT_ATOM_COLD_START_CACHE_KEYS } from '@onekeyhq/shared/src/consts/jotaiConsts';
import { SWAP_TOKEN_SELECTOR_SNAPSHOT_MAX_CHARS } from '@onekeyhq/shared/src/utils/swapTokenSelectorSnapshotUtils';

import {
  computeEffectiveBuildHash,
  countNonMetaEntries,
  filterDevSafeL2CtxSnapshot,
  shouldProceedAfterReset,
} from '../hydrate';

describe('computeEffectiveBuildHash', () => {
  it('prefers githubSHA when present', () => {
    expect(computeEffectiveBuildHash('abc123', '5.0.0', '1234')).toBe('abc123');
  });

  it('prefers githubSHA even if version/buildNumber are also set', () => {
    // The per-commit SHA bumps on every push, so it must win over the
    // release-only version/buildNumber pair whenever it is available.
    expect(computeEffectiveBuildHash('deadbeef', '5.0.0', '42')).toBe(
      'deadbeef',
    );
  });

  it('falls back to v:<version>:<buildNumber> when githubSHA is missing', () => {
    expect(computeEffectiveBuildHash(undefined, '5.0.0', '1234')).toBe(
      'v:5.0.0:1234',
    );
  });

  it('keeps buildNumber slot empty when only version is available', () => {
    expect(computeEffectiveBuildHash(undefined, '5.0.0', undefined)).toBe(
      'v:5.0.0:',
    );
  });

  it('treats empty-string githubSHA as missing', () => {
    expect(computeEffectiveBuildHash('', '5.0.0', '1')).toBe('v:5.0.0:1');
  });

  it('returns undefined when both githubSHA and version are absent', () => {
    expect(
      computeEffectiveBuildHash(undefined, undefined, undefined),
    ).toBeUndefined();
  });

  it('returns undefined when version is empty and githubSHA is absent', () => {
    // No usable signal — we must NOT manufacture a placeholder hash, or
    // every deploy with empty env would share the same marker and the
    // invalidation gate would never trigger.
    expect(computeEffectiveBuildHash(undefined, '', '1234')).toBeUndefined();
  });
});

// Regression tests for the post-reset IDB recheck gate. resetColdStartCache
// in webColdStartStorage swallows db.clear failures (best-effort
// semantics), so a successful await does NOT prove the store is empty.
// hydrate.ts uses shouldProceedAfterReset to gate the prime + marker-refresh
// step on a fresh recheck — if non-meta entries survived the wipe we must
// surface as 'error' to avoid writing the new BUILD_HASH on top of stale
// data, which would silently match on the next boot and prime data written
// under a different schema.

describe('shouldProceedAfterReset', () => {
  it('proceeds when recheck returns an empty map', () => {
    expect(shouldProceedAfterReset(new Map())).toBe(true);
  });

  it('proceeds when recheck contains only ui-snapshot-meta:* entries', () => {
    // Meta-only is indistinguishable from a brand-new DB to downstream
    // consumers (countNonMetaEntries == 0).
    const recheck = new Map<string, unknown>([
      ['ui-snapshot-meta:buildHash', 'abc'],
      ['ui-snapshot-meta:other', 'def'],
    ]);
    expect(shouldProceedAfterReset(recheck)).toBe(true);
  });

  it('refuses to proceed when recheck still contains a non-meta entry', () => {
    // db.clear must have failed (silently swallowed by resetColdStartCache);
    // writing the new marker now would falsely vouch for stale entries.
    const recheck = new Map<string, unknown>([
      ['ui-snapshot-meta:buildHash', 'abc'],
      ['ctx-atom-snapshot:d:v1', '{"stale":true}'],
    ]);
    expect(shouldProceedAfterReset(recheck)).toBe(false);
  });

  it('refuses to proceed when recheck is undefined (timeout / throw)', () => {
    // No proof the wipe succeeded → must NOT proceed.
    expect(shouldProceedAfterReset(undefined)).toBe(false);
  });
});

describe('filterDevSafeL2CtxSnapshot', () => {
  it('keeps only versioned display-only Swap balance caches', () => {
    const balanceCache = {
      version: 1,
      entries: [{ accountAddress: '0xabc', balance: '1' }],
    };
    expect(
      filterDevSafeL2CtxSnapshot({
        'store:swap::ctx:swapBalanceDisplayCacheAtom': balanceCache,
        'store:swap::ctx:swapStockBalanceDisplayCacheAtom': balanceCache,
        'store:swap::ctx:swapSelectFromTokenAtom': { symbol: 'ETH' },
        'store:swap::ctx:swapProPositionsCacheAtom': { byOwner: {} },
        'store:swap::ctx:swapStockBalanceDisplayCacheAtom:invalid':
          balanceCache,
      }),
    ).toEqual({
      'store:swap::ctx:swapBalanceDisplayCacheAtom': balanceCache,
      'store:swap::ctx:swapStockBalanceDisplayCacheAtom': balanceCache,
    });
  });

  it('rejects unversioned or malformed balance cache payloads', () => {
    expect(
      filterDevSafeL2CtxSnapshot({
        'store:swap::ctx:swapBalanceDisplayCacheAtom': {
          entries: [],
        },
        'store:swap::ctx:swapStockBalanceDisplayCacheAtom': {
          version: 1,
          entries: null,
        },
      }),
    ).toEqual({});
  });

  it('hydrates complete selector snapshots for display without runtime refresh authority', () => {
    const scopeKey = `store:swap::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTokenMapAtom}`;
    const queryKey = JSON.stringify({ networkId: 'evm--1', keywords: '' });
    const emptyQueryKey = JSON.stringify({
      networkId: 'evm--10',
      keywords: '',
    });
    const searchQueryKey = JSON.stringify({
      networkId: 'evm--1',
      keywords: 'eth',
    });
    const tokens = [
      {
        networkId: 'evm--1',
        contractAddress: '',
        symbol: 'ETH',
        decimals: 18,
        balanceParsed: '1',
      },
    ];
    const entry = {
      data: tokens,
      updatedAt: 10,
      refreshVersion: 5,
      identityVersion: 3,
    };
    expect(
      filterDevSafeL2CtxSnapshot({
        [scopeKey]: {
          version: 1,
          tokenCatch: {
            [queryKey]: entry,
            [emptyQueryKey]: { ...entry, data: [] },
            [searchQueryKey]: entry,
          },
        },
      }),
    ).toEqual({
      [scopeKey]: {
        version: 1,
        updatedAt: 10,
        tokenCatch: {
          [queryKey]: {
            data: tokens,
            updatedAt: 10,
            identityVersion: 0,
            persisted: true,
          },
          [emptyQueryKey]: {
            data: [],
            updatedAt: 10,
            identityVersion: 0,
            persisted: true,
          },
        },
      },
    });
  });

  it.each([
    { tokenCatch: {} },
    { version: 2, tokenCatch: {} },
    { version: 1 },
    { version: 1, tokenCatch: [] },
    { version: 1, tokenCatch: null },
  ])('rejects incompatible selector snapshot envelopes %j', (value) => {
    expect(
      filterDevSafeL2CtxSnapshot({
        [`store:swap::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTokenMapAtom}`]:
          value,
      }),
    ).toEqual({});
  });

  it('applies selector limits by evicting whole entries before dev hydration', () => {
    const scopeKey = `store:swap::${CONTEXT_ATOM_COLD_START_CACHE_KEYS.swapTokenMapAtom}`;
    const queryKey = JSON.stringify({ networkId: 'evm--1', keywords: '' });
    const emptyQueryKey = JSON.stringify({
      networkId: 'evm--10',
      keywords: '',
    });
    const largeToken = {
      networkId: 'evm--1',
      contractAddress: '',
      symbol: 'ETH',
      decimals: 18,
      name: 'x'.repeat(SWAP_TOKEN_SELECTOR_SNAPSHOT_MAX_CHARS),
    };
    expect(
      filterDevSafeL2CtxSnapshot({
        [scopeKey]: {
          version: 1,
          tokenCatch: {
            [queryKey]: { data: [largeToken], updatedAt: 20 },
            [emptyQueryKey]: { data: [], updatedAt: 10 },
          },
        },
      }),
    ).toEqual({
      [scopeKey]: {
        version: 1,
        updatedAt: 10,
        tokenCatch: {
          [emptyQueryKey]: {
            data: [],
            updatedAt: 10,
            identityVersion: 0,
            persisted: true,
          },
        },
      },
    });
  });
});

describe('countNonMetaEntries', () => {
  it('returns 0 for an empty map', () => {
    expect(countNonMetaEntries(new Map())).toBe(0);
  });

  it('ignores ui-snapshot-meta:* keys', () => {
    const m = new Map<string, unknown>([
      ['ui-snapshot-meta:buildHash', 'x'],
      ['ui-snapshot-meta:other', 'y'],
    ]);
    expect(countNonMetaEntries(m)).toBe(0);
  });

  it('counts payload keys but skips meta keys mixed in', () => {
    const m = new Map<string, unknown>([
      ['ui-snapshot-meta:buildHash', 'x'],
      ['ctx-atom-snapshot:d:v1', '{}'],
      ['swr:cache', '{}'],
    ]);
    expect(countNonMetaEntries(m)).toBe(2);
  });
});
