/** @jest-environment jsdom */

import { act, render, waitFor } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  swrCacheUtils,
  swrKeys,
} from '@onekeyhq/shared/src/utils/swrCacheUtils';
import type {
  IMarketBasicConfigNetwork,
  IMarketTokenListResponse,
} from '@onekeyhq/shared/types/marketV2';

import { transformApiItemToToken } from '../utils/tokenListHelpers';

import { fetchMarketTokenListForPlatform } from './marketTokenListPlatformApi';
import { useMarketTokenList } from './useMarketTokenList';

const mockTrackNetworkLoading = jest.fn();
let mockLocale = 'en-US';
let mockNetworkList: IMarketBasicConfigNetwork[] = [];

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

jest.mock('@onekeyhq/kit/src/hooks/useLocaleVariant', () => ({
  useLocaleVariant: () => mockLocale,
}));

jest.mock('@onekeyhq/kit/src/views/Market/hooks', () => ({
  useMarketBasicConfig: () => ({
    minLiquidity: 5000,
    networkList: mockNetworkList,
  }),
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

jest.mock('../utils/tokenListHelpers', () => {
  type ITokenItem = {
    address: string;
    name: string;
    symbol: string;
    networkId?: string;
  };
  type ITransformOptions = {
    chainId: string;
    networkLogoUriMap?: ReadonlyMap<string, string>;
    networkLogoUri: string;
  };
  const getMarketTokenNetworkLogoUri = ({
    tokenNetworkId,
    chainId,
    networkLogoUriMap,
    networkLogoUri,
  }: ITransformOptions & { tokenNetworkId?: string }) => {
    if (!tokenNetworkId) {
      return networkLogoUri;
    }
    return (
      networkLogoUriMap?.get(tokenNetworkId) ||
      (tokenNetworkId === chainId ? networkLogoUri : '')
    );
  };

  return {
    buildMarketNetworkLogoUriMap: (networkList: IMarketBasicConfigNetwork[]) =>
      new Map(
        networkList.map(
          (network) => [network.networkId, network.logoUrl] as const,
        ),
      ),
    getMarketTokenNetworkLogoUri,
    getNetworkLogoUri: (networkId: string) =>
      networkId === 'evm--1' ? 'network-logo' : '',
    transformApiItemToToken: jest.fn(
      (item: ITokenItem, options: ITransformOptions) => {
        const tokenNetworkId = item.networkId || options.chainId;
        const networkLogoUri = getMarketTokenNetworkLogoUri({
          tokenNetworkId: item.networkId,
          ...options,
        });
        return {
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
          networkLogoUri,
          networkId: tokenNetworkId,
          chainId: tokenNetworkId,
        };
      },
    ),
  };
});

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
  const mutablePlatformEnv = platformEnv as {
    isNative: boolean;
    isWeb: boolean;
  };
  const cacheKey = swrKeys.marketHomeTokenList({
    networkId: 'evm--1',
    locale: 'en-US',
    sortBy: 'v24hUSD',
    sortType: 'desc',
    pageSize: 20,
    minLiquidity: 5000,
    type: 'trending',
  });
  const mockFetchMarketTokenList = jest.mocked(fetchMarketTokenListForPlatform);
  const mockTransformApiItemToToken = jest.mocked(transformApiItemToToken);

  beforeEach(() => {
    Object.defineProperty(globalThis, 'cancelIdleCallback', {
      configurable: true,
      value: jest.fn(),
    });
    mutablePlatformEnv.isNative = false;
    mutablePlatformEnv.isWeb = true;
    mockLocale = 'en-US';
    mockNetworkList = [];
    swrCacheUtils.clearAll();
    swrCacheUtils.flushNow();
    mockFetchMarketTokenList.mockReset();
    mockTransformApiItemToToken.mockClear();
    mockTrackNetworkLoading.mockReset();
  });

  afterEach(() => {
    swrCacheUtils.clearAll();
    swrCacheUtils.flushNow();
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

  it('replays native SWR rows synchronously without using the web seed path', async () => {
    mutablePlatformEnv.isNative = true;
    mutablePlatformEnv.isWeb = false;
    const cachedResponse = createResponse('0xcached', 'Cached Token', 'CACHED');
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
        undefined,
      );
    });
  });

  it('requests the current locale immediately after it changes', async () => {
    mockFetchMarketTokenList.mockResolvedValue(
      createResponse('0xremote', 'Remote Token', 'REMOTE'),
    );

    function Probe() {
      useMarketTokenList({
        networkId: 'evm--1',
        pollingInterval: 0,
        type: 'trending',
      });
      return null;
    }

    const { rerender } = render(<Probe />);

    await waitFor(() => {
      expect(mockFetchMarketTokenList).toHaveBeenCalledTimes(1);
    });

    mockLocale = 'zh-CN';
    rerender(<Probe />);

    await waitFor(() => {
      expect(mockFetchMarketTokenList).toHaveBeenCalledTimes(2);
    });
  });

  it('passes dynamic Market network logos to token transformation', async () => {
    mockNetworkList = [
      {
        networkId: 'evm--143',
        index: 1,
        name: 'Monad',
        logoUrl: 'https://example.com/monad.png',
        explorerUrl: 'https://example.com',
        chainId: '143',
      },
    ];
    mockFetchMarketTokenList.mockResolvedValue({
      list: [
        {
          address: '0xmonad',
          name: 'Monad Token',
          symbol: 'MON',
          decimals: 18,
          networkId: 'evm--143',
        },
      ],
      total: 1,
    });

    function Probe() {
      useMarketTokenList({
        networkId: 'evm--143',
        pollingInterval: 0,
        type: 'trending',
      });
      return null;
    }

    render(<Probe />);

    await waitFor(() => {
      const transformOptions = mockTransformApiItemToToken.mock.calls.find(
        ([item]) => item.address === '0xmonad',
      )?.[1];
      expect(transformOptions?.networkLogoUri).toBe(
        'https://example.com/monad.png',
      );
      expect(transformOptions?.networkLogoUriMap?.get('evm--143')).toBe(
        'https://example.com/monad.png',
      );
    });
  });

  it('keeps loaded pages and uses the latest logos when config resolves before page 2', async () => {
    const pageTwoRequest = createDeferred<IMarketTokenListResponse>();
    let latestResult: ReturnType<typeof useMarketTokenList> | undefined;
    let loadMorePromise: Promise<void> | undefined;

    mockFetchMarketTokenList.mockResolvedValueOnce({
      list: [
        {
          address: '0xpage1',
          name: 'Page One',
          symbol: 'ONE',
          decimals: 18,
          networkId: 'evm--143',
        },
      ],
      total: 2,
    });

    function Probe() {
      latestResult = useMarketTokenList({
        networkId: 'evm--143',
        pageSize: 1,
        pollingInterval: 0,
        type: 'trending',
      });
      return null;
    }

    const view = render(<Probe />);
    await waitFor(() => expect(latestResult?.canLoadMore).toBe(true));

    mockFetchMarketTokenList.mockReturnValueOnce(pageTwoRequest.promise);
    await act(async () => {
      loadMorePromise = latestResult?.loadMore();
      await Promise.resolve();
    });

    mockNetworkList = [
      {
        networkId: 'evm--143',
        index: 1,
        name: 'Monad',
        logoUrl: 'https://example.com/monad.png',
        explorerUrl: 'https://example.com',
        chainId: '143',
      },
    ];
    view.rerender(<Probe />);
    await waitFor(() => {
      expect(latestResult?.data).toHaveLength(1);
      expect(latestResult?.data[0]?.networkLogoUri).toBe(
        'https://example.com/monad.png',
      );
    });

    await act(async () => {
      pageTwoRequest.resolve({
        list: [
          {
            address: '0xpage2',
            name: 'Page Two',
            symbol: 'TWO',
            decimals: 18,
            networkId: 'evm--143',
          },
        ],
        total: 2,
      });
      await loadMorePromise;
    });

    await waitFor(() => {
      expect(latestResult?.data).toHaveLength(2);
      expect(
        latestResult?.data.every(
          (item) => item.networkLogoUri === 'https://example.com/monad.png',
        ),
      ).toBe(true);
    });
  });

  it('refreshes every loaded page without resetting pagination when config resolves later', async () => {
    let latestResult: ReturnType<typeof useMarketTokenList> | undefined;

    mockFetchMarketTokenList
      .mockResolvedValueOnce({
        list: [
          {
            address: '0xpage1',
            name: 'Page One',
            symbol: 'ONE',
            decimals: 18,
            networkId: 'evm--143',
          },
        ],
        total: 2,
      })
      .mockResolvedValueOnce({
        list: [
          {
            address: '0xpage2',
            name: 'Page Two',
            symbol: 'TWO',
            decimals: 18,
            networkId: 'evm--143',
          },
        ],
        total: 2,
      });

    function Probe() {
      latestResult = useMarketTokenList({
        networkId: 'evm--143',
        pageSize: 1,
        pollingInterval: 0,
        type: 'trending',
      });
      return null;
    }

    const view = render(<Probe />);
    await waitFor(() => expect(latestResult?.canLoadMore).toBe(true));

    await act(async () => {
      await latestResult?.loadMore();
    });
    await waitFor(() => {
      expect(latestResult?.data).toHaveLength(2);
      expect(latestResult?.currentPage).toBe(2);
    });

    mockNetworkList = [
      {
        networkId: 'evm--143',
        index: 1,
        name: 'Monad',
        logoUrl: 'https://example.com/monad.png',
        explorerUrl: 'https://example.com',
        chainId: '143',
      },
    ];
    view.rerender(<Probe />);

    await waitFor(() => {
      expect(latestResult?.data).toHaveLength(2);
      expect(latestResult?.currentPage).toBe(2);
      expect(
        latestResult?.data.every(
          (item) => item.networkLogoUri === 'https://example.com/monad.png',
        ),
      ).toBe(true);
    });
  });

  it('omits sorting when the caller requests the API default order', async () => {
    mockFetchMarketTokenList.mockResolvedValue(
      createResponse('0xremote', 'Remote Token', 'REMOTE'),
    );

    function Probe() {
      useMarketTokenList({
        networkId: 'evm--1',
        pollingInterval: 0,
        type: 'trending',
        useApiDefaultSort: true,
      });
      return null;
    }

    render(<Probe />);

    await waitFor(() => {
      expect(mockFetchMarketTokenList).toHaveBeenCalledWith(
        expect.objectContaining({
          networkId: 'evm--1',
          page: 1,
          sortBy: undefined,
          sortType: undefined,
          type: 'trending',
        }),
        undefined,
      );
    });
  });
});
