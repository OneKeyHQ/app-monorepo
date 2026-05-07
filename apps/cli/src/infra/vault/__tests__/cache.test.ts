import { decideCacheAction } from '../cache';
import {
  ABSOLUTE_MAX_TTL_MS,
  REFRESH_THRESHOLD_MS,
  SLIDING_TTL_MS,
} from '../constants';

import type { IVaultCacheEntry } from '../types';

const T0 = 1_714_000_000_000;

function createEntry(
  overrides: Partial<IVaultCacheEntry> = {},
): IVaultCacheEntry {
  return {
    hdCredentialBlob: 'blob',
    issuedAt: T0,
    expiresAt: T0 + SLIDING_TTL_MS,
    ...overrides,
  };
}

describe('decideCacheAction', () => {
  it('misses when no cache entry exists', () => {
    expect(decideCacheAction(undefined, T0)).toEqual({
      kind: 'miss',
      reason: 'not-found',
    });
  });

  it('misses on clock-back when now is before issuedAt', () => {
    expect(decideCacheAction(createEntry(), T0 - 1)).toEqual({
      kind: 'miss',
      reason: 'clock-back',
    });
  });

  it('misses at the absolute 24h boundary', () => {
    expect(decideCacheAction(createEntry(), T0 + ABSOLUTE_MAX_TTL_MS)).toEqual({
      kind: 'miss',
      reason: 'absolute',
    });
  });

  it('absolute max wins even when expiresAt is in the future', () => {
    const entry = createEntry({
      expiresAt: T0 + ABSOLUTE_MAX_TTL_MS + SLIDING_TTL_MS,
    });

    expect(decideCacheAction(entry, T0 + ABSOLUTE_MAX_TTL_MS + 1)).toEqual({
      kind: 'miss',
      reason: 'absolute',
    });
  });

  it('misses at the sliding expiry boundary', () => {
    expect(decideCacheAction(createEntry(), T0 + SLIDING_TTL_MS)).toEqual({
      kind: 'miss',
      reason: 'expired',
    });
  });

  it('misses after sliding expiry', () => {
    expect(decideCacheAction(createEntry(), T0 + SLIDING_TTL_MS + 1)).toEqual({
      kind: 'miss',
      reason: 'expired',
    });
  });

  it('hits without writing when remaining TTL is above the refresh threshold', () => {
    const entry = createEntry();
    const now = entry.expiresAt - REFRESH_THRESHOLD_MS - 1;

    expect(decideCacheAction(entry, now)).toEqual({
      entry,
      kind: 'hit-no-write',
    });
  });

  it('refreshes when remaining TTL equals the refresh threshold', () => {
    const entry = createEntry();
    const now = entry.expiresAt - REFRESH_THRESHOLD_MS;

    expect(decideCacheAction(entry, now)).toEqual({
      kind: 'hit-refresh',
      nextEntry: {
        ...entry,
        expiresAt: now + SLIDING_TTL_MS,
      },
    });
  });

  it('refreshes when remaining TTL is below the refresh threshold', () => {
    const entry = createEntry();
    const now = entry.expiresAt - REFRESH_THRESHOLD_MS + 1;

    expect(decideCacheAction(entry, now)).toEqual({
      kind: 'hit-refresh',
      nextEntry: {
        ...entry,
        expiresAt: now + SLIDING_TTL_MS,
      },
    });
  });

  it('truncates refreshes at the absolute 24h cap', () => {
    const entry = createEntry({
      expiresAt: T0 + ABSOLUTE_MAX_TTL_MS - 3 * 60 * 1000,
    });
    const now = entry.expiresAt - 60 * 1000;

    expect(decideCacheAction(entry, now)).toEqual({
      kind: 'hit-refresh',
      nextEntry: {
        ...entry,
        expiresAt: T0 + ABSOLUTE_MAX_TTL_MS,
      },
    });
  });

  it('does not write when refresh would not extend expiresAt', () => {
    const entry = createEntry({
      expiresAt: T0 + ABSOLUTE_MAX_TTL_MS,
    });
    const now = entry.expiresAt - 60 * 1000;

    expect(decideCacheAction(entry, now)).toEqual({
      entry,
      kind: 'hit-no-write',
    });
  });

  it('keeps issuedAt unchanged across refreshes', () => {
    const entry = createEntry();
    const now = entry.expiresAt - REFRESH_THRESHOLD_MS;
    const decision = decideCacheAction(entry, now);

    expect(decision.kind).toBe('hit-refresh');
    if (decision.kind === 'hit-refresh') {
      expect(decision.nextEntry.issuedAt).toBe(entry.issuedAt);
    }
  });

  it('keeps 24h high-frequency refresh writes within the vault write budget', () => {
    let entry = createEntry();
    let refreshCount = 0;

    for (let index = 0; index < 1000; index += 1) {
      const now = T0 + Math.floor((ABSOLUTE_MAX_TTL_MS * index) / 1000);
      const decision = decideCacheAction(entry, now);
      if (decision.kind === 'hit-refresh') {
        refreshCount += 1;
        entry = decision.nextEntry;
      }
    }

    expect(refreshCount).toBeLessThanOrEqual(25);
  });
});
