/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

import { useRecommendedRefreshSwapEvents } from './useRecommendedRefreshSwapEvents';

type IFetchAccountHistory = (params: {
  accountId: string;
  networkId: string;
}) => Promise<{
  accountsWithChangedTxs: {
    accountId: string;
    networkId: string;
  }[];
}>;

const mockFetchAccountHistory: jest.MockedFunction<IFetchAccountHistory> =
  jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHistory: {
      fetchAccountHistory: (params: { accountId: string; networkId: string }) =>
        mockFetchAccountHistory(params),
    },
  },
}));

describe('useRecommendedRefreshSwapEvents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stays idle until swap success arrives, then waits for history sync before refreshing', async () => {
    const scheduleRecommendedRefresh = jest.fn();
    const shouldRefreshByAccounts = jest.fn(() => true);

    mockFetchAccountHistory.mockResolvedValue({
      accountsWithChangedTxs: [
        {
          accountId: 'hd-1',
          networkId: 'onekeyall',
        },
      ],
    });

    renderHook(() =>
      useRecommendedRefreshSwapEvents({
        enableFetch: true,
        historyRefreshAccounts: [
          {
            accountId: 'hd-1',
            networkId: 'onekeyall',
          },
        ],
        shouldRefreshByAccounts,
        scheduleRecommendedRefresh,
      }),
    );

    expect(mockFetchAccountHistory).not.toHaveBeenCalled();

    act(() => {
      appEventBus.emit(EAppEventBusNames.SwapTxHistoryStatusUpdate, {
        status: ESwapTxHistoryStatus.SUCCESS,
      });
    });

    expect(mockFetchAccountHistory).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(5000);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockFetchAccountHistory).toHaveBeenCalledWith({
        accountId: 'hd-1',
        networkId: 'onekeyall',
      });
    });

    expect(shouldRefreshByAccounts).toHaveBeenCalledWith([
      {
        accountId: 'hd-1',
        networkId: 'onekeyall',
      },
    ]);
    expect(scheduleRecommendedRefresh).toHaveBeenCalledWith({
      source: 'app-event',
    });
  });
});
