import type { IBorrowMarketItem } from '@onekeyhq/shared/types/staking';

import { buildBorrowMarketKey } from '../borrowMarketKey';

import {
  BORROW_MARKET_PRELOAD_SUCCESS_TTL,
  getBorrowMarketPreloadCompletionKey,
  getBorrowMarketPreloadNextWakeAt,
  getBorrowMarketPreloadRetryDelay,
  getNextBorrowMarketToPreload,
} from './borrowMarketPreload.utils';

function market(networkId: string, marketAddress: string) {
  return {
    networkId,
    marketAddress,
    provider: 'aave',
  } as IBorrowMarketItem;
}

describe('getNextBorrowMarketToPreload', () => {
  const core = market('evm--1', '0xcore');
  const base = market('evm--8453', '0xbase');
  const arbitrum = market('evm--42161', '0xarbitrum');
  const markets = [base, core, arbitrum];

  it('skips the visible market and keeps same-network work adjacent', () => {
    expect(
      getNextBorrowMarketToPreload({
        markets,
        visibleMarketKey: buildBorrowMarketKey(core),
        attempts: new Map(),
        sessionScopeKey: 'account-1',
        now: 100,
      }),
    ).toEqual({ market: arbitrum, phase: 'reserves' });
  });

  it('requeues a market for a different account scope', () => {
    const attempts = new Map([
      [
        getBorrowMarketPreloadCompletionKey({
          sessionScopeKey: 'account-1',
          market: arbitrum,
        }),
        { nextEligibleAt: 200, failedAttempts: 0 },
      ] as const,
    ]);
    expect(
      getNextBorrowMarketToPreload({
        markets,
        visibleMarketKey: buildBorrowMarketKey(core),
        attempts,
        sessionScopeKey: 'account-1',
        now: 100,
      }),
    ).toEqual({ market: base, phase: 'reserves' });
    expect(
      getNextBorrowMarketToPreload({
        markets,
        visibleMarketKey: buildBorrowMarketKey(core),
        attempts,
        sessionScopeKey: 'account-2',
        now: 100,
      }),
    ).toEqual({ market: arbitrum, phase: 'reserves' });
  });

  it('retries failures before refreshing successful markets', () => {
    const attempts = new Map([
      [
        getBorrowMarketPreloadCompletionKey({
          sessionScopeKey: 'account-1',
          market: arbitrum,
        }),
        { nextEligibleAt: 105, failedAttempts: 1 },
      ] as const,
      [
        getBorrowMarketPreloadCompletionKey({
          sessionScopeKey: 'account-1',
          market: base,
        }),
        {
          nextEligibleAt: 100 + BORROW_MARKET_PRELOAD_SUCCESS_TTL,
          failedAttempts: 0,
        },
      ] as const,
    ]);
    const params = {
      markets,
      visibleMarketKey: buildBorrowMarketKey(core),
      attempts,
      sessionScopeKey: 'account-1',
    };
    expect(
      getNextBorrowMarketToPreload({ ...params, now: 100 }),
    ).toBeUndefined();
    expect(getBorrowMarketPreloadNextWakeAt({ ...params, now: 100 })).toBe(105);
    expect(getNextBorrowMarketToPreload({ ...params, now: 105 })).toEqual({
      market: arbitrum,
      phase: 'reserves',
    });
  });

  it('completes unvisited markets before refreshing an expired market', () => {
    const attempts = new Map([
      [
        getBorrowMarketPreloadCompletionKey({
          sessionScopeKey: 'account-1',
          market: arbitrum,
        }),
        { nextEligibleAt: 100, failedAttempts: 0 },
      ] as const,
    ]);
    expect(
      getNextBorrowMarketToPreload({
        markets,
        visibleMarketKey: buildBorrowMarketKey(core),
        attempts,
        sessionScopeKey: 'account-1',
        now: 100,
      }),
    ).toEqual({ market: base, phase: 'reserves' });
  });

  it('refreshes expired reserves before moving to the next market', () => {
    const attempts = new Map([
      [
        getBorrowMarketPreloadCompletionKey({
          sessionScopeKey: 'account-1',
          market: arbitrum,
          phase: 'reserves',
        }),
        { nextEligibleAt: 100, failedAttempts: 0 },
      ] as const,
      [
        getBorrowMarketPreloadCompletionKey({
          sessionScopeKey: 'account-1',
          market: base,
          phase: 'reserves',
        }),
        {
          nextEligibleAt: 100 + BORROW_MARKET_PRELOAD_SUCCESS_TTL,
          failedAttempts: 0,
        },
      ] as const,
    ]);
    expect(
      getNextBorrowMarketToPreload({
        markets,
        visibleMarketKey: buildBorrowMarketKey(core),
        attempts,
        sessionScopeKey: 'account-1',
        now: 100,
      }),
    ).toEqual({ market: arbitrum, phase: 'reserves' });
  });

  it('caps repeated retry delay', () => {
    expect(getBorrowMarketPreloadRetryDelay(1)).toBe(5000);
    expect(getBorrowMarketPreloadRetryDelay(2)).toBe(10_000);
    expect(getBorrowMarketPreloadRetryDelay(20)).toBe(5 * 60_000);
  });
});
