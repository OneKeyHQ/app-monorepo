import type { IBorrowMarketItem } from '@onekeyhq/shared/types/staking';

import { resolveRememberedBorrowMarket } from './borrowMarketMemory.utils';

function buildMarket(marketAddress: string): IBorrowMarketItem {
  return {
    provider: 'Aave',
    networkId: 'evm--1',
    marketAddress,
  } as unknown as IBorrowMarketItem;
}

const aave = buildMarket('0xAAA');
const spark = buildMarket('0xBBB');
const markets = [aave, spark];
const sparkKey = 'aave:evm--1:0xbbb';

function resolve(
  overrides: Partial<Parameters<typeof resolveRememberedBorrowMarket>[0]> = {},
) {
  return resolveRememberedBorrowMarket({
    markets,
    rememberedKey: sparkKey,
    hasUserChosen: false,
    hasRestored: false,
    currentMarket: aave,
    ...overrides,
  });
}

describe('resolveRememberedBorrowMarket', () => {
  it('restores the remembered market over the default first entry', () => {
    expect(resolve()).toBe(spark);
  });

  it('stays armed for a key that arrives after the market list', () => {
    // Storage hydrates asynchronously off native, so the first runs see ''.
    expect(resolve({ rememberedKey: '' })).toBeNull();
    expect(resolve()).toBe(spark);
  });

  it('does not restore once the user has picked a market', () => {
    // Otherwise a persisted mirror still echoing the previous value would
    // revert the pick the user just made.
    expect(resolve({ hasUserChosen: true })).toBeNull();
  });

  it('restores at most once per session', () => {
    expect(resolve({ hasRestored: true })).toBeNull();
  });

  it('leaves the fallback alone when the remembered market is gone', () => {
    expect(resolve({ markets: [aave] })).toBeNull();
  });

  it('does not re-apply a market that is already selected', () => {
    expect(resolve({ currentMarket: spark })).toBeNull();
  });

  it('waits for the market list before restoring', () => {
    expect(resolve({ markets: [] })).toBeNull();
  });
});
