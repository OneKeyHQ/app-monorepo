import type { INotificationWatchlistToken } from '@onekeyhq/shared/types/notification';

import ServiceMarketV2 from './ServiceMarketV2';

const mockGet = jest.fn();
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
      },
    });
    service.getClient = jest.fn(async () => ({ get: mockGet })) as never;
    return service;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockListingCache = {};
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

  it('uses the default stock token for notifications without changing the stored listing', async () => {
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
          tradingEnabled: false,
        },
      ],
    });
    const batch = jest
      .spyOn(service, 'fetchMarketTokenListBatch')
      .mockResolvedValue({
        list: [
          { symbol: 'AAPL', name: 'Apple', address: '0xdefault', decimals: 18 },
        ],
      });
    await service.buildWatchlistTokensForNotification();
    expect(batch).toHaveBeenCalledWith({
      tokenAddressList: [
        { chainId: 'evm--1', contractAddress: '0xdefault', isNative: false },
      ],
    });
    expect(mockListingCache['stock:AAPL']).toMatchObject({
      tokenAddress: '0xdefault',
      symbol: 'AAPL',
    });
    expect(stored).toEqual({
      stockId: 'AAPL',
      chainId: '',
      contractAddress: '',
    });
  });

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
      params: { query: 'aapl', limit: 10 },
      autoHandleError: false,
    });
    expect(result.items[0]?.stockId).toBe('AAPL');
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
      autoHandleError: false,
    });
    expect(mockGet).toHaveBeenNthCalledWith(
      2,
      '/utility/v1/stocks/BRK%2FB/tokens',
      { autoHandleError: false },
    );
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
      points: 200,
    });
    await service.fetchMarketStockEvents({ stockId: 'AAPL' });
    await service.fetchMarketStockNews({ stockId: 'AAPL', limit: 5 });

    expect(mockGet).toHaveBeenNthCalledWith(
      1,
      '/utility/v1/stocks/AAPL/chart',
      {
        params: { period: '1w', points: 200 },
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
