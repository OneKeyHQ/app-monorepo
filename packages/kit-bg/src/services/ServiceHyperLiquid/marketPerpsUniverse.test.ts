import type { IPerpsUniverse } from '@onekeyhq/shared/types/hyperliquid';

import {
  MARKET_PERPS_UNIVERSE_MAX_AGE_MS,
  shouldRefreshMarketPerpsUniverse,
} from './marketPerpsUniverse';

const NOW = Date.parse('2026-09-08T12:00:00Z');

function universe(names: string[]): IPerpsUniverse[][] {
  return [names.map((name) => ({ name }) as IPerpsUniverse)];
}

describe('shouldRefreshMarketPerpsUniverse', () => {
  it('refreshes when nothing has been cached yet', () => {
    expect(
      shouldRefreshMarketPerpsUniverse({
        universesByDex: [],
        updatedAt: NOW,
        now: NOW,
      }),
    ).toBe(true);
    expect(
      shouldRefreshMarketPerpsUniverse({
        universesByDex: [[]],
        updatedAt: NOW,
        now: NOW,
      }),
    ).toBe(true);
  });

  it('refreshes a cache that carries no timestamp', () => {
    // Written before the timestamp existed, so its age cannot be judged.
    expect(
      shouldRefreshMarketPerpsUniverse({
        universesByDex: universe(['BTC']),
        now: NOW,
      }),
    ).toBe(true);
  });

  it('serves a cache that is still inside its window', () => {
    expect(
      shouldRefreshMarketPerpsUniverse({
        universesByDex: universe(['BTC']),
        updatedAt: NOW - MARKET_PERPS_UNIVERSE_MAX_AGE_MS + 1000,
        now: NOW,
      }),
    ).toBe(false);
  });

  it('refreshes once the window has passed', () => {
    // Market never refreshes this on its own, so an old universe would keep
    // hiding a market listed since and advertising one removed since.
    expect(
      shouldRefreshMarketPerpsUniverse({
        universesByDex: universe(['BTC']),
        updatedAt: NOW - MARKET_PERPS_UNIVERSE_MAX_AGE_MS - 1000,
        now: NOW,
      }),
    ).toBe(true);
  });
});
