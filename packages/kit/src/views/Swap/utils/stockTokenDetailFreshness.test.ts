import {
  getStockTokenDetailDisplaySeed,
  isStockTokenDetailStateLanded,
  isStockTokenDetailStateResolvedForActivation,
} from './stockTokenDetailFreshness';

import type { IStockTokenDetailFetchState } from './stockTokenDetailFreshness';

const TTL = 60_000;
const NOW = 1_000_000_000;
const SCOPE = 'evm--1:0xstock:token';
const MOUNT = 'mount-1';
const ACTIVATION = 'activation-1';

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

function resolvedForActivation(
  state: IStockTokenDetailFetchState | undefined,
  activationId = ACTIVATION,
) {
  return isStockTokenDetailStateResolvedForActivation({
    activationId,
    state,
    scope: SCOPE,
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

  it('rejects a token payload whose fetchedAt exceeded the TTL', () => {
    expect(
      landed({
        scope: SCOPE,
        token: stockToken,
        perpsInfo: undefined,
        fetchedAt: NOW - TTL - 1,
      }),
    ).toBe(false);
  });

  it('rejects legacy payloads without fetchedAt', () => {
    expect(
      landed({ scope: SCOPE, token: stockToken, perpsInfo: undefined }),
    ).toBe(false);
  });

  it('lands a genuine empty answer via its own fetchedAt', () => {
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

  it('lands a post-TTL fallback only within the mount that produced it', () => {
    const fallback: IStockTokenDetailFetchState = {
      scope: SCOPE,
      token: undefined,
      perpsInfo: undefined,
      fallbackOfMountId: MOUNT,
    };
    expect(landed(fallback, MOUNT)).toBe(true);
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
});

describe('isStockTokenDetailStateResolvedForActivation', () => {
  it('accepts only a result produced by the current activation', () => {
    const currentState: IStockTokenDetailFetchState = {
      scope: SCOPE,
      token: stockToken,
      perpsInfo: undefined,
      fetchedAt: NOW,
      resolvedByActivationId: ACTIVATION,
    };
    expect(resolvedForActivation(currentState)).toBe(true);
    expect(resolvedForActivation(currentState, 'activation-2')).toBe(false);
  });

  it('settles a current failed request without accepting cached fallback', () => {
    expect(
      resolvedForActivation({
        scope: SCOPE,
        token: undefined,
        perpsInfo: undefined,
        resolvedByActivationId: ACTIVATION,
      }),
    ).toBe(true);
    expect(
      resolvedForActivation({
        scope: SCOPE,
        token: undefined,
        perpsInfo: undefined,
        fallbackOfMountId: MOUNT,
        resolvedByActivationId: 'activation-previous',
      }),
    ).toBe(false);
  });
});

describe('getStockTokenDetailDisplaySeed', () => {
  it('uses stale matching detail for display without landing trade readiness', () => {
    const state: IStockTokenDetailFetchState = {
      scope: SCOPE,
      token: stockToken,
      perpsInfo: undefined,
      fetchedAt: NOW - TTL - 1,
    };

    expect(getStockTokenDetailDisplaySeed({ state, scope: SCOPE })).toBe(
      stockToken,
    );
    expect(landed(state)).toBe(false);
  });

  it('rejects display seeds from another scope or without Stock metadata', () => {
    expect(
      getStockTokenDetailDisplaySeed({
        state: {
          scope: 'evm--1:0xother:token',
          token: stockToken,
          perpsInfo: undefined,
        },
        scope: SCOPE,
      }),
    ).toBeUndefined();
    expect(
      getStockTokenDetailDisplaySeed({
        state: {
          scope: SCOPE,
          token: {} as never,
          perpsInfo: undefined,
        },
        scope: SCOPE,
      }),
    ).toBeUndefined();
  });
});
