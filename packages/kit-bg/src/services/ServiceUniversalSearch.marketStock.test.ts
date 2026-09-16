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
  test('returns mapped stock listings from the stock search endpoint', async () => {
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
        serviceMarketV2: { searchMarketStocks },
      },
    });

    const result = await service.universalSearchOfMarketStock(' aapl ');

    expect(searchMarketStocks).toHaveBeenCalledWith({
      query: ' aapl ',
      limit: 10,
    });
    expect(result).toEqual([
      expect.objectContaining({
        stockId: 'AAPL',
        address: '',
        network: '',
      }),
    ]);
  });

  test('returns an empty list when stock search returns a payload without items', async () => {
    const Ctor = ServiceUniversalSearch as unknown as new (args: {
      backgroundApi: unknown;
    }) => ServiceUniversalSearch;
    const service = new Ctor({
      backgroundApi: {
        serviceMarketV2: {
          searchMarketStocks: jest.fn().mockResolvedValue({
            code: 1,
            message: 'unavailable',
          }),
        },
      },
    });

    await expect(service.universalSearchOfMarketStock('aapl')).resolves.toEqual(
      [],
    );
  });

  test('keeps token search on the token endpoint only', async () => {
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
