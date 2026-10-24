import {
  getWatchlistTokenCache,
  publishWatchlistTokenCache,
  releaseWatchlistTokenCache,
} from './useMarketWatchlistTokenList';

import type { IMarketToken } from '../MarketTokenData';

jest.mock('@onekeyhq/components', () => ({
  useCarouselIndex: () => 0,
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceMarketV2: {}, serviceHyperliquid: {} },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ result: undefined }),
}));

jest.mock('@onekeyhq/kit/src/views/Market/hooks', () => ({
  useMarketBasicConfig: () => ({ networkList: [] }),
}));

jest.mock('./marketTokenBatchPlatformApi', () => ({
  fetchMarketTokenListBatchForPlatform: jest.fn(),
}));

const tokens = (id: string) => [{ id } as IMarketToken];

describe('watchlist token cache', () => {
  it('hands the cache to a list still mounted when the last writer leaves', () => {
    const home = Symbol('home');
    const sidebar = Symbol('sidebar');
    const homeTokens = tokens('home');
    publishWatchlistTokenCache(home, homeTokens);
    publishWatchlistTokenCache(sidebar, tokens('sidebar'));

    releaseWatchlistTokenCache(sidebar);

    expect(getWatchlistTokenCache()).toBe(homeTokens);

    releaseWatchlistTokenCache(home);
    expect(getWatchlistTokenCache()).toEqual([]);
  });

  it('keeps the cache when a list that no longer owns it unmounts', () => {
    const home = Symbol('home');
    const sidebar = Symbol('sidebar');
    publishWatchlistTokenCache(sidebar, tokens('sidebar'));
    const homeTokens = tokens('home');
    publishWatchlistTokenCache(home, homeTokens);

    releaseWatchlistTokenCache(sidebar);

    expect(getWatchlistTokenCache()).toBe(homeTokens);
    releaseWatchlistTokenCache(home);
  });
});
