/**
 * @jest-environment jsdom
 */

import type { ReactNode } from 'react';

import SwapReward from '.';

import { act, render, waitFor } from '@testing-library/react';

import { Toast } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EExportTimeRange,
  type ISwapCumulativeRewardsResponse,
  type ISwapInviteItem,
  type ISwapInvitesParams,
  type ISwapInvitesResponse,
  type ISwapInvitesSortBy,
} from '@onekeyhq/shared/src/referralCode/type';

type ISwapInvitesRequest = ISwapInvitesParams & {
  disableAutoToast?: boolean;
};

const mockGetSwapCumulativeRewards = jest.fn<
  Promise<ISwapCumulativeRewardsResponse>,
  [unknown]
>();
const mockGetSwapInvites = jest.fn<
  Promise<ISwapInvitesResponse>,
  [ISwapInvitesRequest]
>();
const mockScrollView = jest.fn();
const mockSwapDetailsSection = jest.fn();
const mockReferFriendsDetailHeader = jest.fn();
const mockIntl = {
  formatMessage: ({ id }: { id: string }) => id,
};
const mockFilterState = {
  timeRange: EExportTimeRange.All,
  startTime: undefined,
  endTime: undefined,
  inviteCode: undefined,
};
const mockDatePickerValue = {
  start: null,
  end: null,
};
const mockDatePresets: [] = [];
let mockRouteFocused = true;

jest.mock('react-intl', () => ({
  useIntl: () => mockIntl,
}));

jest.mock('@onekeyhq/components', () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => children;
  const Page = ({ children }: { children?: ReactNode }) => children;
  Page.Body = Passthrough;

  return {
    DatePicker: {
      Range: () => null,
    },
    Page,
    RefreshControl: () => null,
    ScrollView: ({
      children,
      ...props
    }: {
      children?: ReactNode;
      onScroll?: (event: unknown) => void;
    }) => {
      mockScrollView(props);
      return children;
    },
    Spinner: () => null,
    Toast: {
      error: jest.fn(),
    },
    XStack: Passthrough,
    YStack: Passthrough,
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceReferralCode: {
      getSwapCumulativeRewards: (...args: [unknown]) =>
        mockGetSwapCumulativeRewards(...args),
      getSwapInvites: (...args: [ISwapInvitesRequest]) =>
        mockGetSwapInvites(...args),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: { children?: ReactNode }) =>
    children,
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockRouteFocused,
}));

jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/hooks/useRedirectWhenNotLoggedIn',
  () => ({
    useRedirectWhenNotLoggedIn: () => undefined,
  }),
);

jest.mock('../../components', () => ({
  ExportButton: () => null,
  FilterButton: () => null,
  ReferFriendsDetailHeader: (props: unknown) => {
    mockReferFriendsDetailHeader(props);
    return null;
  },
  ReferFriendsPageContainer: ({ children }: { children?: ReactNode }) =>
    children,
}));

jest.mock('../../hooks/useDatePresets', () => ({
  useDatePresets: () => mockDatePresets,
}));

jest.mock('../../hooks/useRewardFilter', () => ({
  useRewardFilter: () => ({
    filterState: mockFilterState,
    updateFilter: jest.fn(),
    setCustomDateRange: jest.fn(),
    clearCustomDateRange: jest.fn(),
    datePickerValue: mockDatePickerValue,
  }),
}));

jest.mock('./components/SwapDetailsSection', () => ({
  SwapDetailsSection: (props: unknown) => {
    mockSwapDetailsSection(props);
    return null;
  },
}));

jest.mock('./components/SwapRewardHeader', () => ({
  SwapRewardHeader: () => null,
}));

const cumulativeRewards: ISwapCumulativeRewardsResponse = {
  pendingReward: '1',
  pendingRewardFiatValue: '1',
  undistributedReward: '2',
  undistributedRewardFiatValue: '2',
  totalReward: '3',
  totalRewardFiatValue: '3',
  totalVolume: '10',
  totalVolumeFiatValue: '10',
  totalFee: '1',
  totalFeeFiatValue: '1',
  invitedAddresses: 1,
  walletCount: 1,
  nextDistribution: '2026-08-01',
  token: {
    networkId: 'evm--1',
    address: '0xtoken',
    logoURI: 'https://example.com/token.png',
    name: 'USD Coin',
    symbol: 'USDC',
  },
};

const inviteItem: ISwapInviteItem = {
  _id: 'invitee-id',
  address: '0x12...7890',
  invitationTime: null,
  inviteCode: 'ONEKEY',
  inviteCodeRemark: '',
  firstTradeTime: null,
  volume: '1',
  volumeFiatValue: '1',
  fee: '0.01',
  feeFiatValue: '0.01',
  reward: '0.005',
  rewardFiatValue: '0.005',
  hasUndistributed: true,
  token: cumulativeRewards.token,
};

const invites: ISwapInvitesResponse = {
  total: 1,
  cursor: null,
  items: [inviteItem],
};

function createInvitesResponse(
  id: string,
  cursor: string | null = null,
): ISwapInvitesResponse {
  return {
    total: 1,
    cursor,
    items: [{ ...inviteItem, _id: id }],
  };
}

interface ISwapDetailsSectionTestProps {
  records: ISwapInviteItem[];
  activeTab: 'undistributed' | 'total';
  onTabChange: (tab: 'undistributed' | 'total') => void;
  hideZeroVolume: boolean;
  onHideZeroVolumeChange: (value: boolean) => void;
  onSort: (field: ISwapInvitesSortBy) => void;
  totalCount?: number;
  isTabLoading: boolean;
  isLoadingMore: boolean;
  hasError: boolean;
  onRetry: () => void;
}

interface IScrollViewTestProps {
  onScroll?: (event: {
    nativeEvent: {
      contentOffset: { y: number };
      contentSize: { height: number };
      layoutMeasurement: { height: number };
    };
  }) => void;
}

function getLatestDetailsProps(): ISwapDetailsSectionTestProps {
  const latestCall = mockSwapDetailsSection.mock.calls[
    mockSwapDetailsSection.mock.calls.length - 1
  ] as [ISwapDetailsSectionTestProps] | undefined;
  expect(latestCall).toBeDefined();
  return (latestCall as [ISwapDetailsSectionTestProps])[0];
}

function getLatestScrollViewProps(): IScrollViewTestProps {
  const latestCall = mockScrollView.mock.calls[
    mockScrollView.mock.calls.length - 1
  ] as [IScrollViewTestProps] | undefined;
  expect(latestCall).toBeDefined();
  return (latestCall as [IScrollViewTestProps])[0];
}

function scrollToBottom() {
  getLatestScrollViewProps().onScroll?.({
    nativeEvent: {
      contentOffset: { y: 900 },
      contentSize: { height: 1000 },
      layoutMeasurement: { height: 200 },
    },
  });
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function completeInitialLoad() {
  await waitFor(() => {
    expect(mockGetSwapCumulativeRewards).toHaveBeenCalledTimes(1);
    expect(mockGetSwapInvites).toHaveBeenCalledTimes(2);
    expect(mockSwapDetailsSection).toHaveBeenCalled();
  });
}

describe('SwapReward refresh feedback', () => {
  const toastErrorMock = jest.mocked(Toast.error);

  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteFocused = true;
  });

  it('uses the Swap product name in the reward page title', async () => {
    mockGetSwapCumulativeRewards.mockResolvedValue(cumulativeRewards);
    mockGetSwapInvites.mockResolvedValue(invites);

    render(<SwapReward />);
    await completeInitialLoad();

    expect(mockReferFriendsDetailHeader).toHaveBeenCalledWith(
      expect.objectContaining({
        title: ETranslations.swap_referral_link__title,
      }),
    );
  });

  it('refreshes only the current list when sorting', async () => {
    mockGetSwapCumulativeRewards.mockResolvedValue(cumulativeRewards);
    mockGetSwapInvites.mockResolvedValue(invites);

    render(<SwapReward />);
    await completeInitialLoad();

    const sortRefresh = createDeferred<ISwapInvitesResponse>();
    const sortedInvites = createInvitesResponse('sorted-invitee', 'next-page');
    mockGetSwapInvites.mockReturnValueOnce(sortRefresh.promise);

    act(() => {
      getLatestDetailsProps().onSort('fee');
    });

    await waitFor(() => {
      expect(mockGetSwapInvites).toHaveBeenCalledTimes(3);
    });
    expect(mockGetSwapCumulativeRewards).toHaveBeenCalledTimes(1);
    expect(mockGetSwapInvites).toHaveBeenLastCalledWith(
      expect.objectContaining({
        tab: 'undistributed',
        sortBy: 'fee',
        sortOrder: 'desc',
        limit: 20,
        disableAutoToast: true,
      }),
    );
    expect(getLatestDetailsProps()).toEqual(
      expect.objectContaining({
        records: invites.items,
        isTabLoading: true,
      }),
    );

    await act(async () => {
      sortRefresh.resolve(sortedInvites);
      await sortRefresh.promise;
    });

    await waitFor(() => {
      expect(getLatestDetailsProps()).toEqual(
        expect.objectContaining({
          records: sortedInvites.items,
          isTabLoading: false,
        }),
      );
    });
  });

  it('keeps only the latest list response when sorting rapidly', async () => {
    mockGetSwapCumulativeRewards.mockResolvedValue(cumulativeRewards);
    mockGetSwapInvites.mockResolvedValue(invites);

    render(<SwapReward />);
    await completeInitialLoad();

    const feeRefresh = createDeferred<ISwapInvitesResponse>();
    const rewardRefresh = createDeferred<ISwapInvitesResponse>();
    const feeInvites = createInvitesResponse('fee-invitee');
    const rewardInvites = createInvitesResponse('reward-invitee');
    mockGetSwapInvites
      .mockReturnValueOnce(feeRefresh.promise)
      .mockReturnValueOnce(rewardRefresh.promise);

    act(() => {
      getLatestDetailsProps().onSort('fee');
    });
    await waitFor(() => {
      expect(mockGetSwapInvites).toHaveBeenCalledTimes(3);
    });

    act(() => {
      getLatestDetailsProps().onSort('reward');
    });
    await waitFor(() => {
      expect(mockGetSwapInvites).toHaveBeenCalledTimes(4);
    });

    await act(async () => {
      rewardRefresh.resolve(rewardInvites);
      await rewardRefresh.promise;
    });
    await waitFor(() => {
      expect(getLatestDetailsProps().records).toEqual(rewardInvites.items);
    });

    await act(async () => {
      feeRefresh.resolve(feeInvites);
      await feeRefresh.promise;
    });

    expect(getLatestDetailsProps().records).toEqual(rewardInvites.items);
    expect(mockGetSwapCumulativeRewards).toHaveBeenCalledTimes(1);
  });

  it('refreshes only the current list for tab and inactive filters', async () => {
    mockGetSwapCumulativeRewards.mockResolvedValue(cumulativeRewards);
    mockGetSwapInvites.mockResolvedValue(invites);

    render(<SwapReward />);
    await completeInitialLoad();

    act(() => {
      getLatestDetailsProps().onTabChange('total');
    });
    await waitFor(() => {
      expect(mockGetSwapInvites).toHaveBeenCalledTimes(3);
    });
    expect(mockGetSwapInvites).toHaveBeenLastCalledWith(
      expect.objectContaining({
        tab: 'total',
        hideZeroVolume: true,
        limit: 20,
      }),
    );

    act(() => {
      getLatestDetailsProps().onHideZeroVolumeChange(false);
    });
    await waitFor(() => {
      expect(mockGetSwapInvites).toHaveBeenCalledTimes(4);
    });
    expect(mockGetSwapInvites).toHaveBeenLastCalledWith(
      expect.objectContaining({
        tab: 'total',
        hideZeroVolume: false,
        limit: 20,
      }),
    );
    expect(mockGetSwapCumulativeRewards).toHaveBeenCalledTimes(1);
  });

  it('shows an error instead of previous tab rows when a tab refresh fails', async () => {
    mockGetSwapCumulativeRewards.mockResolvedValue(cumulativeRewards);
    mockGetSwapInvites.mockResolvedValue(invites);

    render(<SwapReward />);
    await completeInitialLoad();

    const tabRefresh = createDeferred<ISwapInvitesResponse>();
    mockGetSwapInvites.mockReturnValueOnce(tabRefresh.promise);

    act(() => {
      getLatestDetailsProps().onTabChange('total');
    });

    await waitFor(() => {
      expect(mockGetSwapInvites).toHaveBeenCalledTimes(3);
    });
    expect(getLatestDetailsProps()).toEqual(
      expect.objectContaining({
        activeTab: 'total',
        hasError: false,
        isTabLoading: true,
        records: invites.items,
      }),
    );

    await act(async () => {
      tabRefresh.reject(new Error('Tab refresh failed'));
      await Promise.allSettled([tabRefresh.promise]);
    });

    await waitFor(() => {
      expect(getLatestDetailsProps()).toEqual(
        expect.objectContaining({
          activeTab: 'total',
          hasError: true,
          isTabLoading: false,
        }),
      );
    });
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('does not reuse previous tab rows when a full refresh supersedes the tab request', async () => {
    mockGetSwapCumulativeRewards.mockResolvedValue(cumulativeRewards);
    mockGetSwapInvites.mockResolvedValue(invites);

    const view = render(<SwapReward />);
    await completeInitialLoad();

    const tabRefresh = createDeferred<ISwapInvitesResponse>();
    mockGetSwapInvites.mockReturnValueOnce(tabRefresh.promise);
    act(() => {
      getLatestDetailsProps().onTabChange('total');
    });
    await waitFor(() => {
      expect(mockGetSwapInvites).toHaveBeenCalledTimes(3);
    });

    mockGetSwapInvites
      .mockRejectedValueOnce(new Error('Full list refresh failed'))
      .mockResolvedValueOnce(invites);
    act(() => {
      mockRouteFocused = false;
      view.rerender(<SwapReward />);
    });
    act(() => {
      mockRouteFocused = true;
      view.rerender(<SwapReward />);
    });

    await waitFor(() => {
      expect(getLatestDetailsProps()).toEqual(
        expect.objectContaining({
          activeTab: 'total',
          hasError: true,
          isTabLoading: false,
        }),
      );
    });
    expect(toastErrorMock).not.toHaveBeenCalled();

    await act(async () => {
      tabRefresh.resolve(createInvitesResponse('stale-total-invitee'));
      await tabRefresh.promise;
    });
    expect(getLatestDetailsProps().hasError).toBe(true);
  });

  it('shows an error instead of rows from a previous inactive filter', async () => {
    const totalInvites = createInvitesResponse('total-invitee');
    mockGetSwapCumulativeRewards.mockResolvedValue(cumulativeRewards);
    mockGetSwapInvites.mockResolvedValue(invites);

    render(<SwapReward />);
    await completeInitialLoad();

    mockGetSwapInvites.mockResolvedValueOnce(totalInvites);
    act(() => {
      getLatestDetailsProps().onTabChange('total');
    });
    await waitFor(() => {
      expect(getLatestDetailsProps().records).toEqual(totalInvites.items);
    });

    mockGetSwapInvites.mockRejectedValueOnce(
      new Error('Inactive filter refresh failed'),
    );
    act(() => {
      getLatestDetailsProps().onHideZeroVolumeChange(false);
    });

    await waitFor(() => {
      expect(getLatestDetailsProps()).toEqual(
        expect.objectContaining({
          activeTab: 'total',
          hasError: true,
          isTabLoading: false,
        }),
      );
    });
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it('retries only the current list after a list-control failure', async () => {
    mockGetSwapCumulativeRewards.mockResolvedValue(cumulativeRewards);
    mockGetSwapInvites.mockResolvedValue(invites);

    render(<SwapReward />);
    await completeInitialLoad();

    mockGetSwapInvites.mockRejectedValueOnce(new Error('Sort failed'));
    act(() => {
      getLatestDetailsProps().onSort('fee');
    });
    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: ETranslations.global_failed,
        }),
      );
    });
    expect(getLatestDetailsProps().hasError).toBe(false);

    const retryInvites = createInvitesResponse('retry-invitee');
    mockGetSwapInvites.mockResolvedValueOnce(retryInvites);
    act(() => {
      getLatestDetailsProps().onRetry();
    });

    await waitFor(() => {
      expect(getLatestDetailsProps()).toEqual(
        expect.objectContaining({
          hasError: false,
          records: retryInvites.items,
        }),
      );
    });
    expect(mockGetSwapCumulativeRewards).toHaveBeenCalledTimes(1);
    expect(mockGetSwapInvites).toHaveBeenCalledTimes(4);
  });

  it('keeps the previous rows visible when a list-only refresh fails', async () => {
    mockGetSwapCumulativeRewards.mockResolvedValue(cumulativeRewards);
    mockGetSwapInvites.mockResolvedValue(invites);

    render(<SwapReward />);
    await completeInitialLoad();

    mockGetSwapInvites.mockRejectedValueOnce(new Error('Sort failed'));
    act(() => {
      getLatestDetailsProps().onSort('fee');
    });

    await waitFor(() => {
      expect(mockGetSwapInvites).toHaveBeenCalledTimes(3);
    });

    expect(getLatestDetailsProps()).toEqual(
      expect.objectContaining({
        hasError: false,
        isTabLoading: false,
        records: invites.items,
      }),
    );
    expect(toastErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: ETranslations.global_failed,
      }),
    );
  });

  it('keeps pagination aligned with displayed rows after a sort failure', async () => {
    const initialInvites = createInvitesResponse('initial-invitee', 'cursor-1');
    const nextPage = createInvitesResponse('next-invitee');
    mockGetSwapCumulativeRewards.mockResolvedValue(cumulativeRewards);
    mockGetSwapInvites.mockResolvedValue(initialInvites);

    render(<SwapReward />);
    await completeInitialLoad();

    const sortRefresh = createDeferred<ISwapInvitesResponse>();
    mockGetSwapInvites.mockReturnValueOnce(sortRefresh.promise);
    act(() => {
      getLatestDetailsProps().onSort('fee');
    });
    await waitFor(() => {
      expect(mockGetSwapInvites).toHaveBeenCalledTimes(3);
    });

    act(() => {
      scrollToBottom();
    });
    expect(mockGetSwapInvites).toHaveBeenCalledTimes(3);

    await act(async () => {
      sortRefresh.reject(new Error('Sort failed'));
      await Promise.allSettled([sortRefresh.promise]);
    });
    await waitFor(() => {
      expect(getLatestDetailsProps().isTabLoading).toBe(false);
    });

    mockGetSwapInvites.mockResolvedValueOnce(nextPage);
    act(() => {
      scrollToBottom();
    });

    await waitFor(() => {
      expect(mockGetSwapInvites).toHaveBeenCalledTimes(4);
    });
    expect(mockGetSwapInvites).toHaveBeenLastCalledWith(
      expect.objectContaining({
        cursor: 'cursor-1',
        sortBy: 'volume',
        sortOrder: 'desc',
      }),
    );
    await waitFor(() => {
      expect(getLatestDetailsProps().records).toEqual([
        ...initialInvites.items,
        ...nextPage.items,
      ]);
    });
  });

  it('does not let a stale page request unlock a newer request with the same cursor', async () => {
    const initialInvites = createInvitesResponse(
      'initial-invitee',
      'shared-cursor',
    );
    const sortedInvites = createInvitesResponse(
      'sorted-invitee',
      'shared-cursor',
    );
    const nextPage = createInvitesResponse('next-page-invitee');
    const stalePage = createDeferred<ISwapInvitesResponse>();
    const currentPage = createDeferred<ISwapInvitesResponse>();
    mockGetSwapCumulativeRewards.mockResolvedValue(cumulativeRewards);
    mockGetSwapInvites.mockResolvedValue(initialInvites);

    render(<SwapReward />);
    await completeInitialLoad();

    mockGetSwapInvites.mockReturnValueOnce(stalePage.promise);
    act(() => {
      scrollToBottom();
    });
    await waitFor(() => {
      expect(mockGetSwapInvites).toHaveBeenCalledTimes(3);
      expect(getLatestDetailsProps().isLoadingMore).toBe(true);
    });

    mockGetSwapInvites.mockResolvedValueOnce(sortedInvites);
    act(() => {
      getLatestDetailsProps().onSort('fee');
    });
    await waitFor(() => {
      expect(mockGetSwapInvites).toHaveBeenCalledTimes(4);
      expect(getLatestDetailsProps()).toEqual(
        expect.objectContaining({
          records: sortedInvites.items,
          isLoadingMore: false,
          isTabLoading: false,
        }),
      );
    });

    mockGetSwapInvites.mockReturnValueOnce(currentPage.promise);
    act(() => {
      scrollToBottom();
    });
    await waitFor(() => {
      expect(mockGetSwapInvites).toHaveBeenCalledTimes(5);
      expect(getLatestDetailsProps().isLoadingMore).toBe(true);
    });

    await act(async () => {
      stalePage.resolve(createInvitesResponse('stale-page-invitee'));
      await stalePage.promise;
    });

    expect(getLatestDetailsProps().isLoadingMore).toBe(true);
    act(() => {
      scrollToBottom();
    });
    expect(mockGetSwapInvites).toHaveBeenCalledTimes(5);

    await act(async () => {
      currentPage.resolve(nextPage);
      await currentPage.promise;
    });
    await waitFor(() => {
      expect(getLatestDetailsProps()).toEqual(
        expect.objectContaining({
          records: [...sortedInvites.items, ...nextPage.items],
          isLoadingMore: false,
        }),
      );
    });
  });

  it('does not let an older full refresh overwrite a newer list filter', async () => {
    mockGetSwapCumulativeRewards.mockResolvedValue(cumulativeRewards);
    mockGetSwapInvites.mockResolvedValue(invites);

    const view = render(<SwapReward />);
    await completeInitialLoad();

    act(() => {
      getLatestDetailsProps().onTabChange('total');
    });
    await waitFor(() => {
      expect(mockGetSwapInvites).toHaveBeenCalledTimes(3);
    });

    const cumulativeRefresh = createDeferred<ISwapCumulativeRewardsResponse>();
    const fullListRefresh = createDeferred<ISwapInvitesResponse>();
    const inactiveCountRefresh = createDeferred<ISwapInvitesResponse>();
    const filteredInvites = {
      ...createInvitesResponse('filtered-invitee'),
      total: 7,
    };
    mockGetSwapCumulativeRewards.mockReturnValueOnce(cumulativeRefresh.promise);
    mockGetSwapInvites
      .mockReturnValueOnce(fullListRefresh.promise)
      .mockReturnValueOnce(inactiveCountRefresh.promise)
      .mockResolvedValueOnce(filteredInvites);

    act(() => {
      mockRouteFocused = false;
      view.rerender(<SwapReward />);
    });
    act(() => {
      mockRouteFocused = true;
      view.rerender(<SwapReward />);
    });
    await waitFor(() => {
      expect(mockGetSwapInvites).toHaveBeenCalledTimes(5);
    });

    act(() => {
      getLatestDetailsProps().onHideZeroVolumeChange(false);
    });
    await waitFor(() => {
      expect(getLatestDetailsProps()).toEqual(
        expect.objectContaining({
          records: filteredInvites.items,
          totalCount: 7,
        }),
      );
    });

    await act(async () => {
      cumulativeRefresh.resolve(cumulativeRewards);
      fullListRefresh.resolve({
        ...createInvitesResponse('old-full-invitee'),
        total: 2,
      });
      inactiveCountRefresh.resolve({ ...invites, total: 3 });
      await Promise.all([
        cumulativeRefresh.promise,
        fullListRefresh.promise,
        inactiveCountRefresh.promise,
      ]);
    });

    expect(getLatestDetailsProps()).toEqual(
      expect.objectContaining({
        records: filteredInvites.items,
        totalCount: 7,
      }),
    );
  });

  it('shows one error toast when the inactive tab count refresh fails', async () => {
    let inactiveCountCalls = 0;
    mockGetSwapCumulativeRewards
      .mockResolvedValueOnce(cumulativeRewards)
      .mockResolvedValueOnce(cumulativeRewards);
    mockGetSwapInvites.mockImplementation((params) => {
      if (params.limit === 1) {
        inactiveCountCalls += 1;
        if (inactiveCountCalls === 2) {
          return Promise.reject(new Error('Inactive count failed'));
        }
      }
      return Promise.resolve(invites);
    });

    const view = render(<SwapReward />);
    await completeInitialLoad();

    act(() => {
      mockRouteFocused = false;
      view.rerender(<SwapReward />);
    });
    act(() => {
      mockRouteFocused = true;
      view.rerender(<SwapReward />);
    });

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
      expect(toastErrorMock).toHaveBeenCalledWith({
        title: ETranslations.global_failed,
      });
    });
    expect(inactiveCountCalls).toBe(2);
    expect(mockGetSwapInvites).toHaveBeenCalledWith(
      expect.objectContaining({
        tab: 'total',
        limit: 1,
        disableAutoToast: true,
      }),
    );
  });

  it('shows a refresh error after an initial load displays only the overview', async () => {
    let listCalls = 0;
    mockGetSwapCumulativeRewards
      .mockResolvedValueOnce(cumulativeRewards)
      .mockRejectedValueOnce(new Error('Cumulative rewards failed'));
    mockGetSwapInvites.mockImplementation((params) => {
      if (params.limit === 1) {
        return Promise.resolve(invites);
      }
      listCalls += 1;
      return listCalls === 1
        ? Promise.reject(new Error('Invite list failed'))
        : Promise.resolve(invites);
    });

    const view = render(<SwapReward />);
    await waitFor(() => {
      expect(mockSwapDetailsSection).toHaveBeenLastCalledWith(
        expect.objectContaining({ hasError: true }),
      );
    });
    expect(toastErrorMock).not.toHaveBeenCalled();

    act(() => {
      mockRouteFocused = false;
      view.rerender(<SwapReward />);
    });
    act(() => {
      mockRouteFocused = true;
      view.rerender(<SwapReward />);
    });

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledTimes(1);
      expect(toastErrorMock).toHaveBeenCalledWith({
        title: ETranslations.global_failed,
      });
    });
  });

  it('does not show a refresh error after the route loses focus', async () => {
    const cumulativeRefresh = createDeferred<ISwapCumulativeRewardsResponse>();
    const listRefresh = createDeferred<ISwapInvitesResponse>();
    const inactiveCountRefresh = createDeferred<ISwapInvitesResponse>();
    let listCalls = 0;
    let inactiveCountCalls = 0;

    mockGetSwapCumulativeRewards
      .mockResolvedValueOnce(cumulativeRewards)
      .mockReturnValueOnce(cumulativeRefresh.promise);
    mockGetSwapInvites.mockImplementation((params) => {
      if (params.limit === 1) {
        inactiveCountCalls += 1;
        return inactiveCountCalls === 1
          ? Promise.resolve(invites)
          : inactiveCountRefresh.promise;
      }
      listCalls += 1;
      return listCalls === 1 ? Promise.resolve(invites) : listRefresh.promise;
    });

    const view = render(<SwapReward />);
    await completeInitialLoad();

    act(() => {
      mockRouteFocused = false;
      view.rerender(<SwapReward />);
    });
    act(() => {
      mockRouteFocused = true;
      view.rerender(<SwapReward />);
    });
    await waitFor(() => {
      expect(mockGetSwapCumulativeRewards).toHaveBeenCalledTimes(2);
      expect(mockGetSwapInvites).toHaveBeenCalledTimes(4);
    });

    act(() => {
      mockRouteFocused = false;
      view.rerender(<SwapReward />);
    });

    await act(async () => {
      const error = new Error('Refresh failed');
      cumulativeRefresh.reject(error);
      listRefresh.reject(error);
      inactiveCountRefresh.reject(error);
      await Promise.allSettled([
        cumulativeRefresh.promise,
        listRefresh.promise,
        inactiveCountRefresh.promise,
      ]);
    });

    expect(toastErrorMock).not.toHaveBeenCalled();
  });
});
