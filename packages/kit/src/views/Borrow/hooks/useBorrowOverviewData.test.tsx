/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import type {
  IBorrowHealthFactor,
  IBorrowRewards,
} from '@onekeyhq/shared/types/staking';

import { useBorrowOverviewData } from './useBorrowOverviewData';

const mockHealthData = {
  alerts: [{ id: 'old-alert' }],
} as unknown as IBorrowHealthFactor;
const mockRewardsData = { title: { text: 'Old rewards' } } as IBorrowRewards;
const mockRefresh = jest.fn(async () => {});
const mockHealthFactorResult = {
  healthFactorData: mockHealthData,
  isInitialLoading: false,
  isLoading: false,
  isError: false,
  refresh: mockRefresh,
};
const mockRewardsResult = {
  borrowRewards: mockRewardsData,
  isInitialLoading: false,
  isLoading: false,
  isError: false,
  refresh: mockRefresh,
};
const mockContext = {
  reserves: { refresh: mockRefresh },
  market: {
    networkId: 'evm--1',
    provider: 'aave',
    marketAddress: '0xMarket',
  },
  earnAccount: { data: { account: { id: 'account-1' } }, loading: false },
  setRefreshAllBorrowData: jest.fn(),
};

jest.mock('../BorrowProvider', () => ({
  __esModule: true,
  useBorrowContext: () => mockContext,
}));
jest.mock('./useBorrowHealthFactor', () => ({
  __esModule: true,
  useBorrowHealthFactor: () => mockHealthFactorResult,
}));
jest.mock('./useBorrowRewards', () => ({
  __esModule: true,
  useBorrowRewards: () => mockRewardsResult,
}));

describe('useBorrowOverviewData terminal metric errors', () => {
  beforeEach(() => {
    mockHealthFactorResult.isLoading = false;
    mockHealthFactorResult.isError = false;
    mockRewardsResult.isLoading = false;
    mockRewardsResult.isError = false;
  });

  it('keeps values during polling and hides fallback values after failure', () => {
    const { result, rerender } = renderHook(() => useBorrowOverviewData());
    expect(result.current.healthFactorData).toBe(mockHealthData);
    expect(result.current.borrowRewards).toBe(mockRewardsData);

    mockHealthFactorResult.isLoading = true;
    mockRewardsResult.isLoading = true;
    rerender();
    expect(result.current.healthFactorData).toBe(mockHealthData);
    expect(result.current.borrowRewards).toBe(mockRewardsData);
    expect(result.current.isHealthFactorLoading).toBe(false);
    expect(result.current.isRewardsLoading).toBe(false);

    mockHealthFactorResult.isLoading = false;
    mockHealthFactorResult.isError = true;
    mockRewardsResult.isLoading = false;
    mockRewardsResult.isError = true;
    rerender();
    expect(result.current.healthFactorData).toBeNull();
    expect(result.current.borrowRewards).toBeNull();
    expect(result.current.isHealthFactorError).toBe(true);
    expect(result.current.isRewardsError).toBe(true);
  });
});
