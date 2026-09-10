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
    priceChange24hPercent?: string;
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
    marketTokenKey: (item: {
      assetId?: string;
      stockId?: string;
      perpsCoin?: string;
      networkId: string;
      address?: string;
      isNative?: boolean;
    }) => {
      if (item.assetId) return `asset:${item.assetId}`;
      if (item.stockId) return `stock:${item.stockId}`;
      return item.perpsCoin
        ? `perps:${item.perpsCoin}`
        : `${item.networkId}:${(item.address || '').toLowerCase()}:${item.isNative ? 1 : 0}`;
    },
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
          change24h: Number(item.priceChange24hPercent) || 0,
          priceChangeRaw: item.priceChange24hPercent,
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
  priceChange24hPercent?: string,
): IMarketTokenListResponse {
  return {
    list: [{ address, name, symbol, decimals: 18, priceChange24hPercent }],
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
    Object.defineProperty(globalThis, 'requestIdleCallback', {
      configurable: true,
      value: (callback: () => void) => setTimeout(callback, 0),
    });
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

  it('replaces a missing price change when a refresh returns zero', async () => {
    let latestResult: ReturnType<typeof useMarketTokenList> | undefined;
    mockFetchMarketTokenList
      .mockResolvedValueOnce(createResponse('0xtoken', 'Token', 'TOKEN', '-'))
      .mockResolvedValueOnce(createResponse('0xtoken', 'Token', 'TOKEN', '0'));

    function Probe() {
      latestResult = useMarketTokenList({
        networkId: 'evm--1',
        pollingInterval: 0,
        type: 'trending',
      });
      return null;
    }

    render(<Probe />);

    await waitFor(() => {
      expect(latestResult?.data[0]?.priceChangeRaw).toBe('-');
    });

    await act(async () => {
      latestResult?.refresh();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(latestResult?.data[0]?.priceChangeRaw).toBe('0');
    });
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

  it('deduplicates overlapping native ranking pages without losing page progress', async () => {
    mutablePlatformEnv.isNative = true;
    mutablePlatformEnv.isWeb = false;
    let latestResult: ReturnType<typeof useMarketTokenList> | undefined;
    mockFetchMarketTokenList.mockImplementation(async ({ page }) =>
      page === 1
        ? {
            list: [
              {
                address: '0xDuplicate',
                name: 'Page One',
                symbol: 'ONE',
                decimals: 18,
              },
            ],
            total: 2,
          }
        : {
            list: [
              {
                address: '0xduplicate',
                name: 'Moved Ranking',
                symbol: 'ONE',
                decimals: 18,
              },
              {
                address: '0xunique',
                name: 'Page Two',
                symbol: 'TWO',
                decimals: 18,
              },
            ],
            total: 2,
          },
    );

    function Probe() {
      latestResult = useMarketTokenList({
        networkId: 'evm--1',
        pageSize: 1,
        pollingInterval: 0,
        type: 'trending',
      });
      return null;
    }

    render(<Probe />);
    await waitFor(() => expect(latestResult?.canLoadMore).toBe(true));
    await act(async () => latestResult?.loadMore());
    await waitFor(() => {
      expect(latestResult?.data.map((item) => item.id)).toEqual([
        '0xDuplicate',
        '0xunique',
      ]);
      expect(latestResult?.currentPage).toBe(2);
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
  it('ends native network-switch loading on failure and recovers through refetch', async () => {
    mutablePlatformEnv.isNative = true;
    mutablePlatformEnv.isWeb = false;
    let latestResult: ReturnType<typeof useMarketTokenList> | undefined;
    mockFetchMarketTokenList.mockRejectedValue(new Error('offline'));
    function Probe() {
      latestResult = useMarketTokenList({
        networkId: 'evm--1',
        pollingInterval: 0,
        type: 'trending',
      });
      return null;
    }
    render(<Probe />);
    await waitFor(() => expect(latestResult?.isError).toBe(true));
    expect(latestResult?.isLoading).toBe(false);
    expect(latestResult?.isNetworkSwitching).toBe(false);
    expect(latestResult?.data).toEqual([]);
    mockFetchMarketTokenList.mockImplementation(async (_params, options) => {
      if (!options?.forceRemote) {
        return Promise.reject(new Error('cached offline failure'));
      }
      return createResponse('0xremote', 'Remote Token', 'REMOTE');
    });
    await act(async () => latestResult?.refetch());
    expect(latestResult?.isError).toBe(false);
    expect(latestResult?.data[0]?.id).toBe('0xremote');
  });

  it('ends native cold-start loading when the network is initialized after mount', async () => {
    mutablePlatformEnv.isNative = true;
    mutablePlatformEnv.isWeb = false;
    let latestResult: ReturnType<typeof useMarketTokenList> | undefined;
    mockFetchMarketTokenList.mockRejectedValue(new Error('offline'));
    function Probe({ networkId }: { networkId: string }) {
      latestResult = useMarketTokenList({
        networkId,
        pollingInterval: 0,
        type: 'trending',
      });
      return null;
    }
    const { rerender } = render(<Probe networkId="" />);
    await act(async () => latestResult?.refetch());
    expect(mockFetchMarketTokenList).not.toHaveBeenCalled();
    rerender(<Probe networkId="evm--1" />);
    await waitFor(() => expect(latestResult?.isError).toBe(true));
    expect(latestResult?.isLoading).toBe(false);
    expect(latestResult?.isNetworkSwitching).toBe(false);
    expect(latestResult?.data).toEqual([]);
    mockFetchMarketTokenList.mockResolvedValue(
      createResponse('0xremote', 'Remote Token', 'REMOTE'),
    );
    await act(async () => latestResult?.refetch());
    expect(latestResult?.isError).toBe(false);
    expect(latestResult?.isLoading).toBe(false);
    expect(latestResult?.data[0]?.id).toBe('0xremote');
  });

  it('keeps native rows when an offline refresh uses the last successful response', async () => {
    mutablePlatformEnv.isNative = true;
    mutablePlatformEnv.isWeb = false;
    let latestResult: ReturnType<typeof useMarketTokenList> | undefined;
    mockFetchMarketTokenList.mockResolvedValue(
      createResponse('0xremote', 'Remote Token', 'REMOTE'),
    );
    function Probe() {
      latestResult = useMarketTokenList({
        networkId: 'evm--1',
        pollingInterval: 0,
        type: 'trending',
      });
      return null;
    }
    render(<Probe />);
    await waitFor(() => expect(latestResult?.data[0]?.id).toBe('0xremote'));
    mockFetchMarketTokenList.mockRejectedValue(new Error('offline'));
    await act(async () => latestResult?.refetch());
    expect(latestResult?.isError).toBe(true);
    expect(latestResult?.data[0]?.id).toBe('0xremote');
    expect(latestResult?.isLoading).toBe(false);
  });

  it('starts only one native page request for concurrent end-reached events', async () => {
    mutablePlatformEnv.isNative = true;
    mutablePlatformEnv.isWeb = false;
    let latestResult: ReturnType<typeof useMarketTokenList> | undefined;
    const nextPage = createDeferred<IMarketTokenListResponse>();
    mockFetchMarketTokenList.mockImplementation(async ({ page }) =>
      page === 1
        ? { ...createResponse('first', 'First', 'FIRST'), total: 4 }
        : nextPage.promise,
    );
    function Probe() {
      latestResult = useMarketTokenList({
        networkId: 'evm--1',
        pollingInterval: 0,
        pageSize: 1,
        type: 'trending',
      });
      return null;
    }
    render(<Probe />);
    await waitFor(() =>
      expect(latestResult?.isProvisionalFirstPageResult).toBe(false),
    );
    let requests: Promise<void>[] = [];
    act(() => {
      if (latestResult) {
        requests = [latestResult.loadMore(), latestResult.loadMore()];
      }
    });
    const nextPageCalls = mockFetchMarketTokenList.mock.calls.filter(
      ([params]) => params.page === 2,
    ).length;
    await act(async () => {
      nextPage.resolve({
        ...createResponse('second', 'Second', 'SECOND'),
        total: 4,
      });
      await Promise.all(requests);
    });
    expect(nextPageCalls).toBe(1);
    expect(latestResult?.data.map((item) => item.id)).toEqual([
      'first',
      'second',
    ]);
  });

  it('does not append an old native page after a refreshed first page', async () => {
    mutablePlatformEnv.isNative = true;
    mutablePlatformEnv.isWeb = false;
    let latestResult: ReturnType<typeof useMarketTokenList> | undefined;
    const nextPage = createDeferred<IMarketTokenListResponse>();
    mockFetchMarketTokenList.mockImplementation(async ({ page }) =>
      page === 1
        ? { ...createResponse('first', 'First', 'FIRST'), total: 4 }
        : nextPage.promise,
    );
    function Probe() {
      latestResult = useMarketTokenList({
        networkId: 'evm--1',
        pollingInterval: 0,
        pageSize: 1,
        type: 'trending',
      });
      return null;
    }
    render(<Probe />);
    await waitFor(() =>
      expect(latestResult?.isProvisionalFirstPageResult).toBe(false),
    );
    let pending: Promise<void> | undefined;
    act(() => {
      pending = latestResult?.loadMore();
    });
    expect(latestResult?.isLoadingMore).toBe(true);
    mockFetchMarketTokenList.mockResolvedValue({
      ...createResponse('fresh', 'Fresh', 'FRESH'),
      total: 4,
    });
    await act(async () => latestResult?.refetch());
    await act(async () => {
      nextPage.resolve({
        ...createResponse('stale', 'Stale', 'STALE'),
        total: 4,
      });
      await pending;
    });
    expect(latestResult?.data.map((item) => item.id)).toEqual(['fresh']);
    expect(latestResult?.currentPage).toBe(1);
    expect(latestResult?.isLoadingMore).toBe(false);
  });

  it('keeps current native pagination loading when an old category finishes', async () => {
    mutablePlatformEnv.isNative = true;
    mutablePlatformEnv.isWeb = false;
    let latestResult: ReturnType<typeof useMarketTokenList> | undefined;
    const oldPage = createDeferred<IMarketTokenListResponse>();
    const newPage = createDeferred<IMarketTokenListResponse>();
    mockFetchMarketTokenList.mockImplementation(async ({ page, category }) => {
      if (page !== 1)
        return category === 'old' ? oldPage.promise : newPage.promise;
      return { ...createResponse(category || '', 'Token', 'TOKEN'), total: 4 };
    });
    function Probe({ category }: { category: string }) {
      latestResult = useMarketTokenList({
        networkId: 'evm--1',
        pollingInterval: 0,
        pageSize: 1,
        type: 'trending',
        category,
      });
      return null;
    }
    const view = render(<Probe category="old" />);
    await waitFor(() =>
      expect(latestResult?.isProvisionalFirstPageResult).toBe(false),
    );
    let oldRequest: Promise<void> | undefined;
    act(() => {
      oldRequest = latestResult?.loadMore();
    });
    view.rerender(<Probe category="new" />);
    await waitFor(() =>
      expect(latestResult?.isProvisionalFirstPageResult).toBe(false),
    );
    let newRequest: Promise<void> | undefined;
    act(() => {
      newRequest = latestResult?.loadMore();
    });
    await act(async () => {
      oldPage.resolve(createResponse('stale', 'Stale', 'STALE'));
      await oldRequest;
    });
    const loadingAfterOldCompletion = latestResult?.isLoadingMore;
    await act(async () => {
      newPage.resolve(createResponse('current', 'Current', 'CURRENT'));
      await newRequest;
    });
    expect(loadingAfterOldCompletion).toBe(true);
    expect(latestResult?.data.map((item) => item.id)).toEqual([
      'new',
      'current',
    ]);
    expect(latestResult?.isLoadingMore).toBe(false);
  });
});
