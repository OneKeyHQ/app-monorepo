import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import type { IFetchAccountTokensParams } from '@onekeyhq/shared/types/token';

import {
  HomeSourceRuntime,
  type IHomeSourceEnvironment,
} from './homeSourceRuntime';

import type { IHomeStoreState } from '../store/homeStoreTypes';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAllNetwork: {
      clearGetAllNetworkAccountsCache: jest.fn(),
      getAllNetworkAccounts: jest.fn(),
    },
    serviceNetwork: {
      getAllNetworks: jest.fn(),
      getVaultSettings: jest.fn(),
    },
    serviceToken: {
      fetchAccountTokens: jest.fn(),
      getAccountLocalTokens: jest.fn(),
      updateCurrentAccount: jest.fn(),
    },
    serviceTokenViewModel: {
      ingestRound: jest.fn(),
    },
  },
}));

const mockedBackgroundApiProxy = jest.mocked(backgroundApiProxy);

function buildTokenResponse(params: IFetchAccountTokensParams) {
  const isLpTokenRequest = params.withoutWalletToken === true;
  const symbol = isLpTokenRequest ? 'aEthUSDe' : params.networkId.toUpperCase();
  const key = `${params.networkId}:${symbol}`;
  const token = {
    $key: key,
    accountId: params.accountId,
    address: isLpTokenRequest ? '0xdefi' : '',
    decimals: 18,
    isNative: !isLpTokenRequest,
    name: symbol,
    networkId: params.networkId,
    symbol,
  };
  const fiat = {
    balance: '1',
    balanceParsed: '1',
    currency: 'usd',
    fiatValue: isLpTokenRequest ? '1' : '2',
    price: isLpTokenRequest ? 1 : 2,
  };

  return {
    accountId: params.accountId,
    networkId: params.networkId,
    isSameAllNetworksAccountData: true,
    tokens: {
      data: [token],
      keys: key,
      map: { [key]: fiat },
      fiatValue: fiat.fiatValue,
      currency: 'usd',
    },
    smallBalanceTokens: {
      data: [],
      keys: '',
      map: {},
      fiatValue: '0',
      currency: 'usd',
    },
    riskTokens: {
      data: [],
      keys: '',
      map: {},
      fiatValue: '0',
      currency: 'usd',
    },
    aggregateTokenListMap: {},
    aggregateTokenMap: {},
  };
}

function createRuntime(state: IHomeStoreState) {
  return new HomeSourceRuntime({
    identity: {
      runtimeInstanceId: 'runtime-a',
      clientInstanceId: 'client-a',
    },
    scheduler: {} as never,
    commitBudget: {} as never,
    leafPool: {
      cancelSession: jest.fn(),
      dispose: jest.fn(),
      getSnapshot: jest.fn(),
      run: (
        _priority: string,
        request: () => Promise<unknown>,
        _sessionId?: string,
      ) => request(),
    } as never,
    dispatch: jest.fn(),
    dispatchAtomically: jest.fn(),
    getStateView: () => state,
  });
}

function getLoadPortfolio(runtime: HomeSourceRuntime) {
  return (
    runtime as unknown as {
      loadPortfolio(input: {
        environment: IHomeSourceEnvironment;
        force: boolean;
        priority: 'interactive';
        publishIntermediate: (input: {
          payload: unknown;
          rowIds: readonly string[];
        }) => void;
        requestSequence: number;
        sessionId: string;
        signal: AbortSignal;
        yieldIfMainBudgetExceeded: () => Promise<void>;
      }): Promise<{
        confirmedEmpty: boolean;
        payload: {
          accountTokensValue: string;
          showLpTokenFilterSwitch: boolean;
          showLpTokensOnly: boolean;
          tokens: { symbol: string }[];
        };
        rowIds: readonly string[];
      }>;
    }
  ).loadPortfolio.bind(runtime);
}

describe('HomeSourceRuntime Portfolio workflow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedBackgroundApiProxy.serviceAllNetwork.getAllNetworkAccounts.mockResolvedValue(
      {
        accountsInfo: [
          {
            accountId: 'evm-account',
            apiAddress: '0x1',
            isBackendIndexed: true,
            isNftEnabled: true,
            isTestnet: false,
            networkId: 'evm--1',
          },
          {
            accountId: 'local-account',
            apiAddress: 'local',
            isBackendIndexed: false,
            isNftEnabled: false,
            isTestnet: false,
            networkId: 'local--1',
          },
        ],
        accountsInfoBackendIndexed: [
          {
            accountId: 'evm-account',
            apiAddress: '0x1',
            isBackendIndexed: true,
            isNftEnabled: true,
            isTestnet: false,
            networkId: 'evm--1',
          },
        ],
        accountsInfoBackendNotIndexed: [
          {
            accountId: 'local-account',
            apiAddress: 'local',
            isBackendIndexed: false,
            isNftEnabled: false,
            isTestnet: false,
            networkId: 'local--1',
          },
        ],
        allAccountsInfo: [],
      } as never,
    );
    mockedBackgroundApiProxy.serviceNetwork.getVaultSettings.mockResolvedValue({
      mergeDeriveAssetsEnabled: false,
    } as never);
    mockedBackgroundApiProxy.serviceNetwork.getAllNetworks.mockResolvedValue({
      networks: [
        { id: 'evm--1', logoURI: 'evm.png' },
        { id: 'local--1', logoURI: 'local.png' },
      ],
    } as never);
    mockedBackgroundApiProxy.serviceToken.getAccountLocalTokens.mockResolvedValue(
      { hasCache: false } as never,
    );
    mockedBackgroundApiProxy.serviceToken.fetchAccountTokens.mockImplementation(
      async (params) => buildTokenResponse(params) as never,
    );
    mockedBackgroundApiProxy.serviceToken.updateCurrentAccount.mockResolvedValue(
      undefined,
    );
    mockedBackgroundApiProxy.serviceTokenViewModel.ingestRound.mockResolvedValue(
      undefined,
    );
  });

  it('keeps all-network DeFi token requests single-network and cache-free', async () => {
    const state = {
      interaction: {
        sectionControls: {
          portfolio: {
            'home.portfolio.showLpTokensOnly': true,
          },
        },
      },
      session: {
        ownerToken: {
          scopeKey: 'wallet:account:all',
          sessionId: 'session-a',
        },
      },
    } as unknown as IHomeStoreState;
    const activeAccount = {
      account: { createAtNetwork: 'evm--1', id: 'all-account' },
      indexedAccount: { id: 'indexed-account' },
      network: { id: 'all--0', isAllNetworks: true },
      ready: true,
      vaultSettings: { mergeDeriveAssetsEnabled: false },
      wallet: { id: 'wallet-1' },
    } as IAccountSelectorActiveAccountInfo;
    const environment = {
      activeAccount,
      bannerLabels: { referralDescription: '', referralTitle: '' },
      currencyMap: {},
      settings: {
        currencyInfo: { id: 'usd' },
        isFilterLowValueHistoryEnabled: false,
        isFilterScamHistoryEnabled: false,
        locale: 'en-US',
      },
    } as IHomeSourceEnvironment;
    const runtime = createRuntime(state);
    (
      runtime as unknown as {
        environment: IHomeSourceEnvironment;
      }
    ).environment = environment;

    const result = await getLoadPortfolio(runtime)({
      environment,
      force: false,
      priority: 'interactive',
      publishIntermediate: jest.fn(),
      requestSequence: 1,
      sessionId: 'session-a',
      signal: new AbortController().signal,
      yieldIfMainBudgetExceeded: () => Promise.resolve(),
    });

    expect(
      mockedBackgroundApiProxy.serviceAllNetwork.getAllNetworkAccounts.mock
        .calls,
    ).toHaveLength(1);
    const requests =
      mockedBackgroundApiProxy.serviceToken.fetchAccountTokens.mock.calls;
    const walletRequests = requests.filter(
      ([params]) => params.withoutDappToken === true,
    );
    const lpRequests = requests.filter(
      ([params]) => params.withoutWalletToken === true,
    );

    expect(walletRequests).toHaveLength(2);
    expect(walletRequests).toEqual(
      expect.arrayContaining([
        [
          expect.objectContaining({
            accountId: 'evm-account',
            flag: 'home-token-list',
            isAllNetworks: true,
            mergeTokens: true,
            networkId: 'evm--1',
            saveToLocal: true,
          }),
        ],
        [
          expect.objectContaining({
            accountId: 'local-account',
            flag: 'home-token-list',
            isAllNetworks: true,
            mergeTokens: true,
            networkId: 'local--1',
            saveToLocal: true,
          }),
        ],
      ]),
    );
    expect(lpRequests).toEqual([
      [
        expect.objectContaining({
          accountId: 'evm-account',
          flag: 'token-selector',
          isAllNetworks: false,
          mergeTokens: false,
          networkId: 'evm--1',
          requestScopedAllNetworksAuthority: true,
          saveToLocal: false,
        }),
      ],
    ]);
    expect(result.payload).toEqual(
      expect.objectContaining({
        accountTokensValue: '4',
        showLpTokensOnly: true,
        tokens: [expect.objectContaining({ symbol: 'aEthUSDe' })],
      }),
    );
    runtime.dispose();
  });

  it('keeps the DeFi token filter capability when the LP result is empty', async () => {
    mockedBackgroundApiProxy.serviceToken.fetchAccountTokens.mockImplementation(
      async (params) => {
        const response = buildTokenResponse(params);
        if (params.withoutWalletToken !== true) {
          return response as never;
        }
        return {
          ...response,
          tokens: {
            ...response.tokens,
            data: [],
            keys: '',
            map: {},
            fiatValue: '0',
          },
        } as never;
      },
    );
    const state = {
      interaction: {
        sectionControls: {
          portfolio: {
            'home.portfolio.showLpTokensOnly': true,
          },
        },
      },
      session: {
        ownerToken: {
          scopeKey: 'wallet:account:all',
          sessionId: 'session-empty-lp',
        },
      },
    } as unknown as IHomeStoreState;
    const activeAccount = {
      account: { createAtNetwork: 'evm--1', id: 'all-account' },
      indexedAccount: { id: 'indexed-account' },
      network: { id: 'all--0', isAllNetworks: true },
      ready: true,
      vaultSettings: { mergeDeriveAssetsEnabled: false },
      wallet: { id: 'wallet-1' },
    } as IAccountSelectorActiveAccountInfo;
    const environment = {
      activeAccount,
      bannerLabels: { referralDescription: '', referralTitle: '' },
      currencyMap: {},
      settings: {
        currencyInfo: { id: 'usd' },
        isFilterLowValueHistoryEnabled: false,
        isFilterScamHistoryEnabled: false,
        locale: 'en-US',
      },
    } as IHomeSourceEnvironment;
    const runtime = createRuntime(state);
    (
      runtime as unknown as {
        environment: IHomeSourceEnvironment;
      }
    ).environment = environment;

    const result = await getLoadPortfolio(runtime)({
      environment,
      force: false,
      priority: 'interactive',
      publishIntermediate: jest.fn(),
      requestSequence: 1,
      sessionId: 'session-empty-lp',
      signal: new AbortController().signal,
      yieldIfMainBudgetExceeded: () => Promise.resolve(),
    });

    expect(result).toMatchObject({
      confirmedEmpty: true,
      rowIds: [],
      payload: {
        accountTokensValue: '4',
        showLpTokenFilterSwitch: true,
        showLpTokensOnly: true,
        tokens: [],
      },
    });
    runtime.dispose();
  });
});
