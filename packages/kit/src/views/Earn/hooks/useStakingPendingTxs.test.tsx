/* eslint-disable import/first */

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => {
  const actual = jest.requireActual(
    '@onekeyhq/shared/src/utils/timerUtils',
  ) as typeof import('@onekeyhq/shared/src/utils/timerUtils');
  return {
    __esModule: true,
    default: {
      ...actual.default,
      getTimeDurationMs: () => 0,
    },
  };
});

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));

jest.mock('@onekeyhq/components', () => {
  const { useDeferredPromise } = jest.requireActual(
    '../../../../../components/src/hooks/useDeferredPromise',
  ) as typeof import('../../../../../components/src/hooks/useDeferredPromise');
  return {
    __esModule: true,
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => undefined,
    useDeferredPromise,
    useNetInfo: () => ({
      isInternetReachable: true,
      isRawInternetReachable: true,
    }),
  };
});

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    isBTCNetwork: () => false,
  },
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => {
  const activeAccount = {
    account: { id: 'active-account' },
    indexedAccount: { id: 'active-indexed-account' },
    network: { id: 'evm--1' },
  };
  return {
    useActiveAccount: () => ({ activeAccount }),
  };
});

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/earn', () => {
  const earnState = { availableAssetsByType: {} };
  return {
    useEarnAtom: () => [earnState],
  };
});

jest.mock('@onekeyhq/kit/src/views/Staking/utils/utils', () => ({
  buildLocalTxStatusSyncId: jest.fn(),
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const backgroundMock = {
    fetchAccountHistory: jest.fn(),
    getAccountLocalHistoryPendingTxs: jest.fn(),
    getAccountMetaForNetworksBatch: jest.fn(),
    getFetchHistoryPollingIntervalsBatch: jest.fn(),
  };
  (
    globalThis as unknown as {
      __stakingPendingTxsBackgroundMock: typeof backgroundMock;
    }
  ).__stakingPendingTxsBackgroundMock = backgroundMock;
  return {
    __esModule: true,
    default: {
      serviceAccount: {
        getAccountMetaForNetworksBatch:
          backgroundMock.getAccountMetaForNetworksBatch,
      },
      serviceHistory: {
        fetchAccountHistory: backgroundMock.fetchAccountHistory,
        getAccountLocalHistoryPendingTxs:
          backgroundMock.getAccountLocalHistoryPendingTxs,
      },
      serviceStaking: {
        getFetchHistoryPollingIntervalsBatch:
          backgroundMock.getFetchHistoryPollingIntervalsBatch,
      },
    },
  };
});

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  type IStakePendingTx,
  useStakingPendingTxsByInfo,
} from './useStakingPendingTxs';

const backgroundMock = (
  globalThis as unknown as {
    __stakingPendingTxsBackgroundMock: {
      fetchAccountHistory: jest.Mock;
      getAccountLocalHistoryPendingTxs: jest.Mock;
      getAccountMetaForNetworksBatch: jest.Mock;
      getFetchHistoryPollingIntervalsBatch: jest.Mock;
    };
  }
).__stakingPendingTxsBackgroundMock;

const pendingTag = 'borrow:aave:setEMode';
const pendingTagMatcher = (tag: string) => tag === pendingTag;

function createPendingTx(id: string): IStakePendingTx {
  return {
    id,
    stakingInfo: {
      tags: [pendingTag],
    },
  } as unknown as IStakePendingTx;
}

describe('useStakingPendingTxsByInfo history verification', () => {
  beforeEach(() => {
    backgroundMock.fetchAccountHistory.mockReset();
    backgroundMock.fetchAccountHistory.mockResolvedValue(undefined);
    backgroundMock.getAccountLocalHistoryPendingTxs.mockReset();
    backgroundMock.getAccountMetaForNetworksBatch.mockReset();
    backgroundMock.getAccountMetaForNetworksBatch.mockImplementation(
      async ({
        pairs,
      }: {
        pairs: Array<{ accountId: string; networkId: string }>;
      }) =>
        Object.fromEntries(
          pairs.map(({ accountId, networkId }) => [
            networkId,
            {
              accountAddress: `${accountId}-${networkId}`,
            },
          ]),
        ),
    );
    backgroundMock.getFetchHistoryPollingIntervalsBatch.mockReset();
    backgroundMock.getFetchHistoryPollingIntervalsBatch.mockResolvedValue({});
  });

  it('fails closed after every pending-history query fails on a cold mount', async () => {
    backgroundMock.getAccountLocalHistoryPendingTxs.mockRejectedValue(
      new OneKeyLocalError('history unavailable'),
    );
    const networkIds = ['evm--1'];
    const { result } = renderHook(() =>
      useStakingPendingTxsByInfo({
        networkIds,
        accountId: 'route-account',
        tagMatcher: pendingTagMatcher,
      }),
    );

    await waitFor(() => {
      expect(
        backgroundMock.getAccountLocalHistoryPendingTxs,
      ).toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isPendingHistoryVerified).toBe(false);
    });

    expect(result.current.filteredTxs).toEqual([]);
    expect(result.current.pendingCount).toBe(0);
    expect(result.current.pendingHistoryFailedNetworkIds).toEqual(['evm--1']);
  });

  it('fails closed when an expected network account meta cannot be resolved', async () => {
    backgroundMock.getAccountMetaForNetworksBatch.mockRejectedValue(
      new OneKeyLocalError('account meta unavailable'),
    );
    const networkIds = ['evm--1'];
    const { result } = renderHook(() =>
      useStakingPendingTxsByInfo({
        networkIds,
        accountId: 'route-account',
        tagMatcher: pendingTagMatcher,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isPendingHistoryVerified).toBe(false);
    });

    expect(
      backgroundMock.getAccountLocalHistoryPendingTxs,
    ).not.toHaveBeenCalled();
    expect(result.current.pendingHistoryFailedNetworkIds).toEqual(['evm--1']);
  });

  it('keeps the failed network last verified tx on partial success', async () => {
    const firstNetworkTx = createPendingTx('network-1');
    const secondNetworkTx = createPendingTx('network-2');
    let phase: 'verified' | 'partial' = 'verified';
    backgroundMock.getAccountLocalHistoryPendingTxs.mockImplementation(
      async ({ networkId }: { networkId: string }) => {
        if (phase === 'partial') {
          if (networkId === 'evm--2') {
            throw new OneKeyLocalError('network 2 history unavailable');
          }
          return [];
        }
        return networkId === 'evm--1' ? [firstNetworkTx] : [secondNetworkTx];
      },
    );
    const networkIds = ['evm--1', 'evm--2'];
    const precomputed = {
      networkAccountMap: {
        'evm--1': 'active-account',
        'evm--2': 'network-2-account',
      },
      pollingIntervalsByNetwork: {
        'evm--1': 0,
        'evm--2': 0,
      },
      accountMetaByNetwork: {
        'evm--1': {
          accountId: 'active-account',
          accountAddress: '0xaccount1',
        },
        'evm--2': {
          accountId: 'network-2-account',
          accountAddress: '0xaccount2',
        },
      },
    };
    const { result } = renderHook(() =>
      useStakingPendingTxsByInfo({
        networkIds,
        tagMatcher: pendingTagMatcher,
        precomputed,
      }),
    );

    await waitFor(() => {
      expect(result.current.isPendingHistoryVerified).toBe(true);
      expect(result.current.pendingCount).toBe(2);
    });

    phase = 'partial';
    await act(async () => {
      await result.current.refreshPending();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isPendingHistoryVerified).toBe(false);
      expect(result.current.pendingHistoryFailedNetworkIds).toEqual(['evm--2']);
    });
    expect(result.current.filteredTxs).toEqual([secondNetworkTx]);
    expect(result.current.pendingCount).toBe(1);
  });
});
