import ServiceMarketV2 from './ServiceMarketV2';

const mockGet = jest.fn();
let mockLocale = 'en';

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/kit-bg/src/states/jotai/atoms')
  >('@onekeyhq/kit-bg/src/states/jotai/atoms');
  return {
    ...actual,
    settingsPersistAtom: {
      get: jest.fn(async () => ({ locale: mockLocale })),
    },
  };
});

jest.mock('@onekeyhq/shared/src/locale/getDefaultLocale', () => ({
  getDefaultLocale: jest.fn(() => 'fr-FR'),
}));

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

const configFor = (name: string) => ({
  code: 0,
  message: 'OK',
  data: { spotCategories: [{ type: 'trending', name }] },
});

describe('ServiceMarketV2 basic config', () => {
  const createService = () => {
    const service = new ServiceMarketV2({ backgroundApi: {} });
    service.getClient = jest.fn(async () => ({ get: mockGet })) as never;
    return service;
  };

  beforeEach(() => {
    mockGet.mockReset();
    mockLocale = 'en';
  });

  it('refetches localized categories after the locale changes without a restart', async () => {
    const service = createService();
    mockGet
      .mockResolvedValueOnce({ data: configFor('Trending') })
      .mockResolvedValueOnce({ data: configFor('热门') });

    await expect(service.fetchMarketBasicConfig()).resolves.toEqual(
      configFor('Trending'),
    );
    mockLocale = 'zh-CN';
    await expect(service.fetchMarketBasicConfig()).resolves.toEqual(
      configFor('热门'),
    );
    // Switching back reuses the cached English config.
    mockLocale = 'en';
    await expect(service.fetchMarketBasicConfig()).resolves.toEqual(
      configFor('Trending'),
    );

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mockGet.mock.calls[0]?.[1]?.headers).toEqual({
      'x-onekey-request-locale': 'en',
    });
    expect(mockGet.mock.calls[1]?.[1]?.headers).toEqual({
      'x-onekey-request-locale': 'zh-cn',
    });
  });

  it('resolves the system locale before caching the config', async () => {
    const service = createService();
    mockLocale = 'system';
    mockGet.mockResolvedValueOnce({ data: configFor('Tendance') });

    await service.fetchMarketBasicConfig();
    mockLocale = 'fr-FR';
    await service.fetchMarketBasicConfig();

    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet.mock.calls[0]?.[1]?.headers).toEqual({
      'x-onekey-request-locale': 'fr-fr',
    });
  });

  it('retries a failed request for the same locale', async () => {
    const service = createService();
    mockGet
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ data: configFor('Trending') });

    await expect(service.fetchMarketBasicConfig()).rejects.toThrow('offline');
    await expect(service.fetchMarketBasicConfig()).resolves.toEqual(
      configFor('Trending'),
    );
    expect(mockGet).toHaveBeenCalledTimes(2);
  });
});
