import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useNativeHomePortfolioData } from './useNativeHomePortfolioData';

interface ITestActiveAccountState {
  activeAccount: {
    account?: { id: string };
    deriveInfoItems: [];
    indexedAccount?: { id: string };
    network?: { id: string; isAllNetworks: boolean };
    vaultSettings: { mergeDeriveAssetsEnabled: boolean };
    wallet?: { id: string };
  };
}

interface ITestToken {
  $key: string;
  address: string;
  decimals: number;
  isNative: boolean;
  name: string;
  networkId: string;
  symbol: string;
}

interface ITestFetchResponse {
  accountId?: string;
  isSameAllNetworksAccountData?: boolean;
  networkId?: string;
  riskTokens: {
    data: ITestToken[];
    map: Record<string, { fiatValue: string }>;
  };
  smallBalanceTokens: {
    data: ITestToken[];
    map: Record<string, { fiatValue: string }>;
  };
  tokens: { data: ITestToken[]; map: Record<string, { fiatValue: string }> };
}

interface ITestResponse extends ITestFetchResponse {
  nativeHomeGeneration?: number;
  nativeHomeOwnerEpoch: number;
  nativeHomeOwnerScopeKey: string;
}

interface ITestAllNetworkParams {
  allNetworkAccountsData?: (value: { accounts: []; allAccounts: [] }) => void;
  allNetworkCacheData?: (value: {
    accountId: string;
    data: Array<{
      accountId: string;
      map: Record<string, { fiatValue: string }>;
      mergeDeriveAssets: boolean;
      networkId: string;
      riskMap: Record<string, { fiatValue: string }>;
      riskTokens: ITestToken[];
      smallBalanceMap: Record<string, { fiatValue: string }>;
      smallBalanceTokens: ITestToken[];
      tokens: ITestToken[];
    }>;
    generation: number;
    networkId: string;
  }) => Promise<void>;
  allNetworkRequests: (value: {
    accountId: string;
    networkId: string;
  }) => Promise<ITestResponse | undefined>;
  clearAllNetworkData: () => void;
  onFinished?: (value: {
    accountId?: string;
    networkId?: string;
  }) => Promise<void>;
  onRequestSettled?: (response: ITestResponse, generation: number) => void;
  onStarted?: (value: {
    accountId?: string;
    allNetworkDataInit?: boolean;
    networkId?: string;
  }) => Promise<void>;
}

interface ITestAllNetworkControl {
  params?: ITestAllNetworkParams;
  result?: ITestResponse[];
  run: jest.Mock<Promise<void>, [Record<string, unknown>?]>;
}

interface ITestLocalCache {
  hasCache: boolean;
  tokenList?: ITestToken[];
  tokenListMap?: Record<string, { fiatValue: string }>;
}

interface ITestBackgroundControl {
  customTokensRawData: jest.Mock<Promise<unknown>, []>;
  fetchAccountTokens: jest.Mock<
    Promise<ITestFetchResponse>,
    [Record<string, unknown>]
  >;
  getAccountLocalTokens: jest.Mock<
    Promise<ITestLocalCache>,
    [Record<string, unknown>]
  >;
  getAccountXpubOrAddress: jest.Mock<
    Promise<string | undefined>,
    [Record<string, unknown>]
  >;
  updateCurrentAccount: jest.Mock<Promise<void>, [Record<string, unknown>]>;
}

type ITestGlobal = typeof globalThis & {
  __nativeHomePortfolioActiveState: ITestActiveAccountState;
  __nativeHomePortfolioAllNetworkControl: ITestAllNetworkControl;
  __nativeHomePortfolioBackgroundControl: ITestBackgroundControl;
};

jest.mock('../../states/jotai/contexts/accountSelector', () => {
  const state: ITestActiveAccountState = {
    activeAccount: {
      account: { id: 'account-btc' },
      deriveInfoItems: [],
      indexedAccount: { id: 'indexed-1' },
      network: { id: 'btc--0', isAllNetworks: false },
      vaultSettings: { mergeDeriveAssetsEnabled: false },
      wallet: { id: 'wallet-1' },
    },
  };
  (globalThis as ITestGlobal).__nativeHomePortfolioActiveState = state;
  return {
    useActiveAccount: () => state,
  };
});

jest.mock('../../hooks/useAllNetwork', () => {
  const control: ITestAllNetworkControl = {
    run: jest.fn<Promise<void>, [Record<string, unknown>?]>(() =>
      Promise.resolve(),
    ),
  };
  (globalThis as ITestGlobal).__nativeHomePortfolioAllNetworkControl = control;
  return {
    useAllNetworkRequests: (params: ITestAllNetworkParams) => {
      control.params = params;
      return {
        isEmptyAccount: false,
        result: control.result,
        run: control.run,
      };
    },
  };
});

jest.mock('../../background/instance/backgroundApiProxy', () => {
  const control: ITestBackgroundControl = {
    customTokensRawData: jest.fn<Promise<unknown>, []>(),
    fetchAccountTokens: jest.fn<
      Promise<ITestFetchResponse>,
      [Record<string, unknown>]
    >(),
    getAccountLocalTokens: jest.fn<
      Promise<ITestLocalCache>,
      [Record<string, unknown>]
    >(),
    getAccountXpubOrAddress: jest.fn<
      Promise<string | undefined>,
      [Record<string, unknown>]
    >(),
    updateCurrentAccount: jest.fn<Promise<void>, [Record<string, unknown>]>(),
  };
  (globalThis as ITestGlobal).__nativeHomePortfolioBackgroundControl = control;
  return {
    __esModule: true,
    default: {
      serviceAccount: {
        getAccountXpubOrAddress: control.getAccountXpubOrAddress,
        getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes: jest.fn(),
      },
      serviceNetwork: {
        getVaultSettings: jest.fn(() =>
          Promise.resolve({ mergeDeriveAssetsEnabled: false }),
        ),
      },
      serviceSetting: {
        syncWalletConfig: jest.fn(() => Promise.resolve()),
      },
      serviceToken: {
        fetchAccountTokens: control.fetchAccountTokens,
        getAccountLocalTokens: control.getAccountLocalTokens,
        updateCurrentAccount: control.updateCurrentAccount,
      },
      simpleDb: {
        aggregateToken: {
          getRawData: jest.fn(() =>
            Promise.resolve({ aggregateTokenConfigMap: {} }),
          ),
        },
        customTokens: {
          getRawData: control.customTokensRawData,
        },
        riskTokenManagement: {
          getRawData: jest.fn(() => Promise.resolve(undefined)),
        },
      },
    },
  };
});

jest.mock('./nativeHomeBalanceAuthority', () => {
  const owner = {
    authority: { scopeKey: 'balance-scope', status: 'pending' },
    begin: jest.fn(() => ({ generation: 1, scopeKey: 'balance-scope' })),
    settle: jest.fn(),
  };
  return {
    buildNativeHomeBalanceScopeKey: jest.fn(() => 'balance-scope'),
    useNativeHomeBalanceAuthorityOwner: jest.fn(() => owner),
  };
});

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    AccountDataUpdate: 'AccountDataUpdate',
    NetworkDeriveTypeChanged: 'NetworkDeriveTypeChanged',
  },
  appEventBus: {
    off: jest.fn(),
    on: jest.fn(),
  },
}));

const globalControl = globalThis as ITestGlobal;

function createToken(symbol: string, networkId: string): ITestToken {
  return {
    $key: `${networkId}:${symbol}`,
    address: symbol,
    decimals: 18,
    isNative: false,
    name: symbol,
    networkId,
    symbol,
  };
}

function createResponse(token: ITestToken): ITestFetchResponse {
  return {
    accountId: `account-${token.networkId}`,
    isSameAllNetworksAccountData: true,
    riskTokens: { data: [], map: {} },
    smallBalanceTokens: { data: [], map: {} },
    tokens: {
      data: [token],
      map: { [token.$key]: { fiatValue: '1' } },
    },
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function setActiveScope({
  accountId,
  isAllNetworks,
  networkId,
}: {
  accountId?: string;
  isAllNetworks: boolean;
  networkId: string;
}) {
  globalControl.__nativeHomePortfolioActiveState.activeAccount = {
    account: accountId ? { id: accountId } : undefined,
    deriveInfoItems: [],
    indexedAccount: { id: 'indexed-1' },
    network: { id: networkId, isAllNetworks },
    vaultSettings: { mergeDeriveAssetsEnabled: false },
    wallet: { id: 'wallet-1' },
  };
}

describe('useNativeHomePortfolioData owner behavior', () => {
  beforeEach(() => {
    const background = globalControl.__nativeHomePortfolioBackgroundControl;
    const allNetwork = globalControl.__nativeHomePortfolioAllNetworkControl;
    jest.clearAllMocks();
    allNetwork.run.mockReset();
    allNetwork.run.mockResolvedValue(undefined);
    allNetwork.params = undefined;
    allNetwork.result = undefined;
    background.customTokensRawData.mockResolvedValue(undefined);
    background.getAccountXpubOrAddress.mockResolvedValue('address-1');
    background.getAccountLocalTokens.mockResolvedValue({ hasCache: false });
    background.updateCurrentAccount.mockResolvedValue(undefined);
    background.fetchAccountTokens.mockResolvedValue({
      riskTokens: { data: [], map: {} },
      smallBalanceTokens: { data: [], map: {} },
      tokens: { data: [], map: {} },
    });
    setActiveScope({
      accountId: 'account-btc',
      isAllNetworks: false,
      networkId: 'btc--0',
    });
  });

  it('drops AllA writes across AllA -> BTC -> AllB and accepts AllB', async () => {
    const background = globalControl.__nativeHomePortfolioBackgroundControl;
    const allNetwork = globalControl.__nativeHomePortfolioAllNetworkControl;
    const oldToken = createToken('USDT', 'evm--1');
    setActiveScope({
      accountId: 'account-all',
      isAllNetworks: true,
      networkId: 'all--0',
    });
    background.fetchAccountTokens.mockResolvedValueOnce(
      createResponse(oldToken),
    );
    const { result, rerender } = renderHook(() =>
      useNativeHomePortfolioData({ enabled: true }),
    );
    const allA = allNetwork.params;
    expect(allA).toBeDefined();
    const ownedOldResponse = await allA?.allNetworkRequests({
      accountId: 'account-evm',
      networkId: 'evm--1',
    });
    expect(ownedOldResponse).toBeDefined();

    setActiveScope({
      accountId: 'account-btc',
      isAllNetworks: false,
      networkId: 'btc--0',
    });
    rerender({});
    await act(async () => {
      await allA?.allNetworkCacheData?.({
        accountId: 'account-all',
        data: [
          {
            accountId: 'account-evm',
            map: { [oldToken.$key]: { fiatValue: '1' } },
            mergeDeriveAssets: false,
            networkId: 'evm--1',
            riskMap: {},
            riskTokens: [],
            smallBalanceMap: {},
            smallBalanceTokens: [],
            tokens: [oldToken],
          },
        ],
        generation: 1,
        networkId: 'all--0',
      });
      if (ownedOldResponse) {
        allA?.onRequestSettled?.(ownedOldResponse, 1);
        allNetwork.result = [ownedOldResponse];
      }
      await allA?.onStarted?.({
        accountId: 'account-all',
        networkId: 'all--0',
      });
      allA?.allNetworkAccountsData?.({ accounts: [], allAccounts: [] });
      allA?.clearAllNetworkData();
      await allA?.onFinished?.({
        accountId: 'account-all',
        networkId: 'all--0',
      });
      rerender({});
    });

    await waitFor(() => {
      expect(result.current.dataScopeKey).toContain('btc--0');
      expect(result.current.tokens).toEqual([]);
    });

    const currentToken = createToken('BTC', 'btc--0');
    setActiveScope({
      accountId: 'account-all',
      isAllNetworks: true,
      networkId: 'all--0',
    });
    rerender({});
    const allB = allNetwork.params;
    expect(allB).toBeDefined();
    expect(allB).not.toBe(allA);
    background.fetchAccountTokens.mockResolvedValueOnce(
      createResponse(currentToken),
    );
    const currentResponse = await allB?.allNetworkRequests({
      accountId: 'account-btc',
      networkId: 'btc--0',
    });

    act(() => {
      if (currentResponse) {
        allB?.onRequestSettled?.(currentResponse, 2);
      }
      if (ownedOldResponse) {
        allA?.onRequestSettled?.(ownedOldResponse, 99);
      }
      allA?.clearAllNetworkData();
    });

    expect(result.current.dataScopeKey).toContain('all--0');
    expect(result.current.tokens.map((token) => token.symbol)).toEqual(['BTC']);
  });

  it('blocks All fan-out until the captured owner prerequisite resolves', async () => {
    const background = globalControl.__nativeHomePortfolioBackgroundControl;
    const allNetwork = globalControl.__nativeHomePortfolioAllNetworkControl;
    const prerequisite = createDeferred<void>();
    const accountsStep = jest.fn();
    const cacheStep = jest.fn();
    const fetchStep = jest.fn();
    setActiveScope({
      accountId: 'account-all',
      isAllNetworks: true,
      networkId: 'all--0',
    });
    const { result } = renderHook(() =>
      useNativeHomePortfolioData({ enabled: true }),
    );
    await waitFor(() =>
      expect(background.updateCurrentAccount).toHaveBeenCalled(),
    );
    background.updateCurrentAccount.mockClear();
    background.updateCurrentAccount.mockReturnValueOnce(prerequisite.promise);
    allNetwork.run.mockImplementationOnce(async () => {
      const params = allNetwork.params;
      expect(params).toBeDefined();
      await params?.onStarted?.({
        accountId: 'account-all',
        networkId: 'all--0',
      });
      accountsStep();
      params?.allNetworkAccountsData?.({ accounts: [], allAccounts: [] });
      cacheStep();
      await params?.allNetworkCacheData?.({
        accountId: 'account-all',
        data: [],
        generation: 1,
        networkId: 'all--0',
      });
      fetchStep();
      await params?.onFinished?.({
        accountId: 'account-all',
        networkId: 'all--0',
      });
    });

    let refreshTask: Promise<void> | undefined;
    act(() => {
      refreshTask = result.current.refresh();
    });
    await waitFor(() =>
      expect(background.updateCurrentAccount).toHaveBeenCalledWith({
        accountId: 'account-all',
        networkId: 'all--0',
      }),
    );
    expect(accountsStep).not.toHaveBeenCalled();
    expect(cacheStep).not.toHaveBeenCalled();
    expect(fetchStep).not.toHaveBeenCalled();

    await act(async () => {
      prerequisite.resolve();
      await refreshTask;
    });
    expect(accountsStep).toHaveBeenCalledTimes(1);
    expect(cacheStep).toHaveBeenCalledTimes(1);
    expect(fetchStep).toHaveBeenCalledTimes(1);
  });

  it('accepts AllB and rejects an older same-owner generation', async () => {
    const background = globalControl.__nativeHomePortfolioBackgroundControl;
    const allNetwork = globalControl.__nativeHomePortfolioAllNetworkControl;
    setActiveScope({
      accountId: 'account-all',
      isAllNetworks: true,
      networkId: 'all--0',
    });
    const { result } = renderHook(() =>
      useNativeHomePortfolioData({ enabled: true }),
    );
    const allB = allNetwork.params;
    const currentToken = createToken('BTC', 'btc--0');
    const staleToken = createToken('STALE', 'evm--1');
    background.fetchAccountTokens
      .mockResolvedValueOnce(createResponse(currentToken))
      .mockResolvedValueOnce(createResponse(staleToken));
    const currentResponse = await allB?.allNetworkRequests({
      accountId: 'account-btc',
      networkId: 'btc--0',
    });
    const staleResponse = await allB?.allNetworkRequests({
      accountId: 'account-evm',
      networkId: 'evm--1',
    });

    act(() => {
      if (currentResponse) allB?.onRequestSettled?.(currentResponse, 3);
      if (staleResponse) allB?.onRequestSettled?.(staleResponse, 2);
    });

    expect(result.current.tokens.map((token) => token.symbol)).toEqual(['BTC']);
  });

  it('settles missing-account and fetch-error states', async () => {
    const background = globalControl.__nativeHomePortfolioBackgroundControl;
    setActiveScope({
      accountId: undefined,
      isAllNetworks: false,
      networkId: 'ton--mainnet',
    });
    const missing = renderHook(() =>
      useNativeHomePortfolioData({ enabled: true }),
    );
    await waitFor(() => expect(missing.result.current.initialized).toBe(true));
    expect(background.fetchAccountTokens).not.toHaveBeenCalled();
    missing.unmount();

    setActiveScope({
      accountId: 'account-btc',
      isAllNetworks: false,
      networkId: 'btc--0',
    });
    background.fetchAccountTokens.mockRejectedValueOnce(new Error('timeout'));
    const failed = renderHook(() =>
      useNativeHomePortfolioData({ enabled: true }),
    );
    await waitFor(() =>
      expect(failed.result.current).toMatchObject({
        errorCode: 'portfolio_fetch_failed',
        initialized: true,
        isRefreshing: false,
      }),
    );
  });

  it('commits live rows while custom-token projection remains unresolved', async () => {
    const background = globalControl.__nativeHomePortfolioBackgroundControl;
    const liveToken = createToken('BTC', 'btc--0');
    background.customTokensRawData.mockReturnValue(
      new Promise(() => undefined),
    );
    background.fetchAccountTokens.mockResolvedValueOnce(
      createResponse(liveToken),
    );
    const { result } = renderHook(() =>
      useNativeHomePortfolioData({ enabled: true }),
    );

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
      expect(result.current.tokens.map((token) => token.symbol)).toEqual([
        'BTC',
      ]);
      expect(result.current.isRefreshing).toBe(false);
    });
  });

  it('does not let delayed single-network cache replace a newer live snapshot', async () => {
    const background = globalControl.__nativeHomePortfolioBackgroundControl;
    const cache = createDeferred<ITestLocalCache>();
    const pendingFollowUp = createDeferred<ITestFetchResponse>();
    const liveToken = createToken('LIVE', 'btc--0');
    const cachedToken = createToken('CACHED', 'btc--0');
    background.getAccountLocalTokens.mockReturnValueOnce(cache.promise);
    background.fetchAccountTokens
      .mockResolvedValueOnce(createResponse(liveToken))
      .mockReturnValueOnce(pendingFollowUp.promise);
    const { result } = renderHook(() =>
      useNativeHomePortfolioData({ enabled: true }),
    );

    await act(async () => {
      await result.current.refresh();
    });
    expect(result.current.tokens.map((token) => token.symbol)).toEqual([
      'LIVE',
    ]);

    await act(async () => {
      cache.resolve({
        hasCache: true,
        tokenList: [cachedToken],
        tokenListMap: { [cachedToken.$key]: { fiatValue: '1' } },
      });
      await Promise.resolve();
    });
    expect(result.current.tokens.map((token) => token.symbol)).toEqual([
      'LIVE',
    ]);

    await act(async () => {
      pendingFollowUp.resolve(createResponse(liveToken));
      await Promise.resolve();
    });
  });
});
