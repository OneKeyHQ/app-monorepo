/** @jest-environment jsdom */
import { act, render, waitFor } from '@testing-library/react';

import type { IPortfolioCategoryRefreshResult } from '@onekeyhq/kit-bg/src/services/ServiceHardware/serviceHardwarePortfolioSync/ServiceHardwarePortfolioSync';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  ICustomTokenItem,
  IFetchAccountTokensResp,
} from '@onekeyhq/shared/types/token';

import type { IHomePortfolioSnapshot } from '../../pages/homeOverviewBalanceHold';

type ICategoryState = {
  ownerKey: string;
  requestId: number;
  isRefreshing: boolean;
  failedSources: ('defi' | 'perps')[];
  data?: IPortfolioCategoryRefreshResult;
  dataRequestId?: number;
  heldTotalFiatUsd?: string;
  retry?: () => void;
};
let mockPublishRefreshedHeader = false;
let mockCategoryState: ICategoryState;
const mockRefreshCategories = jest.fn<
  Promise<IPortfolioCategoryRefreshResult>,
  [unknown]
>();

const mockNotifySettled = jest.fn<Promise<void>, unknown[]>(
  async () => undefined,
);
const mockSyncPortfolio = jest.fn(async (_payload: unknown) => true);
const mockUpdateSyncUi = jest.fn();
const mockFetchTokens = jest.fn<Promise<IFetchAccountTokensResp>, []>();
const mockNoop = jest.fn();
const mockAsyncNoop = jest.fn(async () => undefined);
const mockRunAllNetworks = jest.fn(async () => undefined);
const mockRunAccountRequests = jest.fn(async () => undefined);
let mockRouteFocused = true;
const mockPortfolioLoading = jest.fn();
const mockPortfolioError = jest.fn();
const mockBeginPortfolioStage = jest.fn<Promise<number | undefined>, []>(
  async () => 7,
);
const mockEndPortfolioStage = jest.fn(
  async (_params?: { error?: unknown; doneI18n?: unknown }) => undefined,
);
const mockShowPortfolioProcessing = jest.fn<Promise<void>, []>(
  async () => undefined,
);
const mockCustomTokens: ICustomTokenItem[] = [];
const mockCurrencyMap = {};
let mockEpoch = 0;
let mockTokenWorth = '125';
let mockTapTokenMap: IFetchAccountTokensResp['tokens']['map'] = {};
const mockAccount = {
  id: 'hw-account-1',
  address: '0x123',
  indexedAccountId: 'hw-indexed-1',
};
const mockIndexedAccount = { id: 'hw-indexed-1', index: 0, name: 'Account #1' };
let mockIndexedAccountReady = true;
let mockNetwork = { id: 'evm--1', isAllNetworks: false };
const mockWallet = {
  id: 'hw-wallet-1',
  type: 'hw',
  associatedDeviceInfo: {
    id: 'device-1',
    connectId: 'usb-1',
    deviceType: 'pro2',
  },
};
const mockActiveAccount = () => ({
  account: mockAccount,
  indexedAccount: mockIndexedAccountReady ? mockIndexedAccount : undefined,
  network: mockNetwork,
  wallet: mockWallet,
  accountName: 'Account #1',
  deriveInfo: {},
  deriveInfoItems: [],
  vaultSettings: { mergeDeriveAssetsEnabled: false },
});
const mockSelectorStore = {
  get: (key: string) => {
    if (key === 'epoch') return [mockEpoch];
    if (key === 'active') return [mockActiveAccount()];
    return [
      {
        walletId: mockWallet.id,
        indexedAccountId: mockIndexedAccount.id,
        networkId: mockNetwork.id,
      },
    ];
  },
};
const mockTokenStore = {
  get: jest.fn(() => tokenResponse().tokens.data[0]),
};
const mockStructure = {
  ownerKey: 'home-owner',
  generation: 0,
  orderedIds: [] as string[],
  smallBalanceIds: [],
  aggMembership: {},
  ownedAggregateTokenListMap: {},
};
let mockHomeDisplay: IHomePortfolioSnapshot = {
  ownerKey: 'hw-account-1__evm--1',
  totalFiatUsd: '125',
  tokenFiatUsd: '125',
  defiFiatUsd: '0',
  perpsFiatUsd: '0',
  isLive: true,
};
let mockAllNetworkResult:
  | Array<
      IFetchAccountTokensResp & {
        tokenSelectorFilterMode: string;
        syncTokenFilterToOverview: boolean;
        ownerAccountId: string;
        ownerNetworkId: string;
      }
    >
  | undefined;
let mockVisibilityListener: ((visible: boolean) => void) | undefined;
const mockUpdateAccountWorth = jest.fn();
const mockUpdateTokenListState = jest.fn();
const mockCommitAuthoritativeIngest = jest.fn();
let mockAllNetworkParams:
  | {
      onStarted?: (params: {
        accountId: string;
        networkId: string;
        generation: number;
      }) => Promise<void>;
      allNetworkAccountsData?: (params: {
        accounts: { accountId: string; networkId: string }[];
        allAccounts: { accountId: string; networkId: string }[];
      }) => void;
      onResultPublished?: (
        result: typeof mockAllNetworkResult,
        generation: number,
      ) => void;
      onFinished?: (params: {
        accountId?: string;
        networkId?: string;
        runResult: {
          didComplete: boolean;
          requestCount: number;
          resultCount: number;
        };
        generation: number;
      }) => Promise<void> | void;
    }
  | undefined;
const mockActions = {
  updateAccountWorth: mockUpdateAccountWorth,
  retainAccountWorth: mockNoop,
  updateAccountOverviewState: mockNoop,
  updateAllNetworksState: mockNoop,
};
const mockTokenActions = {
  updateTokenListState: mockUpdateTokenListState,
  updateSearchKey: mockNoop,
  updatePortfolioSyncUiState: mockUpdateSyncUi,
};
const mockPipeline = {
  reset: mockNoop,
  seedAndFlushCache: mockAsyncNoop,
  setEnabledKeys: mockNoop,
  ingestLiveRound: mockNoop,
  buildAuthoritativeSnapshot: jest.fn(),
  commitAuthoritativeIngest: mockCommitAuthoritativeIngest,
};

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('../../hooks/useHomeNativeRefresh', () => ({
  useHomeNativeRefresh: () => ({
    refreshing: false,
    onRefresh: mockNoop,
    onScrollBeginDrag: mockNoop,
    onScroll: mockNoop,
    onScrollEndDrag: mockNoop,
  }),
}));
jest.mock('@onekeyhq/components', () => ({
  Toast: { loading: mockPortfolioLoading, error: mockPortfolioError },
  Stack: () => null,
  Skeleton: { HeadingLg: () => null },
  onVisibilityStateChange: (listener: (visible: boolean) => void) => {
    mockVisibilityListener = listener;
    return () => {
      if (mockVisibilityListener === listener) {
        mockVisibilityListener = undefined;
      }
    };
  },
  useOnRouterChange: () => undefined,
}));
jest.mock('../../hooks/useHomeTab', () => ({
  useTabIsRefreshingFocused: () => ({
    isFocused: true,
    isHeaderRefreshing: false,
    setIsHeaderRefreshing: mockNoop,
  }),
}));
jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  Currency: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/Empty', () => ({
  EmptyAccount: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/TokenListView', () => ({
  TokenListView: () => null,
}));
jest.mock(
  '@onekeyhq/kit/src/components/TokenListView/perfTokenListView',
  () => ({
    perfTokenListView: { markStart: () => undefined, markEnd: () => undefined },
  }),
);
jest.mock('@onekeyhq/kit/src/components/TokenSelectorFilter/utils', () => ({}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: mockNoop }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useDeviceStageBurst', () => ({
  useDeviceStageBurst: () => ({
    beginBurst: mockBeginPortfolioStage,
    endBurst: mockEndPortfolioStage,
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useIsDeFiEnabled', () => ({
  useIsDeFiEnabled: () => false,
}));
jest.mock('@onekeyhq/kit/src/hooks/useManageToken', () => ({
  useManageToken: () => ({
    handleOnManageToken: mockNoop,
    manageTokenEnabled: false,
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockRouteFocused,
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const { useCallback, useRef } =
    jest.requireActual<typeof import('react')>('react');
  return {
    usePromiseResult: (callback: () => Promise<unknown>) => {
      const latestCallback = useRef(callback);
      latestCallback.current = callback;
      const run = useCallback(() => latestCallback.current(), []);
      return { result: undefined, run };
    },
  };
});
jest.mock('@onekeyhq/kit/src/hooks/useAllNetwork', () => ({
  useAllNetworkRequests: (params: typeof mockAllNetworkParams) => {
    mockAllNetworkParams = params;
    return {
      run: mockRunAllNetworks,
      runAccountRequests: mockRunAccountRequests,
      result: mockAllNetworkResult,
      isEmptyAccount: false,
    };
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  activeAccountEpochAtom: () => 'epoch',
  activeAccountsAtom: () => 'active',
  selectedAccountsAtom: () => 'selected',
  useAccountSelectorContextData: () => ({ store: mockSelectorStore }),
  useActiveAccount: () => ({ activeAccount: mockActiveAccount() }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountOverview', () => ({
  usePortfolioCategoryRefreshAtom: () => {
    const { useState, useRef, useCallback } =
      jest.requireActual<typeof import('react')>('react');
    const [state, setState] = useState<ICategoryState>({
      ownerKey: '',
      requestId: 0,
      isRefreshing: false,
      failedSources: [],
    });
    const latest = useRef(state);
    latest.current = state;
    mockCategoryState = state;
    const set = useCallback(
      (update: ICategoryState | ((old: ICategoryState) => ICategoryState)) => {
        const next =
          typeof update === 'function' ? update(latest.current) : update;
        if (
          mockPublishRefreshedHeader &&
          next.data &&
          next.dataRequestId !== latest.current.dataRequestId
        ) {
          mockHomeDisplay = {
            ownerKey: next.ownerKey,
            isLive: true,
            tokenFiatUsd: mockTokenWorth,
            defiFiatUsd: next.data.defiFiat,
            perpsFiatUsd: next.data.perpsFiat,
            totalFiatUsd: String(
              Number(mockTokenWorth) +
                Number(next.data.defiFiat) +
                Number(next.data.perpsFiat),
            ),
            categoryRevision: next.dataRequestId,
          };
        }
        latest.current = next;
        mockCategoryState = next;
        setState(next);
      },
      [],
    );
    return [state, set];
  },
  useAccountOverviewActions: () => ({ current: mockActions }),
  useAccountWorthAtom: () => [
    {
      accountId: mockAccount.id,
      initialized: true,
      currency: 'usd',
      worth: { [`hw-account-1_${mockNetwork.id}`]: mockTokenWorth },
      updateAll: true,
    },
  ],
  useHomePortfolioDisplayAtom: () => [mockHomeDisplay],
  useHomePrivacyTokenStatusAtom: () => [undefined],
  useOverviewTokenCacheStateAtom: () => [{}, mockNoop],
  useAllNetworksStateStateAtom: () => [{ visibleCount: 1 }],
}));
jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/accountOverview/atoms',
  () => ({
    buildOverviewOwnerKey: (accountId: string, networkId: string) =>
      `${accountId}__${networkId}`,
  }),
);
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/tokenList', () => ({
  useTokenListActions: () => ({ current: mockTokenActions }),
  useTokenListStateAtom: () => [{ initialized: true, isRefreshing: false }],
  useListStructureAtom: () => [mockStructure],
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/tokenList/atoms', () => ({
  useTokenListContextData: () => ({ store: mockTokenStore }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/tokenList/cells', () => ({
  useHomeTokenListOwnerKey: () => 'home-owner',
  useTokenListCellsColdStartHydrate: () => undefined,
  useTokenListCellsProducer: () => undefined,
}));
jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/tokenList/cells/projection',
  () => ({ meta: (_store: unknown, key: string) => key }),
);
jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/tokenList/cells/tapTimeHomeMap',
  () => ({ buildTapTimeHomeTokenMap: () => mockTapTokenMap }),
);
jest.mock('@onekeyhq/kit/src/views/AssetList/hooks/useTokenManagement', () => ({
  useTokenManagement: () => ({ customTokens: mockCustomTokens }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  EJotaiContextStoreNames: { homeTokenList: 'homeTokenList' },
  useCurrencyPersistAtom: () => [{ currencyMap: mockCurrencyMap }],
  useSettingsPersistAtom: () => [{ currencyInfo: { id: 'usd' } }],
  useFirmwareUpdateWorkflowRunningAtom: () => [false],
  useHardwareUiStateAtom: () => [false],
  useTokenSelectorFilterPersistAtom: () => [{}],
}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isHwWallet: ({ walletId }: { walletId: string }) =>
      walletId.startsWith('hw-'),
    isQrWallet: () => false,
    isHwHiddenWallet: () => false,
    isOthersWallet: () => false,
    buildAccountValueKey: ({
      accountId,
      networkId,
    }: {
      accountId: string;
      networkId: string;
    }) => `${accountId}:${networkId}`,
  },
}));
jest.mock('@onekeyhq/shared/src/utils/hardwareDeviceTypes', () => ({
  isProtocolV2ProductType: (deviceType: string) => deviceType === 'pro2',
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/shared/src/utils/tokenUtils', () => ({
  calculateAccountTokensValue: () => '125',
  getEmptyTokenData: () => ({
    tokens: { data: [], map: {} },
    smallBalanceTokens: { data: [], map: {} },
    riskTokens: { data: [], map: {} },
  }),
  flattenAggregateTokensMap: () => ({}),
  sortTokensByFiatValue: ({ tokens }: { tokens: unknown[] }) => tokens,
}));
jest.mock('@onekeyhq/shared/src/utils/tokenSelectorFilterUtils', () => ({
  buildTokenSelectorDappTokenFilterParams: () => ({}),
  isTokenSelectorDappTokenFilterSupportedNetwork: () => false,
  isTokenSelectorDappToken: () => false,
}));
jest.mock('@onekeyhq/shared/src/performance/enabled', () => ({
  isAccountSwitchDiagnosticsEnabled: () => false,
}));
jest.mock('@onekeyhq/shared/src/errors/utils/errorToastUtils', () => ({
  __esModule: true,
  default: { toastIfError: mockNoop, showToastOfError: mockNoop },
}));
jest.mock('@onekeyhq/shared/src/errors/utils/deviceErrorUtils', () => ({
  isOneKeyHardwareError: () => false,
}));
jest.mock('@onekeyhq/shared/src/errors/utils/errorUtils', () => ({
  isRequestCanceledError: () => false,
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({ defaultLogger: {} }));
jest.mock('@onekeyhq/kit/src/utils/fiatConvert', () => ({
  convertFiat: ({ value }: { value: string }) => value,
}));
jest.mock('../HomeStickyHeaderContext', () => ({
  HomeStickyHeaderContext: jest
    .requireActual<typeof import('react')>('react')
    .createContext(undefined),
}));
jest.mock('../RichBlock/RichBlock', () => ({ RichBlock: () => null }));
jest.mock('./useTokenListReactivePipeline', () => ({
  useTokenListReactivePipeline: () => mockPipeline,
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHardwareUI: {
      showDeviceProcessLoadingDialog: mockShowPortfolioProcessing,
    },
    serviceHardwarePortfolioSync: {
      refreshPortfolioCategories: mockRefreshCategories,
      syncPortfolio: mockSyncPortfolio,
      notifyAllNetworksTokenListSettled: (...args: unknown[]) =>
        mockNotifySettled(...args),
    },
    serviceToken: {
      abortFetchAccountTokens: mockAsyncNoop,
      fetchAccountTokens: () => mockFetchTokens(),
      updateCurrentAccount: mockAsyncNoop,
      updateLocalAggregateTokenMap: mockAsyncNoop,
      updateLocalAggregateTokenListMap: mockAsyncNoop,
      cancelHomeTokenRequest: mockAsyncNoop,
      getAccountLocalTokens: async () => ({
        hasCache: false,
        tokenList: [],
        smallBalanceTokenList: [],
        riskyTokenList: [],
        tokenListMap: {},
        smallBalanceTokenListMap: {},
        riskyTokenListMap: {},
        tokenListValue: '0',
      }),
    },
    serviceTokenViewModel: { ingestRound: mockAsyncNoop },
    serviceAccount: { getAllHdHwQrWallets: async () => ({ wallets: [] }) },
    simpleDb: {
      appStatus: { getWalletAssetStatusAnalytics: mockAsyncNoop },
      customTokens: { getRawData: mockAsyncNoop },
      riskTokenManagement: { getRawData: mockAsyncNoop },
      aggregateToken: {
        getAggregateTokenConfigSnapshot: async () => ({
          aggregateTokenConfigMap: {},
        }),
      },
    },
    serviceSetting: { syncWalletConfigIfNeeded: mockAsyncNoop },
  },
}));

const { TokenListBlock } =
  jest.requireActual<typeof import('./TokenListBlock')>('./TokenListBlock');

function tokenResponse(): IFetchAccountTokensResp {
  const token = {
    $key: 'eth',
    networkId: 'evm--1',
    address: '',
    decimals: 18,
    isNative: true,
    name: 'Ethereum',
    symbol: 'ETH',
  };
  const group = {
    data: [],
    map: {},
    keys: '',
    fiatValue: '0',
    currency: 'usd',
  };
  return {
    accountId: mockAccount.id,
    networkId: mockNetwork.id,
    tokens: {
      ...group,
      data: [token],
      fiatValue: '125',
      map: {
        eth: { balance: '1', balanceParsed: '1', fiatValue: '125', price: 125 },
      },
    },
    smallBalanceTokens: { ...group },
    riskTokens: { ...group },
  };
}

async function refresh() {
  await act(async () => {
    appEventBus.emit(EAppEventBusNames.RefreshTokenList, undefined);
  });
  expect(mockFetchTokens).toHaveBeenCalledTimes(1);
}

describe('Home automatic Portfolio sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEpoch = 0;
    mockVisibilityListener = undefined;
    platformEnv.isExtensionUi = false;
    platformEnv.isExtensionUiPopup = false;
    mockIndexedAccountReady = true;
    mockPublishRefreshedHeader = false;
    mockRefreshCategories.mockImplementation(async () => ({
      defiFiat: mockHomeDisplay.defiFiatUsd ?? '0',
      perpsFiat: mockHomeDisplay.perpsFiatUsd ?? '0',
      deFiSource: 'live',
      deFiOverview: {
        netWorth: Number(mockHomeDisplay.defiFiatUsd ?? 0),
        totalValue: Number(mockHomeDisplay.defiFiatUsd ?? 0),
        totalDebt: 0,
        totalReward: 0,
      },
      fetchedAt: Date.now(),
      failedSources: [],
    }));
    mockTokenWorth = '125';
    mockTapTokenMap = {};
    mockStructure.orderedIds = [];
    mockNetwork = { id: 'evm--1', isAllNetworks: false };
    mockHomeDisplay = {
      ownerKey: 'hw-account-1__evm--1',
      totalFiatUsd: '125',
      tokenFiatUsd: '125',
      defiFiatUsd: '0',
      perpsFiatUsd: '0',
      isLive: true,
    };
    mockAllNetworkResult = undefined;
    mockFetchTokens.mockResolvedValue(tokenResponse());
  });

  it('refreshes All Networks when a persistent extension window regains focus', async () => {
    platformEnv.isExtensionUi = true;
    mockNetwork = { id: 'onekeyall', isAllNetworks: true };

    render(<TokenListBlock />);
    await act(async () => {
      mockVisibilityListener?.(true);
    });

    expect(mockRunAllNetworks).toHaveBeenCalledWith({
      alwaysSetState: true,
      skipAccountsCache: true,
    });
  });

  it('does not subscribe the short-lived extension popup to focus refresh', () => {
    platformEnv.isExtensionUi = true;
    platformEnv.isExtensionUiPopup = true;

    render(<TokenListBlock />);

    expect(mockVisibilityListener).toBeUndefined();
    expect(mockRunAllNetworks).not.toHaveBeenCalled();
  });

  it('does not query categories until a current spot response is available', async () => {
    jest.useFakeTimers();
    try {
      mockIndexedAccountReady = false;
      const { rerender } = render(<TokenListBlock />);
      mockIndexedAccountReady = true;
      rerender(<TokenListBlock />);
      expect(mockRefreshCategories).not.toHaveBeenCalled();
      await act(async () => {
        jest.advanceTimersByTime(180_000);
        appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
        appEventBus.emit(EAppEventBusNames.NetworkDeriveTypeChanged, undefined);
      });
      expect(mockRefreshCategories).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('refreshes spot and both categories once before explicit sync', async () => {
    mockPublishRefreshedHeader = true;
    render(<TokenListBlock />);
    const request = mockUpdateSyncUi.mock.calls.at(-1)?.[0]
      .request as () => void;
    await act(async () => request());
    await waitFor(() => expect(mockSyncPortfolio).toHaveBeenCalledTimes(1));
    expect(mockRefreshCategories).toHaveBeenCalledTimes(1);
    expect(mockRefreshCategories).toHaveBeenCalledWith(
      expect.objectContaining({ force: true, sources: ['defi', 'perps'] }),
    );
    expect(mockFetchTokens).toHaveBeenCalledTimes(1);
    expect(mockSyncPortfolio).toHaveBeenCalledWith(
      expect.objectContaining({
        eventPayload: expect.objectContaining({
          homeTotalFiatUsd: '125',
          homeCategoryFiatUsd: { defiFiat: '0', perpsFiat: '0' },
        }),
      }),
    );
  });

  it.each(['defi', 'perps'] as const)(
    'refreshes both categories before explicit sync when %s is missing',
    async (source) => {
      mockPublishRefreshedHeader = true;
      mockHomeDisplay = {
        ...mockHomeDisplay,
        defiFiatUsd: source === 'defi' ? undefined : '40',
        perpsFiatUsd: source === 'perps' ? undefined : '20',
      };
      mockRefreshCategories.mockResolvedValueOnce({
        defiFiat: '40',
        perpsFiat: '20',
        deFiSource: 'live',
        deFiOverview: {
          totalValue: 40,
          totalDebt: 0,
          totalReward: 0,
          netWorth: 40,
        },
        fetchedAt: Date.now(),
        failedSources: [],
      });
      render(<TokenListBlock />);
      const request = mockUpdateSyncUi.mock.calls.at(-1)?.[0]
        .request as () => void;
      await act(async () => request());
      await waitFor(() => expect(mockSyncPortfolio).toHaveBeenCalledTimes(1));
      expect(mockRefreshCategories).toHaveBeenCalledTimes(1);
      expect(mockRefreshCategories).toHaveBeenCalledWith(
        expect.objectContaining({ force: true, sources: ['defi', 'perps'] }),
      );
      expect(mockSyncPortfolio).toHaveBeenCalledWith(
        expect.objectContaining({
          eventPayload: expect.objectContaining({
            homeTotalFiatUsd: '185',
            homeCategoryFiatUsd: { defiFiat: '40', perpsFiat: '20' },
          }),
        }),
      );
    },
  );

  it('waits for the new spot response and ignores repeated sync clicks', async () => {
    mockPublishRefreshedHeader = true;
    let resolveTokens: (value: IFetchAccountTokensResp) => void = () =>
      undefined;
    mockFetchTokens.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveTokens = resolve;
        }),
    );
    render(<TokenListBlock />);
    const request = mockUpdateSyncUi.mock.calls.at(-1)?.[0]
      .request as () => void;
    await act(async () => {
      request();
      request();
    });
    expect(mockFetchTokens).toHaveBeenCalledTimes(1);
    expect(mockRefreshCategories).toHaveBeenCalledTimes(1);
    expect(mockBeginPortfolioStage).toHaveBeenCalledTimes(1);
    expect(mockShowPortfolioProcessing).toHaveBeenCalledTimes(1);
    expect(mockBeginPortfolioStage.mock.invocationCallOrder[0]).toBeLessThan(
      mockFetchTokens.mock.invocationCallOrder[0],
    );
    expect(mockEndPortfolioStage).not.toHaveBeenCalled();
    expect(mockPortfolioLoading).not.toHaveBeenCalled();
    expect(mockCategoryState.isRefreshing).toBe(true);
    expect(mockCategoryState.data).toBeUndefined();
    expect(mockSyncPortfolio).not.toHaveBeenCalled();
    await act(async () => resolveTokens(tokenResponse()));
    await waitFor(() => expect(mockSyncPortfolio).toHaveBeenCalledTimes(1));
    expect(mockBeginPortfolioStage).toHaveBeenCalledTimes(1);
    expect(mockEndPortfolioStage).toHaveBeenCalledWith({
      doneI18n: { key: 'portfolio_updated__title' },
    });
  });

  it('can retry the whole sync after the spot refresh times out', async () => {
    jest.useFakeTimers();
    try {
      mockPublishRefreshedHeader = true;
      mockFetchTokens.mockImplementationOnce(
        () => new Promise(() => undefined),
      );
      render(<TokenListBlock />);
      const request = mockUpdateSyncUi.mock.calls.at(-1)?.[0]
        .request as () => void;
      await act(async () => request());
      await act(async () => {
        jest.advanceTimersByTime(30_000);
      });
      expect(mockCategoryState.isRefreshing).toBe(false);
      expect(mockCategoryState.retry).toEqual(expect.any(Function));
      expect(mockEndPortfolioStage).toHaveBeenCalledWith({
        error: expect.any(Error),
      });
      expect(mockPortfolioError).not.toHaveBeenCalled();
      expect(mockSyncPortfolio).not.toHaveBeenCalled();
      const retry = mockUpdateSyncUi.mock.calls.at(-1)?.[0]
        .request as () => void;
      await act(async () => retry());
      expect(mockFetchTokens).toHaveBeenCalledTimes(2);
      expect(mockRefreshCategories).toHaveBeenCalledTimes(2);
      expect(mockSyncPortfolio).toHaveBeenCalledTimes(1);
      expect(mockBeginPortfolioStage).toHaveBeenCalledTimes(2);
      expect(mockEndPortfolioStage).toHaveBeenCalledTimes(2);
      expect(mockPortfolioLoading).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('waits for the preparation panel before handing off complete data', async () => {
    mockPublishRefreshedHeader = true;
    let resolveProcessing: () => void = () => undefined;
    mockShowPortfolioProcessing.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveProcessing = resolve;
        }),
    );
    render(<TokenListBlock />);
    const request = mockUpdateSyncUi.mock.calls.at(-1)?.[0]
      .request as () => void;
    await act(async () => request());
    expect(mockFetchTokens).toHaveBeenCalledTimes(1);
    expect(mockCategoryState.isRefreshing).toBe(false);
    expect(mockSyncPortfolio).not.toHaveBeenCalled();
    await act(async () => resolveProcessing());
    await waitFor(() => expect(mockSyncPortfolio).toHaveBeenCalledTimes(1));
    expect(mockBeginPortfolioStage).toHaveBeenCalledTimes(1);
    expect(mockPortfolioLoading).not.toHaveBeenCalled();
    expect(mockPortfolioError).not.toHaveBeenCalled();
  });

  it('keeps the previous total and does not upload when spot refresh fails', async () => {
    mockPublishRefreshedHeader = true;
    mockHomeDisplay = {
      ...mockHomeDisplay,
      totalFiatUsd: '9.01',
      tokenFiatUsd: '3.42',
      defiFiatUsd: '5.59',
    };
    mockFetchTokens.mockRejectedValueOnce(new Error('offline'));
    render(<TokenListBlock />);
    const request = mockUpdateSyncUi.mock.calls.at(-1)?.[0]
      .request as () => void;
    await act(async () => request());
    await waitFor(() => expect(mockCategoryState.isRefreshing).toBe(false));
    expect(mockHomeDisplay.totalFiatUsd).toBe('9.01');
    expect(mockCategoryState.data).toBeUndefined();
    expect(mockCategoryState.retry).toEqual(expect.any(Function));
    expect(mockEndPortfolioStage).toHaveBeenCalledWith({
      error: expect.any(Error),
    });
    expect(mockPortfolioError).not.toHaveBeenCalled();
    expect(mockSyncPortfolio).not.toHaveBeenCalled();
  });

  it.each([
    { didComplete: false, requestCount: 2, resultCount: 1 },
    { didComplete: true, requestCount: 2, resultCount: 1 },
  ])(
    'does not upload or replace Home after an incomplete All Networks spot refresh: %j',
    async (runResult) => {
      mockPublishRefreshedHeader = true;
      mockNetwork = { id: 'all--0', isAllNetworks: true };
      mockHomeDisplay = {
        ...mockHomeDisplay,
        ownerKey: 'hw-account-1__all--0',
        totalFiatUsd: '9.01',
        tokenFiatUsd: '3.42',
        defiFiatUsd: '5.59',
      };
      render(<TokenListBlock />);
      const request = mockUpdateSyncUi.mock.calls.at(-1)?.[0]
        .request as () => void;
      await act(async () => request());
      expect(mockCategoryState.isRefreshing).toBe(true);
      await act(async () => {
        await mockAllNetworkParams?.onStarted?.({
          accountId: mockAccount.id,
          networkId: mockNetwork.id,
          generation: 1,
        });
        await mockAllNetworkParams?.onFinished?.({
          accountId: mockAccount.id,
          networkId: mockNetwork.id,
          generation: 1,
          runResult,
        });
      });
      await waitFor(() => expect(mockCategoryState.isRefreshing).toBe(false));
      expect(mockCategoryState.data).toBeUndefined();
      expect(mockCategoryState.retry).toEqual(expect.any(Function));
      expect(mockHomeDisplay.totalFiatUsd).toBe('9.01');
      expect(mockSyncPortfolio).not.toHaveBeenCalled();
    },
  );

  it('refreshes both categories before automatically syncing the committed Home total', async () => {
    mockPublishRefreshedHeader = true;
    mockHomeDisplay = {
      ...mockHomeDisplay,
      isLive: false,
      defiFiatUsd: undefined,
      perpsFiatUsd: undefined,
    };
    let resolveCategories: (
      value: IPortfolioCategoryRefreshResult,
    ) => void = () => undefined;
    mockRefreshCategories.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCategories = resolve;
        }),
    );
    render(<TokenListBlock />);
    await refresh();
    expect(mockRefreshCategories).toHaveBeenCalledTimes(1);
    expect(mockRefreshCategories).toHaveBeenCalledWith(
      expect.objectContaining({ force: false, sources: ['defi', 'perps'] }),
    );
    expect(mockNotifySettled).not.toHaveBeenCalled();
    await act(async () =>
      resolveCategories({
        defiFiat: '40',
        perpsFiat: '20',
        deFiSource: 'live',
        deFiOverview: {
          netWorth: 40,
          totalValue: 40,
          totalDebt: 0,
          totalReward: 0,
        },
        fetchedAt: Date.now(),
        failedSources: [],
      }),
    );
    await waitFor(() => expect(mockNotifySettled).toHaveBeenCalledTimes(1));
    expect(mockPortfolioLoading).not.toHaveBeenCalled();
    expect(mockPortfolioError).not.toHaveBeenCalled();
    expect(mockBeginPortfolioStage).not.toHaveBeenCalled();
    expect(mockShowPortfolioProcessing).not.toHaveBeenCalled();
    expect(mockFetchTokens).toHaveBeenCalledTimes(1);
    expect(mockRefreshCategories).toHaveBeenCalledTimes(1);
    expect(mockNotifySettled).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerAccountId: mockAccount.id,
        ownerNetworkId: 'evm--1',
        networkId: 'evm--1',
        totalFiat: '125',
        totalFiatCurrency: 'usd',
        homeTotalFiatUsd: '185',
        homeCategoryFiatUsd: { defiFiat: '40', perpsFiat: '20' },
        tokens: [
          expect.objectContaining({ networkId: 'evm--1', symbol: 'ETH' }),
        ],
      }),
    );
  });

  it('forces an explicit sync instead of reusing a routine category request', async () => {
    mockPublishRefreshedHeader = true;
    let resolveAutomatic: (
      result: IPortfolioCategoryRefreshResult,
    ) => void = () => undefined;
    mockRefreshCategories.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAutomatic = resolve;
        }),
    );
    render(<TokenListBlock />);
    await refresh();
    expect(mockRefreshCategories).toHaveBeenLastCalledWith(
      expect.objectContaining({ force: false }),
    );
    const request = mockUpdateSyncUi.mock.calls.at(-1)?.[0]
      .request as () => void;
    await act(async () => request());
    expect(mockRefreshCategories).toHaveBeenCalledTimes(2);
    expect(mockRefreshCategories).toHaveBeenLastCalledWith(
      expect.objectContaining({ force: true }),
    );
    expect(mockFetchTokens).toHaveBeenCalledTimes(2);
    expect(mockSyncPortfolio).toHaveBeenCalledTimes(1);
    await act(async () =>
      resolveAutomatic({
        defiFiat: '999',
        perpsFiat: '999',
        deFiSource: 'live',
        fetchedAt: Date.now(),
        failedSources: [],
      }),
    );
    expect(mockCategoryState.data?.defiFiat).toBe('0');
    expect(mockCategoryState.retry).toBeUndefined();
    expect(mockHomeDisplay.totalFiatUsd).toBe('125');
  });

  it.each(['defi', 'perps'] as const)(
    'keeps Home and skips automatic upload when %s refresh is incomplete',
    async (source) => {
      mockPublishRefreshedHeader = true;
      mockRefreshCategories.mockResolvedValueOnce({
        defiFiat: source === 'defi' ? undefined : '40',
        perpsFiat: source === 'perps' ? undefined : '20',
        deFiSource: source === 'defi' ? 'unknown' : 'live',
        fetchedAt: Date.now(),
        failedSources: [source],
      });
      const { rerender } = render(<TokenListBlock />);
      await refresh();
      expect(mockCategoryState.isRefreshing).toBe(false);
      expect(mockCategoryState.failedSources).toEqual([source]);
      expect(mockCategoryState.data).toBeUndefined();
      expect(mockCategoryState.heldTotalFiatUsd).toBe('125');
      expect(mockHomeDisplay.totalFiatUsd).toBe('125');
      expect(mockNotifySettled).not.toHaveBeenCalled();
      rerender(<TokenListBlock />);
      expect(mockRefreshCategories).toHaveBeenCalledTimes(1);
      expect(mockFetchTokens).toHaveBeenCalledTimes(1);
    },
  );

  it('waits for the refreshed Home revision before automatically uploading', async () => {
    const { rerender } = render(<TokenListBlock />);
    await refresh();
    expect(mockCategoryState.dataRequestId).toBeDefined();
    expect(mockNotifySettled).not.toHaveBeenCalled();
    mockHomeDisplay = {
      ...mockHomeDisplay,
      categoryRevision: mockCategoryState.dataRequestId,
    };
    rerender(<TokenListBlock />);
    await waitFor(() => expect(mockNotifySettled).toHaveBeenCalledTimes(1));
    expect(mockRefreshCategories).toHaveBeenCalledTimes(1);
  });

  it('drops an automatic category response after account selection changes', async () => {
    mockPublishRefreshedHeader = true;
    let resolveCategories: (
      value: IPortfolioCategoryRefreshResult,
    ) => void = () => undefined;
    mockRefreshCategories.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveCategories = resolve;
        }),
    );
    const { rerender } = render(<TokenListBlock />);
    await refresh();
    const requestId = mockCategoryState.requestId;
    mockEpoch += 1;
    rerender(<TokenListBlock />);
    await act(async () =>
      resolveCategories({
        defiFiat: '999',
        perpsFiat: '20',
        deFiSource: 'live',
        fetchedAt: Date.now(),
        failedSources: [],
      }),
    );
    expect(mockCategoryState.requestId).toBeGreaterThan(requestId);
    expect(mockCategoryState.data).toBeUndefined();
    expect(mockNotifySettled).not.toHaveBeenCalled();
    expect(mockSyncPortfolio).not.toHaveBeenCalled();
  });

  it('refreshes categories before syncing the newly committed Home snapshot and token rows', async () => {
    mockPublishRefreshedHeader = true;
    mockHomeDisplay = {
      ...mockHomeDisplay,
      totalFiatUsd: '160',
      tokenFiatUsd: '100',
      defiFiatUsd: '40',
      perpsFiatUsd: '20',
      isLive: true,
    };
    const heldResponse = tokenResponse();
    heldResponse.tokens.fiatValue = '100';
    heldResponse.tokens.map.eth = {
      balance: '1',
      balanceParsed: '1',
      fiatValue: '100',
      price: 100,
    };
    mockTokenWorth = '100';
    mockTapTokenMap = heldResponse.tokens.map;
    mockStructure.orderedIds = ['eth'];
    mockFetchTokens.mockResolvedValue(heldResponse);
    const { rerender } = render(<TokenListBlock />);
    await refresh();
    await waitFor(() => expect(mockNotifySettled).toHaveBeenCalledTimes(1));

    mockHomeDisplay = { ...mockHomeDisplay, isLive: false };
    mockTokenWorth = '125';
    mockTapTokenMap = tokenResponse().tokens.map;
    rerender(<TokenListBlock />);
    mockFetchTokens.mockResolvedValue(tokenResponse());
    await act(async () => {
      appEventBus.emit(EAppEventBusNames.RefreshTokenList, undefined);
    });
    expect(mockFetchTokens).toHaveBeenCalledTimes(2);
    expect(mockNotifySettled).toHaveBeenCalledTimes(2);
    const { request, disabled } = mockUpdateSyncUi.mock.calls.at(-1)?.[0] as {
      request: () => void;
      disabled: boolean;
    };
    expect(disabled).toBe(false);
    // The cell projection still holds the older token price when sync starts.
    mockTapTokenMap = heldResponse.tokens.map;
    await act(async () => request());
    await waitFor(() => expect(mockSyncPortfolio).toHaveBeenCalledTimes(1));
    expect(mockSyncPortfolio).toHaveBeenCalledWith(
      expect.objectContaining({
        eventPayload: expect.objectContaining({
          totalFiat: '125',
          homeTotalFiatUsd: '185',
          homeCategoryFiatUsd: { defiFiat: '40', perpsFiat: '20' },
          tokenMap: tokenResponse().tokens.map,
          tokens: [expect.objectContaining({ symbol: 'ETH' })],
        }),
      }),
    );
    expect(mockFetchTokens).toHaveBeenCalledTimes(3);
  });

  it('waits for matching token rows when only the held balance is available', async () => {
    mockHomeDisplay = {
      ...mockHomeDisplay,
      tokenFiatUsd: '100',
      isLive: false,
    };
    render(<TokenListBlock />);
    await waitFor(() => expect(mockCategoryState.isRefreshing).toBe(false));
    const { request, disabled } = mockUpdateSyncUi.mock.calls.at(-1)?.[0] as {
      request: () => void;
      disabled: boolean;
    };
    expect(disabled).toBe(false);
    await act(async () => request());
    expect(mockSyncPortfolio).not.toHaveBeenCalled();
    expect(mockFetchTokens).toHaveBeenCalledTimes(1);
  });

  it('refreshes missing categories before replacing a cached total and syncing', async () => {
    mockPublishRefreshedHeader = true;
    mockHomeDisplay = {
      ownerKey: 'hw-account-1__evm--1',
      totalFiatUsd: '160',
      isLive: false,
    };
    render(<TokenListBlock />);
    await waitFor(() => expect(mockCategoryState.isRefreshing).toBe(false));
    const { request, disabled } = mockUpdateSyncUi.mock.calls.at(-1)?.[0] as {
      request: () => void;
      disabled: boolean;
    };
    expect(disabled).toBe(false);
    await act(async () => request());
    await waitFor(() => expect(mockSyncPortfolio).toHaveBeenCalledTimes(1));
    expect(mockFetchTokens).toHaveBeenCalledTimes(1);
    expect(mockSyncPortfolio).toHaveBeenCalledWith(
      expect.objectContaining({
        eventPayload: expect.objectContaining({
          homeTotalFiatUsd: '125',
          homeCategoryFiatUsd: { defiFiat: '0', perpsFiat: '0' },
        }),
      }),
    );
  });

  it('preserves Home on failure and refreshes all three categories on retry', async () => {
    mockPublishRefreshedHeader = true;
    render(<TokenListBlock />);
    await waitFor(() => expect(mockCategoryState.isRefreshing).toBe(false));
    const complete: IPortfolioCategoryRefreshResult = {
      defiFiat: '0',
      perpsFiat: '0',
      deFiSource: 'live',
      deFiOverview: {
        totalValue: 0,
        totalDebt: 0,
        totalReward: 0,
        netWorth: 0,
      },
      fetchedAt: Date.now(),
      failedSources: [],
    };
    mockRefreshCategories.mockResolvedValueOnce({
      ...complete,
      defiFiat: undefined,
      deFiSource: undefined,
      deFiOverview: undefined,
      perpsFiat: '20',
      failedSources: ['defi'],
    });
    const request = mockUpdateSyncUi.mock.calls.at(-1)?.[0]
      .request as () => void;
    await act(async () => request());
    expect(mockCategoryState.failedSources).toEqual(['defi']);
    expect(mockCategoryState.isRefreshing).toBe(false);
    expect(mockHomeDisplay.totalFiatUsd).toBe('125');
    expect(mockCategoryState.heldTotalFiatUsd).toBe('125');
    expect(mockSyncPortfolio).not.toHaveBeenCalled();
    mockRefreshCategories.mockResolvedValueOnce({
      ...complete,
      defiFiat: '40',
      deFiOverview: {
        totalValue: 40,
        totalDebt: 0,
        totalReward: 0,
        netWorth: 40,
      },
      perpsFiat: '20',
    });
    await act(async () => mockCategoryState.retry?.());
    expect(mockFetchTokens).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(mockSyncPortfolio).toHaveBeenCalledTimes(1));
    expect(mockRefreshCategories).toHaveBeenLastCalledWith(
      expect.objectContaining({
        force: true,
        sources: ['defi', 'perps'],
      }),
    );
    expect(mockSyncPortfolio).toHaveBeenCalledWith(
      expect.objectContaining({
        eventPayload: expect.objectContaining({ homeTotalFiatUsd: '185' }),
      }),
    );
  });

  it('waits for the header to commit the refreshed revision before communicating', async () => {
    mockHomeDisplay = { ...mockHomeDisplay, defiFiatUsd: undefined };
    const { rerender } = render(<TokenListBlock />);
    await waitFor(() => expect(mockCategoryState.isRefreshing).toBe(false));
    const request = mockUpdateSyncUi.mock.calls.at(-1)?.[0]
      .request as () => void;
    await act(async () => request());
    expect(mockSyncPortfolio).not.toHaveBeenCalled();
    expect(mockUpdateSyncUi.mock.calls.at(-1)?.[0].loading).toBe(true);
    mockHomeDisplay = {
      ...mockHomeDisplay,
      categoryRevision: mockCategoryState.dataRequestId,
      defiFiatUsd: '0',
    };
    rerender(<TokenListBlock />);
    await waitFor(() => expect(mockSyncPortfolio).toHaveBeenCalledTimes(1));
  });

  it('ignores a refresh response superseded by account selection', async () => {
    mockHomeDisplay = { ...mockHomeDisplay, defiFiatUsd: undefined };
    const { rerender } = render(<TokenListBlock />);
    await waitFor(() => expect(mockCategoryState.isRefreshing).toBe(false));
    const complete: IPortfolioCategoryRefreshResult = {
      defiFiat: '0',
      perpsFiat: '0',
      deFiSource: 'live',
      deFiOverview: {
        totalValue: 0,
        totalDebt: 0,
        totalReward: 0,
        netWorth: 0,
      },
      fetchedAt: Date.now(),
      failedSources: [],
    };
    let resolveRefresh: (
      result: IPortfolioCategoryRefreshResult,
    ) => void = () => undefined;
    mockRefreshCategories.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRefresh = resolve;
        }),
    );
    const request = mockUpdateSyncUi.mock.calls.at(-1)?.[0]
      .request as () => void;
    await act(async () => request());
    const oldRequestId = mockCategoryState.requestId;
    mockEpoch += 1;
    rerender(<TokenListBlock />);
    await act(async () => resolveRefresh({ ...complete, defiFiat: '999' }));
    expect(mockCategoryState.requestId).toBeGreaterThan(oldRequestId);
    expect(mockCategoryState.data?.defiFiat).not.toBe('999');
    expect(mockCategoryState.isRefreshing).toBe(false);
    expect(mockSyncPortfolio).not.toHaveBeenCalled();
    expect(mockEndPortfolioStage).toHaveBeenCalledTimes(1);
    expect(mockPortfolioError).not.toHaveBeenCalled();
  });

  it('ends the preparation stage on unmount and ignores the late response', async () => {
    let resolveTokens: (value: IFetchAccountTokensResp) => void = () =>
      undefined;
    mockFetchTokens.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveTokens = resolve;
        }),
    );
    const view = render(<TokenListBlock />);
    const request = mockUpdateSyncUi.mock.calls.at(-1)?.[0]
      .request as () => void;
    await act(async () => request());
    expect(mockBeginPortfolioStage).toHaveBeenCalledTimes(1);
    expect(mockEndPortfolioStage).not.toHaveBeenCalled();
    view.unmount();
    expect(mockEndPortfolioStage).toHaveBeenCalledTimes(1);
    await act(async () => resolveTokens(tokenResponse()));
    expect(mockSyncPortfolio).not.toHaveBeenCalled();
    expect(mockPortfolioError).not.toHaveBeenCalled();
  });

  it('cancels preparation when its own top panel is closed', async () => {
    let resolveTokens: (value: IFetchAccountTokensResp) => void = () =>
      undefined;
    mockFetchTokens.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveTokens = resolve;
        }),
    );
    render(<TokenListBlock />);
    const request = mockUpdateSyncUi.mock.calls.at(-1)?.[0]
      .request as () => void;
    await act(async () => request());
    await act(async () => {
      appEventBus.emit(EAppEventBusNames.DeviceStageOff, { burstId: 7 });
    });
    expect(mockEndPortfolioStage).toHaveBeenCalledWith(undefined);
    await act(async () => resolveTokens(tokenResponse()));
    expect(mockSyncPortfolio).not.toHaveBeenCalled();
    expect(mockShowPortfolioProcessing).toHaveBeenCalledTimes(1);
    expect(mockPortfolioError).not.toHaveBeenCalled();
  });

  it('releases a pending stage opening on unmount and ignores its late response', async () => {
    let resolveStage: (burstId: number) => void = () => undefined;
    mockBeginPortfolioStage.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStage = resolve;
        }),
    );
    const view = render(<TokenListBlock />);
    const request = mockUpdateSyncUi.mock.calls.at(-1)?.[0]
      .request as () => void;
    await act(async () => request());
    view.unmount();
    expect(mockEndPortfolioStage).toHaveBeenCalledWith(undefined);
    await act(async () => resolveStage(7));
    expect(mockShowPortfolioProcessing).not.toHaveBeenCalled();
    expect(mockFetchTokens).toHaveBeenCalledTimes(1);
    expect(mockSyncPortfolio).not.toHaveBeenCalled();
  });

  it.each([
    { explicit: false, complete: true },
    { explicit: true, complete: true },
    { explicit: false, complete: false },
  ])(
    'syncs All Networks only with complete spot and category results: %j',
    async ({ explicit, complete }) => {
      mockPublishRefreshedHeader = true;
      mockNetwork = { id: 'onekeyall--0', isAllNetworks: true };
      mockHomeDisplay = {
        ...mockHomeDisplay,
        ownerKey: 'hw-account-1__onekeyall--0',
      };
      const response = tokenResponse();
      mockAllNetworkResult = [
        {
          ...response,
          tokenSelectorFilterMode: 'wallet-token',
          syncTokenFilterToOverview: true,
          ownerAccountId: mockAccount.id,
          ownerNetworkId: mockNetwork.id,
        },
      ];
      mockPipeline.buildAuthoritativeSnapshot.mockResolvedValue({
        orderedTokens: response.tokens.data,
        smallBalanceTokens: [],
        riskyTokens: [],
        mergeTokenListMap: response.tokens.map,
        riskyTokenListMap: {},
        aggregateTokenMap: {},
        aggregateTokenListMap: {},
        accountsWorth: { account: '125' },
        createAtNetworkWorth: '125',
      });
      const { rerender } = render(<TokenListBlock />);
      await act(async () => {
        const accounts = [
          { accountId: mockAccount.id, networkId: mockNetwork.id },
          ...(complete
            ? []
            : [{ accountId: 'missing-account', networkId: 'evm--10' }]),
        ];
        mockAllNetworkParams?.allNetworkAccountsData?.({
          accounts,
          allAccounts: accounts,
        });
      });
      if (!complete) {
        expect(mockRefreshCategories).not.toHaveBeenCalled();
        expect(mockNotifySettled).not.toHaveBeenCalled();
        return;
      }
      await waitFor(() => expect(mockNotifySettled).toHaveBeenCalledTimes(1));
      expect(mockRefreshCategories).toHaveBeenCalledTimes(1);
      if (explicit) {
        mockPublishRefreshedHeader = true;
        const request = mockUpdateSyncUi.mock.calls.at(-1)?.[0]
          .request as () => void;
        await act(async () => request());
        await act(async () => {
          await mockAllNetworkParams?.onStarted?.({
            accountId: mockAccount.id,
            networkId: mockNetwork.id,
            generation: 1,
          });
          await mockAllNetworkParams?.onFinished?.({
            accountId: mockAccount.id,
            networkId: mockNetwork.id,
            generation: 1,
            runResult: { didComplete: true, requestCount: 1, resultCount: 1 },
          });
        });
        expect(mockCategoryState.isRefreshing).toBe(true);
        expect(mockSyncPortfolio).not.toHaveBeenCalled();
        await act(async () => {
          const accounts = [
            { accountId: mockAccount.id, networkId: mockNetwork.id },
          ];
          mockAllNetworkParams?.allNetworkAccountsData?.({
            accounts,
            allAccounts: accounts,
          });
          mockAllNetworkResult = mockAllNetworkResult?.map((item) => ({
            ...item,
          }));
          mockAllNetworkParams?.onResultPublished?.(mockAllNetworkResult, 1);
          rerender(<TokenListBlock />);
        });
        await waitFor(() => expect(mockSyncPortfolio).toHaveBeenCalledTimes(1));
      }
      expect(mockNotifySettled).toHaveBeenCalledWith(
        expect.objectContaining({
          networkId: 'onekeyall--0',
          homeTotalFiatUsd: '125',
        }),
      );
    },
  );

  it.each([
    { isLive: false },
    { tokenFiatUsd: '126' },
    { ownerKey: 'another-account__evm--1' },
  ])('waits for a matching live Home balance: %p', async (display) => {
    mockHomeDisplay = { ...mockHomeDisplay, ...display };
    render(<TokenListBlock />);
    await refresh();
    expect(mockNotifySettled).not.toHaveBeenCalled();
  });

  it('drops a single-network response superseded by an account selection change', async () => {
    mockFetchTokens.mockImplementation(async () => {
      mockEpoch += 1;
      return tokenResponse();
    });
    render(<TokenListBlock />);
    await refresh();
    expect(mockNotifySettled).not.toHaveBeenCalled();
  });
});

describe('Home All Networks owner without accounts', () => {
  const finishRun = async (requestCount: number) => {
    await act(async () => {
      await mockAllNetworkParams?.onFinished?.({
        accountId: mockAccount.id,
        networkId: mockNetwork.id,
        runResult: { didComplete: true, requestCount, resultCount: 0 },
        generation: 1,
      });
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockEpoch = 0;
    mockIndexedAccountReady = true;
    mockAllNetworkResult = undefined;
    mockNetwork = { id: 'onekeyall--0', isAllNetworks: true };
  });

  afterEach(() => {
    mockNetwork = { id: 'evm--1', isAllNetworks: false };
  });

  it('stamps an empty authoritative snapshot when the run issued no request', async () => {
    render(<TokenListBlock />);
    mockUpdateTokenListState.mockClear();
    await finishRun(0);
    expect(mockCommitAuthoritativeIngest).toHaveBeenCalledTimes(1);
    expect(mockCommitAuthoritativeIngest).toHaveBeenCalledWith(
      expect.objectContaining({
        orderedTokens: [],
        smallBalanceTokens: [],
        riskyTokens: [],
        accountsWorth: {},
      }),
      undefined,
    );
    expect(mockUpdateAccountWorth).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: mockAccount.id,
        initialized: true,
        updateAll: true,
        worth: {},
      }),
    );
    expect(mockUpdateTokenListState).toHaveBeenCalledWith({
      initialized: true,
      isRefreshing: false,
    });
  });

  it('leaves the projection to the fan-out when requests were issued', async () => {
    render(<TokenListBlock />);
    await finishRun(3);
    expect(mockCommitAuthoritativeIngest).not.toHaveBeenCalled();
    expect(mockUpdateAccountWorth).not.toHaveBeenCalled();
  });

  it('does not stamp a superseded owner', async () => {
    render(<TokenListBlock />);
    mockEpoch += 1;
    await finishRun(0);
    expect(mockCommitAuthoritativeIngest).not.toHaveBeenCalled();
  });
});

describe('Home RefreshTokenList route focus and account scoping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEpoch = 0;
    mockIndexedAccountReady = true;
    mockAllNetworkResult = undefined;
    mockRouteFocused = true;
    mockFetchTokens.mockResolvedValue(tokenResponse());
  });

  afterEach(() => {
    mockRouteFocused = true;
    mockNetwork = { id: 'evm--1', isAllNetworks: false };
  });

  it('defers and coalesces off-route RefreshTokenList events until Home regains route focus', async () => {
    mockNetwork = { id: 'onekeyall--0', isAllNetworks: true };
    mockRouteFocused = false;
    const { rerender } = render(<TokenListBlock />);
    mockRunAllNetworks.mockClear();
    mockRunAccountRequests.mockClear();

    await act(async () => {
      appEventBus.emit(EAppEventBusNames.RefreshTokenList, {
        accounts: [{ accountId: 'zec-account-1', networkId: 'zec--main' }],
      });
      appEventBus.emit(EAppEventBusNames.RefreshTokenList, {
        accounts: [{ accountId: 'zec-account-1', networkId: 'zec--main' }],
      });
      appEventBus.emit(EAppEventBusNames.RefreshTokenList, {
        accounts: [{ accountId: 'xmr-account-1', networkId: 'xmr--0' }],
      });
    });

    expect(mockRunAllNetworks).not.toHaveBeenCalled();
    expect(mockRunAccountRequests).not.toHaveBeenCalled();

    mockRouteFocused = true;
    await act(async () => {
      rerender(<TokenListBlock />);
    });

    expect(mockRunAllNetworks).not.toHaveBeenCalled();
    expect(mockRunAccountRequests).toHaveBeenCalledTimes(1);
    expect(mockRunAccountRequests).toHaveBeenCalledWith([
      { accountId: 'zec-account-1', networkId: 'zec--main' },
      { accountId: 'xmr-account-1', networkId: 'xmr--0' },
    ]);
  });

  it('ignores foreign-network account-scoped RefreshTokenList in single-network mode', async () => {
    mockNetwork = { id: 'evm--1', isAllNetworks: false };
    render(<TokenListBlock />);
    mockFetchTokens.mockClear();

    await act(async () => {
      appEventBus.emit(EAppEventBusNames.RefreshTokenList, {
        accounts: [{ accountId: 'zec-account-1', networkId: 'zec--main' }],
      });
    });
    expect(mockFetchTokens).not.toHaveBeenCalled();

    await act(async () => {
      appEventBus.emit(EAppEventBusNames.RefreshTokenList, {
        accounts: [{ accountId: mockAccount.id, networkId: 'evm--1' }],
      });
    });
    expect(mockFetchTokens).toHaveBeenCalledTimes(1);
  });
});
