jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
  toastIfError: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) => d,
}));

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: any;

    constructor({ backgroundApi }: { backgroundApi: any }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

// eslint-disable-next-line import/first
import ServiceUniversalSearch from './ServiceUniversalSearch';

describe('ServiceUniversalSearch market stock search', () => {
  test('prepends stock listings from the stock search endpoint', async () => {
    const searchV2Token = jest.fn().mockResolvedValue([
      {
        name: 'Apple (Ondo Tokenized)',
        symbol: 'AAPLon',
        address: '0xaapl',
        network: 'evm--56',
        price: '190',
        logoUrl: '',
        isNative: false,
        decimals: 18,
        liquidity: '0',
        volume_24h: '0',
        stock: { stockId: 'AAPL', subtitle: 'Apple', sourceLogoUri: '' },
      },
    ]);
    const searchMarketStocks = jest.fn().mockResolvedValue({
      items: [
        {
          stockId: 'AAPL',
          symbol: 'AAPL',
          name: 'Apple Inc.',
          logoUrl: 'https://example.com/aapl.png',
          assetType: 'stock',
          currency: 'USD',
          price: '190.12',
        },
      ],
      total: 1,
    });
    const Ctor = ServiceUniversalSearch as unknown as new (args: {
      backgroundApi: unknown;
    }) => ServiceUniversalSearch;
    const service = new Ctor({
      backgroundApi: {
        serviceMarket: { searchV2Token },
        serviceMarketV2: { searchMarketStocks },
      },
    });

    const result = await service.universalSearchOfV2MarketToken(' aapl ', {
      includeStockListings: true,
    });

    expect(searchMarketStocks).toHaveBeenCalledWith({
      query: ' aapl ',
      limit: 10,
    });
    expect(result.map((item) => item.stockId ?? item.symbol)).toEqual([
      'AAPL',
      'AAPLon',
    ]);
    expect(result[0]).toMatchObject({
      stockId: 'AAPL',
      address: '',
      network: '',
    });
  });

  test('keeps token results when stock search fails', async () => {
    const searchV2Token = jest.fn().mockResolvedValue([
      {
        name: 'Apple (Ondo Tokenized)',
        symbol: 'AAPLon',
        address: '0xaapl',
        network: 'evm--56',
        price: '190',
        logoUrl: '',
        isNative: false,
        decimals: 18,
        liquidity: '0',
        volume_24h: '0',
      },
    ]);
    const Ctor = ServiceUniversalSearch as unknown as new (args: {
      backgroundApi: unknown;
    }) => ServiceUniversalSearch;
    const service = new Ctor({
      backgroundApi: {
        serviceMarket: { searchV2Token },
        serviceMarketV2: {
          searchMarketStocks: jest.fn().mockRejectedValue(new Error('offline')),
        },
      },
    });

    const result = await service.universalSearchOfV2MarketToken('aapl', {
      includeStockListings: true,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.symbol).toBe('AAPLon');
  });

  test('skips the stock search endpoint unless listings are requested', async () => {
    const searchV2Token = jest.fn().mockResolvedValue([]);
    const searchMarketStocks = jest.fn();
    const Ctor = ServiceUniversalSearch as unknown as new (args: {
      backgroundApi: unknown;
    }) => ServiceUniversalSearch;
    const service = new Ctor({
      backgroundApi: {
        serviceMarket: { searchV2Token },
        serviceMarketV2: { searchMarketStocks },
      },
    });

    await service.universalSearchOfV2MarketToken('aapl');

    expect(searchMarketStocks).not.toHaveBeenCalled();
    expect(searchV2Token).toHaveBeenCalledWith('aapl');
  });
});
