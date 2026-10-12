import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAllNetworkAccountsInfoResult } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

import { loadDustSweepNetworks } from './loadNetworks';

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
  entry: 'walletMore' as const,
};

describe('loadDustSweepNetworks request ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    ).resolves.toEqual({ networks: [], partialError: false });
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
