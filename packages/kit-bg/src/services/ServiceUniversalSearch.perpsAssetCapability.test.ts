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
});
