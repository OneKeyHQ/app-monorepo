/*
yarn test packages/kit-bg/src/services/ServiceDeFi.fetchAccountDeFiPositionsBatch.test.ts
*/

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
  toastIfError: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) => d,
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    DeFiEnabledNetworksChanged: 'DeFiEnabledNetworksChanged',
    DeFiPositionRefreshed: 'DeFiPositionRefreshed',
    LocalPendingTxConfirmed: 'LocalPendingTxConfirmed',
  },
  appEventBus: { emit: jest.fn(), on: jest.fn() },
}));
jest.mock('../states/jotai/atoms/currency', () => ({
  currencyPersistAtom: { get: async () => ({ currencyMap: {} }) },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  settingsPersistAtom: { get: async () => ({ currencyInfo: { id: 'usd' } }) },
}));
jest.mock('@onekeyhq/shared/src/config/networkIds', () => ({
  getNetworkIdsMap: () => ({ onekeyall: 'onekeyall--0' }),
}));
jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: any;

    _currentNetworkId: string | undefined;

    _currentAccountId: string | undefined;

    _currentUrlNetworkId: string | undefined;

    _currentUrlAccountId: string | undefined;

    constructor({ backgroundApi }: { backgroundApi: any }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isUrlAccountFn: ({ accountId }: { accountId: string }) =>
      accountId === 'url-account',
    isOthersAccount: () => false,
  },
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    isAllNetwork: ({ networkId }: { networkId: string }) =>
      networkId === 'onekeyall--0',
  },
}));
jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: { getTimeDurationMs: () => 3_600_000 },
}));

// eslint-disable-next-line import/first
import type { IDeFiPosition } from '@onekeyhq/shared/types/defi';

// eslint-disable-next-line import/first
import ServiceDeFi from './ServiceDeFi';

function position({
  networkId,
  chain,
  protocol,
  value,
}: {
  networkId: string;
  chain: string;
  protocol: string;
  value: number;
}): IDeFiPosition {
  return {
    networkId,
    owner: '0xabc',
    protocol,
    protocolName: protocol,
    protocolLogo: `https://logo/${protocol}.png`,
    chain,
    category: 'lending',
    assets: [
      {
        symbol: 'A',
        address: '0xa',
        amount: String(value),
        value,
        price: 1,
        category: 'supplied',
        meta: { decimals: 18, isVerified: true },
      },
    ],
    debts: [],
    rewards: [],
    metrics: { healthFactor: null },
    source: { provider: 'debank', fetchedAt: '', ttl: 0, cached: false },
    groupId: `${networkId}-${protocol}`,
    name: protocol,
  };
}

function multiChainResponse(networkIds: string[]) {
  return {
    data: {
      data: {
        success: true,
        data: {
          positions: {
            'evm--1': [
              position({
                networkId: 'evm--1',
                chain: 'eth',
                protocol: 'aave-v3',
                value: 100,
              }),
            ],
            'evm--8453': [
              position({
                networkId: 'evm--8453',
                chain: 'base',
                protocol: 'aave-v3',
                value: 50,
              }),
            ],
          },
          totals: {
            totalValue: 150,
            totalDebt: 0,
            totalReward: 0,
            netWorth: 150,
            chains: ['eth', 'base'],
            protocolCount: 1,
            positionCount: 2,
          },
          protocolSummaries: [
            {
              protocol: 'aave-v3',
              protocolName: 'Aave V3',
              totalValue: 150,
              totalDebt: 0,
              totalReward: 0,
              netWorth: 150,
              networkIds: ['evm--1', 'evm--8453'],
              positionCount: 2,
              positionIndices: [],
              protocolLogo: '',
              protocolUrl: '',
            },
          ],
        },
        meta: {
          queriedNetworkIds: networkIds,
          requestedNetworkIds: networkIds,
          networkIds,
          degraded: false,
        },
      },
    },
  };
}

function makeService() {
  const post = jest.fn();
  const updateAccountDeFiOverview = jest.fn(async () => undefined);
  const service = new ServiceDeFi({
    backgroundApi: {
      serviceAccount: {
        getDBAccountSafe: async () => ({ indexedAccountId: 'idx-1' }),
        getAccountAddressForApi: async () => '0xabc',
        getAccountXpub: async () => undefined,
      },
      serviceAccountProfile: {
        _getWalletTypeHeader: async () => ({ 'x-wallet-type': 'hd' }),
      },
      simpleDb: {
        deFi: {
          updateAccountDeFiOverview,
          getEnabledNetworksMap: async () => ({}),
        },
      },
    },
  });
  (service as any)._currentNetworkId = 'onekeyall--0';
  (service as any)._currentAccountId = 'hd-1--all';
  (service as any).getClient = async () => ({ post });
  return { service, post, updateAccountDeFiOverview };
}

const usd = { id: 'usd', value: 1 } as any;
const baseParams = {
  accountId: 'hd-1--evm',
  isAllNetworks: true,
  allNetworksAccountId: 'hd-1--all',
  allNetworksNetworkId: 'onekeyall--0',
  sourceCurrencyInfo: usd,
  targetCurrencyInfo: usd,
  saveToLocal: true,
  excludeLowValueProtocols: true,
};

describe('ServiceDeFi.fetchAccountDeFiPositionsBatch', () => {
  it('sends an array for several networks and returns per-network results in order', async () => {
    const { service, post, updateAccountDeFiOverview } = makeService();
    post.mockResolvedValueOnce(multiChainResponse(['evm--1', 'evm--8453']));

    const results = await service.fetchAccountDeFiPositionsBatch({
      ...baseParams,
      networkIds: ['evm--1', 'evm--8453'],
    });

    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0][0]).toBe('/wallet/v1/portfolio/positions');
    expect(post.mock.calls[0][1]).toEqual({
      networkId: ['evm--1', 'evm--8453'],
      accountAddress: '0xabc',
      isForceRefresh: undefined,
    });
    expect(results.map((r) => r?.networkId)).toEqual(['evm--1', 'evm--8453']);
    expect(results[0]?.overview.netWorth).toBe(100);
    expect(results[1]?.overview.netWorth).toBe(50);
    expect(results[0]?.protocolMap['evm--1-aave-v3'].protocolLogo).toBe(
      'https://logo/aave-v3.png',
    );
    expect(results[0]?.isSameAllNetworksAccountData).toBe(true);
    expect(updateAccountDeFiOverview).toHaveBeenCalledTimes(1);
    expect(updateAccountDeFiOverview).toHaveBeenCalledWith({
      accountAddress: '0xabc',
      xpub: undefined,
      merge: true,
      overview: {
        'evm--1': {
          totalValue: 100,
          totalDebt: 0,
          totalReward: 0,
          netWorth: 100,
          currency: 'usd',
        },
        'evm--8453': {
          totalValue: 50,
          totalDebt: 0,
          totalReward: 0,
          netWorth: 50,
          currency: 'usd',
        },
      },
    });
  });

  it('sends a string for a single network and empties a network the backend skipped', async () => {
    const { service, post } = makeService();
    post.mockResolvedValueOnce(multiChainResponse(['evm--1']));

    const [only] = await service.fetchAccountDeFiPositionsBatch({
      ...baseParams,
      networkIds: ['evm--1'],
    });
    expect(post.mock.calls[0][1].networkId).toBe('evm--1');
    expect(only?.overview.netWorth).toBe(100);

    post.mockResolvedValueOnce(multiChainResponse(['evm--1']));
    const results = await service.fetchAccountDeFiPositionsBatch({
      ...baseParams,
      networkIds: ['evm--1', 'evm--137'],
    });
    expect(results[1]).toMatchObject({
      networkId: 'evm--137',
      protocols: [],
      overview: { netWorth: 0 },
    });
  });

  it('returns empty data without a request when the current network is not All Networks', async () => {
    const { service, post } = makeService();
    (service as any)._currentNetworkId = 'evm--1';
    const results = await service.fetchAccountDeFiPositionsBatch({
      ...baseParams,
      networkIds: ['evm--1', 'evm--8453'],
    });
    expect(post).not.toHaveBeenCalled();
    expect(results.map((r) => r?.isSameAllNetworksAccountData)).toEqual([
      false,
      false,
    ]);
  });

  it('splits the batch once on 13004', async () => {
    const { service, post } = makeService();
    post
      .mockRejectedValueOnce(
        Object.assign(new Error('too many'), { code: 13_004 }),
      )
      .mockResolvedValueOnce(multiChainResponse(['evm--1']))
      .mockResolvedValueOnce(multiChainResponse(['evm--8453']));
    const results = await service.fetchAccountDeFiPositionsBatch({
      ...baseParams,
      networkIds: ['evm--1', 'evm--8453'],
    });
    expect(post).toHaveBeenCalledTimes(3);
    expect(results.map((r) => r?.networkId)).toEqual(['evm--1', 'evm--8453']);
  });

  it('falls back to single-network requests on 40115', async () => {
    const { service, post } = makeService();
    post.mockRejectedValueOnce(
      Object.assign(new Error('invalid'), { code: 40_115 }),
    );
    const single = jest
      .spyOn(service, 'fetchAccountDeFiPositions')
      .mockImplementation(
        async ({ networkId }) =>
          ({
            overview: {
              totalValue: 1,
              totalDebt: 0,
              totalReward: 0,
              netWorth: 1,
              chains: [],
              protocolCount: 0,
              positionCount: 0,
            },
            protocols: [],
            protocolMap: {},
            isSameAllNetworksAccountData: true,
            networkId,
          }) as unknown as Awaited<
            ReturnType<ServiceDeFi['fetchAccountDeFiPositions']>
          >,
      );
    const results = await service.fetchAccountDeFiPositionsBatch({
      ...baseParams,
      networkIds: ['evm--1', 'evm--8453'],
    });
    expect(single).toHaveBeenCalledTimes(2);
    expect(single.mock.calls.map(([p]) => p.networkId)).toEqual([
      'evm--1',
      'evm--8453',
    ]);
    expect(results.map((r) => r?.networkId)).toEqual(['evm--1', 'evm--8453']);
  });

  it('serves a set the backend rejected one by one without retrying the array', async () => {
    const { service, post } = makeService();
    post.mockRejectedValueOnce(
      Object.assign(new Error('invalid'), { code: 40_115 }),
    );
    const single = jest
      .spyOn(service, 'fetchAccountDeFiPositions')
      .mockImplementation(
        async ({ networkId }) =>
          ({
            overview: {
              totalValue: 0,
              totalDebt: 0,
              totalReward: 0,
              netWorth: 0,
              chains: [],
              protocolCount: 0,
              positionCount: 0,
            },
            protocols: [],
            protocolMap: {},
            isSameAllNetworksAccountData: true,
            networkId,
          }) as unknown as Awaited<
            ReturnType<ServiceDeFi['fetchAccountDeFiPositions']>
          >,
      );

    const rejected = ['aptos--1', 'aptos--126'];
    await service.fetchAccountDeFiPositionsBatch({
      ...baseParams,
      networkIds: rejected,
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(single).toHaveBeenCalledTimes(2);

    const again = await service.fetchAccountDeFiPositionsBatch({
      ...baseParams,
      networkIds: rejected,
    });
    expect(post).toHaveBeenCalledTimes(1);
    expect(single).toHaveBeenCalledTimes(4);
    expect(again.map((r) => r?.networkId)).toEqual(rejected);

    // Another set still gets its array attempt.
    post.mockResolvedValueOnce(multiChainResponse(['evm--1', 'evm--8453']));
    await service.fetchAccountDeFiPositionsBatch({
      ...baseParams,
      networkIds: ['evm--1', 'evm--8453'],
    });
    expect(post).toHaveBeenCalledTimes(2);
  });
});
