import {
  SWAP_PRO_POSITIONS_CACHE_TTL_MS,
  shouldReuseSwapProPositionsCache,
} from './swapProPositionsCacheUtils';

const cacheEntry = {
  ownerKey: 'account-1__evm--1__usd',
  networkIdsKey: 'evm--1',
  currencyId: 'usd',
  tokens: [],
  updatedAt: 1000,
};

describe('swapProPositionsCacheUtils', () => {
  it('reuses a fresh cache for the same owner', () => {
    expect(
      shouldReuseSwapProPositionsCache({
        cacheEntry,
        now: 1000 + SWAP_PRO_POSITIONS_CACHE_TTL_MS - 1,
        ownerKey: cacheEntry.ownerKey,
      }),
    ).toBe(true);
  });

  it('refreshes an expired cache and an explicitly refreshed cache', () => {
    expect(
      shouldReuseSwapProPositionsCache({
        cacheEntry,
        now: 1000 + SWAP_PRO_POSITIONS_CACHE_TTL_MS,
        ownerKey: cacheEntry.ownerKey,
      }),
    ).toBe(false);
    expect(
      shouldReuseSwapProPositionsCache({
        cacheEntry,
        forceRefresh: true,
        now: 1001,
        ownerKey: cacheEntry.ownerKey,
      }),
    ).toBe(false);
  });

  it('never reuses another account owner cache', () => {
    expect(
      shouldReuseSwapProPositionsCache({
        cacheEntry,
        now: 1001,
        ownerKey: 'account-2__evm--1__usd',
      }),
    ).toBe(false);
  });
});
