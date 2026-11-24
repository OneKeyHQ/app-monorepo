/** @jest-environment jsdom */
/* eslint-disable import/first */

import { act, renderHook } from '@testing-library/react';

const mockGetEarnReward = jest.fn<Promise<unknown>, unknown[]>();
const mockGetPositions = jest.fn<Promise<unknown>, unknown[]>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceReferralCode: {
      getEarnReward: (...args: unknown[]) => mockGetEarnReward(...args),
      getPositions: (...args: unknown[]) => mockGetPositions(...args),
    },
  },
}));

// Runs the fetcher whenever its deps change and reports loading around it,
// which is all this hook relies on.
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (
    fn: () => Promise<unknown>,
    deps: unknown[],
    options?: { watchLoading?: boolean },
  ) => {
    const React = jest.requireActual<typeof import('react')>('react');
    // oxlint-disable-next-line react-hooks/rules-of-hooks
    const [state, setState] = React.useState<{
      result?: unknown;
      isLoading?: boolean;
    }>({});
    // The deps are the caller's, as in the real hook.
    // oxlint-disable-next-line react-hooks/rules-of-hooks, react-hooks/exhaustive-deps
    React.useEffect(() => {
      let alive = true;
      if (options?.watchLoading) {
        setState((prev) => ({ ...prev, isLoading: true }));
      }
      void fn().then((result) => {
        if (alive) {
          setState({ result, isLoading: false });
        }
      });
      return () => {
        alive = false;
      };
      // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, deps);
    return { ...state, run: jest.fn() };
  },
}));

// The real module pulls in the UI kit; only its separator is needed here.
jest.mock('../components/RewardAccountList', () => ({
  EARN_VAULT_KEY_SEPARATOR: '__',
}));

import type { IFilterState } from '@onekeyhq/kit/src/views/ReferFriends/components/FilterButton';

import { useEarnRewards } from './useEarnRewards';

const filterState = {} as IFilterState;

const rewardItem = {
  accountAddress: '0xabc',
  fiatValue: '3',
  items: [{ networkId: 'evm--1' }],
};

async function flush() {
  // Let the reward request, then the positions request, settle.
  await act(async () => {
    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }
  });
}

describe('useEarnRewards', () => {
  beforeEach(() => {
    mockGetEarnReward.mockReset();
    mockGetPositions.mockReset();
    mockGetEarnReward.mockResolvedValue({
      fiatValue: '3',
      items: [rewardItem],
      total: 1,
    });
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

  it('shows the reward records while positions never answer', async () => {
    mockGetPositions.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useEarnRewards(filterState));

    await flush();

    expect(mockGetPositions).toHaveBeenCalledWith([
      { accountAddress: '0xabc', networkId: 'evm--1' },
    ]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.lists).toEqual([[rewardItem], [rewardItem]]);
  });

  it('maps deposited amounts when positions load', async () => {
    mockGetPositions.mockResolvedValue({
      list: [
        { accountAddress: '0xabc', key: 'evm--1__0xVAULT', deposited: '7' },
      ],
    });
    const { result } = renderHook(() => useEarnRewards(filterState));

    await flush();

    expect(result.current.isLoading).toBe(false);
    expect(result.current.vaultAmount).toEqual({
      '0xabc': { 'evm--1__0xvault': '7' },
    });
  });

  it('skips the positions request when there are no reward accounts', async () => {
    mockGetEarnReward.mockResolvedValue({
      fiatValue: '0',
      items: [],
      total: 0,
    });
    const { result } = renderHook(() => useEarnRewards(filterState));

    await flush();

    expect(mockGetPositions).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.lists).toEqual([[], []]);
  });
});
