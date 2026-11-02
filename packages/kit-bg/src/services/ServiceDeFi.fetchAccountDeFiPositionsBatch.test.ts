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
    buildAccountLocalAssetsKey: ({
      accountAddress,
      xpub,
    }: {
      accountAddress?: string;
      xpub?: string;
    }) => (xpub || accountAddress || '').toLowerCase(),
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
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
// eslint-disable-next-line import/first
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
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
          } as Record<string, IDeFiPosition[]>,
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
  const updateAccountDeFiOverview = jest.fn(
    async (_params: {
      accountAddress?: string;
      xpub?: string;
      overview: Record<string, unknown>;
      merge?: boolean;
    }) => undefined,
  );
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
      serviceSetting: {
        getCurrencyMap: async () => ({ usd: { id: 'usd', value: 1 } }),
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

function singleResult({
  networkId,
  netWorth,
}: {
  networkId: string;
  netWorth: number;
}) {
  return {
    overview: {
      totalValue: netWorth,
      totalDebt: 0,
      totalReward: 0,
      netWorth,
      chains: [],
      protocolCount: 0,
      positionCount: 0,
    },
    protocols: [],
    protocolMap: {},
    isSameAllNetworksAccountData: true,
    networkId,
  } as unknown as Awaited<ReturnType<ServiceDeFi['fetchAccountDeFiPositions']>>;
}

describe('ServiceDeFi.fetchAccountDeFiPositionsBatch', () => {
  it('forces a recently settled network until its current revision is acknowledged', async () => {
    const { service, post } = makeService();
    const marker = service as unknown as {
      _markRecentDeFiSettlement: (accountId: string, networkId: string) => void;
    };
    marker._markRecentDeFiSettlement(baseParams.accountId, 'evm--8453');
    const revision = await service.getDeFiSettlementRevision({
      accountId: baseParams.accountId,
      networkId: 'evm--8453',
    });
    expect(revision).toBeDefined();
    if (revision === undefined) return;
    post.mockResolvedValue(multiChainResponse(['evm--1', 'evm--8453']));
    await service.fetchAccountDeFiPositionsBatch({
      ...baseParams,
      networkIds: ['evm--1', 'evm--8453'],
    });
    expect(post.mock.calls[0][1].isForceRefresh).toBe(true);
    await service.acknowledgeDeFiSettlement({
      accountId: baseParams.accountId,
      networkId: 'evm--8453',
      revision,
    });
    await service.fetchAccountDeFiPositionsBatch({
      ...baseParams,
      networkIds: ['evm--1', 'evm--8453'],
    });
    expect(post.mock.calls[1][1].isForceRefresh).toBeUndefined();
  });

  it('does not let an older batch overwrite a newer single-network overview', async () => {
    const { service, post, updateAccountDeFiOverview } = makeService();
    let resolveOld:
      | ((value: ReturnType<typeof multiChainResponse>) => void)
      | undefined;
    let markDispatched: (() => void) | undefined;
    const dispatched = new Promise<void>((resolve) => {
      markDispatched = resolve;
    });
    post.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
          markDispatched?.();
        }),
    );
    const oldRequest = service.fetchAccountDeFiPositionsBatch({
      ...baseParams,
      networkIds: ['evm--1', 'evm--8453'],
    });
    await dispatched;
    const newer = multiChainResponse(['evm--8453']);
    newer.data.data.data.totals.netWorth = 5;
    newer.data.data.data.totals.totalValue = 5;
    newer.data.data.data.positions = {};
    newer.data.data.data.protocolSummaries = [];
    post.mockResolvedValueOnce(newer);
    await service.fetchAccountDeFiPositions({
      ...baseParams,
      networkId: 'evm--8453',
      isForceRefresh: true,
    });
    resolveOld?.(multiChainResponse(['evm--1', 'evm--8453']));
    await oldRequest;
    expect(updateAccountDeFiOverview).toHaveBeenCalledTimes(2);
    expect(
      Object.keys(updateAccountDeFiOverview.mock.calls[0][0].overview),
    ).toEqual(['evm--8453']);
    expect(
      Object.keys(updateAccountDeFiOverview.mock.calls[1][0].overview),
    ).toEqual(['evm--1']);
  });

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

  it('sends a string for a single network and empties a network the backend queried without positions', async () => {
    const { service, post, updateAccountDeFiOverview } = makeService();
    post.mockResolvedValueOnce(multiChainResponse(['evm--1']));

    const [only] = await service.fetchAccountDeFiPositionsBatch({
      ...baseParams,
      networkIds: ['evm--1'],
    });
    expect(post.mock.calls[0][1].networkId).toBe('evm--1');
    expect(only?.overview.netWorth).toBe(100);

    // Queried (named in `meta.queriedNetworkIds`) but holding nothing: an
    // empty result that is persisted as zero.
    post.mockResolvedValueOnce(multiChainResponse(['evm--1', 'evm--137']));
    const results = await service.fetchAccountDeFiPositionsBatch({
      ...baseParams,
      networkIds: ['evm--1', 'evm--137'],
    });
    expect(post).toHaveBeenCalledTimes(2);
    expect(results[1]).toMatchObject({
      networkId: 'evm--137',
      protocols: [],
      overview: { netWorth: 0 },
    });
    expect(
      Object.keys(updateAccountDeFiOverview.mock.calls[1][0].overview),
    ).toEqual(['evm--1', 'evm--137']);
  });

  it('fetches a network the batch did not query one by one and keeps its cached overview', async () => {
    const { service, post, updateAccountDeFiOverview } = makeService();
    // `evm--137` is absent from `meta.queriedNetworkIds` and from `positions`:
    // the backend never looked at it (OK-63882), so "no positions" is not a
    // result for it.
    post.mockResolvedValueOnce(multiChainResponse(['evm--1']));
    const single = jest
      .spyOn(service, 'fetchAccountDeFiPositions')
      .mockImplementation(async ({ networkId }) =>
        singleResult({ networkId, netWorth: 7 }),
      );

    const results = await service.fetchAccountDeFiPositionsBatch({
      ...baseParams,
      networkIds: ['evm--1', 'evm--137'],
    });

    expect(post).toHaveBeenCalledTimes(1);
    expect(single).toHaveBeenCalledTimes(1);
    expect(single.mock.calls[0][0].networkId).toBe('evm--137');
    expect(results.map((r) => r?.networkId)).toEqual(['evm--1', 'evm--137']);
    expect(results[0]?.overview.netWorth).toBe(100);
    expect(results[1]?.overview.netWorth).toBe(7);
    // The batch persists only the networks it queried.
    expect(updateAccountDeFiOverview).toHaveBeenCalledTimes(1);
    expect(
      Object.keys(updateAccountDeFiOverview.mock.calls[0][0].overview),
    ).toEqual(['evm--1']);
  });

  it('leaves a network the batch did not query undefined when its own request fails', async () => {
    const { service, post, updateAccountDeFiOverview } = makeService();
    post.mockResolvedValueOnce(multiChainResponse(['evm--1']));
    jest
      .spyOn(service, 'fetchAccountDeFiPositions')
      .mockRejectedValue(new Error('timeout'));

    const results = await service.fetchAccountDeFiPositionsBatch({
      ...baseParams,
      networkIds: ['evm--1', 'evm--137'],
    });

    expect(results[0]?.overview.netWorth).toBe(100);
    expect(results[1]).toBeUndefined();
    expect(
      Object.keys(updateAccountDeFiOverview.mock.calls[0][0].overview),
    ).toEqual(['evm--1']);
  });

  it('does not re-request a single network the backend did not query and skips its cache write', async () => {
    const { service, post, updateAccountDeFiOverview } = makeService();
    const resp = multiChainResponse([]);
    resp.data.data.data.positions = {};
    post.mockResolvedValueOnce(resp);
    const single = jest.spyOn(service, 'fetchAccountDeFiPositions');

    const [only] = await service.fetchAccountDeFiPositionsBatch({
      ...baseParams,
      networkIds: ['evm--250'],
    });

    expect(post).toHaveBeenCalledTimes(1);
    expect(single).not.toHaveBeenCalled();
    expect(only).toMatchObject({ networkId: 'evm--250', protocols: [] });
    expect(updateAccountDeFiOverview).not.toHaveBeenCalled();
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

  it('falls back to single-network requests on a general batch error without remembering the set', async () => {
    const { service, post } = makeService();
    post.mockRejectedValueOnce(new Error('timeout'));
    const single = jest
      .spyOn(service, 'fetchAccountDeFiPositions')
      .mockImplementation(async ({ networkId }) =>
        singleResult({ networkId, netWorth: 1 }),
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

    // The request failed, the set was not rejected: the next run arrays again.
    post.mockResolvedValueOnce(multiChainResponse(['evm--1', 'evm--8453']));
    await service.fetchAccountDeFiPositionsBatch({
      ...baseParams,
      networkIds: ['evm--1', 'evm--8453'],
    });
    expect(post).toHaveBeenCalledTimes(2);
    expect(single).toHaveBeenCalledTimes(2);
  });

  it('rethrows an aborted batch request instead of falling back', async () => {
    const { service, post } = makeService();
    post.mockImplementationOnce(async () => {
      await service.abortFetchAccountDeFiPositions();
      throw new OneKeyLocalError('canceled');
    });
    const single = jest.spyOn(service, 'fetchAccountDeFiPositions');

    await expect(
      service.fetchAccountDeFiPositionsBatch({
        ...baseParams,
        networkIds: ['evm--1', 'evm--8453'],
      }),
    ).rejects.toThrow('canceled');
    expect(single).not.toHaveBeenCalled();
  });

  it('rethrows a general error for a single network', async () => {
    const { service, post } = makeService();
    post.mockRejectedValueOnce(new Error('timeout'));
    const single = jest.spyOn(service, 'fetchAccountDeFiPositions');

    await expect(
      service.fetchAccountDeFiPositionsBatch({
        ...baseParams,
        networkIds: ['evm--1'],
      }),
    ).rejects.toThrow('timeout');
    expect(post).toHaveBeenCalledTimes(1);
    expect(single).not.toHaveBeenCalled();
  });

  it('returns the positions when the cache write fails', async () => {
    const { service, post, updateAccountDeFiOverview } = makeService();
    post.mockResolvedValueOnce(multiChainResponse(['evm--1', 'evm--8453']));
    updateAccountDeFiOverview.mockRejectedValueOnce(new Error('db locked'));
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const results = await service.fetchAccountDeFiPositionsBatch({
      ...baseParams,
      networkIds: ['evm--1', 'evm--8453'],
    });

    expect(results.map((r) => r?.overview.netWorth)).toEqual([100, 50]);
    expect(consoleError).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
});

describe('ServiceDeFi.fetchAccountDeFiPositions', () => {
  function singleChainResponse({
    networkId,
    queried,
  }: {
    networkId: string;
    queried: boolean;
  }) {
    const resp = multiChainResponse(queried ? [networkId] : []);
    resp.data.data.data.positions = queried ? { [networkId]: [] } : {};
    resp.data.data.data.totals = {
      totalValue: 0,
      totalDebt: 0,
      totalReward: 0,
      netWorth: 0,
      chains: [],
      protocolCount: 0,
      positionCount: 0,
    };
    resp.data.data.data.protocolSummaries = [];
    return resp;
  }

  it('does not publish an omitted network as an empty confirmed position', async () => {
    const { service, post } = makeService();
    post.mockResolvedValueOnce(
      singleChainResponse({ networkId: 'evm--250', queried: false }),
    );
    const mockBus = appEventBus as unknown as { emit: jest.Mock };
    mockBus.emit.mockClear();
    const refresh = service as unknown as {
      _fetchDeFiForceRefresh: (params: {
        accountId: string;
        networkId: string;
      }) => Promise<unknown>;
    };
    expect(
      await refresh._fetchDeFiForceRefresh({
        accountId: 'hd-1--evm',
        networkId: 'evm--250',
      }),
    ).toBeUndefined();
    expect(mockBus.emit).not.toHaveBeenCalled();
  });

  it('does not publish a force response superseded by a later request', async () => {
    const { service, post } = makeService();
    const retry = jest
      .spyOn(service as any, '_runDeFiForceRefresh')
      .mockResolvedValue(undefined);
    const mockBus = appEventBus as unknown as { emit: jest.Mock };
    mockBus.emit.mockClear();
    let resolveOld:
      | ((value: ReturnType<typeof multiChainResponse>) => void)
      | undefined;
    let markDispatched: (() => void) | undefined;
    const dispatched = new Promise<void>((resolve) => {
      markDispatched = resolve;
    });
    post.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
          markDispatched?.();
        }),
    );
    const refresh = service as unknown as {
      _fetchDeFiForceRefresh: (params: {
        accountId: string;
        networkId: string;
      }) => Promise<unknown>;
    };
    const old = refresh._fetchDeFiForceRefresh({
      accountId: 'hd-1--evm',
      networkId: 'evm--250',
    });
    await dispatched;
    post.mockResolvedValueOnce(
      singleChainResponse({ networkId: 'evm--250', queried: true }),
    );
    await service.fetchAccountDeFiPositions({
      ...baseParams,
      networkId: 'evm--250',
    });
    resolveOld?.(singleChainResponse({ networkId: 'evm--250', queried: true }));
    expect(await old).toBeUndefined();
    expect(mockBus.emit).not.toHaveBeenCalled();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('bounds force refresh retries when consecutive attempts are superseded', async () => {
    const { service, post } = makeService();
    const mockBus = appEventBus as unknown as { emit: jest.Mock };
    mockBus.emit.mockClear();
    const scope = { accountId: 'hd-1--evm', networkId: 'evm--250' };
    const response = singleChainResponse({
      networkId: scope.networkId,
      queried: true,
    });
    let releaseFirst: ((value: typeof response) => void) | undefined;
    let releaseRetry: ((value: typeof response) => void) | undefined;
    let firstStarted: (() => void) | undefined;
    let retryStarted: (() => void) | undefined;
    const firstDispatched = new Promise<void>((resolve) => {
      firstStarted = resolve;
    });
    const retryDispatched = new Promise<void>((resolve) => {
      retryStarted = resolve;
    });
    let forceCount = 0;
    post.mockImplementation((_url, body: { isForceRefresh?: boolean }) => {
      if (!body.isForceRefresh) return Promise.resolve(response);
      forceCount += 1;
      if (forceCount === 1) {
        return new Promise((resolve) => {
          releaseFirst = resolve;
          firstStarted?.();
        });
      }
      if (forceCount === 2) {
        return new Promise((resolve) => {
          releaseRetry = resolve;
          retryStarted?.();
        });
      }
      return Promise.resolve(response);
    });
    const internals = service as unknown as {
      _runDeFiForceRefresh: (params: typeof scope) => Promise<unknown>;
      _deFiForceRefreshInFlight: Map<string, Promise<unknown>>;
    };
    const run = jest.spyOn(internals, '_runDeFiForceRefresh');
    const first = internals._runDeFiForceRefresh(scope);
    await firstDispatched;
    await service.fetchAccountDeFiPositions({
      ...baseParams,
      networkId: scope.networkId,
    });
    releaseFirst?.(response);
    await first;
    await retryDispatched;
    const pending = internals._deFiForceRefreshInFlight.get(
      `${scope.accountId}__${scope.networkId}`,
    );
    expect(pending).toBeDefined();
    await service.fetchAccountDeFiPositions({
      ...baseParams,
      networkId: scope.networkId,
    });
    releaseRetry?.(response);
    await pending;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(run).toHaveBeenCalledTimes(2);
    expect(forceCount).toBe(2);
    expect(mockBus.emit).not.toHaveBeenCalled();
  });

  it('uses the xpub for the cached overview when an address was supplied', async () => {
    const { service, post, updateAccountDeFiOverview } = makeService();
    (service as any).backgroundApi.serviceAccount.getAccountXpub = jest
      .fn()
      .mockResolvedValue('xpub-test');
    post.mockResolvedValueOnce(
      singleChainResponse({ networkId: 'evm--250', queried: true }),
    );
    await service.fetchAccountDeFiPositions({
      ...baseParams,
      accountAddress: '0xabc',
      networkId: 'evm--250',
    });
    expect(updateAccountDeFiOverview).toHaveBeenCalledWith(
      expect.objectContaining({ xpub: 'xpub-test' }),
    );
  });

  it('invalidates the scope again when a later force refresh succeeds', async () => {
    const { service, post } = makeService();
    const scope = { accountId: 'hd-1--evm', networkId: 'evm--250' };
    const mockBus = appEventBus as unknown as { emit: jest.Mock };
    mockBus.emit.mockClear();
    post.mockResolvedValue(
      singleChainResponse({ networkId: scope.networkId, queried: true }),
    );
    const refresh = service as unknown as {
      _fetchDeFiForceRefresh: (params: typeof scope) => Promise<unknown>;
    };
    await refresh._fetchDeFiForceRefresh(scope);
    const first = await service.getDeFiSettlementRevision(scope);
    expect(first).toBeDefined();
    if (first === undefined) return;
    await service.acknowledgeDeFiSettlement({ ...scope, revision: first });
    expect(await service.getDeFiSettlementRevision(scope)).toBeUndefined();
    await refresh._fetchDeFiForceRefresh(scope);
    expect(await service.getDeFiSettlementRevision(scope)).toBeDefined();
    expect(mockBus.emit).toHaveBeenCalledTimes(2);
  });

  it('persists the overview of a queried network', async () => {
    const { service, post, updateAccountDeFiOverview } = makeService();
    post.mockResolvedValueOnce(
      singleChainResponse({ networkId: 'evm--250', queried: true }),
    );

    const result = await service.fetchAccountDeFiPositions({
      ...baseParams,
      networkId: 'evm--250',
    });

    expect(result.overview.netWorth).toBe(0);
    expect(updateAccountDeFiOverview).toHaveBeenCalledTimes(1);
    expect(
      Object.keys(updateAccountDeFiOverview.mock.calls[0][0].overview),
    ).toEqual(['evm--250']);
  });

  it('does not persist an overview for a network the backend did not query', async () => {
    const { service, post, updateAccountDeFiOverview } = makeService();
    post.mockResolvedValueOnce(
      singleChainResponse({ networkId: 'evm--250', queried: false }),
    );

    const result = await service.fetchAccountDeFiPositions({
      ...baseParams,
      networkId: 'evm--250',
    });

    expect(result.protocols).toEqual([]);
    expect(result.isNetworkQueried).toBe(false);
    expect(updateAccountDeFiOverview).not.toHaveBeenCalled();
  });

  it('returns the positions when the cache write fails', async () => {
    const { service, post, updateAccountDeFiOverview } = makeService();
    post.mockResolvedValueOnce(
      singleChainResponse({ networkId: 'evm--250', queried: true }),
    );
    updateAccountDeFiOverview.mockRejectedValueOnce(new Error('db locked'));
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const result = await service.fetchAccountDeFiPositions({
      ...baseParams,
      networkId: 'evm--250',
    });

    expect(result.overview.netWorth).toBe(0);
    expect(consoleError).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
});
