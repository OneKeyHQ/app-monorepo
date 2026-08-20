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

describe('ServiceUniversalSearch perps asset capability', () => {
  test('requests the dex-aware asset type contract', async () => {
    const client = {
      get: jest.fn().mockResolvedValue({
        data: {
          data: [
            {
              type: 'para',
              logoUrl: 'https://example.com/paraUNITREE.png',
              name: 'UNITREE',
              maxLeverage: null,
              midPx: '68',
              dayNtlVlm: null,
            },
          ],
        },
      }),
    };
    const backgroundApi = {
      simpleDb: {
        perp: {
          getTradingUniverse: jest.fn().mockResolvedValue({
            universesByDex: [
              [{ name: 'BTC' }],
              [{ name: 'xyz:NVDA' }],
              [{ name: 'para:UNITREE' }],
            ],
            updatedAt: Date.now(),
          }),
        },
      },
      serviceHyperliquid: {
        refreshTradingMeta: jest.fn(),
      },
    };
    const Ctor = ServiceUniversalSearch as unknown as new (args: {
      backgroundApi: unknown;
    }) => ServiceUniversalSearch;
    const service = new Ctor({ backgroundApi });
    (service as any).getClient = jest.fn().mockResolvedValue(client);

    const result = await service.universalSearchOfPerp({ input: 'unitree' });

    expect(client.get).toHaveBeenCalledWith(
      '/wallet/v1/proxy/hyperliquid/perpsAsset',
      {
        params: {
          query: 'unitree',
          assetTypeVersion: 2,
        },
      },
    );
    expect(result.items).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({
          assetType: 'para',
          name: 'UNITREE',
        }),
      }),
    ]);
  });
  // Rows the endpoint returns for `usdc` because they are USDC settled, not
  // because the query matches anything the row displays.
  const searchAssets = [
    { type: 'perps', name: 'BTC', subtitle: 'Bitcoin' },
    { type: 'xyz', name: 'AMAT', subtitle: 'Applied Materials' },
    { type: 'xyz', name: 'EWJ', subtitle: 'Japan ETF' },
    { type: 'para', name: 'UNITREE', subtitle: 'Unitree' },
  ].map((asset) => ({
    ...asset,
    logoUrl: 'https://example.com/logo.png',
    maxLeverage: null,
    midPx: '1',
    dayNtlVlm: null,
  }));

  function buildSearchService() {
    const backgroundApi = {
      simpleDb: {
        perp: {
          getTradingUniverse: jest.fn().mockResolvedValue({
            universesByDex: [
              [{ name: 'BTC', maxLeverage: 40 }],
              [
                { name: 'xyz:AMAT', maxLeverage: 10 },
                { name: 'xyz:EWJ', maxLeverage: 10 },
              ],
              [{ name: 'para:UNITREE', maxLeverage: 5 }],
            ],
            updatedAt: Date.now(),
          }),
        },
      },
      serviceHyperliquid: { refreshTradingMeta: jest.fn() },
    };
    const Ctor = ServiceUniversalSearch as unknown as new (args: {
      backgroundApi: unknown;
    }) => ServiceUniversalSearch;
    const service = new Ctor({ backgroundApi });
    (service as any).getClient = jest.fn().mockResolvedValue({
      get: jest.fn().mockResolvedValue({ data: { data: searchAssets } }),
    });
    return service;
  }

  test.each<[string, string[]]>([
    ['usdc', []],
    ['btc', ['BTC']],
    // An exact dex prefix browses that sub-dex, a fragment of one does not.
    ['xyz', ['AMAT', 'EWJ']],
    ['ar', []],
    // Longer and non-ASCII queries stay on the endpoint's own ranking.
    ['japan', ['BTC', 'AMAT', 'EWJ', 'UNITREE']],
    ['比特币', ['BTC', 'AMAT', 'EWJ', 'UNITREE']],
  ])('keeps the rows a %p query can match', async (input, expected) => {
    const service = buildSearchService();

    const result = await service.universalSearchOfPerp({ input });

    expect(
      result.items.map((item) => (item.payload as { name: string }).name),
    ).toEqual(expected);
  });
});
