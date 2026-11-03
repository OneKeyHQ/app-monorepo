/** @jest-environment jsdom */
import { act, render, waitFor } from '@testing-library/react';

import type { IPortfolioCategoryRefreshResult } from '@onekeyhq/kit-bg/src/services/ServiceHardware/serviceHardwarePortfolioSync/ServiceHardwarePortfolioSync';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
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
const mockActions = {
  updateAccountWorth: mockNoop,
  retainAccountWorth: mockNoop,
  updateAccountOverviewState: mockNoop,
  updateAllNetworksState: mockNoop,
};
const mockTokenActions = {
  updateTokenListState: mockNoop,
  updateSearchKey: mockNoop,
  updatePortfolioSyncUiState: mockUpdateSyncUi,
};
const mockPipeline = {
  reset: mockNoop,
  seedAndFlushCache: mockAsyncNoop,
  setEnabledKeys: mockNoop,
  ingestLiveRound: mockNoop,
  buildAuthoritativeSnapshot: jest.fn(),
  commitAuthoritativeIngest: mockNoop,
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
  Stack: () => null,
  Skeleton: { HeadingLg: () => null },
  onVisibilityStateChange: () => () => undefined,
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
    beginBurst: mockAsyncNoop,
    endBurst: mockAsyncNoop,
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
  useRouteIsFocused: () => true,
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
  useAllNetworkRequests: () => ({
    run: mockAsyncNoop,
    runAccountRequests: mockAsyncNoop,
    result: mockAllNetworkResult,
    isEmptyAccount: false,
  }),
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

  it('does not query categories on hydration, timers or account refresh events', async () => {
    jest.useFakeTimers();
    try {
      mockIndexedAccountReady = false;
      const { rerender } = render(<TokenListBlock />);
      mockIndexedAccountReady = true;
      rerender(<TokenListBlock />);
      await act(async () => {
        jest.advanceTimersByTime(180_000);
        appEventBus.emit(EAppEventBusNames.AccountDataUpdate, undefined);
        appEventBus.emit(EAppEventBusNames.NetworkDeriveTypeChanged, undefined);
      });
      expect(mockRefreshCategories).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('syncs a complete Home snapshot without querying categories', async () => {
    render(<TokenListBlock />);
    await refresh();
    const request = mockUpdateSyncUi.mock.calls.at(-1)?.[0]
      .request as () => void;
    await act(async () => request());
    await waitFor(() => expect(mockSyncPortfolio).toHaveBeenCalledTimes(1));
    expect(mockRefreshCategories).not.toHaveBeenCalled();
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
    'only queries the missing %s category without forcing refresh',
    async (source) => {
      mockPublishRefreshedHeader = true;
      mockHomeDisplay = {
        ...mockHomeDisplay,
        defiFiatUsd: source === 'defi' ? undefined : '40',
        perpsFiatUsd: source === 'perps' ? undefined : '20',
      };
      mockRefreshCategories.mockResolvedValueOnce({
        defiFiat: source === 'defi' ? '40' : undefined,
        perpsFiat: source === 'perps' ? '20' : undefined,
        deFiSource: source === 'defi' ? 'live' : undefined,
        deFiOverview:
          source === 'defi'
            ? {
                totalValue: 40,
                totalDebt: 0,
                totalReward: 0,
                netWorth: 40,
              }
            : undefined,
        fetchedAt: Date.now(),
        failedSources: [],
      });
      render(<TokenListBlock />);
      await refresh();
      const request = mockUpdateSyncUi.mock.calls.at(-1)?.[0]
        .request as () => void;
      await act(async () => request());
      await waitFor(() => expect(mockSyncPortfolio).toHaveBeenCalledTimes(1));
      expect(mockRefreshCategories).toHaveBeenCalledTimes(1);
      expect(mockRefreshCategories).toHaveBeenCalledWith(
        expect.objectContaining({ force: false, sources: [source] }),
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

  it('automatically syncs the current single-network snapshot after a live refresh', async () => {
    render(<TokenListBlock />);
    await refresh();
    await waitFor(() => expect(mockNotifySettled).toHaveBeenCalledTimes(1));
    expect(mockNotifySettled).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerAccountId: mockAccount.id,
        ownerNetworkId: 'evm--1',
        networkId: 'evm--1',
        totalFiat: '125',
        totalFiatCurrency: 'usd',
        homeTotalFiatUsd: '125',
        tokens: [
          expect.objectContaining({ networkId: 'evm--1', symbol: 'ETH' }),
        ],
      }),
    );
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
    expect(mockNotifySettled).toHaveBeenCalledTimes(1);
    const { request, disabled } = mockUpdateSyncUi.mock.calls.at(-1)?.[0] as {
      request: () => void;
      disabled: boolean;
    };
    expect(disabled).toBe(false);
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
    expect(mockFetchTokens).toHaveBeenCalledTimes(2);
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
    expect(mockFetchTokens).not.toHaveBeenCalled();
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
    expect(mockFetchTokens).not.toHaveBeenCalled();
    expect(mockSyncPortfolio).toHaveBeenCalledWith(
      expect.objectContaining({
        eventPayload: expect.objectContaining({
          homeTotalFiatUsd: '125',
          homeCategoryFiatUsd: { defiFiat: '0', perpsFiat: '0' },
        }),
      }),
    );
  });

  it('keeps the previous snapshot on failure and retries only the failed source', async () => {
    mockHomeDisplay = {
      ...mockHomeDisplay,
      defiFiatUsd: undefined,
      perpsFiatUsd: undefined,
    };
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
      perpsFiat: undefined,
    });
    await act(async () => mockCategoryState.retry?.());
    await waitFor(() => expect(mockSyncPortfolio).toHaveBeenCalledTimes(1));
    expect(mockRefreshCategories).toHaveBeenLastCalledWith(
      expect.objectContaining({ force: false, sources: ['defi'] }),
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
  });

  it('continues automatically syncing the all-networks snapshot', async () => {
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
    render(<TokenListBlock />);
    await waitFor(() => expect(mockNotifySettled).toHaveBeenCalledTimes(1));
    expect(mockNotifySettled).toHaveBeenCalledWith(
      expect.objectContaining({
        networkId: 'onekeyall--0',
        homeTotalFiatUsd: '125',
      }),
    );
  });

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
