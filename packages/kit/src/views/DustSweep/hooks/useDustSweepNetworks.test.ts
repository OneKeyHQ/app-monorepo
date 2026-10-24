/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { EAppEventBusNames } from '@onekeyhq/shared/src/eventBus/appEventBusNames';
import type {
  IDustSweepNetwork,
  IDustSweepRouteParams,
} from '@onekeyhq/shared/types/swap/dustSweep';
import { ESwapTxHistoryStatus } from '@onekeyhq/shared/types/swap/types';

import { loadDustSweepNetworks } from '../utils/loadNetworks';
import {
  getDustSweepNetworksCache,
  invalidateDustSweepNetworksCache,
  setDustSweepNetworksCache,
} from '../utils/networkCache';

import {
  DUST_SWEEP_REFRESH_INTERVAL,
  useDustSweepNetworkRefresh,
  useDustSweepNetworks,
} from './useDustSweepNetworks';

import type { IDustSweepNetworksResult } from '../utils/loadNetworks';

jest.mock('../utils/loadNetworks', () => ({
  loadDustSweepNetworks: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => {
  const { EventEmitter } =
    jest.requireActual<typeof import('events')>('events');
  return { appEventBus: new EventEmitter() };
});

const mockLoad = jest.mocked(loadDustSweepNetworks);
const params: IDustSweepRouteParams = {
  walletId: 'hook-wallet',
  accountId: 'hook-account',
  entry: 'tokenListHeader',
};
const network: IDustSweepNetwork = {
  network: { networkId: 'evm--1', name: 'Ethereum', symbol: 'ETH' },
  accountId: 'account',
  address: 'address',
  balanceUsd: '2',
  nativeToken: {
    networkId: 'evm--1',
    contractAddress: '',
    isNative: true,
    symbol: 'ETH',
    decimals: 18,
  },
  tokens: [
    {
      key: 'usdc',
      networkId: 'evm--1',
      contractAddress: '0xusdc',
      symbol: 'USDC',
      amount: '2',
      valueUsd: '2',
      decimals: 6,
      suspicious: false,
    },
  ],
};
const data: IDustSweepNetworksResult = {
  networks: [network],
  partialError: false,
};

function deferred() {
  let resolve!: (value: IDustSweepNetworksResult) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<IDustSweepNetworksResult>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

async function settle(request: ReturnType<typeof deferred>, result = data) {
  await act(async () => {
    request.resolve(result);
    await request.promise;
  });
}

function useModel({ scope = params, focused = true, enabled = true } = {}) {
  const result = useDustSweepNetworks(scope);
  const timerActive = useDustSweepNetworkRefresh({
    params: scope,
    isFocused: focused,
    enabled,
    hasData: result.hasData,
    refreshStatus: result.refreshStatus,
    refresh: result.refresh,
    isRefreshing: result.isRefreshing,
  });
  return { ...result, timerActive };
}

beforeEach(() => {
  invalidateDustSweepNetworksCache(params.walletId);
  mockLoad.mockReset();
});
afterEach(() => jest.useRealTimers());

it('loads without data, then displays Home cache while fresh data is pending', async () => {
  const request = deferred();
  mockLoad.mockReturnValue(request.promise);
  const { result } = renderHook(() => useModel());
  expect(result.current.loadStatus).toBe('loading');
  expect(result.current.timerActive).toBe(false);
  act(() => mockLoad.mock.calls[0][2]?.([network]));
  expect(result.current.loadStatus).toBe('ready');
  expect(result.current.refreshStatus).toBe('refreshing');
  expect(getDustSweepNetworksCache(params)).toBeUndefined();
  await settle(request);
  expect(result.current.timerActive).toBe(true);
  expect(getDustSweepNetworksCache(params)).toEqual(data);
});

it('prefers Dust cache on re-entry and ignores Home cache even if it arrives later', async () => {
  setDustSweepNetworksCache(params, data);
  const request = deferred();
  mockLoad.mockReturnValue(request.promise);
  const { result } = renderHook(() => useModel());
  expect(result.current.loadStatus).toBe('ready');
  expect(result.current.networks).toEqual([network]);
  expect(mockLoad.mock.calls[0][3]).toEqual({
    isManualRefresh: true,
    skipCache: true,
  });
  act(() => mockLoad.mock.calls[0][2]?.([{ ...network, address: 'obsolete' }]));
  expect(result.current.networks).toEqual([network]);
  await settle(request);
});

it('retains a known empty result during refresh instead of returning to a skeleton', async () => {
  setDustSweepNetworksCache(params, { networks: [], partialError: false });
  const request = deferred();
  mockLoad.mockReturnValue(request.promise);
  const { result } = renderHook(() => useModel());
  expect(result.current.hasData).toBe(true);
  expect(result.current.loadStatus).toBe('ready');
  expect(result.current.networks).toEqual([]);
  act(() => mockLoad.mock.calls[0][2]?.([network]));
  expect(result.current.networks).toEqual([]);
  await settle(request, { networks: [], partialError: false });
});

it.each([true, false])(
  'retains data after a failed refresh only when it exists: %s',
  async (cached) => {
    if (cached) setDustSweepNetworksCache(params, data);
    const request = deferred();
    mockLoad.mockReturnValue(request.promise);
    const { result } = renderHook(() => useModel());
    await act(async () => {
      request.reject(new Error('Offline'));
      await request.promise.catch(() => undefined);
    });
    expect(result.current.loadStatus).toBe(cached ? 'ready' : 'error');
    expect(result.current.networks).toEqual(cached ? [network] : []);
    expect(result.current.refreshStatus).toBe('error');
    expect(result.current.partialError).toBe(true);
  },
);

it('aborts pre-trade reads before starting and never caches or applies their late result', async () => {
  setDustSweepNetworksCache(params, data);
  const request = deferred();
  mockLoad.mockReturnValue(request.promise);
  const { result, rerender } = renderHook(useModel, {
    initialProps: { enabled: true },
  });
  act(() => {
    result.current.suspend();
  });
  rerender({ enabled: false });
  act(() => result.current.refresh());
  expect(mockLoad).toHaveBeenCalledTimes(1);
  expect(mockLoad.mock.calls[0][1].aborted).toBe(true);
  expect(result.current.timerActive).toBe(false);
  // Post-transaction reconciliation wins over the old full request.
  act(() =>
    result.current.setNetworks([{ ...network, tokens: [], balanceUsd: '0' }]),
  );
  await settle(request);
  expect(result.current.networks[0].tokens).toEqual([]);
  expect(getDustSweepNetworksCache(params)?.networks[0].tokens).toEqual([]);
  act(() => result.current.resume());
});

it('rejects obsolete A to B to A requests and their cache writes', async () => {
  const first = deferred();
  const second = deferred();
  const third = deferred();
  mockLoad
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise)
    .mockReturnValueOnce(third.promise);
  const { result, rerender } = renderHook(({ scope }) => useModel({ scope }), {
    initialProps: { scope: params },
  });
  rerender({ scope: { ...params, accountId: 'other' } });
  rerender({ scope: { ...params } });
  await settle(third, {
    ...data,
    networks: [{ ...network, address: 'latest' }],
  });
  await settle(first);
  await settle(second);
  expect(result.current.networks[0].address).toBe('latest');
  expect(getDustSweepNetworksCache(params)?.networks[0].address).toBe('latest');
  expect(
    getDustSweepNetworksCache({ ...params, accountId: 'other' }),
  ).toBeUndefined();
});

it('does not let an unmounted request repopulate the Dust cache', async () => {
  const request = deferred();
  mockLoad.mockReturnValue(request.promise);
  const { unmount } = renderHook(() => useModel());
  unmount();
  await settle(request);
  expect(getDustSweepNetworksCache(params)).toBeUndefined();
});

it('keeps failed network previews but removes explicitly unsupported networks after refresh', async () => {
  const other = {
    ...network,
    network: { ...network.network, networkId: 'evm--56' },
  };
  setDustSweepNetworksCache(params, {
    networks: [network, other],
    partialError: false,
  });
  const first = deferred();
  const second = deferred();
  mockLoad
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const { result } = renderHook(() => useModel());
  await settle(first, {
    networks: [],
    partialError: true,
    failedNetworkIds: ['evm--1'],
    failedNetworkOwners: [
      {
        networkId: 'evm--1',
        accountId: network.accountId,
        address: network.address,
      },
    ],
  });
  expect(result.current.networks).toEqual([network]);
  act(() => result.current.refresh());
  await settle(second, { networks: [], partialError: false });
  expect(result.current.networks).toEqual([]);
  expect(result.current.loadStatus).toBe('ready');
});

it('owns one 15-second timer and pauses it while hidden, loading, or executing', async () => {
  jest.useFakeTimers();
  const first = deferred();
  const second = deferred();
  const third = deferred();
  mockLoad
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise)
    .mockReturnValueOnce(third.promise);
  const { result, rerender } = renderHook(useModel, {
    initialProps: { focused: true, enabled: true },
  });
  await settle(first);
  await act(async () =>
    jest.advanceTimersByTime(DUST_SWEEP_REFRESH_INTERVAL - 1),
  );
  rerender({ focused: true, enabled: true });
  await act(async () => jest.advanceTimersByTime(1));
  expect(mockLoad).toHaveBeenCalledTimes(2);
  await act(async () =>
    jest.advanceTimersByTime(DUST_SWEEP_REFRESH_INTERVAL * 2),
  );
  expect(mockLoad).toHaveBeenCalledTimes(2);
  await settle(second);
  rerender({ focused: false, enabled: true });
  expect(result.current.timerActive).toBe(false);
  await act(async () =>
    jest.advanceTimersByTime(DUST_SWEEP_REFRESH_INTERVAL * 2),
  );
  expect(mockLoad).toHaveBeenCalledTimes(2);
  rerender({ focused: true, enabled: true });
  expect(mockLoad).toHaveBeenCalledTimes(3);
  await settle(third);
  rerender({ focused: true, enabled: false });
  await act(async () =>
    jest.advanceTimersByTime(DUST_SWEEP_REFRESH_INTERVAL * 2),
  );
  expect(mockLoad).toHaveBeenCalledTimes(3);
});

it('does not duplicate a manual refresh when the existing 15-second deadline fires in the same event', async () => {
  jest.useFakeTimers();
  const first = deferred();
  const second = deferred();
  mockLoad
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const { result } = renderHook(() => useModel());
  await settle(first);
  act(() => {
    result.current.refresh();
    jest.advanceTimersByTime(DUST_SWEEP_REFRESH_INTERVAL);
  });
  expect(mockLoad).toHaveBeenCalledTimes(2);
  expect(mockLoad.mock.calls[1][1].aborted).toBe(false);
  await settle(second);
});

it('coalesces events during a pending request into one follow-up round', async () => {
  const first = deferred();
  const second = deferred();
  mockLoad
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  renderHook(() => useModel());
  act(() => {
    appEventBus.emit(EAppEventBusNames.SwapTxHistoryStatusUpdate, {
      status: ESwapTxHistoryStatus.SUCCESS,
    });
  });
  await settle(first);
  expect(mockLoad).toHaveBeenCalledTimes(2);
  await settle(second);
  expect(mockLoad).toHaveBeenCalledTimes(2);
});

it('coalesces transaction events into one follow-up request and defers it while hidden', async () => {
  const first = deferred();
  const second = deferred();
  mockLoad
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const { rerender } = renderHook(useModel, {
    initialProps: { focused: false },
  });
  act(() => {
    appEventBus.emit(EAppEventBusNames.SwapTxHistoryStatusUpdate, {
      status: ESwapTxHistoryStatus.SUCCESS,
    });
    appEventBus.emit(EAppEventBusNames.SwapTxHistoryStatusUpdate, {
      status: ESwapTxHistoryStatus.SUCCESS,
    });
  });
  await settle(first);
  expect(mockLoad).toHaveBeenCalledTimes(1);
  rerender({ focused: true });
  expect(mockLoad).toHaveBeenCalledTimes(2);
  await settle(second);
  expect(mockLoad).toHaveBeenCalledTimes(2);
});

it('ignores a delayed suspend callback from an unmounted page', async () => {
  setDustSweepNetworksCache(params, data);
  const first = deferred();
  const second = deferred();
  mockLoad
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const old = renderHook(() => useDustSweepNetworks(params));
  const suspend = old.result.current.suspend;
  old.unmount();
  const current = renderHook(() => useDustSweepNetworks(params));
  act(() => {
    expect(suspend()).toBe(false);
  });
  await settle(second);
  await settle(first, { networks: [], partialError: false });
  expect(current.result.current.networks).toEqual([network]);
  expect(getDustSweepNetworksCache(params)).toEqual(data);
});

it('clears changed account identities before refresh and refuses their old cached snapshot', async () => {
  setDustSweepNetworksCache(params, data);
  const first = deferred();
  const second = deferred();
  mockLoad
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const { result } = renderHook(() => useDustSweepNetworks(params));
  const suspend = result.current.suspend;
  act(() => {
    appEventBus.emit(EAppEventBusNames.GlobalDeriveTypeUpdate, {
      networkImpl: 'evm',
    });
  });
  expect(result.current.loadStatus).toBe('loading');
  expect(result.current.networks).toEqual([]);
  expect(getDustSweepNetworksCache(params)).toBeUndefined();
  expect(mockLoad.mock.calls[0][1].aborted).toBe(true);
  expect(mockLoad.mock.calls[1][3]?.skipCache).toBe(false);
  await settle(first);
  expect(result.current.networks).toEqual([]);
  const updated = {
    ...network,
    accountId: 'new-account',
    address: 'new-address',
  };
  await settle(second, { ...data, networks: [updated] });
  expect(result.current.networks).toEqual([updated]);
  act(() => {
    expect(suspend()).toBe(false);
  });
  expect(result.current.networks).toEqual([updated]);
  expect(result.current.refreshStatus).toBe('idle');
});

it('preserves execution data on an identity change and loads the new owner after resume', async () => {
  setDustSweepNetworksCache(params, data);
  const first = deferred();
  const second = deferred();
  mockLoad
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const { result } = renderHook(() => useDustSweepNetworks(params));
  act(() => {
    result.current.suspend();
  });
  act(() => {
    appEventBus.emit(EAppEventBusNames.GlobalDeriveTypeUpdate, {
      networkImpl: 'evm',
    });
  });
  expect(result.current.networks).toEqual([network]);
  expect(mockLoad).toHaveBeenCalledTimes(1);
  act(() => result.current.setNetworks([{ ...network, balanceUsd: '0' }]));
  expect(getDustSweepNetworksCache(params)).toBeUndefined();
  act(() => result.current.resume());
  expect(result.current.loadStatus).toBe('loading');
  expect(mockLoad).toHaveBeenCalledTimes(2);
  await settle(second, { networks: [], partialError: false });
  await settle(first);
  expect(result.current.networks).toEqual([]);
});

it('does not retain the previous account when a new owner on the same network fails', async () => {
  setDustSweepNetworksCache(params, data);
  const request = deferred();
  mockLoad.mockReturnValue(request.promise);
  const { result } = renderHook(() => useDustSweepNetworks(params));
  await settle(request, {
    networks: [],
    partialError: true,
    failedNetworkIds: ['evm--1'],
    failedNetworkOwners: [
      { networkId: 'evm--1', accountId: 'new-account', address: 'new-address' },
    ],
  });
  expect(result.current.networks).toEqual([]);
  expect(result.current.partialError).toBe(true);
});

it('keeps the newer consumer response in shared cache when an older response arrives last', async () => {
  setDustSweepNetworksCache(params, data);
  const oldRequest = deferred();
  const newerRequest = deferred();
  mockLoad
    .mockReturnValueOnce(oldRequest.promise)
    .mockReturnValueOnce(newerRequest.promise);
  const olderConsumer = renderHook(() => useDustSweepNetworks(params));
  const newerConsumer = renderHook(() => useDustSweepNetworks(params));
  await settle(newerRequest, {
    ...data,
    networks: [{ ...network, balanceUsd: '1' }],
  });
  expect(getDustSweepNetworksCache(params)?.networks[0].balanceUsd).toBe('1');
  await settle(oldRequest, {
    ...data,
    networks: [{ ...network, balanceUsd: '2' }],
  });
  expect(getDustSweepNetworksCache(params)?.networks[0].balanceUsd).toBe('1');
  olderConsumer.unmount();
  newerConsumer.unmount();
});

it('rejects another consumer writing pre-trade balances after execution invalidates the wallet', async () => {
  const otherNetwork = {
    ...network,
    network: { ...network.network, networkId: 'evm--56' },
    balanceUsd: '100',
  };
  const initial = { ...data, networks: [network, otherNetwork] };
  setDustSweepNetworksCache(params, initial);
  const first = deferred();
  const second = deferred();
  mockLoad
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const olderConsumer = renderHook(() => useDustSweepNetworks(params));
  const executingConsumer = renderHook(() => useDustSweepNetworks(params));
  act(() => {
    executingConsumer.result.current.suspend();
  });
  act(() =>
    executingConsumer.result.current.setNetworks([
      { ...network, tokens: [], balanceUsd: '0' },
      { ...otherNetwork, balanceUsd: '0' },
    ]),
  );
  expect(getDustSweepNetworksCache(params)?.networks[1].balanceUsd).toBe('0');
  act(() =>
    olderConsumer.result.current.setNetworks((previous) =>
      previous.map((entry) =>
        entry.network.networkId === 'evm--1'
          ? { ...entry, balanceUsd: '0' }
          : entry,
      ),
    ),
  );
  expect(getDustSweepNetworksCache(params)?.networks[1].balanceUsd).toBe('0');
  olderConsumer.unmount();
  executingConsumer.unmount();
});
