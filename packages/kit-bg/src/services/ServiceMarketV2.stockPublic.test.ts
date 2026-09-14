// cspell:ignore financials
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { INotificationWatchlistToken } from '@onekeyhq/shared/types/notification';

import ServiceMarketV2 from './ServiceMarketV2';

const mockGet = jest.fn();
let mockPauseMemoizationTasks = false;

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/kit-bg/src/states/jotai/atoms')
  >('@onekeyhq/kit-bg/src/states/jotai/atoms');
  return {
    ...actual,
    settingsPersistAtom: {
      get: jest.fn(async () => ({ locale: 'en-US' })),
    },
  };
});

jest.mock('next-tick', () => (callback: () => void) => {
  if (!mockPauseMemoizationTasks) queueMicrotask(callback);
});
const mockAssetDetail = jest.fn();
let mockListingCache: Record<string, INotificationWatchlistToken> = {};
const mockNotificationSettings = {
  getMarketListingTokens: jest.fn(async () => mockListingCache),
  saveMarketListingTokens: jest.fn(
    async (tokens: Record<string, INotificationWatchlistToken>) => {
      mockListingCache = { ...mockListingCache, ...tokens };
    },
  ),
};

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    MemoryPressureWarning: 'MemoryPressureWarning',
  },
  appEventBus: {
    on: jest.fn(),
  },
}));

describe('ServiceMarketV2 public stock APIs', () => {
  const createService = () => {
    const service = new ServiceMarketV2({
      backgroundApi: {
        simpleDb: { notificationSettings: mockNotificationSettings },
        serviceMarket: { fetchMarketAssetDetail: mockAssetDetail },
      },
    });
    service.getClient = jest.fn(async () => ({ get: mockGet })) as never;
    return service;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGet.mockReset();
    mockListingCache = {};
  });

  afterEach(() => {
    mockPauseMemoizationTasks = false;
    jest.restoreAllMocks();
  });

  it('deduplicates stock banner requests and clears cached quotes explicitly', async () => {
    const service = createService();
    mockGet.mockResolvedValue({
      data: { data: [{ stockId: 'AAPL', price: '100' }] },
    });
    const [first, second] = await Promise.all([
      service.fetchMarketBannerStockTokenList({ id: 'stocks' }),
      service.fetchMarketBannerStockTokenList({ id: 'stocks' }),
    ]);
    expect(first).toEqual(second);
    expect(mockGet).toHaveBeenCalledTimes(1);
    await service.clearMarketBannerCache();
    mockGet.mockResolvedValue({
      data: { data: [{ stockId: 'AAPL', price: '101' }] },
    });
    await expect(
      service.fetchMarketBannerStockTokenList({ id: 'stocks' }),
    ).resolves.toEqual([{ stockId: 'AAPL', price: '101' }]);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it('does not reuse an Android offline failure after an explicit token retry', async () => {
    jest.replaceProperty(platformEnv, 'isNativeAndroid', true);
    mockPauseMemoizationTasks = true;
    const service = createService();
    const query = { networkId: 'evm--1', type: 'trending' };
    const response = { list: [{ symbol: 'ETH' }], total: 1 };
    mockGet.mockRejectedValueOnce(new Error('offline'));
    await expect(service.fetchMarketTokenList(query)).rejects.toThrow(
      'offline',
    );
    await expect(service.fetchMarketTokenList(query)).rejects.toThrow(
      'offline',
    );
    expect(mockGet).toHaveBeenCalledTimes(1);
    mockGet.mockResolvedValue({ data: { data: response } });
    await expect(
      service.fetchMarketTokenList(query, { forceRemote: true }),
    ).resolves.toEqual(response);
    await expect(service.fetchMarketTokenList(query)).resolves.toEqual(
      response,
    );
    expect(mockGet).toHaveBeenCalledTimes(3);
    await expect(service.fetchMarketTokenList(query)).resolves.toEqual(
      response,
    );
    expect(mockGet).toHaveBeenCalledTimes(3);
  });

  it('loads a stock watchlist quote without resolving a token variant', async () => {
    const service = createService();
    const variants = jest.spyOn(service, 'fetchMarketStockTokenVariants');
    mockGet.mockResolvedValueOnce({
      data: {
        data: {
          stockId: 'AAPL',
          symbol: 'AAPL',
          name: 'Apple',
          logoUrl: '',
          price: '200',
        },
      },
    });
    expect(
      await service.fetchMarketListingWatchlistQuote({ stockId: 'AAPL' }),
    ).toMatchObject({ symbol: 'AAPL', price: '200' });
    expect(variants).not.toHaveBeenCalled();
  });

  it.each([
    { tradingEnabled: false },
    { status: 'inactive' },
    { isPaused: true },
    { tradingHours: { isPaused: true } },
  ])(
    'falls back from an unavailable default for notifications: %j',
    async (unavailable) => {
      const service = createService();
      const stored = { stockId: 'AAPL', chainId: '', contractAddress: '' };
      jest
        .spyOn(service, 'getMarketWatchListV2')
        .mockResolvedValue({ data: [stored] });
      jest.spyOn(service, 'fetchMarketStockTokenVariants').mockResolvedValue({
        stockId: 'AAPL',
        defaultTokenId: 'default',
        items: [
          {
            tokenId: 'first',
            issuer: 'first',
            networkId: 'evm--1',
            contractAddress: '0xfirst',
            currency: 'USD',
            status: 'active',
            tradingEnabled: true,
          },
          {
            tokenId: 'default',
            issuer: 'default',
            networkId: 'evm--1',
            contractAddress: '0xdefault',
            currency: 'USD',
            status: 'active',
            tradingEnabled: true,
            ...unavailable,
          },
        ],
      });
      const batch = jest
        .spyOn(service, 'fetchMarketTokenListBatch')
        .mockResolvedValue({
          list: [
            { symbol: 'AAPL', name: 'Apple', address: '0xfirst', decimals: 18 },
          ],
        });
      await service.buildWatchlistTokensForNotification();
      expect(batch).toHaveBeenCalledWith({
        tokenAddressList: [
          { chainId: 'evm--1', contractAddress: '0xfirst', isNative: false },
        ],
      });
      expect(mockListingCache['stock:AAPL']).toMatchObject({
        tokenAddress: '0xfirst',
        symbol: 'AAPL',
      });
      expect(stored).toEqual({
        stockId: 'AAPL',
        chainId: '',
        contractAddress: '',
      });
    },
  );

  it('keeps healthy subscriptions when a new listing lookup rejects', async () => {
    const service = createService();
    jest.spyOn(service, 'getMarketWatchListV2').mockResolvedValue({
      data: [
        { stockId: 'AAPL', chainId: '', contractAddress: '' },
        { chainId: 'evm--1', contractAddress: '0xhealthy' },
      ],
    });
    jest
      .spyOn(service, 'fetchMarketStockTokenVariants')
      .mockRejectedValue(new Error('offline'));
    jest.spyOn(service, 'fetchMarketTokenListBatch').mockResolvedValue({
      list: [
        {
          symbol: 'OK',
          name: 'Healthy',
          address: '0xhealthy',
          decimals: 18,
          logoUrl: '',
        },
      ],
    });
    await expect(
      service.buildWatchlistTokensForNotification(),
    ).resolves.toEqual([
      {
        networkId: 'evm--1',
        tokenAddress: '0xhealthy',
        isNative: false,
        symbol: 'OK',
        logoURI: '',
      },
    ]);
  });

  it('reuses a persisted listing identity after restart without restoring removed favorites', async () => {
    mockListingCache = {
      'stock:AAPL': {
        networkId: 'evm--1',
        tokenAddress: '0xdefault',
        isNative: false,
        symbol: 'AAPL',
        logoURI: 'logo',
      },
      'stock:REMOVED': {
        networkId: 'evm--1',
        tokenAddress: '0xremoved',
        isNative: false,
        symbol: 'REMOVED',
        logoURI: '',
      },
    };
    const service = createService();
    jest.spyOn(service, 'getMarketWatchListV2').mockResolvedValue({
      data: [{ stockId: 'AAPL', chainId: '', contractAddress: '' }],
    });
    jest
      .spyOn(service, 'fetchMarketStockTokenVariants')
      .mockRejectedValue(new Error('offline'));
    jest
      .spyOn(service, 'fetchMarketTokenListBatch')
      .mockResolvedValue({ list: [] });
    await expect(
      service.buildWatchlistTokensForNotification(),
    ).resolves.toEqual([mockListingCache['stock:AAPL']]);
  });

  it.each(['asset', 'stock'] as const)(
    'preserves a cached %s subscription when resolution succeeds but batch metadata is missing',
    async (kind) => {
      const cachedToken: INotificationWatchlistToken = {
        networkId: 'evm--1',
        tokenAddress: '0xcached',
        isNative: false,
        symbol: 'AAPL',
        logoURI: 'cached-logo',
      };
      const cacheKey = `${kind}:AAPL`;
      mockListingCache = { [cacheKey]: cachedToken };
      const service = createService();
      jest.spyOn(service, 'getMarketWatchListV2').mockResolvedValue({
        data: [
          { chainId: 'evm--1', contractAddress: '0xhealthy' },
          {
            ...(kind === 'asset' ? { assetId: 'AAPL' } : { stockId: 'AAPL' }),
            chainId: '',
            contractAddress: '',
          },
        ],
      });
      mockAssetDetail.mockResolvedValue({
        selectedVariant: {
          networkId: 'evm--1',
          tokenAddress: '0xnew',
          isNative: false,
        },
      });
      jest.spyOn(service, 'fetchMarketStockTokenVariants').mockResolvedValue({
        stockId: 'AAPL',
        defaultTokenId: 'new',
        items: [
          {
            tokenId: 'new',
            issuer: 'new',
            networkId: 'evm--1',
            contractAddress: '0xnew',
            currency: 'USD',
            status: 'active',
            tradingEnabled: true,
          },
        ],
      });
      const batch = jest
        .spyOn(service, 'fetchMarketTokenListBatch')
        .mockResolvedValue({
          list: [
            {
              symbol: 'OK',
              name: 'Healthy',
              address: '0xhealthy',
              decimals: 18,
            },
          ],
        });
      expect(await service.buildWatchlistTokensForNotification()).toEqual([
        {
          networkId: 'evm--1',
          tokenAddress: '0xhealthy',
          isNative: false,
          symbol: 'OK',
          logoURI: '',
        },
        cachedToken,
      ]);
      expect(mockListingCache[cacheKey]).toEqual(cachedToken);
      batch.mockResolvedValue({
        list: [
          { symbol: 'OK', name: 'Healthy', address: '0xhealthy', decimals: 18 },
          {
            symbol: 'NEW',
            name: 'New variant',
            address: '0xnew',
            decimals: 18,
            logoUrl: 'new-logo',
          },
        ],
      });
      expect(
        await service.buildWatchlistTokensForNotification(),
      ).toContainEqual({
        networkId: 'evm--1',
        tokenAddress: '0xnew',
        isNative: false,
        symbol: 'NEW',
        logoURI: 'new-logo',
      });
      expect(mockListingCache[cacheKey]).toMatchObject({
        tokenAddress: '0xnew',
        symbol: 'NEW',
      });
    },
  );

  it.each(['annual', 'quarter'] as const)(
    'requests %s financials in USD independently of display currency',
    async (period) => {
      const service = createService();
      const financials = { stockId: 'AAPL', period, currency: 'USD' };
      mockGet.mockResolvedValueOnce({ data: { code: 0, data: financials } });
      expect(
        await service.fetchMarketStockFinancials({ stockId: 'AAPL', period }),
      ).toEqual(financials);
      expect(mockGet).toHaveBeenCalledWith(
        '/utility/v1/stocks/AAPL/financials',
        {
          params: { period, limit: 5 },
          headers: { 'x-onekey-request-currency': 'usd' },
          autoHandleError: false,
        },
      );
    },
  );

  it('loads the aggregated stock list without token identity fields', async () => {
    const service = createService();
    mockGet.mockResolvedValueOnce({
      data: {
        data: {
          items: [{ stockId: 'AAPL', symbol: 'AAPL', currency: 'USD' }],
          total: 1,
        },
      },
    });

    const result = await service.fetchMarketStockList({
      category: 'ai-tech',
      sortBy: 'priceChange24hPercent',
      sortType: 'desc',
      limit: 50,
    });

    expect(mockGet).toHaveBeenCalledWith('/utility/v1/stocks', {
      headers: { 'x-onekey-request-currency': 'usd' },
      params: {
        cursor: undefined,
        limit: 50,
        category: 'ai-tech',
        sortBy: 'priceChange24hPercent',
        sortType: 'desc',
      },
      autoHandleError: false,
    });
    expect(result.items[0]).toEqual(
      expect.objectContaining({ stockId: 'AAPL' }),
    );
    expect(result.items[0]).not.toHaveProperty('networkId');
    expect(result.items[0]).not.toHaveProperty('contractAddress');
  });

  it('sorts the stock list by 24h volume descending by default', async () => {
    const service = createService();
    mockGet.mockResolvedValueOnce({
      data: {
        data: {
          items: [],
          total: 0,
        },
      },
    });

    await service.fetchMarketStockList();

    expect(mockGet).toHaveBeenCalledWith('/utility/v1/stocks', {
      params: {
        cursor: undefined,
        limit: 20,
        category: undefined,
        sortBy: 'volume24h',
        sortType: 'desc',
      },
      headers: { 'x-onekey-request-currency': 'usd' },
      autoHandleError: false,
    });
  });

  it('searches stocks through the stock search endpoint', async () => {
    const service = createService();
    mockGet.mockResolvedValueOnce({
      data: {
        data: {
          items: [{ stockId: 'AAPL', symbol: 'AAPL', currency: 'USD' }],
          total: 1,
        },
      },
    });

    const result = await service.searchMarketStocks({
      query: ' aapl ',
      limit: 10,
    });

    expect(mockGet).toHaveBeenCalledWith('/utility/v1/stocks/search', {
      headers: { 'x-onekey-request-currency': 'usd' },
      params: { query: 'aapl', limit: 10 },
      autoHandleError: false,
    });
    expect(result.items[0]?.stockId).toBe('AAPL');
  });

  it('passes the search cursor when loading the next page', async () => {
    const service = createService();
    mockGet.mockResolvedValueOnce({
      data: {
        data: {
          items: [],
          total: 1,
          nextCursor: 'next',
        },
      },
    });

    await service.searchMarketStocks({
      query: 'aapl',
      cursor: 'next',
      limit: 20,
    });

    expect(mockGet).toHaveBeenCalledWith('/utility/v1/stocks/search', {
      headers: { 'x-onekey-request-currency': 'usd' },
      params: { query: 'aapl', limit: 20, cursor: 'next' },
      autoHandleError: false,
    });
  });

  it('loads stock detail and token variants by stockId', async () => {
    const service = createService();
    mockGet
      .mockResolvedValueOnce({
        data: { data: { stockId: 'BRK/B', symbol: 'BRK/B' } },
      })
      .mockResolvedValueOnce({
        data: { data: { stockId: 'BRK/B', items: [] } },
      });

    await service.fetchMarketStockDetail({ stockId: 'BRK/B' });
    await service.fetchMarketStockTokenVariants({ stockId: 'BRK/B' });

    expect(mockGet).toHaveBeenNthCalledWith(1, '/utility/v1/stocks/BRK%2FB', {
      headers: { 'x-onekey-request-currency': 'usd' },
      autoHandleError: false,
    });
    expect(mockGet).toHaveBeenNthCalledWith(
      2,
      '/utility/v1/stocks/BRK%2FB/tokens',
      {
        headers: { 'x-onekey-request-currency': 'usd' },
        autoHandleError: false,
      },
    );
  });

  it('sends Pro intervals and time bounds without injecting a default period', async () => {
    const service = createService();
    mockGet.mockResolvedValue({
      data: {
        data: {
          stockId: 'AAPL',
          interval: '5min',
          currency: 'USD',
          points: [],
        },
      },
    });
    await service.fetchMarketStockChart({
      stockId: 'AAPL',
      interval: '5min',
      from: 1_786_041_000,
      to: 1_786_132_800,
    });
    expect(mockGet).toHaveBeenCalledWith('/utility/v1/stocks/AAPL/chart', {
      headers: { 'x-onekey-request-currency': 'usd' },
      params: { interval: '5min', from: 1_786_041_000, to: 1_786_132_800 },
      autoHandleError: false,
    });
  });

  it('defaults Simple to one day without requesting a point limit', async () => {
    const service = createService();
    mockGet.mockResolvedValue({
      data: {
        data: { stockId: 'AAPL', period: '1d', currency: 'USD', points: [] },
      },
    });
    await service.fetchMarketStockChart({ stockId: 'AAPL' });
    expect(mockGet).toHaveBeenCalledWith('/utility/v1/stocks/AAPL/chart', {
      headers: { 'x-onekey-request-currency': 'usd' },
      params: { period: '1d' },
      autoHandleError: false,
    });
  });

  it('uses independent chart, events, and news endpoints', async () => {
    const service = createService();
    mockGet
      .mockResolvedValueOnce({
        data: {
          data: {
            stockId: 'AAPL',
            period: '1w',
            currency: 'USD',
            points: [],
          },
        },
      })
      .mockResolvedValueOnce({
        data: { data: { stockId: 'AAPL', items: [], updatedAt: '' } },
      })
      .mockResolvedValueOnce({
        data: { data: { stockId: 'AAPL', items: [], updatedAt: '' } },
      });

    await service.fetchMarketStockChart({
      stockId: 'AAPL',
      period: '1w',
    });
    await service.fetchMarketStockEvents({ stockId: 'AAPL' });
    await service.fetchMarketStockNews({ stockId: 'AAPL', limit: 5 });

    expect(mockGet).toHaveBeenNthCalledWith(
      1,
      '/utility/v1/stocks/AAPL/chart',
      {
        params: { period: '1w' },
        headers: { 'x-onekey-request-currency': 'usd' },
        autoHandleError: false,
      },
    );
    expect(mockGet).toHaveBeenNthCalledWith(
      2,
      '/utility/v1/stocks/AAPL/events',
      { autoHandleError: false },
    );
    expect(mockGet).toHaveBeenNthCalledWith(3, '/utility/v1/stocks/AAPL/news', {
      params: { limit: 5 },
      autoHandleError: false,
    });
  });
});
