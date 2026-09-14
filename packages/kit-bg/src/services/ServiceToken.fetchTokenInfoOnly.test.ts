import ServiceToken from './ServiceToken';

type IMockTokenInfo = {
  info: {
    coingeckoId: string;
  };
};

type IMockVault = {
  fetchTokenDetails: (params: {
    contractList: string[];
    networkId: string;
  }) => Promise<{
    data: {
      data: IMockTokenInfo[];
    };
  }>;
};

const mockGetChainOnlyVault = jest.fn<
  Promise<IMockVault>,
  [{ networkId: string }]
>();

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
  backgroundMethodForDev:
    () => (_target: unknown, _key: string, descriptor: unknown) =>
      descriptor,
  checkDevOnlyPassword: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    MemoryPressureWarning: 'MemoryPressureWarning',
  },
  appEventBus: {
    on: jest.fn(),
  },
}));

jest.mock('../vaults/factory', () => ({
  vaultFactory: {
    getChainOnlyVault: (...args: [{ networkId: string }]) =>
      mockGetChainOnlyVault(...args),
  },
}));

describe('ServiceToken.fetchTokenInfoOnly', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetChainOnlyVault.mockImplementation(async ({ networkId }) => ({
      fetchTokenDetails: async ({ contractList }) => ({
        data: {
          data: [
            {
              info: {
                coingeckoId: `${networkId}:${contractList[0]}`,
              },
            },
          ],
        },
      }),
    }));
  });

  it('caches token info by network and token address', async () => {
    const service = new ServiceToken({ backgroundApi: {} });
    const firstParams = {
      networkId: 'evm--1',
      tokenAddress: '0xaaa',
    };
    const secondParams = {
      networkId: 'evm--1',
      tokenAddress: '0xbbb',
    };

    await expect(service.fetchTokenInfoOnly(firstParams)).resolves.toEqual({
      info: { coingeckoId: 'evm--1:0xaaa' },
    });
    await expect(service.fetchTokenInfoOnly(secondParams)).resolves.toEqual({
      info: { coingeckoId: 'evm--1:0xbbb' },
    });
    await expect(
      service.fetchTokenInfoOnly({ ...firstParams }),
    ).resolves.toEqual({
      info: { coingeckoId: 'evm--1:0xaaa' },
    });
    expect(mockGetChainOnlyVault).toHaveBeenCalledTimes(2);
  });

  it('reuses an in-flight request for the same token identity', async () => {
    let resolveFetchTokenDetails:
      | ((value: Awaited<ReturnType<IMockVault['fetchTokenDetails']>>) => void)
      | undefined;
    const fetchTokenDetails = jest.fn<
      ReturnType<IMockVault['fetchTokenDetails']>,
      Parameters<IMockVault['fetchTokenDetails']>
    >(
      () =>
        new Promise((resolve) => {
          resolveFetchTokenDetails = resolve;
        }),
    );
    mockGetChainOnlyVault.mockResolvedValue({ fetchTokenDetails });
    const service = new ServiceToken({ backgroundApi: {} });
    const params = {
      networkId: 'evm--1',
      tokenAddress: '0xaaa',
    };

    const firstRequest = service.fetchTokenInfoOnly(params);
    const secondRequest = service.fetchTokenInfoOnly({ ...params });

    expect(mockGetChainOnlyVault).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    expect(fetchTokenDetails).toHaveBeenCalledTimes(1);

    resolveFetchTokenDetails?.({
      data: {
        data: [{ info: { coingeckoId: 'ethereum' } }],
      },
    });
    await expect(Promise.all([firstRequest, secondRequest])).resolves.toEqual([
      { info: { coingeckoId: 'ethereum' } },
      { info: { coingeckoId: 'ethereum' } },
    ]);
    expect(fetchTokenDetails).toHaveBeenCalledTimes(1);
  });
});
