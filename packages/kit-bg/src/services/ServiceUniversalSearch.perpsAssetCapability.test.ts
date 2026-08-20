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

function buildService(assets: any[]) {
  const client = {
    get: jest.fn().mockResolvedValue({ data: { data: assets } }),
  };
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
    serviceHyperliquid: {
      refreshTradingMeta: jest.fn(),
    },
  };
  const Ctor = ServiceUniversalSearch as unknown as new (args: {
    backgroundApi: unknown;
  }) => ServiceUniversalSearch;
  const service = new Ctor({ backgroundApi });
  (service as any).getClient = jest.fn().mockResolvedValue(client);
  return { service, client };
}

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

  test('drops rows a short query does not literally match', async () => {
    const { service } = buildService([
      {
        type: 'xyz',
        logoUrl: 'https://example.com/xyzAMAT.png',
        name: 'AMAT',
        maxLeverage: null,
        midPx: '491',
        dayNtlVlm: null,
        subtitle: 'Applied Materials',
      },
      {
        type: 'perps',
        logoUrl: 'https://example.com/BTC.png',
        name: 'BTC',
        maxLeverage: 40,
        midPx: '90000',
        dayNtlVlm: '1',
        subtitle: 'Bitcoin',
      },
    ]);

    const result = await service.universalSearchOfPerp({ input: 'usdc' });

    expect(result.items).toEqual([]);
  });

  test('keeps a dex prefix match for a short query', async () => {
    const { service } = buildService([
      {
        type: 'xyz',
        logoUrl: 'https://example.com/xyzAMAT.png',
        name: 'AMAT',
        maxLeverage: null,
        midPx: '491',
        dayNtlVlm: null,
        subtitle: 'Applied Materials',
      },
    ]);

    const result = await service.universalSearchOfPerp({ input: 'xyz' });

    expect(result.items).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({ name: 'AMAT', maxLeverage: 10 }),
      }),
    ]);
  });

  test('keeps description matches for a longer query', async () => {
    const { service } = buildService([
      {
        type: 'xyz',
        logoUrl: 'https://example.com/xyzEWJ.png',
        name: 'EWJ',
        maxLeverage: null,
        midPx: '322',
        dayNtlVlm: null,
        subtitle: 'Japan ETF',
      },
    ]);

    const result = await service.universalSearchOfPerp({ input: 'japan' });

    expect(result.items).toEqual([
      expect.objectContaining({
        payload: expect.objectContaining({ name: 'EWJ' }),
      }),
    ]);
  });
});
