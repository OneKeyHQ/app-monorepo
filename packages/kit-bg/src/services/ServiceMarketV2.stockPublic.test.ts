import ServiceMarketV2 from './ServiceMarketV2';

const mockGet = jest.fn();

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
    const service = new ServiceMarketV2({ backgroundApi: {} });
    service.getClient = jest.fn(async () => ({ get: mockGet })) as never;
    return service;
  };

  beforeEach(() => {
    jest.clearAllMocks();
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
          tradingEnabled: true,
        },
      ],
    });
    const batch = jest
      .spyOn(service, 'fetchMarketTokenListBatch')
      .mockResolvedValue({ list: [] });
    await service.buildWatchlistTokensForNotification();
    expect(batch).toHaveBeenCalledWith({
      tokenAddressList: [
        { chainId: 'evm--1', contractAddress: '0xdefault', isNative: false },
      ],
    });
    expect(stored).toEqual({
      stockId: 'AAPL',
      chainId: '',
      contractAddress: '',
    });
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
