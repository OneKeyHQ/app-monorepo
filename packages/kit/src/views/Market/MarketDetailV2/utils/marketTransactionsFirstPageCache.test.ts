import type { IMarketTokenTransactionsResponse } from '@onekeyhq/shared/types/marketV2';

import {
  MARKET_TRANSACTIONS_FIRST_PAGE_SIZE,
  clearMarketTransactionsFirstPageRequestCache,
  fetchMarketTransactionsFirstPageWithCache,
  getCachedMarketTransactionsFirstPage,
  prefetchMarketTransactionsFirstPageWithCache,
} from './marketTransactionsFirstPageCache';

const mockFetchMarketTokenTransactions = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceMarketV2: {
      fetchMarketTokenTransactions: (
        ...args: unknown[]
      ): Promise<IMarketTokenTransactionsResponse> =>
        mockFetchMarketTokenTransactions(
          ...args,
        ) as Promise<IMarketTokenTransactionsResponse>,
    },
  },
}));

const tokenIdentity = {
  tokenAddress: '0xabc',
  networkId: 'evm--1',
};

describe('marketTransactionsFirstPageCache', () => {
  beforeEach(() => {
    clearMarketTransactionsFirstPageRequestCache();
    mockFetchMarketTokenTransactions.mockReset();
    jest.restoreAllMocks();
  });

  it('deduplicates the navigation prefetch and first detail-page request', async () => {
    let resolveRequest:
      | ((response: IMarketTokenTransactionsResponse) => void)
      | undefined;
    const response: IMarketTokenTransactionsResponse = {
      list: [],
      cursor: 'next-page',
    };
    const pendingRequest = new Promise<IMarketTokenTransactionsResponse>(
      (resolve) => {
        resolveRequest = resolve;
      },
    );
    mockFetchMarketTokenTransactions.mockReturnValue(pendingRequest);

    const navigationPrefetch =
      prefetchMarketTransactionsFirstPageWithCache(tokenIdentity);
    const detailPageRequest =
      fetchMarketTransactionsFirstPageWithCache(tokenIdentity);

    expect(detailPageRequest).toBe(navigationPrefetch);
    expect(mockFetchMarketTokenTransactions).toHaveBeenCalledTimes(1);
    expect(mockFetchMarketTokenTransactions).toHaveBeenCalledWith({
      ...tokenIdentity,
      limit: MARKET_TRANSACTIONS_FIRST_PAGE_SIZE,
    });

    resolveRequest?.(response);
    await expect(detailPageRequest).resolves.toEqual(response);
    expect(getCachedMarketTransactionsFirstPage(tokenIdentity)).toEqual(
      response,
    );
  });

  it('retains a fresh navigation prefetch until the detail page consumes it', async () => {
    const response: IMarketTokenTransactionsResponse = {
      list: [],
      cursor: 'next-page',
    };
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
    mockFetchMarketTokenTransactions.mockResolvedValue(response);

    await prefetchMarketTransactionsFirstPageWithCache(tokenIdentity);
    nowSpy.mockReturnValue(4000);

    expect(getCachedMarketTransactionsFirstPage(tokenIdentity)).toEqual(
      response,
    );
    await expect(
      fetchMarketTransactionsFirstPageWithCache(tokenIdentity),
    ).resolves.toEqual(response);
    expect(mockFetchMarketTokenTransactions).toHaveBeenCalledTimes(1);

    nowSpy.mockReturnValue(9001);
    expect(getCachedMarketTransactionsFirstPage(tokenIdentity)).toBeUndefined();
  });

  it('refetches a retained prefetch whose completed result is stale', async () => {
    const staleResponse: IMarketTokenTransactionsResponse = {
      list: [],
      cursor: 'stale-page',
    };
    const freshResponse: IMarketTokenTransactionsResponse = {
      list: [],
      cursor: 'fresh-page',
    };
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
    let resolveFreshResponse:
      | ((response: IMarketTokenTransactionsResponse) => void)
      | undefined;
    mockFetchMarketTokenTransactions.mockResolvedValueOnce(staleResponse);
    mockFetchMarketTokenTransactions.mockReturnValueOnce(
      new Promise<IMarketTokenTransactionsResponse>((resolve) => {
        resolveFreshResponse = resolve;
      }),
    );

    await prefetchMarketTransactionsFirstPageWithCache(tokenIdentity);
    nowSpy.mockReturnValue(7000);

    expect(getCachedMarketTransactionsFirstPage(tokenIdentity)).toEqual(
      staleResponse,
    );
    const refreshRequest =
      fetchMarketTransactionsFirstPageWithCache(tokenIdentity);
    expect(getCachedMarketTransactionsFirstPage(tokenIdentity)).toEqual(
      staleResponse,
    );

    resolveFreshResponse?.(freshResponse);
    await expect(refreshRequest).resolves.toEqual(freshResponse);
    expect(getCachedMarketTransactionsFirstPage(tokenIdentity)).toEqual(
      freshResponse,
    );
    expect(mockFetchMarketTokenTransactions).toHaveBeenCalledTimes(2);
  });

  it('does not slide the retention window on repeated prefetch hits', async () => {
    const response: IMarketTokenTransactionsResponse = {
      list: [],
      cursor: 'next-page',
    };
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
    mockFetchMarketTokenTransactions.mockResolvedValue(response);

    await prefetchMarketTransactionsFirstPageWithCache(tokenIdentity);
    nowSpy.mockReturnValue(4000);
    await prefetchMarketTransactionsFirstPageWithCache(tokenIdentity);
    nowSpy.mockReturnValue(31_001);

    expect(getCachedMarketTransactionsFirstPage(tokenIdentity)).toBeUndefined();
  });

  it('expires an unconsumed navigation prefetch after the retention window', async () => {
    const response: IMarketTokenTransactionsResponse = {
      list: [],
      cursor: 'next-page',
    };
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1000);
    mockFetchMarketTokenTransactions.mockResolvedValue(response);

    await prefetchMarketTransactionsFirstPageWithCache(tokenIdentity);
    nowSpy.mockReturnValue(31_001);

    expect(getCachedMarketTransactionsFirstPage(tokenIdentity)).toBeUndefined();
    await expect(
      fetchMarketTransactionsFirstPageWithCache(tokenIdentity),
    ).resolves.toEqual(response);
    expect(mockFetchMarketTokenTransactions).toHaveBeenCalledTimes(2);
  });

  it('evicts a failed request so the detail page can retry', async () => {
    mockFetchMarketTokenTransactions
      .mockRejectedValueOnce(new Error('prefetch failed'))
      .mockResolvedValueOnce({ list: [] });

    await expect(
      fetchMarketTransactionsFirstPageWithCache(tokenIdentity),
    ).rejects.toThrow('prefetch failed');
    await expect(
      fetchMarketTransactionsFirstPageWithCache(tokenIdentity),
    ).resolves.toEqual({ list: [] });

    expect(mockFetchMarketTokenTransactions).toHaveBeenCalledTimes(2);
  });
});
