import type { ReactNode } from 'react';

import { act, render, waitFor } from '@testing-library/react-native';

import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import TokenDetailsHistory from './TokenDetailsHistory';

import type { IProps } from '.';

let mockIsNative = false;
let mockPageFocused = true;
let mockRouteFocused = true;
let mockHistoryListProps: {
  showIcon?: boolean;
  refreshEnabled?: boolean;
  onEndReached?: () => void;
  webScrollHost?: HTMLElement | null;
  onPressHistory?: (tx: IAccountHistoryTx) => void | Promise<void>;
};
let mockPaginationProps: { enabled: boolean; onEndReached?: () => void };
let mockPromiseOptions: {
  overrideIsFocused: (isPageFocused: boolean) => boolean;
};
const mockOwner = {} as HTMLElement;
const mockLoadMore = jest.fn();
const mockResetLoadMore = jest.fn();
const mockUpdateAddressesInfo = jest.fn();
const mockRun = jest.fn();
const mockPushModal = jest.fn();
const mockPush = jest.fn();
const mockMaybeOpenPrivateSendHistoryDetail = jest.fn<
  Promise<boolean>,
  [{ navigation: { pushModal: (...args: unknown[]) => void } }]
>();

jest.mock('react-native', () => ({
  View: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockIsNative;
    },
  },
}));
jest.mock('@onekeyhq/kit/src/components/AppPager/useAppPagerPage', () => ({
  useAppPagerPage: () => ({ isFocused: mockPageFocused, owner: mockOwner }),
}));
jest.mock('@onekeyhq/kit/src/components/AppPager/AppPagerContent', () => ({
  AppPagerContent: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('./TokenDetailsPager', () => ({
  TokenDetailsPaginationObserver: (props: {
    enabled: boolean;
    onEndReached?: () => void;
  }) => {
    mockPaginationProps = props;
    return null;
  },
}));
jest.mock(
  '@onekeyhq/kit/src/views/Home/components/HomeHistoryListView/NativeHistoryList',
  () => ({
    NativeHistoryList: (props: typeof mockHistoryListProps) => {
      mockHistoryListProps = props;
      return null;
    },
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Discovery/pages/Browser/WithBrowserProvider',
  () => ({
    withBrowserProvider: (component: unknown) => component,
  }),
);
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/historyList', () => ({
  withHistoryListProvider: (component: unknown) => component,
  useHistoryListActions: () => ({
    current: { updateAddressesInfo: mockUpdateAddressesInfo },
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockRouteFocused,
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (
    _request: () => Promise<unknown>,
    _deps: unknown[],
    options: typeof mockPromiseOptions,
  ) => {
    mockPromiseOptions = options;
    return { result: undefined, run: mockRun };
  },
}));
jest.mock(
  '@onekeyhq/kit/src/views/Home/pages/hooks/useHistoryListLoadMore',
  () => ({
    useHistoryListLoadMore: () => ({
      appendedTxs: [],
      hasMore: true,
      isLoadingMore: false,
      loadMore: mockLoadMore,
      reset: mockResetLoadMore,
      onFirstPageResponse: jest.fn(),
    }),
  }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Home/pages/hooks/useFrozenTopHistoryData',
  () => ({
    useFrozenTopHistoryData: (history: unknown[]) => ({
      displayedHistoryData: history,
      onAwayFromTopChange: jest.fn(),
    }),
  }),
);
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [
    {
      isFilterScamHistoryEnabled: false,
      isFilterLowValueHistoryEnabled: false,
      currencyInfo: { id: 'usd', symbol: '$' },
    },
  ],
  useCurrencyPersistAtom: () => [{ currencyMap: {} }],
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ push: mockPush, pushModal: mockPushModal }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getAccountAddressForApi: async () => '0xabc',
      getAccountXpub: async () => 'xpub',
    },
  },
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { HistoryTxStatusChanged: 'HistoryTxStatusChanged' },
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: { isAllNetwork: () => false },
}));
jest.mock('@onekeyhq/kit/src/views/Swap/utils/privateSendHistory', () => ({
  maybeOpenPrivateSendHistoryDetail: (params: {
    navigation: { pushModal: (...args: unknown[]) => void };
  }) => mockMaybeOpenPrivateSendHistoryDetail(params),
}));

const props = {
  accountId: 'account',
  networkId: 'eth--1',
  walletId: 'wallet',
  tokenInfo: { address: '0x123', symbol: 'TOK' },
} as IProps;

beforeEach(() => {
  mockIsNative = false;
  mockPageFocused = true;
  mockRouteFocused = true;
  mockLoadMore.mockClear();
  mockResetLoadMore.mockClear();
  mockPushModal.mockClear();
  mockPush.mockClear();
  mockMaybeOpenPrivateSendHistoryDetail.mockReset();
});

it('uses an owned list for standalone details and the pager host for a focused Web tab', () => {
  const { rerender } = render(<TokenDetailsHistory {...props} />);
  expect(mockHistoryListProps).toMatchObject({
    showIcon: false,
    refreshEnabled: false,
    onEndReached: mockLoadMore,
  });
  expect(mockHistoryListProps.webScrollHost).toBeUndefined();
  expect(mockPromiseOptions.overrideIsFocused(true)).toBe(true);

  rerender(<TokenDetailsHistory {...props} isTabView inTabList />);
  expect(mockHistoryListProps.webScrollHost).toBe(mockOwner);
  expect(mockPaginationProps.onEndReached).toBe(mockLoadMore);
  expect(mockPromiseOptions.overrideIsFocused(true)).toBe(true);

  mockPageFocused = false;
  rerender(
    <TokenDetailsHistory
      {...props}
      tokenInfo={{ ...props.tokenInfo }}
      isTabView
      inTabList
    />,
  );
  expect(mockHistoryListProps.webScrollHost).toBeNull();
  expect(mockHistoryListProps.onEndReached).toBeUndefined();
  expect(mockPaginationProps.enabled).toBe(false);
  expect(mockPromiseOptions.overrideIsFocused(true)).toBe(false);
});

it('keeps native pagination on the list and gates tab polling on route focus', () => {
  mockIsNative = true;
  mockRouteFocused = false;
  render(<TokenDetailsHistory {...props} isTabView inTabList />);
  expect(mockHistoryListProps.webScrollHost).toBeUndefined();
  expect(mockHistoryListProps.onEndReached).toBeUndefined();
  expect(mockPromiseOptions.overrideIsFocused(true)).toBe(false);
});

it('drops a delayed private-detail navigation after the tab loses focus', async () => {
  let resolvePrivateDetail: (value: boolean) => void = () => {};
  let guardedPushModal: (...args: unknown[]) => void = () => {};
  mockMaybeOpenPrivateSendHistoryDetail.mockImplementation(
    ({
      navigation,
    }: {
      navigation: { pushModal: (...args: unknown[]) => void };
    }) => {
      guardedPushModal = navigation.pushModal;
      return new Promise<boolean>((resolve) => {
        resolvePrivateDetail = resolve;
      });
    },
  );
  const { rerender } = render(
    <TokenDetailsHistory {...props} isTabView inTabList />,
  );
  const tx = {
    id: 'tx',
    decodedTx: { status: 'Confirmed' },
  } as IAccountHistoryTx;
  let action: void | Promise<void> = undefined;
  act(() => {
    action = mockHistoryListProps.onPressHistory?.(tx);
  });
  await waitFor(() =>
    expect(mockMaybeOpenPrivateSendHistoryDetail).toHaveBeenCalledTimes(1),
  );

  guardedPushModal('private-detail', {});
  expect(mockPushModal).toHaveBeenCalledTimes(1);
  mockPushModal.mockClear();

  mockPageFocused = false;
  rerender(
    <TokenDetailsHistory
      {...props}
      tokenInfo={{ ...props.tokenInfo }}
      isTabView
      inTabList
    />,
  );
  guardedPushModal('private-detail', {});
  expect(mockPushModal).not.toHaveBeenCalled();
  await act(async () => {
    resolvePrivateDetail(true);
    await action;
  });
  expect(mockPush).not.toHaveBeenCalled();
});
