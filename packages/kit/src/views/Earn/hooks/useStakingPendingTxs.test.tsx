/* eslint-disable import/first */

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/utils/timerUtils')
  >('@onekeyhq/shared/src/utils/timerUtils');
  const timerMock = { durationMs: 0 };
  (
    globalThis as unknown as {
      __stakingPendingTxsTimerMock: typeof timerMock;
    }
  ).__stakingPendingTxsTimerMock = timerMock;
  return {
    __esModule: true,
    default: {
      ...actual.default,
      getTimeDurationMs: () => timerMock.durationMs,
    },
  };
});

const mockRouteFocus = { current: true };
const mockActiveAccount = {
  account: { id: 'active-account', address: 'address-a' },
  indexedAccount: { id: 'hd-1--0' },
  network: { id: 'evm--1' },
};
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockRouteFocus.current,
  useRouteIsFocusedWhenEnabled: ({ enabled }: { enabled: boolean }) =>
    !enabled || mockRouteFocus.current,
}));

jest.mock('@onekeyhq/components', () => {
  const { useDeferredPromise } = jest.requireActual<
    typeof import('../../../../../components/src/hooks/useDeferredPromise')
  >('../../../../../components/src/hooks/useDeferredPromise');
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
  return {
    useActiveAccount: () => ({ activeAccount: mockActiveAccount }),
  };
});

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/earn', () => {
  const earnState = { availableAssetsByType: {} };
  return {
    useEarnAtom: () => [earnState],
  };
});

jest.mock('@onekeyhq/kit/src/views/Staking/utils/utils', () => {
  const actual = jest.requireActual<typeof import('../../Staking/utils/utils')>(
    '@onekeyhq/kit/src/views/Staking/utils/utils',
  );
  return {
    buildLocalTxStatusSyncId: jest.fn(),
    createEarnActionScopeGuard: actual.createEarnActionScopeGuard,
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => {
  const backgroundMock = {
    fetchAccountHistory: jest.fn(),
    getAccountLocalHistoryPendingTxs: jest.fn(),
    getNetworkAccountsInSameIndexedAccountId: jest.fn(),
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
        getNetworkAccountsInSameIndexedAccountId:
          backgroundMock.getNetworkAccountsInSameIndexedAccountId,
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
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EReplaceTxType } from '@onekeyhq/shared/types/tx';

import {
  type IStakePendingTx,
  useEarnPendingTxsSharedMeta,
  useStakingPendingTxsByInfo,
} from './useStakingPendingTxs';

const backgroundMock = (
  globalThis as unknown as {
    __stakingPendingTxsBackgroundMock: {
      fetchAccountHistory: jest.Mock;
      getAccountLocalHistoryPendingTxs: jest.Mock;
      getNetworkAccountsInSameIndexedAccountId: jest.Mock;
      getAccountMetaForNetworksBatch: jest.Mock;
      getFetchHistoryPollingIntervalsBatch: jest.Mock;
    };
  }
).__stakingPendingTxsBackgroundMock;
const timerMock = (
  globalThis as unknown as {
    __stakingPendingTxsTimerMock: {
      durationMs: number;
    };
  }
).__stakingPendingTxsTimerMock;

const pendingTag = 'borrow:aave:setEMode';
const pendingTagMatcher = (tag: string) => tag === pendingTag;

function createPendingTx(
  id: string,
  replacedType?: EReplaceTxType,
): IStakePendingTx {
  return {
    id,
    stakingInfo: {
      tags: [pendingTag],
    },
    replacedType,
  } as unknown as IStakePendingTx;
}

describe('useStakingPendingTxsByInfo history verification', () => {
  beforeEach(() => {
    mockRouteFocus.current = true;
    mockActiveAccount.account.id = 'active-account';
    mockActiveAccount.account.address = 'address-a';
    mockActiveAccount.indexedAccount.id = 'hd-1--0';
    mockActiveAccount.network.id = 'evm--1';
    timerMock.durationMs = 0;
    backgroundMock.fetchAccountHistory.mockReset();
    backgroundMock.fetchAccountHistory.mockResolvedValue(undefined);
    backgroundMock.getAccountLocalHistoryPendingTxs.mockReset();
    backgroundMock.getNetworkAccountsInSameIndexedAccountId.mockReset();
    backgroundMock.getNetworkAccountsInSameIndexedAccountId.mockResolvedValue(
      [],
    );
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

  it('does not expose cancellation replacements as pending staking actions', async () => {
    const cancelledTx = createPendingTx(
      'cancelled-pending',
      EReplaceTxType.Cancel,
    );
    const activeTx = createPendingTx('active-pending');
    backgroundMock.getAccountLocalHistoryPendingTxs.mockResolvedValue([
      cancelledTx,
      activeTx,
    ]);

    const { result } = renderHook(() =>
      useStakingPendingTxsByInfo({
        networkIds: ['evm--1'],
        accountId: 'route-account',
        tagMatcher: pendingTagMatcher,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.filteredTxs).toEqual([activeTx]);
  });

  it('preserves verified history on picker return and refreshes on the next ordinary focus', async () => {
    backgroundMock.getAccountLocalHistoryPendingTxs.mockResolvedValue([]);
    const networkIds = ['evm--1'];
    const view = renderHook(
      ({ revalidateOnFocus }: { revalidateOnFocus: boolean }) =>
        useStakingPendingTxsByInfo({
          networkIds,
          accountId: 'route-account',
          tagMatcher: pendingTagMatcher,
          revalidateOnFocus,
        }),
      { initialProps: { revalidateOnFocus: true } },
    );
    await waitFor(() => {
      expect(view.result.current.isLoading).toBe(false);
      expect(view.result.current.isPendingHistoryVerified).toBe(true);
    });
    backgroundMock.getAccountLocalHistoryPendingTxs.mockClear();

    mockRouteFocus.current = false;
    view.rerender({ revalidateOnFocus: true });
    mockRouteFocus.current = true;
    view.rerender({ revalidateOnFocus: false });
    view.rerender({ revalidateOnFocus: true });

    expect(
      backgroundMock.getAccountLocalHistoryPendingTxs,
    ).not.toHaveBeenCalled();
    expect(view.result.current.isLoading).toBe(false);
    expect(view.result.current.isPendingHistoryVerified).toBe(true);

    const pendingTx = createPendingTx('new-pending');
    backgroundMock.getAccountLocalHistoryPendingTxs.mockResolvedValue([
      pendingTx,
    ]);
    mockRouteFocus.current = false;
    view.rerender({ revalidateOnFocus: true });
    mockRouteFocus.current = true;
    view.rerender({ revalidateOnFocus: true });
    await waitFor(() => {
      expect(view.result.current.isLoading).toBe(false);
      expect(view.result.current.filteredTxs).toEqual([pendingTx]);
    });
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

  it('automatically retries an unverified pending-history result', async () => {
    timerMock.durationMs = 5;
    const pendingTx = createPendingTx('recovered-pending');
    backgroundMock.getAccountLocalHistoryPendingTxs
      .mockRejectedValueOnce(new OneKeyLocalError('history unavailable'))
      .mockResolvedValue([pendingTx]);

    const { result } = renderHook(() =>
      useStakingPendingTxsByInfo({
        networkIds: ['evm--1'],
        accountId: 'route-account',
        tagMatcher: pendingTagMatcher,
      }),
    );

    await waitFor(() => {
      expect(
        backgroundMock.getAccountLocalHistoryPendingTxs.mock.calls.length,
      ).toBeGreaterThanOrEqual(2);
      expect(result.current.isPendingHistoryVerified).toBe(true);
      expect(result.current.filteredTxs).toEqual([pendingTx]);
    });
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

  it('fails closed when the requested network account map cannot be resolved', async () => {
    backgroundMock.getNetworkAccountsInSameIndexedAccountId.mockRejectedValue(
      new OneKeyLocalError('account map unavailable'),
    );

    const { result } = renderHook(() =>
      useStakingPendingTxsByInfo({
        networkIds: ['evm--8453'],
        indexedAccountId: 'route-indexed-account',
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
    expect(result.current.pendingHistoryFailedNetworkIds).toEqual([
      'evm--8453',
    ]);
  });

  it('fails closed for networks missing from a partial account map', async () => {
    backgroundMock.getNetworkAccountsInSameIndexedAccountId.mockResolvedValue([
      {
        network: { id: 'evm--1' },
        account: { id: 'network-1-account' },
      },
    ]);
    backgroundMock.getAccountLocalHistoryPendingTxs.mockResolvedValue([]);

    const { result } = renderHook(() =>
      useStakingPendingTxsByInfo({
        networkIds: ['evm--1', 'evm--8453'],
        indexedAccountId: 'route-indexed-account',
        tagMatcher: pendingTagMatcher,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isPendingHistoryVerified).toBe(false);
    });

    expect(backgroundMock.getAccountLocalHistoryPendingTxs).toHaveBeenCalled();
    expect(
      backgroundMock.getAccountLocalHistoryPendingTxs.mock.calls.every(
        ([params]) => params.networkId === 'evm--1',
      ),
    ).toBe(true);
    expect(result.current.pendingHistoryFailedNetworkIds).toEqual([
      'evm--8453',
    ]);
  });

  it('verifies a wallet that has no account on some monitored networks', async () => {
    timerMock.durationMs = 5;
    // The resolution succeeds and simply reports no account on evm--8453:
    // accounts are created per network on demand, so this is the normal
    // shape for most wallets rather than a failed lookup.
    backgroundMock.getNetworkAccountsInSameIndexedAccountId.mockResolvedValue([
      {
        network: { id: 'evm--1' },
        account: { id: 'network-1-account' },
      },
    ]);
    backgroundMock.getAccountLocalHistoryPendingTxs.mockResolvedValue([]);

    const { result, unmount } = renderHook(() =>
      useStakingPendingTxsByInfo({
        networkIds: ['evm--1', 'evm--8453'],
        tagMatcher: pendingTagMatcher,
      }),
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isPendingHistoryVerified).toBe(true);
    });
    expect(result.current.pendingHistoryFailedNetworkIds).toEqual([]);
    expect(
      backgroundMock.getAccountLocalHistoryPendingTxs.mock.calls.every(
        ([params]) => params.networkId === 'evm--1',
      ),
    ).toBe(true);

    // Several polling intervals pass without the unverified retry firing.
    const settledLookups =
      backgroundMock.getAccountLocalHistoryPendingTxs.mock.calls.length;
    const settledAccountMaps =
      backgroundMock.getNetworkAccountsInSameIndexedAccountId.mock.calls.length;
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 60);
      });
    });

    expect(
      backgroundMock.getAccountLocalHistoryPendingTxs.mock.calls.length,
    ).toBe(settledLookups);
    expect(
      backgroundMock.getNetworkAccountsInSameIndexedAccountId.mock.calls.length,
    ).toBe(settledAccountMaps);

    unmount();
  });

  const emitAccountUpdate = () =>
    appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
  const emitAccountsAddedTo = (walletId: string) =>
    appEventBus.emit(EAppEventBusNames.AddDBAccountsToWallet, {
      walletId,
      accounts: [],
    });
  const accountsOf = (...networkIds: string[]) =>
    networkIds.map((networkId) => ({
      network: { id: networkId },
      account: { id: `${networkId}-account` },
    }));

  it.each([
    ['an account is imported or renamed', emitAccountUpdate],
    ['a chain is derived for the wallet', () => emitAccountsAddedTo('hd-1')],
  ])('re-resolves the account map when %s', async (_, emitEvent) => {
    backgroundMock.getNetworkAccountsInSameIndexedAccountId.mockResolvedValue(
      accountsOf('evm--1'),
    );
    backgroundMock.getAccountLocalHistoryPendingTxs.mockResolvedValue([]);

    const { result, unmount } = renderHook(() =>
      useStakingPendingTxsByInfo({
        networkIds: ['evm--1', 'evm--8453'],
        tagMatcher: pendingTagMatcher,
      }),
    );

    await waitFor(() => {
      expect(result.current.isPendingHistoryVerified).toBe(true);
    });
    const settledAccountMaps =
      backgroundMock.getNetworkAccountsInSameIndexedAccountId.mock.calls.length;

    backgroundMock.getNetworkAccountsInSameIndexedAccountId.mockResolvedValue(
      accountsOf('evm--1', 'evm--8453'),
    );
    await act(async () => {
      emitEvent();
    });

    await waitFor(() => {
      expect(
        backgroundMock.getNetworkAccountsInSameIndexedAccountId.mock.calls
          .length,
      ).toBeGreaterThan(settledAccountMaps);
      expect(
        backgroundMock.getAccountLocalHistoryPendingTxs.mock.calls.some(
          ([params]) => params.networkId === 'evm--8453',
        ),
      ).toBe(true);
    });

    unmount();
  });

  it('answers a burst of added accounts with one re-resolution, and ignores other wallets', async () => {
    backgroundMock.getNetworkAccountsInSameIndexedAccountId.mockResolvedValue(
      accountsOf('evm--1'),
    );
    backgroundMock.getAccountLocalHistoryPendingTxs.mockResolvedValue([]);

    const { result, unmount } = renderHook(() =>
      useStakingPendingTxsByInfo({
        networkIds: ['evm--1', 'evm--8453'],
        tagMatcher: pendingTagMatcher,
      }),
    );

    await waitFor(() => {
      expect(result.current.isPendingHistoryVerified).toBe(true);
    });
    const accountMapCalls = () =>
      backgroundMock.getNetworkAccountsInSameIndexedAccountId.mock.calls.length;
    const settledAccountMaps = accountMapCalls();
    const waitPastTheDebounce = () =>
      act(async () => {
        await new Promise((resolve) => {
          setTimeout(resolve, 400);
        });
      });

    await act(async () => {
      emitAccountsAddedTo('hd-2');
    });
    await waitPastTheDebounce();
    expect(accountMapCalls()).toBe(settledAccountMaps);

    await act(async () => {
      emitAccountsAddedTo('hd-1');
      emitAccountsAddedTo('hd-1');
      emitAccountsAddedTo('hd-1');
    });
    await waitPastTheDebounce();
    expect(accountMapCalls()).toBe(settledAccountMaps + 1);

    unmount();
  });

  it('re-resolves the shared account map that instances short-circuit to', async () => {
    backgroundMock.getNetworkAccountsInSameIndexedAccountId.mockResolvedValue(
      accountsOf('evm--1'),
    );
    backgroundMock.getAccountLocalHistoryPendingTxs.mockResolvedValue([]);
    const networkIds = ['evm--1', 'evm--8453'];

    const { result, unmount } = renderHook(() => {
      const precomputed = useEarnPendingTxsSharedMeta({
        extraNetworkIds: networkIds,
      });
      return useStakingPendingTxsByInfo({
        networkIds,
        tagMatcher: pendingTagMatcher,
        precomputed,
      });
    });

    await waitFor(() => {
      expect(result.current.isPendingHistoryVerified).toBe(true);
    });
    const accountMapCalls = () =>
      backgroundMock.getNetworkAccountsInSameIndexedAccountId.mock.calls.length;
    const settledAccountMaps = accountMapCalls();
    expect(
      backgroundMock.getAccountLocalHistoryPendingTxs.mock.calls.some(
        ([params]) => params.networkId === 'evm--8453',
      ),
    ).toBe(false);

    backgroundMock.getNetworkAccountsInSameIndexedAccountId.mockResolvedValue(
      accountsOf('evm--1', 'evm--8453'),
    );
    await act(async () => {
      emitAccountsAddedTo('hd-1');
    });

    await waitFor(() => {
      expect(
        backgroundMock.getAccountLocalHistoryPendingTxs.mock.calls.some(
          ([params]) => params.networkId === 'evm--8453',
        ),
      ).toBe(true);
    });
    // Only the parent asks again: the instance reads the parent's new map.
    expect(accountMapCalls()).toBe(settledAccountMaps + 1);

    unmount();
  });

  it('does not reuse the previous wallet shared network map while the new wallet resolves', async () => {
    backgroundMock.getNetworkAccountsInSameIndexedAccountId.mockImplementation(
      ({ indexedAccountId }: { indexedAccountId: string }) =>
        indexedAccountId === 'hd-1--0'
          ? Promise.resolve([
              {
                network: { id: 'evm--2' },
                account: { id: 'wallet-a-chain-2' },
              },
            ])
          : new Promise(() => {}),
    );
    backgroundMock.getAccountLocalHistoryPendingTxs.mockResolvedValue([]);
    const networkIds = ['evm--1', 'evm--2'];
    const view = renderHook(() => {
      const precomputed = useEarnPendingTxsSharedMeta({
        extraNetworkIds: networkIds,
      });
      return useStakingPendingTxsByInfo({
        networkIds,
        tagMatcher: pendingTagMatcher,
        precomputed,
      });
    });
    await waitFor(() =>
      expect(view.result.current.isPendingHistoryVerified).toBe(true),
    );
    expect(
      backgroundMock.getAccountLocalHistoryPendingTxs,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        networkId: 'evm--2',
        accountAddress: 'wallet-a-chain-2-evm--2',
      }),
    );
    backgroundMock.getAccountLocalHistoryPendingTxs.mockClear();
    mockActiveAccount.account.id = 'account-b';
    mockActiveAccount.indexedAccount.id = 'hd-2--0';
    view.rerender(undefined);
    await waitFor(() =>
      expect(
        backgroundMock.getNetworkAccountsInSameIndexedAccountId,
      ).toHaveBeenCalledWith(
        expect.objectContaining({ indexedAccountId: 'hd-2--0' }),
      ),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      backgroundMock.getAccountLocalHistoryPendingTxs,
    ).not.toHaveBeenCalledWith(
      expect.objectContaining({ accountAddress: 'wallet-a-chain-2-evm--2' }),
    );
    view.unmount();
  });

  it('does not retain a previous address pending state when an external account keeps its ID', async () => {
    backgroundMock.getAccountMetaForNetworksBatch.mockImplementation(
      async () => ({
        'evm--1': { accountAddress: mockActiveAccount.account.address },
      }),
    );
    backgroundMock.getAccountLocalHistoryPendingTxs.mockImplementation(
      async ({ accountAddress }: { accountAddress: string }) =>
        accountAddress === 'address-a' ? [createPendingTx('pending-a')] : [],
    );
    const networkIds = ['evm--1'];
    const view = renderHook(() => {
      const precomputed = useEarnPendingTxsSharedMeta({
        extraNetworkIds: networkIds,
      });
      return useStakingPendingTxsByInfo({
        networkIds,
        tagMatcher: pendingTagMatcher,
        precomputed,
      });
    });
    await waitFor(() => expect(view.result.current.pendingCount).toBe(1));
    mockActiveAccount.account.address = 'address-b';
    view.rerender(undefined);
    expect(view.result.current.pendingCount).toBe(0);
    expect(view.result.current.isPendingHistoryVerified).toBe(false);
    await act(async () => {
      emitAccountUpdate();
    });
    await waitFor(() => {
      expect(view.result.current.pendingCount).toBe(0);
      expect(view.result.current.isPendingHistoryVerified).toBe(true);
    });
    view.unmount();
  });

  it('parks history lookups and the retry poll while the host surface is hidden', async () => {
    timerMock.durationMs = 5;
    backgroundMock.getNetworkAccountsInSameIndexedAccountId.mockResolvedValue([
      {
        network: { id: 'evm--1' },
        account: { id: 'network-1-account' },
      },
    ]);
    backgroundMock.getAccountLocalHistoryPendingTxs.mockResolvedValue([]);

    const { rerender, unmount } = renderHook(
      ({ isActive }: { isActive: boolean }) =>
        useStakingPendingTxsByInfo({
          networkIds: ['evm--1', 'evm--8453'],
          indexedAccountId: 'route-indexed-account',
          tagMatcher: pendingTagMatcher,
          isActive,
        }),
      { initialProps: { isActive: false } },
    );

    await waitFor(() => {
      expect(backgroundMock.getAccountMetaForNetworksBatch).toHaveBeenCalled();
    });
    const accountMapCalls =
      backgroundMock.getNetworkAccountsInSameIndexedAccountId.mock.calls.length;
    // Several polling intervals pass; the unverified partial map would
    // otherwise be retried on each of them.
    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 60);
      });
    });

    expect(
      backgroundMock.getAccountLocalHistoryPendingTxs,
    ).not.toHaveBeenCalled();
    expect(
      backgroundMock.getNetworkAccountsInSameIndexedAccountId.mock.calls.length,
    ).toBe(accountMapCalls);

    rerender({ isActive: true });

    await waitFor(() => {
      expect(
        backgroundMock.getAccountLocalHistoryPendingTxs,
      ).toHaveBeenCalled();
      expect(
        backgroundMock.getNetworkAccountsInSameIndexedAccountId.mock.calls
          .length,
      ).toBeGreaterThan(accountMapCalls);
    });
    // The partial map never verifies, so the retry poll would outlive the test.
    unmount();
  });

  it('recovers account ownership before retrying pending history', async () => {
    timerMock.durationMs = 5;
    const recoveredPendingTx = createPendingTx('recovered-account-map');
    backgroundMock.getNetworkAccountsInSameIndexedAccountId
      .mockRejectedValueOnce(new OneKeyLocalError('account map unavailable'))
      .mockResolvedValue([
        {
          network: { id: 'evm--8453' },
          account: { id: 'route-network-account' },
        },
      ]);
    backgroundMock.getAccountLocalHistoryPendingTxs.mockResolvedValue([
      recoveredPendingTx,
    ]);

    const { result } = renderHook(() =>
      useStakingPendingTxsByInfo({
        networkIds: ['evm--8453'],
        indexedAccountId: 'route-indexed-account',
        tagMatcher: pendingTagMatcher,
      }),
    );

    await waitFor(() => {
      expect(
        backgroundMock.getNetworkAccountsInSameIndexedAccountId.mock.calls
          .length,
      ).toBeGreaterThanOrEqual(2);
      expect(result.current.isPendingHistoryVerified).toBe(true);
      expect(result.current.filteredTxs).toEqual([recoveredPendingTx]);
    });
  });

  it('does not replace the last verified pending data with an older late response', async () => {
    const original = createPendingTx('original');
    const latest = createPendingTx('latest');
    backgroundMock.getAccountLocalHistoryPendingTxs.mockResolvedValue([
      original,
    ]);
    const { result } = renderHook(() =>
      useStakingPendingTxsByInfo({
        networkIds: ['evm--1'],
        accountId: 'route-account',
        tagMatcher: pendingTagMatcher,
      }),
    );
    await waitFor(() => {
      expect(result.current.isPendingHistoryVerified).toBe(true);
      expect(result.current.filteredTxs).toEqual([original]);
      expect(result.current.isLoading).toBe(false);
    });

    let resolveOld: (value: IStakePendingTx[]) => void = () => undefined;
    const oldResponse = new Promise<IStakePendingTx[]>((resolve) => {
      resolveOld = resolve;
    });
    backgroundMock.getAccountLocalHistoryPendingTxs
      .mockImplementationOnce(() => oldResponse)
      .mockResolvedValueOnce([latest]);
    const callsBefore =
      backgroundMock.getAccountLocalHistoryPendingTxs.mock.calls.length;
    let oldRefresh: Promise<void> | undefined;
    act(() => {
      oldRefresh = result.current.refreshPending();
    });
    await waitFor(() =>
      expect(
        backgroundMock.getAccountLocalHistoryPendingTxs,
      ).toHaveBeenCalledTimes(callsBefore + 1),
    );
    await act(async () => {
      await result.current.refreshPending();
    });
    await waitFor(() => expect(result.current.filteredTxs).toEqual([latest]));
    await act(async () => {
      resolveOld([]);
      await oldRefresh;
    });
    backgroundMock.getAccountLocalHistoryPendingTxs.mockRejectedValue(
      new OneKeyLocalError('history unavailable'),
    );
    await act(async () => {
      await result.current.refreshPending();
    });
    await waitFor(() => {
      expect(result.current.isPendingHistoryVerified).toBe(false);
      expect(result.current.filteredTxs).toEqual([latest]);
    });
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
    const onRefresh = jest.fn();
    const { result } = renderHook(() =>
      useStakingPendingTxsByInfo({
        networkIds,
        tagMatcher: pendingTagMatcher,
        precomputed,
        onRefresh,
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
    expect(onRefresh).not.toHaveBeenCalled();

    backgroundMock.getAccountLocalHistoryPendingTxs.mockResolvedValue([]);
    await act(async () => {
      await result.current.refreshPending();
    });
    await waitFor(() => {
      expect(result.current.isPendingHistoryVerified).toBe(true);
      expect(result.current.pendingCount).toBe(0);
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('refreshes when a pending tx observed during partial failure is later verified empty', async () => {
    let failSecondNetwork = true;
    backgroundMock.getAccountLocalHistoryPendingTxs.mockImplementation(
      async ({ networkId }: { networkId: string }) => {
        if (failSecondNetwork && networkId === 'evm--2') {
          throw new OneKeyLocalError('history unavailable');
        }
        return failSecondNetwork ? [createPendingTx('observed')] : [];
      },
    );
    const networkIds = ['evm--1', 'evm--2'];
    const precomputed = {
      networkAccountMap: { 'evm--1': 'active-account', 'evm--2': 'account-2' },
      pollingIntervalsByNetwork: { 'evm--1': 0, 'evm--2': 0 },
      accountMetaByNetwork: {
        'evm--1': { accountId: 'active-account', accountAddress: '0x1' },
        'evm--2': { accountId: 'account-2', accountAddress: '0x2' },
      },
    };
    const onRefresh = jest.fn();
    const view = renderHook(() =>
      useStakingPendingTxsByInfo({
        networkIds,
        tagMatcher: pendingTagMatcher,
        precomputed,
        onRefresh,
      }),
    );
    await waitFor(() => {
      expect(view.result.current.pendingCount).toBe(1);
      expect(view.result.current.isPendingHistoryVerified).toBe(false);
    });
    expect(onRefresh).not.toHaveBeenCalled();
    failSecondNetwork = false;
    await act(async () => {
      await view.result.current.refreshPending();
    });
    await waitFor(() => {
      expect(view.result.current.isPendingHistoryVerified).toBe(true);
      expect(view.result.current.pendingCount).toBe(0);
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps a scheduled completion across an equivalent network array and callback update', async () => {
    backgroundMock.getAccountLocalHistoryPendingTxs.mockResolvedValue([
      createPendingTx('pending'),
    ]);
    const oldCallback = jest.fn();
    const nextCallback = jest.fn();
    const view = renderHook(
      ({
        networkIds,
        onRefresh,
      }: {
        networkIds: string[];
        onRefresh: () => void;
      }) =>
        useStakingPendingTxsByInfo({
          accountId: 'a',
          networkIds,
          tagMatcher: pendingTagMatcher,
          onRefresh,
          onRefreshDelayMs: 3000,
        }),
      { initialProps: { networkIds: ['evm--1'], onRefresh: oldCallback } },
    );
    await waitFor(() => expect(view.result.current.pendingCount).toBe(1));
    jest.useFakeTimers();
    try {
      backgroundMock.getAccountLocalHistoryPendingTxs.mockResolvedValue([]);
      await act(async () => {
        await view.result.current.refreshPending();
      });
      expect(view.result.current.pendingCount).toBe(0);
      view.rerender({ networkIds: ['evm--1'], onRefresh: nextCallback });
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      expect(oldCallback).not.toHaveBeenCalled();
      expect(nextCallback).toHaveBeenCalledTimes(1);
    } finally {
      view.unmount();
      jest.useRealTimers();
    }
  });

  it('preserves an already scheduled completion when the surface is hidden', async () => {
    backgroundMock.getAccountLocalHistoryPendingTxs.mockResolvedValue([
      createPendingTx('pending'),
    ]);
    const networkIds = ['evm--1'];
    const onRefresh = jest.fn();
    const view = renderHook(
      ({ isActive }: { isActive: boolean }) =>
        useStakingPendingTxsByInfo({
          accountId: 'a',
          networkIds,
          tagMatcher: pendingTagMatcher,
          onRefresh,
          onRefreshDelayMs: 3000,
          isActive,
        }),
      { initialProps: { isActive: true } },
    );
    await waitFor(() => expect(view.result.current.pendingCount).toBe(1));
    jest.useFakeTimers();
    try {
      backgroundMock.getAccountLocalHistoryPendingTxs.mockResolvedValue([]);
      await act(async () => {
        await view.result.current.refreshPending();
      });
      view.rerender({ isActive: false });
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      expect(onRefresh).toHaveBeenCalledTimes(1);
    } finally {
      view.unmount();
      jest.useRealTimers();
    }
  });

  it('does not send an earlier account completion to the new account callback', async () => {
    backgroundMock.getAccountLocalHistoryPendingTxs.mockResolvedValue([
      createPendingTx('pending-a'),
    ]);
    const networkIds = ['evm--1'];
    const onRefreshA = jest.fn();
    const onRefreshB = jest.fn();
    const view = renderHook(
      ({
        accountId,
        onRefresh,
      }: {
        accountId: string;
        onRefresh: () => void;
      }) =>
        useStakingPendingTxsByInfo({
          accountId,
          networkIds,
          tagMatcher: pendingTagMatcher,
          onRefresh,
          onRefreshDelayMs: 3000,
        }),
      { initialProps: { accountId: 'a', onRefresh: onRefreshA } },
    );
    await waitFor(() => expect(view.result.current.pendingCount).toBe(1));
    jest.useFakeTimers();
    try {
      backgroundMock.getAccountLocalHistoryPendingTxs.mockResolvedValue([]);
      await act(async () => {
        await view.result.current.refreshPending();
      });
      expect(view.result.current.pendingCount).toBe(0);
      view.rerender({ accountId: 'b', onRefresh: onRefreshB });
      await act(async () => {
        await Promise.resolve();
      });
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      expect(onRefreshA).not.toHaveBeenCalled();
      expect(onRefreshB).not.toHaveBeenCalled();
    } finally {
      view.unmount();
      jest.useRealTimers();
    }
  });

  it('does not treat stale pending data as a completion for a new account', async () => {
    backgroundMock.getAccountLocalHistoryPendingTxs.mockResolvedValue([
      createPendingTx('pending-a'),
    ]);
    const networkIds = ['evm--1'];
    const onRefresh = jest.fn();
    const view = renderHook(
      ({ accountId }: { accountId: string }) =>
        useStakingPendingTxsByInfo({
          accountId,
          networkIds,
          tagMatcher: pendingTagMatcher,
          onRefresh,
        }),
      { initialProps: { accountId: 'a' } },
    );
    await waitFor(() => expect(view.result.current.pendingCount).toBe(1));
    backgroundMock.getAccountLocalHistoryPendingTxs.mockResolvedValue([]);
    view.rerender({ accountId: 'b' });
    await waitFor(() => {
      expect(view.result.current.isPendingHistoryVerified).toBe(true);
      expect(view.result.current.pendingCount).toBe(0);
    });
    expect(onRefresh).not.toHaveBeenCalled();
    view.unmount();
  });

  it('cancels a prior filter completion and still refreshes after the new filter completes', async () => {
    backgroundMock.getAccountLocalHistoryPendingTxs.mockResolvedValue([
      createPendingTx('pending-a'),
    ]);
    const networkIds = ['evm--1'];
    const filterA = (tx: IStakePendingTx) => tx.id === 'pending-a';
    const filterB = (tx: IStakePendingTx) => tx.id === 'pending-b';
    const onRefresh = jest.fn();
    const view = renderHook(
      ({ filter }: { filter: (tx: IStakePendingTx) => boolean }) =>
        useStakingPendingTxsByInfo({
          accountId: 'a',
          networkIds,
          tagMatcher: pendingTagMatcher,
          filter,
          onRefresh,
          onRefreshDelayMs: 3000,
        }),
      { initialProps: { filter: filterA } },
    );
    await waitFor(() => expect(view.result.current.pendingCount).toBe(1));
    jest.useFakeTimers();
    try {
      backgroundMock.getAccountLocalHistoryPendingTxs.mockResolvedValue([]);
      await act(async () => {
        await view.result.current.refreshPending();
      });
      view.rerender({ filter: filterB });
      await act(async () => {
        await Promise.resolve();
      });
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      expect(onRefresh).not.toHaveBeenCalled();
      backgroundMock.getAccountLocalHistoryPendingTxs.mockResolvedValue([
        createPendingTx('pending-b'),
      ]);
      await act(async () => {
        await view.result.current.refreshPending();
      });
      expect(view.result.current.pendingCount).toBe(1);
      backgroundMock.getAccountLocalHistoryPendingTxs.mockResolvedValue([]);
      await act(async () => {
        await view.result.current.refreshPending();
      });
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      expect(onRefresh).toHaveBeenCalledTimes(1);
    } finally {
      view.unmount();
      jest.useRealTimers();
    }
  });
});
