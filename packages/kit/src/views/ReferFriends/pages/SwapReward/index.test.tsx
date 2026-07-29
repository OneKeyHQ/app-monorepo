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
  type ISwapInvitesParams,
  type ISwapInvitesResponse,
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
const mockSwapDetailsSection = jest.fn();
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
    ScrollView: Passthrough,
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
  ReferFriendsDetailHeader: () => null,
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

const invites: ISwapInvitesResponse = {
  total: 1,
  cursor: null,
  items: [],
};

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
