/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { useStakingPendingTxs } from './useStakingPendingTxs';

const mockPending = jest.fn<Promise<unknown[]>, [unknown]>();
const mockHistory = jest.fn<Promise<void>, [unknown]>();
const mockAccountAddress = jest.fn<Promise<string>, [unknown]>();

jest.mock('@onekeyhq/components', () => {
  const { useDeferredPromise } = jest.requireActual<
    typeof import('../../../../../components/src/hooks/useDeferredPromise')
  >('../../../../../components/src/hooks/useDeferredPromise');
  return {
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => undefined,
    useDeferredPromise,
    useNetInfo: () => ({ isRawInternetReachable: true }),
  };
});
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      fetchLocalStakingHistoryWithAccount: async (params: unknown) => {
        const accountAddress = await mockAccountAddress(params);
        const txs = await mockPending(params);
        return { accountIdentity: `identity:${accountAddress}`, txs };
      },
      getFetchHistoryPollingInterval: async () => 30,
    },
    serviceHistory: {
      fetchAccountHistory: (params: unknown) => mockHistory(params),
    },
    serviceAccount: {
      getAccountAddressForApi: (params: unknown) => mockAccountAddress(params),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: {} }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/earn', () => ({
  useEarnAtom: () => [{}],
}));

describe('useStakingPendingTxs delayed completion refresh', () => {
  beforeEach(() => {
    mockPending.mockReset();
    mockHistory.mockReset().mockResolvedValue();
    mockAccountAddress.mockReset().mockResolvedValue('address-a');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not send a previous account completion to the new account callback', async () => {
    mockPending.mockResolvedValue([{ id: 'tx-a' }]);
    const refreshA = jest.fn();
    const refreshB = jest.fn();
    const view = renderHook(
      ({ accountId, onRefresh }) =>
        useStakingPendingTxs({
          accountId,
          networkId: 'evm--1',
          stakeTag: 'test',
          onRefresh,
        }),
      { initialProps: { accountId: 'a', onRefresh: refreshA } },
    );
    await waitFor(() => expect(view.result.current.pendingCount).toBe(1));
    jest.useFakeTimers();
    mockPending.mockResolvedValue([]);
    await act(async () => {
      await view.result.current.refreshPending();
    });
    expect(view.result.current.pendingCount).toBe(0);
    view.rerender({ accountId: 'b', onRefresh: refreshB });
    await act(async () => {
      await Promise.resolve();
    });
    expect(refreshA).not.toHaveBeenCalled();
    expect(refreshB).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(refreshA).not.toHaveBeenCalled();
    expect(refreshB).not.toHaveBeenCalled();
    view.unmount();
  });

  it('invalidates old pending transactions when the same account id changes address', async () => {
    let address = 'address-a';
    mockPending.mockImplementation(async () =>
      address === 'address-a' ? [{ id: 'tx-a' }] : [],
    );
    const onRefresh = jest.fn();
    const view = renderHook(() =>
      useStakingPendingTxs({
        accountId: 'external-account',
        networkId: 'evm--1',
        stakeTag: 'test',
        onRefresh,
      }),
    );
    await waitFor(() => expect(view.result.current.pendingCount).toBe(1));
    act(() => {
      address = 'address-b';
      mockAccountAddress.mockResolvedValue(address);
      appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    });
    expect(view.result.current.pendingCount).toBe(0);
    expect(onRefresh).not.toHaveBeenCalled();
    view.unmount();
  });

  it('cancels a scheduled completion refresh when the same account id changes address', async () => {
    mockPending.mockResolvedValue([{ id: 'tx-a' }]);
    const onRefresh = jest.fn();
    const view = renderHook(() =>
      useStakingPendingTxs({
        accountId: 'external-account',
        networkId: 'evm--1',
        stakeTag: 'test',
        onRefresh,
      }),
    );
    await waitFor(() => expect(view.result.current.pendingCount).toBe(1));
    jest.useFakeTimers();
    mockPending.mockResolvedValue([]);
    await act(async () => {
      await view.result.current.refreshPending();
    });
    await act(async () => {
      mockAccountAddress.mockResolvedValue('address-b');
      appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    });
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(onRefresh).not.toHaveBeenCalled();
    view.unmount();
  });

  it('keeps a scheduled completion refresh after an unrelated account update', async () => {
    mockPending.mockResolvedValue([{ id: 'tx-a' }]);
    const onRefresh = jest.fn();
    const view = renderHook(() =>
      useStakingPendingTxs({
        accountId: 'external-account',
        networkId: 'evm--1',
        stakeTag: 'test',
        onRefresh,
      }),
    );
    await waitFor(() => expect(view.result.current.pendingCount).toBe(1));
    jest.useFakeTimers();
    mockPending.mockResolvedValue([]);
    await act(async () => {
      await view.result.current.refreshPending();
    });
    await act(async () => {
      appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    });
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('recognizes a completion discovered after an unrelated account update', async () => {
    mockPending.mockResolvedValue([{ id: 'tx-a' }]);
    const onRefresh = jest.fn();
    const view = renderHook(() =>
      useStakingPendingTxs({
        accountId: 'external-account',
        networkId: 'evm--1',
        stakeTag: 'test',
        onRefresh,
      }),
    );
    await waitFor(() => expect(view.result.current.pendingCount).toBe(1));
    jest.useFakeTimers();
    mockPending.mockResolvedValue([]);
    await act(async () => {
      appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    });
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('waits for account revalidation before restoring a completion refresh', async () => {
    mockPending.mockResolvedValue([{ id: 'tx-a' }]);
    const onRefresh = jest.fn();
    const view = renderHook(() =>
      useStakingPendingTxs({
        accountId: 'external-account',
        networkId: 'evm--1',
        stakeTag: 'test',
        onRefresh,
      }),
    );
    await waitFor(() => expect(view.result.current.pendingCount).toBe(1));
    jest.useFakeTimers();
    mockPending.mockResolvedValue([]);
    await act(async () => {
      await view.result.current.refreshPending();
    });
    let resolveAddress: (address: string) => void = () => undefined;
    mockAccountAddress.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAddress = resolve;
        }),
    );
    await act(async () => {
      appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    });
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(onRefresh).not.toHaveBeenCalled();
    await act(async () => {
      resolveAddress('address-a');
    });
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('does not restore a completion when revalidation finds another pending transaction', async () => {
    mockPending.mockResolvedValue([{ id: 'tx-a' }]);
    const onRefresh = jest.fn();
    const view = renderHook(() =>
      useStakingPendingTxs({
        accountId: 'external-account',
        networkId: 'evm--1',
        stakeTag: 'test',
        onRefresh,
      }),
    );
    await waitFor(() => expect(view.result.current.pendingCount).toBe(1));
    jest.useFakeTimers();
    mockPending.mockResolvedValue([]);
    await act(async () => {
      await view.result.current.refreshPending();
    });
    mockPending.mockResolvedValue([{ id: 'tx-b' }]);
    await act(async () => {
      appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    });
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(view.result.current.pendingCount).toBe(1);
    expect(onRefresh).not.toHaveBeenCalled();
    view.unmount();
  });

  it('discards an older address result after a later update changes the account', async () => {
    mockPending.mockResolvedValue([{ id: 'tx-a' }]);
    const onRefresh = jest.fn();
    const view = renderHook(() =>
      useStakingPendingTxs({
        accountId: 'external-account',
        networkId: 'evm--1',
        stakeTag: 'test',
        onRefresh,
      }),
    );
    await waitFor(() => expect(view.result.current.pendingCount).toBe(1));
    jest.useFakeTimers();
    mockPending.mockResolvedValue([]);
    await act(async () => {
      await view.result.current.refreshPending();
    });
    let resolveOldAddress: (address: string) => void = () => undefined;
    mockAccountAddress.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOldAddress = resolve;
        }),
    );
    await act(async () => {
      appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    });
    mockAccountAddress.mockResolvedValue('address-b');
    await act(async () => {
      appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    });
    await act(async () => {
      resolveOldAddress('address-a');
    });
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(onRefresh).not.toHaveBeenCalled();
    view.unmount();
  });

  it('does not refresh when account revalidation is aborted and resumes after a successful retry', async () => {
    mockPending.mockResolvedValue([{ id: 'tx-a' }]);
    const onRefresh = jest.fn();
    const view = renderHook(() =>
      useStakingPendingTxs({
        accountId: 'external-account',
        networkId: 'evm--1',
        stakeTag: 'test',
        onRefresh,
      }),
    );
    await waitFor(() => expect(view.result.current.pendingCount).toBe(1));
    jest.useFakeTimers();
    mockPending.mockResolvedValue([]);
    await act(async () => {
      await view.result.current.refreshPending();
    });
    mockAccountAddress.mockRejectedValueOnce(
      new DOMException('aborted', 'AbortError'),
    );
    await act(async () => {
      appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);
    });
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(onRefresh).not.toHaveBeenCalled();
    await act(async () => {
      await view.result.current.refreshPending();
    });
    await act(async () => {
      jest.advanceTimersByTime(0);
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('does not treat the old network pending result as a completion on the new network', async () => {
    mockPending.mockResolvedValue([{ id: 'tx-a' }]);
    const onRefresh = jest.fn();
    const view = renderHook(
      ({ networkId }) =>
        useStakingPendingTxs({
          accountId: 'a',
          networkId,
          stakeTag: 'test',
          onRefresh,
        }),
      { initialProps: { networkId: 'evm--1' } },
    );
    await waitFor(() => expect(view.result.current.pendingCount).toBe(1));
    jest.useFakeTimers();
    mockPending.mockResolvedValue([]);
    view.rerender({ networkId: 'evm--10' });
    await act(async () => {
      await Promise.resolve();
    });
    expect(view.result.current.pendingCount).toBe(0);
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(onRefresh).not.toHaveBeenCalled();
    view.unmount();
  });

  it('cancels a completion refresh when another pending transaction appears', async () => {
    mockPending.mockResolvedValue([{ id: 'tx-1' }]);
    const onRefresh = jest.fn();
    const view = renderHook(() =>
      useStakingPendingTxs({
        accountId: 'a',
        networkId: 'evm--1',
        stakeTag: 'test',
        onRefresh,
      }),
    );
    await waitFor(() => expect(view.result.current.pendingCount).toBe(1));
    jest.useFakeTimers();
    mockPending.mockResolvedValue([]);
    await act(async () => {
      await view.result.current.refreshPending();
    });
    expect(view.result.current.pendingCount).toBe(0);
    mockPending.mockResolvedValue([{ id: 'tx-2' }]);
    await act(async () => {
      await view.result.current.refreshPending();
    });
    expect(view.result.current.pendingCount).toBe(1);
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(onRefresh).not.toHaveBeenCalled();
    view.unmount();
  });

  it('cancels the completion refresh when the hook is unmounted', async () => {
    mockPending.mockResolvedValue([{ id: 'tx-1' }]);
    const onRefresh = jest.fn();
    const view = renderHook(() =>
      useStakingPendingTxs({
        accountId: 'a',
        networkId: 'evm--1',
        stakeTag: 'test',
        onRefresh,
      }),
    );
    await waitFor(() => expect(view.result.current.pendingCount).toBe(1));
    jest.useFakeTimers();
    mockPending.mockResolvedValue([]);
    await act(async () => {
      await view.result.current.refreshPending();
    });
    expect(view.result.current.pendingCount).toBe(0);
    view.unmount();
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('refreshes exactly once after the same scope has been clear for three seconds', async () => {
    mockPending.mockResolvedValue([{ id: 'tx-1' }]);
    const onRefresh = jest.fn();
    const view = renderHook(() =>
      useStakingPendingTxs({
        accountId: 'a',
        networkId: 'evm--1',
        stakeTag: 'test',
        onRefresh,
      }),
    );
    await waitFor(() => expect(view.result.current.pendingCount).toBe(1));
    jest.useFakeTimers();
    mockPending.mockResolvedValue([]);
    await act(async () => {
      await view.result.current.refreshPending();
    });
    expect(view.result.current.pendingCount).toBe(0);
    const historyCallsAfterClear = mockHistory.mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(2999);
    });
    expect(onRefresh).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(mockHistory).toHaveBeenCalledTimes(historyCallsAfterClear);
    view.unmount();
  });
});
