import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAllNetworkAccountsInfoResult } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';
import type { ICachedAccountTokens } from '@onekeyhq/shared/types/token';

import {
  loadDustSweepEntryCapabilities,
  loadDustSweepNetworks,
  refreshDustSweepNetwork,
} from './loadNetworks';

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
    serviceSwap.fetchSwapNetworks.mockResolvedValue([ethereum, otherNetwork]);
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
    expect(serviceSwap.getSwapProviderManager.mock.calls).toHaveLength(1);
    expect(swapConfigs.getSwapProviderManager.mock.calls).toHaveLength(1);
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

  it('publishes Home cache before live balances finish, with one shared discovery round', async () => {
    const live =
      deferred<Awaited<ReturnType<typeof serviceToken.fetchAccountTokens>>>();
    serviceToken.fetchAccountTokens.mockReturnValueOnce(live.promise);
    serviceToken.getCachedAccountTokens.mockResolvedValueOnce([
      cachedResponse(),
    ]);
    const onCache = jest.fn();
    const load = loadDustSweepNetworks(
      params,
      new AbortController().signal,
      onCache,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onCache).toHaveBeenCalledTimes(1);
    expect(onCache.mock.calls[0][0][0].tokens[0].symbol).toBe('DUST');
    expect(serviceSwap.fetchSwapNetworks.mock.calls).toHaveLength(1);
    expect(serviceToken.getCachedAccountTokens.mock.calls[0][0]).toEqual({
      accounts: [
        {
          accountId: params.accountId,
          networkId: ethereum.networkId,
          accountAddress: '0xuser',
        },
      ],
    });
    live.resolve(cachedResponse());
    await load;
  });

  it.each(['finished', 'aborted'] as const)(
    'does not publish cache after the consumer is %s',
    async (mode) => {
      const cached = deferred<(ICachedAccountTokens | null)[]>();
      serviceToken.getCachedAccountTokens.mockReturnValueOnce(cached.promise);
      const controller = new AbortController();
      const onCache = jest.fn();
      const load = loadDustSweepNetworks(params, controller.signal, onCache);
      if (mode === 'aborted') controller.abort();
      await load.catch(() => undefined);
      cached.resolve([cachedResponse()]);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(onCache).not.toHaveBeenCalled();
    },
  );

  it.each(['empty', 'wrong-account', 'non-usd'] as const)(
    'rejects %s cache without affecting the live round',
    async (mode) => {
      const response = cachedResponse();
      if (mode === 'empty') response.smallBalanceTokens.data = [];
      if (mode === 'wrong-account') response.accountId = 'other-account';
      if (mode === 'non-usd') response.smallBalanceTokens.currency = 'eur';
      serviceToken.getCachedAccountTokens.mockResolvedValueOnce([response]);
      const live =
        deferred<Awaited<ReturnType<typeof serviceToken.fetchAccountTokens>>>();
      serviceToken.fetchAccountTokens.mockReturnValueOnce(live.promise);
      const onCache = jest.fn();
      const load = loadDustSweepNetworks(
        params,
        new AbortController().signal,
        onCache,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(onCache).not.toHaveBeenCalled();
      live.resolve(cachedResponse());
      await expect(load).resolves.toMatchObject({ partialError: false });
    },
  );

  it('still loads live assets when the optional cache read fails', async () => {
    serviceToken.getCachedAccountTokens.mockRejectedValueOnce(
      new Error('Cache read failed'),
    );
    await expect(
      loadDustSweepNetworks(params, new AbortController().signal),
    ).resolves.toMatchObject({ partialError: false });
  });

  it('identifies failed networks so the consumer can retain their cached preview', async () => {
    serviceSwap.getSwapProviderManager.mockResolvedValueOnce([
      {
        ...okxProvider(),
        supportSingleSwapNetworks: [ethereum, otherNetwork],
      },
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
    expect(result.networks.map((entry) => entry.network.networkId)).toEqual([
      otherNetwork.networkId,
    ]);
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

  it.each([
    { enable: false },
    { singleSwapEnable: false },
    { singleSwapDisableNetworks: [ethereum] },
    { disableNetworks: [ethereum] },
  ])(
    'excludes OKX networks disabled in saved Swap settings (%j)',
    async (settings) => {
      swapConfigs.getSwapProviderManager.mockResolvedValue([
        {
          providerInfo: okxProvider().providerInfo,
          enable: true,
          supportNetworks: [ethereum],
          ...settings,
        },
      ]);
      const result = await loadDustSweepNetworks(
        params,
        new AbortController().signal,
      );
      expect(result.networks).toEqual([]);
      expect(serviceToken.fetchAccountTokens.mock.calls).toHaveLength(0);
    },
  );

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

  it('loads only OKX-supported networks and freezes other-provider restrictions', async () => {
    serviceSwap.getSwapProviderManager.mockResolvedValue([
      okxProvider(),
      {
        ...okxProvider(),
        providerInfo: {
          ...okxProvider().providerInfo,
          provider: 'SwapLiquidMesh',
        },
        supportSingleSwapNetworks: [ethereum, otherNetwork],
      },
    ]);
    const result = await loadDustSweepNetworks(
      params,
      new AbortController().signal,
    );
    expect(result.networks.map((item) => item.network.networkId)).toEqual([
      'evm--1',
    ]);
    expect(result.networks[0].denySingleSwapProvider).toBe('SwapLiquidMesh');
    expect(serviceToken.fetchAccountTokens.mock.calls).toHaveLength(1);
    expect(serviceToken.fetchAccountTokens.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ networkId: 'evm--1', flag: 'dust-sweep' }),
    );
  });

  it.each([
    { providerServiceDisable: true },
    { serviceDisableNetworks: [ethereum] },
    { isSupportSingleSwap: false },
  ])('excludes unavailable OKX capability %j', async (capability) => {
    serviceSwap.getSwapProviderManager.mockResolvedValue([
      { ...okxProvider(), ...capability },
    ]);
    await expect(
      loadDustSweepNetworks(params, new AbortController().signal),
    ).resolves.toEqual({
      networks: [],
      partialError: false,
      providerInfo: okxProvider().providerInfo,
    });
    expect(serviceToken.fetchAccountTokens.mock.calls).toHaveLength(0);
  });

  it('keeps missing or failed provider metadata from granting eligibility', async () => {
    serviceSwap.getSwapProviderManager.mockResolvedValueOnce([]);
    await expect(
      loadDustSweepNetworks(params, new AbortController().signal),
    ).resolves.toEqual({ networks: [], partialError: false });
    serviceSwap.getSwapProviderManager.mockRejectedValueOnce(
      new Error('Provider metadata is unavailable'),
    );
    await expect(
      loadDustSweepNetworks(params, new AbortController().signal),
    ).rejects.toThrow('Provider metadata is unavailable');
    expect(serviceToken.fetchAccountTokens.mock.calls).toHaveLength(0);
  });
});
