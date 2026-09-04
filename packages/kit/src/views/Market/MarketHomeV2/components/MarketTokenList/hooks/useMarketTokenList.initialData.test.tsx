/** @jest-environment jsdom */

import { act, render, renderHook, waitFor } from '@testing-library/react';

import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type { IMarketTokenListResponse } from '@onekeyhq/shared/types/marketV2';

import { fetchMarketTokenListForPlatform } from './marketTokenListPlatformApi';
import { useMarketTokenList } from './useMarketTokenList';

const mockTrackNetworkLoading = jest.fn();
type IUsePromiseResult =
  typeof import('@onekeyhq/kit/src/hooks/usePromiseResult').usePromiseResult;
let mockUsePromiseResultOverride: IUsePromiseResult | undefined;

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/kit/src/hooks/usePromiseResult')
  >('@onekeyhq/kit/src/hooks/usePromiseResult');

  return {
    ...actual,
    usePromiseResult: (...args: Parameters<IUsePromiseResult>) =>
      mockUsePromiseResultOverride
        ? mockUsePromiseResultOverride(...args)
        : actual.usePromiseResult(...args),
  };
});

jest.mock('@onekeyhq/components', () => ({
  getCurrentVisibilityState: () => true,
  onVisibilityStateChange: () => () => undefined,
  useDeferredPromise: () => ({
    promise: Promise.resolve(null),
    reset: jest.fn(),
    resolve: jest.fn(),
  }),
  useNetInfo: () => ({ isRawInternetReachable: true }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));

jest.mock('@onekeyhq/kit/src/views/Market/hooks', () => ({
  useMarketBasicConfig: () => ({ minLiquidity: 5000 }),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/hooks/useNetworkLoadingAnalytics',
  () => ({
    useNetworkLoadingAnalytics: () => ({
      trackNetworkLoading: mockTrackNetworkLoading,
    }),
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Market/utils/marketHomeTokenListSeed',
  () => ({
    discardMarketHomeTokenListSeedForInit: jest.fn(),
    getMarketHomeTokenListSeedForInit: jest.fn(() => undefined),
  }),
);

jest.mock('@onekeyhq/kit/src/views/Market/utils/marketReactPerf', () => ({
  markMarketReactPerf: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false, isWeb: true },
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: { isAllNetwork: () => false },
}));

jest.mock('../utils/tokenListHelpers', () => ({
  getNetworkLogoUri: () => 'network-logo',
  transformApiItemToToken: (item: {
    address: string;
    name: string;
    symbol: string;
  }) => ({
    id: item.address,
    name: item.name,
    symbol: item.symbol,
    address: item.address,
    decimals: 18,
    price: 1,
    change24h: 0,
    marketCap: 0,
    liquidity: 0,
    transactions: 0,
    uniqueTraders: 0,
    holders: 0,
    turnover: 0,
    tokenImageUri: '',
    networkLogoUri: 'network-logo',
    networkId: 'evm--1',
    chainId: 'evm--1',
  }),
}));

jest.mock('./marketTokenListPlatformApi', () => ({
  fetchMarketTokenListForPlatform: jest.fn(),
}));

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function createResponse(
  address: string,
  name: string,
  symbol: string,
): IMarketTokenListResponse {
  return {
    list: [{ address, name, symbol, decimals: 18 }],
    total: 1,
  };
}

describe('useMarketTokenList initial data', () => {
  const cacheKey = swrKeys.marketHomeTokenList({
    networkId: 'evm--1',
    sortBy: 'v24hUSD',
    sortType: 'desc',
    pageSize: 20,
    minLiquidity: 5000,
    type: 'trending',
  });
  const mockFetchMarketTokenList = jest.mocked(fetchMarketTokenListForPlatform);

  beforeEach(() => {
    mockUsePromiseResultOverride = undefined;
    swrCacheUtils.clearAll();
    swrCacheUtils.flushNow();
    mockFetchMarketTokenList.mockReset();
    mockTrackNetworkLoading.mockReset();
  });

  afterEach(() => {
    mockUsePromiseResultOverride = undefined;
    swrCacheUtils.clearAll();
    swrCacheUtils.flushNow();
  });

  it('stops reporting a network switch after an empty request settles', async () => {
    let settleRequest: () => void = () => undefined;

    mockUsePromiseResultOverride = ((_method, _deps, options) => {
      settleRequest = () => options?.onIsLoadingChange?.(false);
      return {
        result: undefined,
        setResult: jest.fn(),
        isLoading: false,
        run: jest.fn(async () => undefined),
        setStopPolling: jest.fn(() => false),
      };
    }) as IUsePromiseResult;

    const { result } = renderHook(() =>
      useMarketTokenList({
        networkId: 'evm--1',
        pollingInterval: 0,
        type: 'trending',
      }),
    );
    await act(async () => {
      settleRequest();
      await Promise.resolve();
    });

    expect(result.current).toMatchObject({
      data: [],
      isLoading: false,
      isNetworkSwitching: false,
    });
  });

  it('renders SWR rows on the first frame, then replaces and caches the remote page', async () => {
    const cachedResponse = createResponse('0xcached', 'Cached Token', 'CACHED');
    const remoteResponse = createResponse('0xremote', 'Remote Token', 'REMOTE');
    const remoteRequest = createDeferred<IMarketTokenListResponse>();
    const renderedTokenIds: string[][] = [];

    swrCacheUtils.set(cacheKey, cachedResponse);
    mockFetchMarketTokenList.mockReturnValueOnce(remoteRequest.promise);

    function Probe() {
      const result = useMarketTokenList({
        networkId: 'evm--1',
        pollingInterval: 0,
        type: 'trending',
      });
      renderedTokenIds.push(result.data.map((item) => item.id));
      return null;
    }

    render(<Probe />);

    expect(renderedTokenIds[0]).toEqual(['0xcached']);
    await waitFor(() => {
      expect(mockFetchMarketTokenList).toHaveBeenCalledWith(
        expect.objectContaining({
          networkId: 'evm--1',
          page: 1,
          type: 'trending',
        }),
        { forceRemote: true },
      );
    });

    await act(async () => {
      remoteRequest.resolve(remoteResponse);
      await remoteRequest.promise;
    });

    await waitFor(() => {
      expect(renderedTokenIds.at(-1)).toEqual(['0xremote']);
    });
    expect(swrCacheUtils.get<IMarketTokenListResponse>(cacheKey)).toMatchObject(
      remoteResponse,
    );
  });
});
