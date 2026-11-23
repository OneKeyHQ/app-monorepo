/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

const mockHistoryProps: Array<{ tableLayout?: boolean }> = [];
let mockGtMd = false;
let mockMergeDerive = false;
const mockCallHistoryBackground = jest.fn<
  Promise<unknown[]>,
  [string, ...unknown[]]
>(async () => []);
const mockGetNetworkAccounts = jest.fn(async () => ({ networkAccounts: [] }));

jest.mock('@onekeyhq/components', () => ({
  onVisibilityStateChange: () => () => {},
  useMedia: () => ({ gtMd: mockGtMd }),
  useScrollContentTabBarOffset: () => 0,
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const { BackgroundServiceProxyBase } = jest.requireActual<
    typeof import('@onekeyhq/kit-bg/src/apis/BackgroundServiceProxyBase')
  >('@onekeyhq/kit-bg/src/apis/BackgroundServiceProxyBase');
  const proxy = new (class extends BackgroundServiceProxyBase {
    serviceNameSpace = '';

    callBackground(method: string, ...args: unknown[]) {
      return mockCallHistoryBackground(method, ...args);
    }
  })();
  return {
    __esModule: true,
    default: {
      serviceHistory: proxy._createProxyService('serviceHistory'),
      serviceAccount: {
        getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes: () =>
          mockGetNetworkAccounts(),
      },
    },
  };
});
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useCurrencyPersistAtom: () => [{ currencyMap: {} }],
  useSettingsPersistAtom: () => [
    {
      currencyInfo: { id: 'usd', symbol: '$' },
      isFilterScamHistoryEnabled: false,
      isFilterLowValueHistoryEnabled: false,
    },
  ],
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    HistoryTxStatusChanged: 'HistoryTxStatusChanged',
    ClearLocalHistoryPendingTxs: 'ClearLocalHistoryPendingTxs',
    AccountDataUpdate: 'AccountDataUpdate',
    NetworkDeriveTypeChanged: 'NetworkDeriveTypeChanged',
    RefreshHistoryList: 'RefreshHistoryList',
  },
  appEventBus: { on: () => {}, off: () => {}, emit: () => {} },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: { isOthersWallet: () => false },
}));
jest.mock('../../../components/NotificationEnableAlert', () => ({
  NotificationEnableAlert: () => null,
}));
jest.mock('../../../hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: () => {} }),
}));
jest.mock('../../../hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ run: () => {} }),
}));
jest.mock('../../../hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => false,
}));
jest.mock('../../../hooks/useRunAfterTokensDone', () => ({
  getTokensTabLastState: () => undefined,
  runAfterTokensDone: () => () => {},
}));
jest.mock('../../../states/jotai/contexts/accountOverview', () => ({
  useAccountOverviewActions: () => ({
    current: { updateAllNetworksState: () => {} },
  }),
}));
jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      account: undefined,
      network: mockMergeDerive ? { id: 'btc--0' } : undefined,
      wallet: mockMergeDerive ? { id: 'hd-1' } : undefined,
      deriveInfoItems: mockMergeDerive ? [{}, {}] : [],
      vaultSettings: mockMergeDerive
        ? { mergeDeriveAssetsEnabled: true }
        : undefined,
      indexedAccount: mockMergeDerive ? { id: 'indexed-1' } : undefined,
    },
  }),
}));
jest.mock('../../../states/jotai/contexts/historyList', () => {
  const actions = {
    current: {
      updateSearchKey: () => {},
      updateAddressesInfo: () => {},
      initAddressesInfoDataFromStorage: async () => {},
    },
  };
  return {
    ProviderJotaiContextHistoryList: ({ children }: { children: ReactNode }) =>
      children,
    useHistoryListActions: () => actions,
  };
});
jest.mock('../../../states/jotai/contexts/tokenList/cells', () => ({
  useHomeTokenListSnapshot: () => ({ map: {} }),
}));
jest.mock('../../Swap/utils/privateSendHistory', () => ({
  maybeOpenPrivateSendHistoryDetail: async () => false,
}));
jest.mock('../components/HomeHistoryListView', () => {
  return {
    HomeHistoryListView: (props: (typeof mockHistoryProps)[number]) => {
      mockHistoryProps.push(props);
      return null;
    },
  };
});
jest.mock('../components/HomeTokenListProvider', () => ({
  HomeTokenListProviderMirrorWrapper: ({ children }: { children: ReactNode }) =>
    children,
}));
jest.mock('../components/PullToRefresh', () => ({
  onHomePageRefresh: () => {},
}));
jest.mock('../hooks/useHomeTab', () => ({
  useTabIsRefreshingFocused: () => ({
    isFocused: false,
    isHeaderRefreshing: false,
    setIsHeaderRefreshing: () => {},
  }),
}));
jest.mock('./historyTokenRefreshGate', () => ({
  buildTokenRefreshPlanAfterHistory: () => ({ accounts: [] }),
}));
jest.mock('./hooks/useFrozenTopHistoryData', () => ({
  useFrozenTopHistoryData: (data: unknown[]) => ({
    displayedHistoryData: data,
    onAwayFromTopChange: () => {},
  }),
}));
jest.mock('./hooks/useHistoryListLoadMore', () => ({
  useHistoryListLoadMore: () => ({
    appendedTxs: [],
    hasMore: false,
    isLoadingMore: false,
    loadMore: () => {},
    reset: () => {},
    onFirstPageResponse: () => {},
  }),
}));

import { render, waitFor } from '@testing-library/react';

import { HISTORY_PAGE_SIZE } from '@onekeyhq/shared/src/consts/walletConsts';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  TxHistoryListContainer,
  TxHistoryListContainerWithProvider,
} from './TxHistoryContainer';

describe('Home history list width', () => {
  beforeEach(() => {
    mockHistoryProps.length = 0;
    Object.assign(platformEnv, { isNative: true });
    mockGtMd = false;
    mockMergeDerive = false;
    mockCallHistoryBackground.mockClear();
    mockGetNetworkAccounts.mockClear();
  });

  it('lets the native list resolve its width', () => {
    render(<TxHistoryListContainerWithProvider />);
    expect(mockHistoryProps.at(-1)?.tableLayout).toBeUndefined();
  });

  it('preserves an explicit compact layout for the recent history sidebar', () => {
    render(<TxHistoryListContainer plainMode tableLayout={false} limit={5} />);
    expect(mockHistoryProps.at(-1)?.tableLayout).toBe(false);
  });

  it('keeps media layout on web and honors an explicit compact layout', () => {
    Object.assign(platformEnv, { isNative: false });
    mockGtMd = true;
    const { rerender } = render(<TxHistoryListContainer />);
    expect(mockHistoryProps.at(-1)?.tableLayout).toBe(true);
    rerender(<TxHistoryListContainer tableLayout={false} />);
    expect(mockHistoryProps.at(-1)?.tableLayout).toBe(false);
  });

  it('loads merged derive history through a single paginated background call', async () => {
    mockMergeDerive = true;
    render(<TxHistoryListContainer />);

    await waitFor(() =>
      expect(mockCallHistoryBackground).toHaveBeenCalledWith(
        'serviceHistory.getAccountsLocalHistoryTxsForMergeDerive',
        expect.objectContaining({
          indexedAccountId: 'indexed-1',
          networkId: 'btc--0',
          limit: HISTORY_PAGE_SIZE,
          sourceCurrency: 'usd',
        }),
      ),
    );
    expect(mockCallHistoryBackground).toHaveBeenCalledTimes(1);
    expect(mockGetNetworkAccounts).not.toHaveBeenCalled();
  });
});
