import ServiceToken from './ServiceToken';

type IMockTokenInfo = {
  info: {
    networkId?: string;
    address: string;
    uniqueKey?: string;
    symbol?: string;
  };
};

type IMockVault = {
  fetchTokenDetails: (params: {
    accountId?: string;
    networkId: string;
    keywords?: string;
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

function buildService({
  availableNetworkIds,
  searchResults,
}: {
  availableNetworkIds: string[];
  searchResults: IMockTokenInfo[];
}) {
  mockGetChainOnlyVault.mockImplementation(async () => ({
    fetchTokenDetails: async () => ({
      data: {
        data: searchResults,
      },
    }),
  }));
  const backgroundApi = {
    serviceNetwork: {
      getAllNetworks: jest.fn().mockResolvedValue({
        networks: availableNetworkIds.map((id) => ({ id })),
      }),
    },
  };
  return new ServiceToken({ backgroundApi });
}

describe('ServiceToken.searchTokens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('drops tokens on networks missing from the available network catalog (OK-60860)', async () => {
    const service = buildService({
      availableNetworkIds: ['btc--0', 'evm--1'],
      searchResults: [
        {
          info: { networkId: 'btc--0', address: '', uniqueKey: 'native' },
        },
        {
          // Delisted network (backend still indexes it) must not surface.
          info: { networkId: 'evm--223', address: '0xb2btc' },
        },
        {
          info: { networkId: 'evm--1', address: '0xwbtc' },
        },
      ],
    });

    const result = await service.searchTokens({
      accountId: '',
      networkId: 'onekeyall--0',
      keywords: 'BTC',
    });

    expect(result.map((token) => token.networkId)).toEqual([
      'btc--0',
      'evm--1',
    ]);
  });

  it('fails open when the network catalog lookup rejects', async () => {
    const service = buildService({
      availableNetworkIds: [],
      searchResults: [
        {
          info: { networkId: 'evm--1', address: '0xwbtc' },
        },
      ],
    });
    (
      service.backgroundApi as unknown as {
        serviceNetwork: { getAllNetworks: jest.Mock };
      }
    ).serviceNetwork.getAllNetworks.mockRejectedValue(
      new Error('catalog unavailable'),
    );

    const result = await service.searchTokens({
      accountId: '',
      networkId: 'onekeyall--0',
      keywords: 'BTC',
    });

    expect(result).toHaveLength(1);
    expect(result[0].networkId).toBe('evm--1');
  });

  it('keeps tokens without their own networkId (single-network scoped response)', async () => {
    const service = buildService({
      availableNetworkIds: ['evm--1'],
      searchResults: [
        {
          info: { address: '0xusdc' },
        },
      ],
    });

    const result = await service.searchTokens({
      accountId: '',
      networkId: 'evm--1',
      keywords: 'USDC',
    });

    expect(result).toHaveLength(1);
    expect(result[0].address).toBe('0xusdc');
  });
});
