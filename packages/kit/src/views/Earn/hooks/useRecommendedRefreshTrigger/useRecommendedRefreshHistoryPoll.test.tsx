/** @jest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';

import { useRecommendedRefreshHistoryPoll } from './useRecommendedRefreshHistoryPoll';

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

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: jest.fn(() => true),
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    usePromiseResult: (method: () => Promise<void>) => {
      React.useEffect(() => {
        void method();
      }, [method]);

      return {
        isLoading: false,
        result: undefined,
        run: jest.fn(),
        setResult: jest.fn(),
      };
    },
  };
});

describe('useRecommendedRefreshHistoryPoll', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('polls scoped history accounts and refreshes when a watched account changes', async () => {
    const scheduleRecommendedRefresh = jest.fn();
    const shouldRefreshByAccounts = jest.fn(() => true);

    mockFetchAccountHistory
      .mockResolvedValueOnce({
        accountsWithChangedTxs: [],
      })
      .mockResolvedValueOnce({
        accountsWithChangedTxs: [
          {
            accountId: 'child-2',
            networkId: 'sol--101',
          },
        ],
      });

    renderHook(() =>
      useRecommendedRefreshHistoryPoll({
        enableFetch: true,
        historyRefreshAccounts: [
          {
            accountId: 'child-1',
            networkId: 'evm--1',
          },
          {
            accountId: 'child-2',
            networkId: 'sol--101',
          },
        ],
        shouldRefreshByAccounts,
        scheduleRecommendedRefresh,
      }),
    );

    await waitFor(() => {
      expect(mockFetchAccountHistory).toHaveBeenNthCalledWith(1, {
        accountId: 'child-1',
        networkId: 'evm--1',
      });
    });

    expect(mockFetchAccountHistory).toHaveBeenNthCalledWith(2, {
      accountId: 'child-2',
      networkId: 'sol--101',
    });
    expect(shouldRefreshByAccounts).toHaveBeenCalledWith([
      {
        accountId: 'child-2',
        networkId: 'sol--101',
      },
    ]);
    expect(scheduleRecommendedRefresh).toHaveBeenCalledWith({
      source: 'app-event',
    });
  });
});
