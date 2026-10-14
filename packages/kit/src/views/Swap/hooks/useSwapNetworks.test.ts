/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import type { ISwapNetwork } from '@onekeyhq/shared/types/swap/types';

import { useSwapNetworks } from './useSwapNetworks';

import type { ISwapDefaultConfigStatus } from '../utils/swapColdStartTokenCacheUtils';

type INetworkCache = { data: ISwapNetwork[] } | null;

const mockGetNetworkCache = jest.fn<Promise<INetworkCache>, []>();
const mockSetNetworkCache = jest.fn<
  Promise<void>,
  [{ data: ISwapNetwork[] }]
>();
const mockFetchNetworks = jest.fn<
  Promise<ISwapNetwork[]>,
  [{ refreshClientNetworks: boolean }]
>();

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    simpleDb: {
      swapNetworksSort: {
        getRawData: () => mockGetNetworkCache(),
        setRawData: (data: { data: ISwapNetwork[] }) =>
          mockSetNetworkCache(data),
      },
    },
    serviceSwap: {
      fetchSwapNetworks: (options: { refreshClientNetworks: boolean }) =>
        mockFetchNetworks(options),
    },
  },
}));

jest.mock('../../../states/jotai/contexts/swap/atoms', () => {
  const { useState: useMockState } =
    jest.requireActual<typeof import('react')>('react');
  return {
    useSwapNetworksAtom: () => useMockState<ISwapNetwork[]>([]),
    useSwapDefaultConfigStatusAtom: () =>
      useMockState<ISwapDefaultConfigStatus>('pending'),
  };
});

const cachedNetwork: ISwapNetwork = {
  networkId: 'evm--1',
  name: 'Ethereum',
  symbol: 'ETH',
  supportSingleSwap: true,
  supportCrossChainSwap: false,
  supportLimit: false,
  supportStock: false,
  backendIndex: true,
  isDeFiEnabled: true,
  defaultSelectTokenDetail: {
    from: {
      networkId: 'evm--1',
      contractAddress: '0xusdc',
      symbol: 'USDC',
      decimals: 6,
    },
    to: {
      networkId: 'evm--1',
      contractAddress: '0xdai',
      symbol: 'DAI',
      decimals: 18,
    },
  },
};
const freshNetwork: ISwapNetwork = {
  ...cachedNetwork,
  defaultSelectTokenDetail: {
    from: {
      networkId: 'evm--1',
      contractAddress: '0xusdt',
      symbol: 'USDT',
      decimals: 6,
    },
    to: {
      networkId: 'evm--1',
      contractAddress: '0xweth',
      symbol: 'WETH',
      decimals: 18,
    },
  },
};

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: Error) => void = () => {};
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('useSwapNetworks configuration lifecycle', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockGetNetworkCache.mockResolvedValue({ data: [cachedNetwork] });
    mockSetNetworkCache.mockResolvedValue(undefined);
  });

  it('makes cached networks usable while fresh default configuration remains pending', async () => {
    const request = deferred<ISwapNetwork[]>();
    mockFetchNetworks.mockReturnValue(request.promise);
    const { result } = renderHook(useSwapNetworks);

    await waitFor(() => expect(mockFetchNetworks).toHaveBeenCalledTimes(1));

    expect(result.current.swapNetworks).toEqual([cachedNetwork]);
    expect(result.current.networkListFetching).toBe(false);
    expect(result.current.defaultConfigStatus).toBe('pending');
    expect(result.current.defaultConfigStatusRef.current).toBe('pending');
  });

  it.each([
    { label: 'configured pair', networks: [freshNetwork] },
    { label: 'empty response', networks: [] },
  ])(
    'uses the fresh $label without restoring old backend defaults',
    async ({ networks }) => {
      const request = deferred<ISwapNetwork[]>();
      const laterRequest = deferred<ISwapNetwork[]>();
      mockFetchNetworks
        .mockReturnValueOnce(request.promise)
        .mockReturnValue(laterRequest.promise);
      const { result } = renderHook(useSwapNetworks);
      await waitFor(() => expect(mockFetchNetworks).toHaveBeenCalledTimes(1));

      await act(async () => request.resolve(networks));

      expect(result.current.swapNetworks).toEqual(networks);
      expect(result.current.swapNetworksRef.current).toEqual(networks);
      expect(result.current.defaultConfigStatus).toBe('success');
      expect(result.current.networkListFetching).toBe(false);
      expect(mockFetchNetworks).toHaveBeenCalledTimes(1);
    },
  );

  it('releases local fallback after transport failure while retaining the usable selector cache', async () => {
    const request = deferred<ISwapNetwork[]>();
    mockFetchNetworks.mockReturnValue(request.promise);
    const { result } = renderHook(useSwapNetworks);
    await waitFor(() => expect(mockFetchNetworks).toHaveBeenCalledTimes(1));

    await act(async () =>
      request.reject(new Error('networks request timed out')),
    );

    expect(result.current.defaultConfigStatus).toBe('failed');
    expect(result.current.defaultConfigStatusRef.current).toBe('failed');
    expect(result.current.networkListFetching).toBe(false);
    expect(result.current.swapNetworks).toEqual([cachedNetwork]);
  });

  it('does not restore old defaults during an explicit refresh after an empty response', async () => {
    const request = deferred<ISwapNetwork[]>();
    const refreshRequest = deferred<ISwapNetwork[]>();
    mockFetchNetworks
      .mockReturnValueOnce(request.promise)
      .mockReturnValue(refreshRequest.promise);
    const { result } = renderHook(useSwapNetworks);
    await waitFor(() => expect(mockFetchNetworks).toHaveBeenCalledTimes(1));
    await act(async () => request.resolve([]));
    expect(result.current.swapNetworks).toEqual([]);

    const refreshes: Promise<void>[] = [];
    act(() => {
      refreshes.push(result.current.fetchSwapNetworks());
    });
    await waitFor(() => expect(mockFetchNetworks).toHaveBeenCalledTimes(2));

    expect(result.current.swapNetworks).toEqual([]);
    expect(result.current.defaultConfigStatus).toBe('success');

    await act(async () => {
      refreshRequest.resolve([freshNetwork]);
      await Promise.all(refreshes);
    });
    expect(result.current.swapNetworks).toEqual([freshNetwork]);
  });

  it('still fetches fresh configuration when reading the selector cache fails', async () => {
    const request = deferred<ISwapNetwork[]>();
    mockGetNetworkCache.mockRejectedValue(new Error('cache read failed'));
    mockFetchNetworks.mockReturnValue(request.promise);
    const { result } = renderHook(useSwapNetworks);
    await waitFor(() => expect(mockFetchNetworks).toHaveBeenCalledTimes(1));

    expect(result.current.defaultConfigStatus).toBe('pending');
    expect(result.current.swapNetworks).toEqual([]);

    await act(async () => request.resolve([freshNetwork]));

    expect(result.current.defaultConfigStatus).toBe('success');
    expect(result.current.swapNetworks).toEqual([freshNetwork]);
    expect(result.current.networkListFetching).toBe(false);
  });

  it('keeps fresh configuration successful when writing its cache fails later', async () => {
    const request = deferred<ISwapNetwork[]>();
    const cacheWrite = deferred<void>();
    mockFetchNetworks.mockReturnValue(request.promise);
    mockSetNetworkCache.mockReturnValue(cacheWrite.promise);
    const { result } = renderHook(useSwapNetworks);
    await waitFor(() => expect(mockFetchNetworks).toHaveBeenCalledTimes(1));

    await act(async () => request.resolve([freshNetwork]));
    expect(result.current.defaultConfigStatus).toBe('success');
    expect(result.current.swapNetworks).toEqual([freshNetwork]);

    await act(async () => cacheWrite.reject(new Error('cache write failed')));

    expect(result.current.defaultConfigStatus).toBe('success');
    expect(result.current.defaultConfigStatusRef.current).toBe('success');
    expect(result.current.swapNetworks).toEqual([freshNetwork]);
  });

  it('shares the in-flight request with simultaneous refresh callers', async () => {
    const request = deferred<ISwapNetwork[]>();
    mockFetchNetworks.mockReturnValue(request.promise);
    const { result } = renderHook(useSwapNetworks);
    await waitFor(() => expect(mockFetchNetworks).toHaveBeenCalledTimes(1));
    const refreshes: Promise<void>[] = [];

    act(() => {
      refreshes.push(
        result.current.fetchSwapNetworks(),
        result.current.fetchSwapNetworks(),
      );
    });
    expect(mockFetchNetworks).toHaveBeenCalledTimes(1);

    await act(async () => {
      request.resolve([freshNetwork]);
      await Promise.all(refreshes);
    });

    expect(mockFetchNetworks).toHaveBeenCalledTimes(1);
    expect(mockGetNetworkCache).toHaveBeenCalledTimes(1);
    expect(result.current.defaultConfigStatus).toBe('success');
    expect(result.current.swapNetworks).toEqual([freshNetwork]);
  });
});
