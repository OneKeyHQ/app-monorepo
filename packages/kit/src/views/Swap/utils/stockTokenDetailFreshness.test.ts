import {
  isStockTokenDetailFreshForCheckpoint,
  isStockTokenDetailStateLanded,
} from './stockTokenDetailFreshness';

import type { IStockTokenDetailFetchState } from './stockTokenDetailFreshness';

const TTL = 60_000;
const NOW = 1_000_000_000;
const SCOPE = 'evm--1:0xstock:token';
const MOUNT = 'mount-1';

function landed(
  state: IStockTokenDetailFetchState | undefined,
  mountId = MOUNT,
) {
  return isStockTokenDetailStateLanded({
    state,
    scope: SCOPE,
    mountId,
    ttlMs: TTL,
    now: NOW,
  });
}

const stockToken = { stock: { isOpen: true } } as never;

describe('isStockTokenDetailStateLanded', () => {
  it('lands a token payload with a fresh real-response fetchedAt', () => {
    expect(
      landed({
        scope: SCOPE,
        token: stockToken,
        perpsInfo: undefined,
        fetchedAt: NOW - TTL,
      }),
    ).toBe(true);
  });

  it('rejects a token payload whose fetchedAt exceeded the TTL (stale SWR hydration)', () => {
    expect(
      landed({
        scope: SCOPE,
        token: stockToken,
        perpsInfo: undefined,
        fetchedAt: NOW - TTL - 1,
      }),
    ).toBe(false);
  });

  it('rejects future and non-finite fetchedAt values', () => {
    [NOW + 1, Number.NaN, Number.POSITIVE_INFINITY].forEach((fetchedAt) => {
      expect(
        landed({
          scope: SCOPE,
          token: stockToken,
          perpsInfo: undefined,
          fetchedAt,
          fallbackOfMountId: MOUNT,
        }),
      ).toBe(false);
    });
  });

  it('rejects legacy payloads without fetchedAt (untrustworthy cache-entry timestamps)', () => {
    expect(
      landed({ scope: SCOPE, token: stockToken, perpsInfo: undefined }),
    ).toBe(false);
  });

  it('lands a genuine empty answer (asset is not a stock) via its own fetchedAt', () => {
    expect(
      landed({
        scope: SCOPE,
        token: undefined,
        perpsInfo: undefined,
        fetchedAt: NOW,
      }),
    ).toBe(true);
    expect(
      landed({
        scope: SCOPE,
        token: undefined,
        perpsInfo: undefined,
        fetchedAt: NOW - TTL - 1,
      }),
    ).toBe(false);
  });

  it('lands the post-TTL error fallback only within the mount that produced it', () => {
    const fallback: IStockTokenDetailFetchState = {
      scope: SCOPE,
      token: undefined,
      perpsInfo: undefined,
      fallbackOfMountId: MOUNT,
    };
    // Same mount: extended outage settles to MarketUnavailable.
    expect(landed(fallback, MOUNT)).toBe(true);
    // Later mount (persisted fallback hydrated back): stays pending so
    // the first real request decides — the backend may have recovered.
    expect(landed(fallback, 'mount-2')).toBe(false);
  });

  it('never lands a scope mismatch or a missing state', () => {
    expect(
      landed({
        scope: 'evm--1:0xother:token',
        token: stockToken,
        perpsInfo: undefined,
        fetchedAt: NOW,
      }),
    ).toBe(false);
    expect(landed(undefined)).toBe(false);
  });

  it('checkpoints only a server response fetched after the current token scope started', () => {
    expect(
      isStockTokenDetailFreshForCheckpoint({
        now: NOW,
        scope: SCOPE,
        scopeStartedAt: NOW,
        state: {
          scope: SCOPE,
          token: stockToken,
          perpsInfo: undefined,
          fetchedAt: NOW,
        },
      }),
    ).toBe(true);
    expect(
      isStockTokenDetailFreshForCheckpoint({
        now: NOW,
        scope: SCOPE,
        scopeStartedAt: NOW,
        state: {
          scope: SCOPE,
          token: stockToken,
          perpsInfo: undefined,
          fetchedAt: NOW - 1,
        },
      }),
    ).toBe(false);
    expect(
      isStockTokenDetailFreshForCheckpoint({
        now: NOW,
        scope: SCOPE,
        scopeStartedAt: NOW,
        state: {
          scope: 'evm--1:0xother:token',
          token: stockToken,
          perpsInfo: undefined,
          fetchedAt: NOW + 1,
        },
      }),
    ).toBe(false);
    expect(
      isStockTokenDetailFreshForCheckpoint({
        now: NOW,
        scope: SCOPE,
        scopeStartedAt: NOW,
        state: {
          scope: SCOPE,
          token: stockToken,
          perpsInfo: undefined,
          fetchedAt: NOW + 1,
        },
      }),
    ).toBe(false);
  });
});
