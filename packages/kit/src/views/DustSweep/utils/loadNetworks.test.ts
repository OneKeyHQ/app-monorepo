import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAllNetworkAccountsInfoResult } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';
import type { ICachedAccountTokens } from '@onekeyhq/shared/types/token';

import {
  loadDustSweepEntryCapabilities,
  loadDustSweepNetworks,
  refreshDustSweepNetwork,
} from './loadNetworks';
import { invalidateDustSweepNetworksCache } from './networkCache';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    simpleDb: {
      swapConfigs: { getSwapProviderManager: jest.fn() },
    },
    serviceAllNetwork: {
      getAllNetworkAccounts: jest.fn(),
    },
    serviceSwap: {
      fetchSwapNetworks: jest.fn(),
      fetchSwapTokens: jest.fn(),
      fetchSwapProviderSupportNetworks: jest.fn(),
      getSwapProviderManager: jest.fn(),
    },
    serviceToken: {
      fetchAccountTokens: jest.fn(),
      getCachedAccountTokens: jest.fn(),
      getNativeToken: jest.fn(),
    },
  },
}));
jest.mock('@onekeyhq/shared/src/config/networkIds', () => ({
  getNetworkIdsMap: () => ({ onekeyall: 'onekeyall--0' }),
}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  isExternalAccount: () => false,
  isWatchingAccount: () => false,
}));

const serviceSwap = jest.mocked(backgroundApiProxy.serviceSwap);
const swapConfigs = jest.mocked(backgroundApiProxy.simpleDb.swapConfigs);
const serviceAllNetwork = jest.mocked(backgroundApiProxy.serviceAllNetwork);
const serviceToken = jest.mocked(backgroundApiProxy.serviceToken);

const ethereum: ISwapNetwork = {
  networkId: 'evm--1',
  name: 'Ethereum',
  symbol: 'ETH',
  shortcode: 'eth',
  supportSingleSwap: true,
};
const otherNetwork: ISwapNetwork = {
  ...ethereum,
  networkId: 'evm--56',
  name: 'BNB Smart Chain',
};

function accountsInfo(networks = [ethereum, otherNetwork]) {
  return {
    accountsInfo: networks.map((network) => ({
      networkId: network.networkId,
      accountId: 'hd-test--0',
      apiAddress: '0xuser',
      accountXpub: undefined,
      pub: undefined,
      dbAccount: undefined,
      isNftEnabled: false,
      isBackendIndexed: false,
      deriveType: undefined,
      deriveInfo: undefined,
      isTestnet: false,
    })),
    accountsInfoBackendIndexed: [],
    accountsInfoBackendNotIndexed: [],
    allAccountsInfo: [],
  };
}

function okxProvider() {
  return {
    providerInfo: {
      provider: 'SwapOKX',
      protocol: EProtocolOfExchange.SWAP,
      logo: '',
      providerName: 'OKX Dex',
    },
    isSupportSingleSwap: true,
    supportSingleSwapNetworks: [ethereum],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const params = {
  walletId: 'hd-test',
  accountId: 'hd-test--0',
  indexedAccountId: 'hd-test--0',
  entry: 'lowValueRow' as const,
};

describe('loadDustSweepNetworks request ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    serviceToken.getCachedAccountTokens.mockResolvedValue([]);
    swapConfigs.getSwapProviderManager.mockResolvedValue([]);
    serviceSwap.getSwapProviderManager.mockResolvedValue([okxProvider()]);
    serviceSwap.fetchSwapNetworks.mockResolvedValue([ethereum]);
    serviceSwap.fetchSwapTokens.mockReset().mockResolvedValue([]);
    serviceSwap.fetchSwapProviderSupportNetworks
      .mockReset()
      .mockResolvedValue([ethereum, otherNetwork]);
    serviceAllNetwork.getAllNetworkAccounts.mockResolvedValue(accountsInfo());
    serviceToken.fetchAccountTokens.mockResolvedValue({
      tokens: { data: [], map: {}, keys: '', currency: 'usd' },
      smallBalanceTokens: { data: [], map: {}, keys: '', currency: 'usd' },
      riskTokens: { data: [], map: {}, keys: '', currency: 'usd' },
    });
    serviceToken.getNativeToken.mockResolvedValue({
      address: '',
      isNative: true,
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18,
    });
  });

  it('loads entry capabilities quietly through the default service callbacks', async () => {
    await expect(loadDustSweepEntryCapabilities()).resolves.toEqual([ethereum]);
    expect(serviceSwap.fetchSwapNetworks.mock.calls).toEqual([
      [{ autoHandleError: false }],
    ]);
    expect(serviceSwap.getSwapProviderManager.mock.calls).toHaveLength(0);
    expect(
      serviceSwap.fetchSwapProviderSupportNetworks.mock.calls,
    ).toHaveLength(0);
    expect(swapConfigs.getSwapProviderManager.mock.calls).toHaveLength(0);
    expect(serviceToken.fetchAccountTokens.mock.calls).toHaveLength(0);
  });

  function cachedResponse(): ICachedAccountTokens {
    return {
      accountId: params.accountId,
      networkId: ethereum.networkId,
      accountAddress: '0xuser',
      source: 'home-token-list',
      coverage: 'partial',
      capturedAt: Date.now(),
      tokens: { data: [], keys: '', map: {}, currency: 'usd' },
      smallBalanceTokens: {
        data: [
          {
            $key: 'dust',
            networkId: ethereum.networkId,
            address: '0xdust',
            symbol: 'DUST',
            name: 'Dust token',
            isNative: false,
            decimals: 18,
          },
        ],
        keys: 'dust',
        currency: 'usd',
        map: {
          dust: {
            balance: '1000000000000000000',
            balanceParsed: '1',
            fiatValue: '0.5',
            price: 0.5,
          },
        },
      },
      riskTokens: { data: [], keys: '', map: {}, currency: 'usd' },
    };
  }

  it('uses Swap network support for fresh and cached asset discovery', async () => {
    serviceSwap.fetchSwapNetworks.mockResolvedValue([
      ethereum,
      { ...otherNetwork, supportSingleSwap: false },
    ]);
    serviceToken.getCachedAccountTokens.mockResolvedValue([cachedResponse()]);
    const result = await loadDustSweepNetworks(
      params,
      new AbortController().signal,
    );
    expect(result.networks.map((entry) => entry.network.networkId)).toEqual([
      ethereum.networkId,
    ]);
    expect(
      serviceToken.fetchAccountTokens.mock.calls.map(
        ([request]) => request.networkId,
      ),
    ).toEqual([ethereum.networkId]);
    expect(
      serviceSwap.fetchSwapProviderSupportNetworks.mock.calls,
    ).toHaveLength(0);
  });

  it('requests Swap candidates with the resolved network, account, and USD scope', async () => {
    await loadDustSweepNetworks(params, new AbortController().signal);

    expect(serviceSwap.fetchSwapTokens.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        networkId: ethereum.networkId,
        accountId: params.accountId,
        accountAddress: '0xuser',
        accountNetworkId: ethereum.networkId,
        currency: 'usd',
        throwOnError: true,
      }),
    );
  });

  it('uses Swap membership with Wallet balance metadata for a matching token', async () => {
    serviceToken.fetchAccountTokens.mockResolvedValueOnce(cachedResponse());
    serviceSwap.fetchSwapTokens.mockResolvedValueOnce([
      {
        networkId: ethereum.networkId,
        contractAddress: '0xdust',
        symbol: 'DUST',
        name: 'Dust token',
        decimals: 18,
        isNative: false,
        balanceParsed: '0.25',
        fiatValue: '0.125',
        price: '0.5',
        currency: 'usd',
      },
    ]);

    const result = await loadDustSweepNetworks(
      params,
      new AbortController().signal,
    );

    expect(result.networks[0].tokens).toEqual([
      expect.objectContaining({
        contractAddress: '0xdust',
        amount: '1',
        valueUsd: '0.5',
      }),
    ]);
    expect(result.networks[0].balanceUsd).toBe('0.5');
  });

  it('loads Wallet metadata for a Swap holding that was not automatically discovered', async () => {
    const response = cachedResponse();
    serviceToken.fetchAccountTokens
      .mockResolvedValueOnce({
        ...response,
        smallBalanceTokens: { data: [], map: {}, keys: '', currency: 'usd' },
      })
      .mockResolvedValueOnce(response);
    serviceSwap.fetchSwapTokens.mockResolvedValueOnce([
      {
        networkId: ethereum.networkId,
        contractAddress: '0xdust',
        symbol: 'DUST',
        name: 'Dust token',
        decimals: 18,
        isNative: false,
        balanceParsed: '1',
        fiatValue: '0.5',
        price: '0.5',
        currency: 'usd',
      },
    ]);

    const result = await loadDustSweepNetworks(
      params,
      new AbortController().signal,
    );

    expect(serviceToken.fetchAccountTokens.mock.calls).toHaveLength(2);
    expect(serviceToken.fetchAccountTokens.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        accountId: params.accountId,
        networkId: ethereum.networkId,
        contractList: ['0xdust'],
      }),
    );
    expect(result.networks[0].tokens).toEqual([
      expect.objectContaining({
        contractAddress: '0xdust',
        amount: '1',
        valueUsd: '0.5',
      }),
    ]);
    expect(result.networks[0].balanceUsd).toBe('0.5');
  });

  it('keeps existing assets and native value when the supplemental response is contract-scoped', async () => {
    const initial = cachedResponse();
    initial.tokens = {
      data: [
        {
          $key: 'native',
          networkId: ethereum.networkId,
          address: '',
          symbol: 'ETH',
          name: 'Ethereum',
          isNative: true,
          decimals: 18,
        },
      ],
      keys: 'native',
      currency: 'usd',
      map: {
        native: {
          balance: '2000000000000000000',
          balanceParsed: '2',
          fiatValue: '3',
          price: 1.5,
        },
      },
    };
    const added = {
      $key: 'added',
      networkId: ethereum.networkId,
      address: '0xadded',
      symbol: 'ADDED',
      name: 'Added token',
      isNative: false,
      decimals: 18,
    };
    const extra = {
      ...initial,
      tokens: { data: [], keys: '', map: {}, currency: 'usd' },
      smallBalanceTokens: {
        data: [added],
        keys: 'added',
        currency: 'usd',
        map: {
          added: {
            balance: '1000000000000000000',
            balanceParsed: '1',
            fiatValue: '0.2',
            price: 0.2,
          },
        },
      },
    };
    serviceToken.fetchAccountTokens
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(extra);
    serviceSwap.fetchSwapTokens.mockResolvedValueOnce([
      {
        networkId: ethereum.networkId,
        contractAddress: '0xdust',
        symbol: 'DUST',
        decimals: 18,
        balanceParsed: '1',
      },
      {
        networkId: ethereum.networkId,
        contractAddress: '0xadded',
        symbol: 'ADDED',
        decimals: 18,
        balanceParsed: '1',
      },
    ]);

    const result = await loadDustSweepNetworks(
      params,
      new AbortController().signal,
    );

    expect(
      result.networks[0].tokens
        .map((token) => token.contractAddress)
        .toSorted(),
    ).toEqual(['0xadded', '0xdust']);
    expect(result.networks[0].balanceUsd).toBe('3.7');
    expect(result.networks[0].nativeToken).toEqual(
      expect.objectContaining({ balanceParsed: '2', price: '1.5' }),
    );
  });

  it.each([
    { nativePrice: 1, nativeInSmall: false },
    { nativePrice: 1, nativeInSmall: true },
    { nativePrice: 0, nativeInSmall: false },
    { nativePrice: 0, nativeInSmall: true },
  ])(
    'recomputes shared Arc balances after merging: $nativePrice, $nativeInSmall',
    async ({ nativePrice, nativeInSmall }) => {
      const arc = { ...ethereum, networkId: 'evm--5042', name: 'Arc' };
      serviceSwap.fetchSwapNetworks.mockResolvedValueOnce([arc]);
      serviceAllNetwork.getAllNetworkAccounts.mockResolvedValueOnce(
        accountsInfo([arc]),
      );
      const nativeGroup = {
        data: [
          {
            $key: 'native',
            networkId: arc.networkId,
            address: '',
            symbol: 'USDC',
            name: 'USDC',
            isNative: true,
            decimals: 6,
          },
        ],
        keys: 'native',
        currency: 'usd',
        map: {
          native: {
            balance: '2000000',
            balanceParsed: '2',
            fiatValue: nativePrice ? '2' : '0',
            price: nativePrice,
          },
        },
      };
      const empty = { data: [], map: {}, keys: '', currency: 'usd' };
      const initial = {
        ...cachedResponse(),
        tokens: nativeInSmall ? empty : nativeGroup,
        smallBalanceTokens: nativeInSmall ? nativeGroup : empty,
      };
      const shared = {
        $key: 'shared',
        networkId: arc.networkId,
        address: '0x3600',
        symbol: 'USDC',
        name: 'USDC',
        isNative: false,
        decimals: 6,
        sharedBalanceExcluded: true,
        sharedBalanceWith: '',
      };
      const sharedGroup = {
        data: [shared],
        keys: 'shared',
        currency: 'usd',
        map: {
          shared: {
            balance: '2000000',
            balanceParsed: '2',
            fiatValue: '2',
            price: 1,
          },
        },
      };
      const supplemental = {
        ...initial,
        tokens: nativeInSmall ? sharedGroup : empty,
        smallBalanceTokens: nativeInSmall ? empty : sharedGroup,
      };
      const originalInitial = JSON.stringify(initial);
      const originalSupplemental = JSON.stringify(supplemental);
      serviceToken.fetchAccountTokens
        .mockResolvedValueOnce(initial)
        .mockResolvedValueOnce(supplemental);
      serviceSwap.fetchSwapTokens.mockResolvedValueOnce([
        {
          networkId: arc.networkId,
          contractAddress: shared.address,
          symbol: 'USDC',
          decimals: 6,
          balanceParsed: '2',
        },
      ]);

      const result = await loadDustSweepNetworks(
        params,
        new AbortController().signal,
      );

      expect(result.networks[0].balanceUsd).toBe('2');
      expect(result.networks[0].tokens).toEqual([]);
      expect(JSON.stringify(initial)).toBe(originalInitial);
      expect(JSON.stringify(supplemental)).toBe(originalSupplemental);
    },
  );

  it('does not duplicate wallet assets when the supplemental response includes a full list', async () => {
    const initial = cachedResponse();
    const original = initial.smallBalanceTokens.data[0];
    const added = {
      ...original,
      $key: 'added',
      address: '0xadded',
      symbol: 'ADDED',
    };
    const repeated = { ...original, $key: 'repeated', address: '0xDUST' };
    const unrelated = { ...original, $key: 'unrelated', address: '0xother' };
    const extra = {
      ...initial,
      tokens: {
        data: [repeated, unrelated],
        keys: 'repeated,unrelated',
        currency: 'usd',
        map: {
          repeated: {
            balance: '1',
            balanceParsed: '1',
            fiatValue: '100',
            price: 100,
          },
          unrelated: {
            balance: '1',
            balanceParsed: '1',
            fiatValue: '200',
            price: 200,
          },
          dangling: {
            balance: '1',
            balanceParsed: '1',
            fiatValue: '300',
            price: 300,
          },
        },
      },
      smallBalanceTokens: {
        data: [original, added],
        keys: 'dust,added',
        currency: 'usd',
        map: {
          ...initial.smallBalanceTokens.map,
          added: {
            balance: '1000000000000000000',
            balanceParsed: '1',
            fiatValue: '0.2',
            price: 0.2,
          },
        },
      },
    };
    serviceToken.fetchAccountTokens
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(extra);
    serviceSwap.fetchSwapTokens.mockResolvedValueOnce([
      {
        networkId: ethereum.networkId,
        contractAddress: '0xdust',
        symbol: 'DUST',
        decimals: 18,
        balanceParsed: '1',
      },
      {
        networkId: ethereum.networkId,
        contractAddress: '0xadded',
        symbol: 'ADDED',
        decimals: 18,
        balanceParsed: '1',
      },
    ]);

    const result = await loadDustSweepNetworks(
      params,
      new AbortController().signal,
    );

    expect(
      result.networks[0].tokens
        .map((token) => token.contractAddress)
        .toSorted(),
    ).toEqual(['0xadded', '0xdust']);
    expect(result.networks[0].balanceUsd).toBe('0.7');
  });

  it('rejects a supplemental response with non-USD prices', async () => {
    const initial = cachedResponse();
    const extra = {
      ...initial,
      tokens: { ...initial.tokens, currency: 'eur' },
    };
    serviceToken.fetchAccountTokens
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(extra);
    serviceSwap.fetchSwapTokens.mockResolvedValueOnce([
      {
        networkId: ethereum.networkId,
        contractAddress: '0xadded',
        symbol: 'ADDED',
        decimals: 18,
        balanceParsed: '1',
      },
    ]);

    await expect(
      loadDustSweepNetworks(params, new AbortController().signal),
    ).rejects.toThrow('Unable to load balances');
  });

  it('rejects a missing asset whose key conflicts with the initial response', async () => {
    const initial = cachedResponse();
    const existing = initial.smallBalanceTokens.data[0];
    const extra = {
      ...initial,
      smallBalanceTokens: {
        data: [{ ...existing, address: '0xadded' }],
        keys: 'dust',
        map: initial.smallBalanceTokens.map,
        currency: 'usd',
      },
    };
    serviceToken.fetchAccountTokens
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(extra);
    serviceSwap.fetchSwapTokens.mockResolvedValueOnce([
      {
        networkId: ethereum.networkId,
        contractAddress: '0xadded',
        symbol: 'ADDED',
        decimals: 18,
        balanceParsed: '1',
      },
    ]);

    await expect(
      loadDustSweepNetworks(params, new AbortController().signal),
    ).rejects.toThrow('Unable to load balances');
  });

  it('marks a network failed when supplemental Wallet metadata cannot be loaded', async () => {
    serviceSwap.fetchSwapNetworks.mockResolvedValueOnce([
      ethereum,
      otherNetwork,
    ]);
    const response = cachedResponse();
    const empty = {
      ...response,
      smallBalanceTokens: { data: [], map: {}, keys: '', currency: 'usd' },
    };
    serviceToken.fetchAccountTokens.mockImplementation(async (request) => {
      if (request.contractList?.length)
        throw new OneKeyLocalError('Details unavailable');
      return empty;
    });
    serviceSwap.fetchSwapTokens.mockImplementation(async ({ networkId }) =>
      networkId === ethereum.networkId
        ? [
            {
              networkId: ethereum.networkId,
              contractAddress: '0xdust',
              symbol: 'DUST',
              decimals: 18,
              balanceParsed: '1',
              fiatValue: '0.5',
              currency: 'usd',
            },
          ]
        : [],
    );

    const result = await loadDustSweepNetworks(
      params,
      new AbortController().signal,
    );

    expect(result.partialError).toBe(true);
    expect(result.failedNetworkIds).toEqual([ethereum.networkId]);
    expect(result.networks.map((entry) => entry.network.networkId)).toEqual([
      otherNetwork.networkId,
    ]);
  });

  it('does not add Wallet-only holdings to a successful empty Swap candidate list', async () => {
    serviceToken.fetchAccountTokens.mockResolvedValueOnce(cachedResponse());
    serviceSwap.fetchSwapTokens.mockResolvedValueOnce([]);

    const result = await loadDustSweepNetworks(
      params,
      new AbortController().signal,
    );

    expect(result.networks[0].tokens).toEqual([]);
    expect(result.networks[0].balanceUsd).toBe('0.5');
  });

  it('reports a failed Swap candidate request without falling back to Wallet candidates', async () => {
    serviceSwap.fetchSwapNetworks.mockResolvedValueOnce([
      ethereum,
      otherNetwork,
    ]);
    serviceSwap.fetchSwapTokens.mockImplementation(async ({ networkId }) => {
      if (networkId === ethereum.networkId)
        throw new OneKeyLocalError('Swap unavailable');
      return [];
    });

    const result = await loadDustSweepNetworks(
      params,
      new AbortController().signal,
    );

    expect(result.partialError).toBe(true);
    expect(result.failedNetworkIds).toEqual([ethereum.networkId]);
    expect(result.networks.map((entry) => entry.network.networkId)).toEqual([
      otherNetwork.networkId,
    ]);
  });

  it('does not publish assets if network capabilities fail', async () => {
    const failure = new Error('Swap networks unavailable');
    serviceSwap.fetchSwapNetworks.mockRejectedValue(failure);
    await expect(
      loadDustSweepNetworks(params, new AbortController().signal),
    ).rejects.toBe(failure);
    expect(serviceToken.fetchAccountTokens.mock.calls).toHaveLength(0);
  });

  it('clears a requested network when Swap support is removed on refresh', async () => {
    const request = { ...params, networkId: ethereum.networkId };
    const first = await loadDustSweepNetworks(
      request,
      new AbortController().signal,
    );
    expect(first.networks).toHaveLength(1);
    serviceSwap.fetchSwapNetworks.mockResolvedValue([]);
    serviceToken.fetchAccountTokens.mockClear();
    await expect(
      loadDustSweepNetworks(request, new AbortController().signal, {
        isManualRefresh: true,
      }),
    ).resolves.toMatchObject({ networks: [], partialError: false });
    expect(serviceToken.fetchAccountTokens.mock.calls).toHaveLength(0);
  });

  it('does not publish Wallet-only cached candidates while Swap candidates load', async () => {
    const live =
      deferred<Awaited<ReturnType<typeof serviceToken.fetchAccountTokens>>>();
    serviceToken.fetchAccountTokens.mockReturnValueOnce(live.promise);
    serviceToken.getCachedAccountTokens.mockResolvedValueOnce([
      cachedResponse(),
    ]);
    const onContexts = jest.fn();
    const load = loadDustSweepNetworks(params, new AbortController().signal, {
      onContexts,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onContexts).toHaveBeenCalledTimes(1);
    expect(serviceSwap.fetchSwapNetworks.mock.calls).toHaveLength(1);
    expect(serviceToken.getCachedAccountTokens.mock.calls).toHaveLength(0);
    live.resolve(cachedResponse());
    await load;
  });

  it('does not publish late network contexts to an aborted consumer', async () => {
    const accounts = deferred<IAllNetworkAccountsInfoResult>();
    serviceAllNetwork.getAllNetworkAccounts.mockReturnValueOnce(
      accounts.promise,
    );
    const controller = new AbortController();
    const onContexts = jest.fn();
    const load = loadDustSweepNetworks(params, controller.signal, {
      onContexts,
    });
    controller.abort();
    await expect(load).rejects.toThrow('Dust Sweep cancelled');
    accounts.resolve(accountsInfo());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onContexts).not.toHaveBeenCalled();
  });

  it('identifies failed networks so the consumer can retain their cached preview', async () => {
    serviceSwap.fetchSwapNetworks.mockResolvedValueOnce([
      ethereum,
      otherNetwork,
    ]);
    serviceToken.fetchAccountTokens.mockRejectedValueOnce(
      new Error('Balance refresh failed'),
    );
    const result = await loadDustSweepNetworks(
      params,
      new AbortController().signal,
    );
    expect(result.partialError).toBe(true);
    expect(result.failedNetworkIds).toEqual([ethereum.networkId]);
    expect(result.failedNetworkOwners).toEqual([
      {
        networkId: ethereum.networkId,
        accountId: 'hd-test--0',
        address: '0xuser',
      },
    ]);
    expect(result.failedNetworks).toEqual([ethereum]);
    expect(result.networks.map((entry) => entry.network.networkId)).toEqual([
      otherNetwork.networkId,
    ]);
  });

  it.each(['ECONNABORTED', 'ERR_NETWORK', 40_001])(
    'recovers a transient asset error %s once without retrying healthy networks',
    async (code) => {
      serviceSwap.fetchSwapNetworks.mockResolvedValueOnce([
        ethereum,
        otherNetwork,
      ]);
      serviceToken.fetchAccountTokens.mockRejectedValueOnce(
        Object.assign(new Error('Temporary asset dependency failure'), {
          code,
        }),
      );
      const result = await loadDustSweepNetworks(
        params,
        new AbortController().signal,
      );
      expect(result.partialError).toBe(false);
      expect(result.networks).toHaveLength(2);
      expect(
        serviceToken.fetchAccountTokens.mock.calls.map(([p]) => p.networkId),
      ).toEqual([
        ethereum.networkId,
        otherNetwork.networkId,
        ethereum.networkId,
      ]);
    },
  );

  it('retains failed network identity after the bounded retry is exhausted', async () => {
    serviceSwap.fetchSwapNetworks.mockResolvedValueOnce([
      ethereum,
      otherNetwork,
    ]);
    const response = await serviceToken.fetchAccountTokens({
      accountId: params.accountId,
      networkId: ethereum.networkId,
      flag: 'dust-sweep',
    });
    serviceToken.fetchAccountTokens.mockClear();
    serviceToken.fetchAccountTokens.mockImplementation(async (p) => {
      if (p.networkId === ethereum.networkId)
        throw Object.assign(new Error('timeout'), { code: 'ECONNABORTED' });
      return response;
    });
    const result = await loadDustSweepNetworks(
      params,
      new AbortController().signal,
    );
    expect(result.failedNetworks).toEqual([ethereum]);
    expect(result.partialError).toBe(true);
    expect(result.networks.map((entry) => entry.network.networkId)).toEqual([
      otherNetwork.networkId,
    ]);
    expect(serviceToken.fetchAccountTokens.mock.calls).toHaveLength(3);
  });

  it.each(['ERR_CANCELED', 40_056, 401])(
    'does not retry cancellation or a definite rejection %s',
    async (code) => {
      serviceToken.fetchAccountTokens.mockRejectedValueOnce(
        Object.assign(new Error('Unavailable'), { code }),
      );
      await expect(
        loadDustSweepNetworks(params, new AbortController().signal),
      ).rejects.toThrow('Unable to load balances');
      expect(serviceToken.fetchAccountTokens.mock.calls).toHaveLength(1);
    },
  );

  it('forces a post-trade round without joining an older in-flight load', async () => {
    const old =
      deferred<Awaited<ReturnType<typeof serviceToken.fetchAccountTokens>>>();
    serviceToken.fetchAccountTokens.mockReturnValueOnce(old.promise);
    const previous = loadDustSweepNetworks(
      params,
      new AbortController().signal,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    const fresh = await loadDustSweepNetworks(
      params,
      new AbortController().signal,
      { isManualRefresh: true },
    );
    expect(serviceToken.fetchAccountTokens.mock.calls).toHaveLength(2);
    expect(
      serviceToken.fetchAccountTokens.mock.calls[1][0].isManualRefresh,
    ).toBe(true);
    old.resolve(await serviceToken.fetchAccountTokens.mock.results[1].value);
    await previous;
    expect(fresh.partialError).toBe(false);
  });

  it('never rejoins a pre-trade request after cache invalidation and re-entry', async () => {
    const old =
      deferred<Awaited<ReturnType<typeof serviceToken.fetchAccountTokens>>>();
    serviceToken.fetchAccountTokens.mockReturnValueOnce(old.promise);
    const previous = loadDustSweepNetworks(
      params,
      new AbortController().signal,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    invalidateDustSweepNetworksCache(params.walletId);
    const fresh = await loadDustSweepNetworks(
      params,
      new AbortController().signal,
    );
    expect(serviceToken.fetchAccountTokens.mock.calls).toHaveLength(2);
    old.resolve(await serviceToken.fetchAccountTokens.mock.results[1].value);
    await previous;
    expect(fresh.partialError).toBe(false);
  });

  it('does not request the Wallet Home candidate cache', async () => {
    await loadDustSweepNetworks(params, new AbortController().signal);
    expect(serviceToken.getCachedAccountTokens.mock.calls).toHaveLength(0);
    expect(serviceToken.fetchAccountTokens.mock.calls.length).toBeGreaterThan(
      0,
    );
  });

  it('force-refreshes an existing network without rediscovering accounts or providers', async () => {
    const initial = await loadDustSweepNetworks(
      params,
      new AbortController().signal,
    );
    const entry = initial.networks[0];
    jest.clearAllMocks();
    const refreshed = await refreshDustSweepNetwork(
      { entry, indexedAccountId: params.indexedAccountId },
      new AbortController().signal,
    );
    expect(refreshed).toEqual(entry);
    expect(serviceToken.fetchAccountTokens.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        accountId: entry.accountId,
        networkId: entry.network.networkId,
        indexedAccountId: params.indexedAccountId,
        isManualRefresh: true,
        saveToLocal: false,
      }),
    );
    expect(serviceToken.getNativeToken.mock.calls).toHaveLength(1);
    expect(serviceSwap.fetchSwapTokens.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        networkId: entry.network.networkId,
        accountId: entry.accountId,
        accountAddress: entry.address,
        accountNetworkId: entry.network.networkId,
        currency: 'usd',
        throwOnError: true,
      }),
    );
    expect(serviceSwap.fetchSwapNetworks.mock.calls).toHaveLength(0);
    expect(serviceSwap.getSwapProviderManager.mock.calls).toHaveLength(0);
    expect(serviceAllNetwork.getAllNetworkAccounts.mock.calls).toHaveLength(0);
  });

  it('rejects a missing native asset instead of treating it as an empty refreshed balance', async () => {
    const initial = await loadDustSweepNetworks(
      params,
      new AbortController().signal,
    );
    serviceToken.getNativeToken.mockResolvedValueOnce(null);
    await expect(
      refreshDustSweepNetwork(
        { entry: initial.networks[0] },
        new AbortController().signal,
      ),
    ).rejects.toThrow('Native token is unavailable');
  });

  it('does not join a pre-settlement in-flight account load', async () => {
    const initial = await loadDustSweepNetworks(
      params,
      new AbortController().signal,
    );
    const oldResponse =
      deferred<
        Awaited<
          ReturnType<typeof backgroundApiProxy.serviceToken.fetchAccountTokens>
        >
      >();
    serviceToken.fetchAccountTokens.mockReturnValueOnce(oldResponse.promise);
    const oldLoad = loadDustSweepNetworks(params, new AbortController().signal);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const controller = new AbortController();
    const fresh = await refreshDustSweepNetwork(
      { entry: initial.networks[0] },
      controller.signal,
    );
    expect(fresh).toEqual(initial.networks[0]);
    expect(serviceToken.fetchAccountTokens.mock.calls).toHaveLength(3);
    oldResponse.resolve({
      tokens: { data: [], map: {}, keys: '', currency: 'usd' },
      smallBalanceTokens: { data: [], map: {}, keys: '', currency: 'usd' },
      riskTokens: { data: [], map: {}, keys: '', currency: 'usd' },
    });
    await oldLoad;
  });

  it('does not apply saved provider restrictions to network eligibility', async () => {
    swapConfigs.getSwapProviderManager.mockResolvedValue([
      {
        providerInfo: okxProvider().providerInfo,
        enable: false,
        supportNetworks: [ethereum],
      },
    ]);
    const result = await loadDustSweepNetworks(
      params,
      new AbortController().signal,
    );
    expect(result.networks.map((item) => item.network.networkId)).toEqual([
      ethereum.networkId,
    ]);
    expect(swapConfigs.getSwapProviderManager.mock.calls).toHaveLength(0);
  });

  it('reports the network balance from regular and small-balance tokens, skipping unavailable values', async () => {
    const fiat = (fiatValue: string) => ({
      balance: '1',
      balanceParsed: '1',
      fiatValue,
      price: 1,
      currency: 'usd',
    });
    serviceToken.fetchAccountTokens.mockResolvedValueOnce({
      tokens: {
        data: [],
        map: { eth: fiat('12.5'), unpriced: fiat('') },
        keys: '',
        currency: 'usd',
      },
      smallBalanceTokens: {
        data: [],
        map: { a: fiat('0.3'), b: fiat('0.1') },
        keys: '',
        currency: 'usd',
      },
      riskTokens: {
        data: [],
        map: { scam: fiat('99') },
        keys: '',
        currency: 'usd',
      },
    });

    const result = await loadDustSweepNetworks(
      params,
      new AbortController().signal,
    );

    expect(result.networks[0].balanceUsd).toBe('12.9');
  });

  it('retains server provider metadata when supported accounts have no tokens', async () => {
    const provider = okxProvider();
    provider.providerInfo.providerName = 'OKX from provider list';
    provider.providerInfo.logo = 'https://example.com/provider-from-list.png';
    serviceSwap.getSwapProviderManager.mockResolvedValue([provider]);

    const result = await loadDustSweepNetworks(
      params,
      new AbortController().signal,
    );

    expect(result.networks[0].tokens).toEqual([]);
    expect(result.providerInfo).toEqual(provider.providerInfo);
    expect(serviceSwap.getSwapProviderManager.mock.calls).toHaveLength(1);
  });

  it('shares an in-flight load across a rapid leave and re-entry', async () => {
    const networks = deferred<ISwapNetwork[]>();
    const accounts = deferred<IAllNetworkAccountsInfoResult>();
    serviceSwap.fetchSwapNetworks.mockReturnValue(networks.promise);
    serviceAllNetwork.getAllNetworkAccounts.mockReturnValue(accounts.promise);

    const firstController = new AbortController();
    const first = loadDustSweepNetworks(params, firstController.signal);
    firstController.abort();
    const second = loadDustSweepNetworks(params, new AbortController().signal);

    expect(
      (serviceSwap.fetchSwapNetworks as jest.Mock).mock.calls,
    ).toHaveLength(1);
    expect(
      (serviceAllNetwork.getAllNetworkAccounts as jest.Mock).mock.calls,
    ).toHaveLength(1);

    await expect(first).rejects.toThrow('Dust Sweep cancelled');
    networks.resolve([]);
    accounts.resolve({
      accountsInfo: [],
      accountsInfoBackendIndexed: [],
      accountsInfoBackendNotIndexed: [],
      allAccountsInfo: [],
    });
    await expect(second).resolves.toEqual({
      networks: [],
      partialError: false,
      providerInfo: okxProvider().providerInfo,
    });
  });

  it('uses fresh capabilities on re-entry even when the previous balance request is still pending', async () => {
    const previousBalances =
      deferred<Awaited<ReturnType<typeof serviceToken.fetchAccountTokens>>>();
    serviceToken.fetchAccountTokens.mockReturnValueOnce(
      previousBalances.promise,
    );
    serviceToken.getCachedAccountTokens.mockResolvedValue([cachedResponse()]);
    const firstController = new AbortController();
    const firstContexts = jest.fn();
    const first = loadDustSweepNetworks(params, firstController.signal, {
      onContexts: firstContexts,
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(firstContexts.mock.calls[0][0]).toHaveLength(1);
    expect(serviceToken.getCachedAccountTokens.mock.calls).toHaveLength(0);
    firstController.abort();
    await expect(first).rejects.toThrow('Dust Sweep cancelled');

    serviceSwap.fetchSwapNetworks.mockResolvedValue([]);
    const nextContexts = jest.fn();
    const next = loadDustSweepNetworks(params, new AbortController().signal, {
      forceFresh: true,
      onContexts: nextContexts,
    });
    await expect(next).resolves.toMatchObject({ networks: [] });
    expect(nextContexts).toHaveBeenCalledWith([]);
    previousBalances.resolve(cachedResponse());
  });

  it('does not fall back to another account for a network-specific entry', async () => {
    serviceSwap.fetchSwapNetworks.mockResolvedValue([
      { networkId: 'evm--1', supportSingleSwap: true } as ISwapNetwork,
    ]);
    serviceAllNetwork.getAllNetworkAccounts.mockResolvedValue({
      accountsInfo: [
        {
          networkId: 'evm--1',
          accountId: 'hd-test--0-bip44',
          apiAddress: '0xother',
          accountXpub: undefined,
          pub: undefined,
          dbAccount: undefined,
          isNftEnabled: false,
          isBackendIndexed: false,
          deriveType: undefined,
          deriveInfo: undefined,
          isTestnet: false,
        },
      ],
      accountsInfoBackendIndexed: [],
      accountsInfoBackendNotIndexed: [],
      allAccountsInfo: [],
    });

    await expect(
      loadDustSweepNetworks(
        { ...params, networkId: 'evm--1' },
        new AbortController().signal,
      ),
    ).rejects.toThrow('Selected network account is unavailable');
    expect(serviceAllNetwork.getAllNetworkAccounts.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        includingNotEqualGlobalDeriveTypeAccount: true,
        networksEnabledOnly: false,
      }),
    );
  });

  it('loads eligible networks without restricting them to OKX', async () => {
    serviceSwap.fetchSwapNetworks.mockResolvedValue([ethereum, otherNetwork]);
    const result = await loadDustSweepNetworks(
      params,
      new AbortController().signal,
    );
    expect(result.networks.map((item) => item.network.networkId)).toEqual([
      ethereum.networkId,
      otherNetwork.networkId,
    ]);
    expect(
      serviceSwap.fetchSwapProviderSupportNetworks.mock.calls,
    ).toHaveLength(0);
  });
});
