import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { useCarouselIndex } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getTokenSubtitle } from '@onekeyhq/shared/src/utils/perpsUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketWatchListItemV2 } from '@onekeyhq/shared/types/market';

import {
  SORT_MAP,
  buildMarketNetworkLogoUriMap,
  getNativeTokenInfo,
  getNetworkLogoUri,
  transformApiItemToToken,
} from '../utils/tokenListHelpers';

import type { IMarketToken } from '../MarketTokenData';

// Cached token list shared with the edit dialog so it opens instantly.
let watchlistTokenCache: IMarketToken[] = [];
const cacheListeners = new Set<() => void>();

export function getWatchlistTokenCache(): IMarketToken[] {
  return watchlistTokenCache;
}

export function subscribeWatchlistTokenCache(cb: () => void) {
  cacheListeners.add(cb);
  return () => {
    cacheListeners.delete(cb);
  };
}

const getIsReady = () => watchlistTokenCache.length > 0;

export function useIsWatchlistTokenCacheReady(): boolean {
  return useSyncExternalStore(subscribeWatchlistTokenCache, getIsReady);
}

export interface IUseMarketWatchlistTokenListParams {
  watchlist: IMarketWatchListItemV2[];
  initialSortBy?: string;
  initialSortType?: 'asc' | 'desc';
  pageSize?: number;
  pollingInterval?: number;
  dataCacheRef?: RefObject<IMarketWatchlistDataCache | undefined>;
}

export interface IMarketWatchlistDataCache {
  spot?: Awaited<
    ReturnType<
      typeof backgroundApiProxy.serviceMarketV2.fetchMarketTokenListBatch
    >
  >;
  perps?: {
    tokenListData: Awaited<
      ReturnType<
        typeof backgroundApiProxy.serviceMarketV2.fetchMarketPerpsTokenList
      >
    >;
    tokenSearchAliases: Awaited<
      ReturnType<
        typeof backgroundApiProxy.serviceHyperliquid.getTokenSearchAliases
      >
    >;
  };
}

export function useMarketWatchlistTokenList({
  watchlist,
  initialSortBy,
  initialSortType,
  pageSize = 100,
  pollingInterval = timerUtils.getTimeDurationMs({ seconds: 30 }),
  dataCacheRef,
}: IUseMarketWatchlistTokenListParams) {
  const { networkList } = useMarketBasicConfig();
  const networkLogoUriMap = useMemo(
    () => buildMarketNetworkLogoUriMap(networkList),
    [networkList],
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [transformedData, setTransformedData] = useState<IMarketToken[]>([]);
  const [sortBy, setSortBy] = useState<string | undefined>(initialSortBy);
  const [sortType, setSortType] = useState<'asc' | 'desc' | undefined>(
    initialSortType,
  );
  const isLoadingMore = false;
  const hasMore = false;
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const pageIndex = useCarouselIndex();

  // Split watchlist into spot and perps items
  const spotItems = useMemo(
    () => watchlist.filter((item) => !item.perpsCoin && item.chainId),
    [watchlist],
  );
  const perpsItems = useMemo(
    () => watchlist.filter((item) => !!item.perpsCoin),
    [watchlist],
  );

  // ── Spot data fetching (existing logic) ──
  const {
    result: spotResult,
    isLoading: apiLoading,
    run: refetchData,
  } = usePromiseResult(
    async () => {
      if (!watchlist || watchlist.length === 0) {
        if (isInitialLoad) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
        return { list: [], failed: false } as const;
      }
      if (spotItems.length === 0) {
        return { list: [], failed: false } as const;
      }
      const tokenAddressList = spotItems.map((item) => ({
        chainId: item.chainId,
        contractAddress: item.contractAddress,
        isNative: item.isNative ?? false,
      }));
      try {
        const response =
          await backgroundApiProxy.serviceMarketV2.fetchMarketTokenListBatch({
            tokenAddressList,
          });
        return { ...response, failed: false };
      } catch (error) {
        if (!platformEnv.isNative) throw error;
        return { list: undefined, failed: true };
      }
    },
    [watchlist, spotItems, isInitialLoad],
    {
      pollingInterval,
      watchLoading: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      overrideIsFocused: (isFocused) => isFocused && pageIndex === 0,
      checkIsFocused: true,
    },
  );

  // ── Perps data: backend API (category=all — watchlist needs all tokens) ──
  const {
    result: perpsResult,
    isLoading: perpsLoading,
    run: refetchPerpsData,
  } = usePromiseResult(
    async () => {
      if (perpsItems.length === 0) return null;
      try {
        const [tokenListData, tokenSearchAliases] = await Promise.all([
          backgroundApiProxy.serviceMarketV2.fetchMarketPerpsTokenList({
            category: 'all',
          }),
          backgroundApiProxy.serviceHyperliquid.getTokenSearchAliases(),
        ]);
        return { tokenListData, tokenSearchAliases, failed: false };
      } catch (error) {
        if (!platformEnv.isNative) throw error;
        return {
          tokenListData: undefined,
          tokenSearchAliases: undefined,
          failed: true,
        };
      }
    },
    [perpsItems.length],
    {
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 30 }),
      watchLoading: platformEnv.isNative,
      revalidateOnReconnect: platformEnv.isNative,
    },
  );

  const lastSpotResultRef = useRef<typeof spotResult>(
    dataCacheRef?.current?.spot
      ? { ...dataCacheRef.current.spot, failed: false }
      : undefined,
  );
  const lastPerpsResultRef = useRef<typeof perpsResult>(
    dataCacheRef?.current?.perps
      ? { ...dataCacheRef.current.perps, failed: false }
      : undefined,
  );
  useEffect(() => {
    if (spotResult && !spotResult.failed) {
      lastSpotResultRef.current = spotResult;
      if (dataCacheRef && spotResult.list)
        dataCacheRef.current = {
          ...dataCacheRef.current,
          spot: { list: [...spotResult.list] },
        };
    }
  }, [dataCacheRef, spotResult]);
  useEffect(() => {
    if (perpsResult && !perpsResult.failed) {
      lastPerpsResultRef.current = perpsResult;
      if (
        dataCacheRef &&
        perpsResult.tokenListData &&
        perpsResult.tokenSearchAliases
      )
        dataCacheRef.current = {
          ...dataCacheRef.current,
          perps: {
            tokenListData: perpsResult.tokenListData,
            tokenSearchAliases: perpsResult.tokenSearchAliases,
          },
        };
    }
  }, [dataCacheRef, perpsResult]);
  // The native page owner survives distant-page unmounts. Merge cached data
  // against the current watchlist below so removed favorites cannot reappear.
  const apiResult =
    spotResult?.failed || (!spotResult && dataCacheRef)
      ? lastSpotResultRef.current
      : spotResult;
  const perpsApiResult =
    perpsResult?.failed || (!perpsResult && dataCacheRef)
      ? lastPerpsResultRef.current
      : perpsResult;

  // Combined loading state
  const isLoading =
    isInitialLoad ||
    apiLoading ||
    (platformEnv.isNative &&
      ((spotItems.length > 0 && apiLoading !== false && !spotResult) ||
        (perpsItems.length > 0 && perpsLoading !== false && !perpsResult)));
  const isError = Boolean(
    (spotItems.length > 0 && spotResult?.failed) ||
    (perpsItems.length > 0 && perpsResult?.failed),
  );
  const refetch = useCallback(async () => {
    await Promise.all([refetchData(), refetchPerpsData()]);
  }, [refetchData, refetchPerpsData]);

  // ── Build perps IMarketToken items from backend ──
  const perpsTokenMap = useMemo(() => {
    const tokens = perpsApiResult?.tokenListData?.tokens;
    if (!tokens) return new Map<string, IMarketToken>();
    const aliases = perpsApiResult?.tokenSearchAliases;
    const map = new Map<string, IMarketToken>();
    for (const t of tokens) {
      map.set(t.name, {
        id: `perps_${t.name}`,
        name: t.displayName,
        symbol: t.displayName,
        address: '',
        decimals: 0,
        price: Number(t.markPrice),
        change24h: t.change24hPercent,
        marketCap: 0,
        liquidity: 0,
        transactions: 0,
        uniqueTraders: 0,
        holders: 0,
        turnover: Number(t.volume24h || 0),
        tokenImageUri: t.tokenImageUrl,
        networkLogoUri: '',
        networkId: '',
        chainId: '',
        perpsCoin: t.name,
        maxLeverage: t.maxLeverage,
        perpsSubtitle: getTokenSubtitle(t.name, aliases),
      });
    }
    return map;
  }, [perpsApiResult]);

  // ── Merge spot + perps into transformedData ──
  useEffect(() => {
    // Transform spot items
    const spotTransformed: IMarketToken[] = [];
    if (apiResult?.list) {
      const tokenMap: Record<
        string,
        { chainId: string; sortIndex: number; isNative: boolean }
      > = {};
      spotItems.forEach((w) => {
        const { isNative, normalizedAddress } = getNativeTokenInfo(
          w.isNative,
          w.contractAddress,
        );
        const key = `${w.chainId}:${normalizedAddress}`;
        tokenMap[key] = {
          chainId: w.chainId,
          sortIndex: w.sortIndex ?? 0,
          isNative,
        };
      });

      apiResult.list
        .filter(
          (item) => item && item.address !== null && item.address !== undefined,
        )
        .forEach((item) => {
          const networkId = item.networkId || '';
          const { normalizedAddress } = getNativeTokenInfo(
            item.isNative,
            item.address,
          );
          const key = `${networkId}:${normalizedAddress}`;
          const tokenInfo = tokenMap[key];
          const chainId = tokenInfo?.chainId || networkId;
          const networkLogoUri =
            networkLogoUriMap.get(chainId) || getNetworkLogoUri(chainId);
          const sortIndex = tokenInfo?.sortIndex;

          spotTransformed.push(
            transformApiItemToToken(item, {
              chainId,
              networkLogoUriMap,
              networkLogoUri,
              sortIndex,
            }),
          );
        });
    }

    // Build result array in watchlist order to maintain correct sorting
    const merged = watchlist
      .map((watchlistItem) => {
        // Perps item — look up from perpsTokenMap
        if (watchlistItem.perpsCoin) {
          const perpsToken = perpsTokenMap.get(watchlistItem.perpsCoin);
          if (perpsToken) {
            return { ...perpsToken, sortIndex: watchlistItem.sortIndex ?? 0 };
          }
          // Perps token not found in universe (may be delisted) — skip
          return undefined;
        }

        // Spot item — find in spotTransformed
        const found = spotTransformed.find((token) => {
          const { normalizedAddress: tokenKey } = getNativeTokenInfo(
            token.isNative,
            token.address,
          );
          const { normalizedAddress: watchlistKey } = getNativeTokenInfo(
            watchlistItem.isNative,
            watchlistItem.contractAddress,
          );
          return (
            tokenKey === watchlistKey && watchlistItem.chainId === token.chainId
          );
        });
        return found;
      })
      .filter(Boolean);

    setTransformedData(merged);

    if (isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [
    apiResult,
    watchlist,
    spotItems,
    perpsTokenMap,
    isInitialLoad,
    networkLogoUriMap,
  ]);

  // Sorting
  const sortedData = useMemo(() => {
    if (!sortBy || !sortType) {
      return transformedData.toSorted((a, b) => {
        const av = a.sortIndex ?? 0;
        const bv = b.sortIndex ?? 0;
        return av - bv;
      });
    }

    const key = SORT_MAP[sortBy] || sortBy;
    return transformedData.toSorted((a, b) => {
      const av = a[key] as number;
      const bv = b[key] as number;
      if (av === bv) return 0;
      return sortType === 'asc' ? av - bv : bv - av;
    });
  }, [transformedData, sortBy, sortType]);

  const totalCount = sortedData.length;
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 1;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [totalPages, currentPage]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const loadMore = useCallback(() => {
    // Watchlist doesn't support load more - all data is loaded at once
  }, []);

  const refresh = useCallback(() => {
    setCurrentPage(1);
    void refetchData();
  }, [refetchData]);

  useEffect(() => {
    watchlistTokenCache = paginatedData;
    cacheListeners.forEach((cb) => cb());
  }, [paginatedData]);

  // Clear stale cache on unmount so re-mounting reads fresh data
  useEffect(
    () => () => {
      watchlistTokenCache = [];
      cacheListeners.forEach((cb) => cb());
    },
    [],
  );

  return {
    data: paginatedData,
    isLoading,
    isError,
    isLoadingMore,
    isNetworkSwitching: false,
    canLoadMore: hasMore,
    currentPage,
    totalPages,
    totalCount,
    setCurrentPage,
    loadMore,
    refresh,
    refetch: platformEnv.isNative ? refetch : refetchData,
    sortBy,
    sortType,
    setSortBy,
    setSortType,
  } as const;
}
