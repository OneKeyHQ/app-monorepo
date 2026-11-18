/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

const mockHistoryProps: Array<{ tableLayout?: boolean }> = [];
let mockGtMd = false;

jest.mock('@onekeyhq/components', () => ({
  onVisibilityStateChange: () => () => {},
  useMedia: () => ({ gtMd: mockGtMd }),
  useScrollContentTabBarOffset: () => 0,
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
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
      network: undefined,
      wallet: undefined,
      deriveInfoItems: [],
      vaultSettings: undefined,
      indexedAccount: undefined,
    },
  }),
}));
jest.mock('../../../states/jotai/contexts/historyList', () => ({
  ProviderJotaiContextHistoryList: ({ children }: { children: ReactNode }) =>
    children,
  useHistoryListActions: () => ({
    current: {
      updateSearchKey: () => {},
      updateAddressesInfo: () => {},
      initAddressesInfoDataFromStorage: async () => {},
    },
  }),
}));
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

import { render } from '@testing-library/react';

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
});
