/** @jest-environment jsdom */
/* eslint-disable import/first */

import { act, renderHook } from '@testing-library/react';

const mockGetEarnReward = jest.fn();
const mockGetPositions = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceReferralCode: {
      getEarnReward: (...args: unknown[]) => mockGetEarnReward(...args),
      getPositions: (...args: unknown[]) => mockGetPositions(...args),
    },
  },
}));

jest.mock('../components/RewardAccountList', () => ({
  EARN_VAULT_KEY_SEPARATOR: '|',
}));

import { useEarnRewards } from './useEarnRewards';

import type { IFilterState } from '@onekeyhq/kit/src/views/ReferFriends/components/FilterButton';

const filterState = {} as IFilterState;

const rewardItem = {
  accountAddress: '0xabc',
  fiatValue: '3',
  items: [{ networkId: 'evm--1' }],
};

async function flush() {
  // Let the reward and positions requests settle, then the 80ms overlay delay.
  await act(async () => {
    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }
  });
  await act(async () => {
    jest.advanceTimersByTime(100);
  });
}

describe('useEarnRewards', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockGetEarnReward.mockReset();
    mockGetPositions.mockReset();
    mockGetEarnReward.mockResolvedValue({
      fiatValue: '3',
      items: [rewardItem],
      total: 1,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps the reward records and stops loading when positions fail', async () => {
    mockGetPositions.mockRejectedValue(new Error('timeout'));
    const { result } = renderHook(() => useEarnRewards(filterState));
    expect(result.current.isLoading).toBe(true);

    await flush();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.lists).toEqual([[rewardItem], [rewardItem]]);
    expect(result.current.amountPending).toBe('3');
    expect(result.current.vaultAmount).toBeUndefined();
  });

  it('maps deposited amounts when positions load', async () => {
    mockGetPositions.mockResolvedValue({
      list: [{ accountAddress: '0xabc', key: 'evm--1|0xVAULT', deposited: '7' }],
    });
    const { result } = renderHook(() => useEarnRewards(filterState));

    await flush();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.vaultAmount).toEqual({
      '0xabc': { 'evm--1|0xvault': '7' },
    });
  });

  it('skips the positions request when there are no reward accounts', async () => {
    mockGetEarnReward.mockResolvedValue({ fiatValue: '0', items: [], total: 0 });
    const { result } = renderHook(() => useEarnRewards(filterState));

    await flush();

    expect(mockGetPositions).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.lists).toEqual([[], []]);
  });
});
