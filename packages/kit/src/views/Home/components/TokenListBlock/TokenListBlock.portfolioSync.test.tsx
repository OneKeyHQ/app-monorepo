/** @jest-environment jsdom */
import { act, render, waitFor } from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type {
  ICustomTokenItem,
  IFetchAccountTokensResp,
} from '@onekeyhq/shared/types/token';

const mockNotifySettled = jest.fn<Promise<void>, unknown[]>(
  async () => undefined,
);
const mockFetchTokens = jest.fn<Promise<IFetchAccountTokensResp>, []>();
const mockNoop = jest.fn();
const mockAsyncNoop = jest.fn(async () => undefined);
const mockCustomTokens: ICustomTokenItem[] = [];
const mockCurrencyMap = {};
let mockEpoch = 0;
const mockAccount = {
  id: 'hw-account-1',
  address: '0x123',
  indexedAccountId: 'hw-indexed-1',
};
const mockIndexedAccount = { id: 'hw-indexed-1', index: 0, name: 'Account #1' };
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
  indexedAccount: mockIndexedAccount,
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
const mockTokenStore = { get: mockNoop };
const mockStructure = {
  ownerKey: 'home-owner',
  generation: 0,
  orderedIds: [],
  smallBalanceIds: [],
  aggMembership: {},
  ownedAggregateTokenListMap: {},
};
let mockHomeDisplay = {
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
  updatePortfolioSyncUiState: mockNoop,
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
jest.mock('@onekeyhq/components', () => ({
  Stack: () => null,
  Skeleton: { HeadingLg: () => null },
  onVisibilityStateChange: () => () => undefined,
  useOnRouterChange: () => undefined,
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
  useAccountOverviewActions: () => ({ current: mockActions }),
  useAccountWorthAtom: () => [
    {
      accountId: mockAccount.id,
      initialized: true,
      currency: 'usd',
      worth: { [`hw-account-1_${mockNetwork.id}`]: '125' },
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
  () => ({}),
);
jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/tokenList/cells/tapTimeHomeMap',
  () => ({ buildTapTimeHomeTokenMap: () => ({}) }),
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
