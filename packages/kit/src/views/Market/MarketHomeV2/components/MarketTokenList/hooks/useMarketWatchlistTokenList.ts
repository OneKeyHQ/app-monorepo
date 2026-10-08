import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';

import { uniq } from 'lodash';
import pLimit from 'p-limit';

import { useCarouselIndex } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { getMarketWatchlistKey } from '@onekeyhq/shared/src/utils/marketWatchlistIdentity';
import { getTokenSubtitle } from '@onekeyhq/shared/src/utils/perpsUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IMarketListingWatchlistQuote,
  IMarketWatchListItemV2,
} from '@onekeyhq/shared/types/market';

import {
  SORT_MAP,
  buildMarketNetworkLogoUriMap,
  getNativeTokenInfo,
  getNetworkLogoUri,
  normalizeStockMetadataValue,
  transformApiItemToToken,
} from '../utils/tokenListHelpers';

import { fetchMarketTokenListBatchForPlatform } from './marketTokenBatchPlatformApi';

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

export interface IMarketWatchlistListingQuoteEntry {
  key: string;
  quote: IMarketListingWatchlistQuote | undefined;
}

export interface IMarketWatchlistDataCache {
  spot?: Awaited<
    ReturnType<
      typeof backgroundApiProxy.serviceMarketV2.fetchMarketTokenListBatch
    >
  >;
  listing?: IMarketWatchlistListingQuoteEntry[];
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

function isWatchlistSpotItem(item: IMarketWatchListItemV2) {
  return (
    !item.perpsCoin && !item.assetId && !item.stockId && Boolean(item.chainId)
  );
}

function isWatchlistListingItem(item: IMarketWatchListItemV2) {
  return Boolean(item.assetId || item.stockId);
}

function isWatchlistPerpsItem(item: IMarketWatchListItemV2) {
  return Boolean(item.perpsCoin);
}

// A remount may paint immediately only when the cache already covers every
// source this watchlist needs. One populated source is not enough: the missing
// source would insert later and reorder the first paint (OK-63895).
function watchlistMountCacheCoversSources(
  cache: IMarketWatchlistDataCache | undefined,
  items: IMarketWatchListItemV2[],
) {
  if (!cache || items.length === 0) {
    return false;
  }
  const needsSpot = items.some(isWatchlistSpotItem);
  const needsListing = items.some(isWatchlistListingItem);
  const needsPerps = items.some(isWatchlistPerpsItem);
  if (needsSpot && !cache.spot?.list?.length) {
    return false;
  }
  if (needsListing && !cache.listing?.length) {
    return false;
  }
  if (needsPerps && !cache.perps?.tokenListData) {
    return false;
  }
  return needsSpot || needsListing || needsPerps;
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
  const [sortBy, setSortBy] = useState<string | undefined>(initialSortBy);
  const [sortType, setSortType] = useState<'asc' | 'desc' | undefined>(
    initialSortType,
  );
  const isLoadingMore = false;
  const hasMore = false;
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  // Cold start paints spot, listings, and perps as each request returns, so
  // rows pop in and the order jumps (OK-63895). Hold the first commit until
  // every source for this watchlist has settled. The mount's own loading
  // flags are current: a sync result with isLoading false can paint
  // immediately. A later watchlist change still carries the previous
  // request's idle flags until its effect starts, so that render does not
  // count. Cache written by in-flight effects is also ignored; only a mount-time
  // cache that already covers every source this watchlist needs can paint early.
  const hasCommittedWatchlistRowsRef = useRef(false);
  const watchlistGenerationRef = useRef<string | null>(null);
  // Set when the watchlist changes, cleared after that generation's fetch
  // effects start. Loading on the transition render still belongs to the
  // previous request.
  const pendingGenerationRef = useRef<string | null>(null);
  const [, setWatchlistFetchEpoch] = useState(0);
  const hadCachedRowsOnMountRef = useRef(
    watchlistMountCacheCoversSources(dataCacheRef?.current, watchlist),
  );

  const pageIndex = useCarouselIndex();

  // Split watchlist into spot and perps items
  const spotItems = useMemo(
    () => watchlist.filter(isWatchlistSpotItem),
    [watchlist],
  );
  const perpsItems = useMemo(
    () => watchlist.filter(isWatchlistPerpsItem),
    [watchlist],
  );

  const listingItems = useMemo(
    () => watchlist.filter(isWatchlistListingItem),
    [watchlist],
  );
  const {
    result: listingQuotes,
    isLoading: listingLoading,
    run: refetchListings,
  } = usePromiseResult(
    async () => {
      const assetItems = listingItems.filter((item) => item.assetId);
      const stockItems = listingItems.filter(
        (item) => !item.assetId && item.stockId,
      );
      const limit = pLimit(4);
      // Unavailable listings get no quote but stay removable from the watchlist.
      const [assetQuotes, stockQuoteById] = await Promise.all([
        Promise.all(
          assetItems.map((item) =>
            limit(async () => {
              try {
                const quote =
                  await backgroundApiProxy.serviceMarketV2.fetchMarketListingWatchlistQuote(
                    item,
                  );
                return { key: getMarketWatchlistKey(item), quote };
              } catch {
                return { key: getMarketWatchlistKey(item), quote: undefined };
              }
            }),
          ),
        ),
        // The batch API returns the Stocks list item, which carries the
        // variants the stock row reveals on hover; the detail API does not.
        (async () => {
          const quoteById = new Map<string, IMarketListingWatchlistQuote>();
          if (stockItems.length === 0) return quoteById;
          try {
            const stocks =
              await backgroundApiProxy.serviceMarketV2.fetchMarketStockBatch({
                stockIds: uniq(stockItems.map((item) => item.stockId ?? '')),
              });
            stocks.forEach((stock) => {
              quoteById.set(stock.stockId.toUpperCase(), stock);
            });
          } catch {
            // Fall through with no stock quotes.
          }
          return quoteById;
        })(),
      ]);
      const stockQuotes = stockItems.map((item) => ({
        key: getMarketWatchlistKey(item),
        quote: stockQuoteById.get((item.stockId ?? '').toUpperCase()),
      }));
      return [...assetQuotes, ...stockQuotes];
    },
    [listingItems],
    {
      pollingInterval,
      watchLoading: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      overrideIsFocused: (isFocused) => isFocused && pageIndex === 0,
      checkIsFocused: true,
    },
  );

  // Listing rows are synthesized from the local watchlist record, so unlike
  // spot rows they can render before any quote exists. Reusing the previous
  // batch keeps a remount — the token selector drops this list on every tab
  // switch — from falling back to that quote-less state.
  const lastListingQuotesRef = useRef<
    IMarketWatchlistListingQuoteEntry[] | undefined
  >(dataCacheRef?.current?.listing);
  useEffect(() => {
    if (!listingQuotes) return;
    lastListingQuotesRef.current = listingQuotes;
    if (dataCacheRef) {
      dataCacheRef.current = {
        ...dataCacheRef.current,
        listing: listingQuotes,
      };
    }
  }, [dataCacheRef, listingQuotes]);
  // usePromiseResult keeps the resolved batch on screen while a refetch is in
  // flight, so either source can predate the current watchlist. Coverage is
  // therefore checked per row below rather than trusting the batch as a whole.
  const listingResult = listingQuotes ?? lastListingQuotesRef.current;

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
      const tokenAddressList = spotItems.map((item) => {
        const { isNative } = getNativeTokenInfo(
          item.isNative,
          item.contractAddress,
        );
        return {
          chainId: item.chainId,
          contractAddress: item.contractAddress,
          isNative,
        };
      });
      try {
        const response = await fetchMarketTokenListBatchForPlatform({
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
      watchLoading: true,
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
    listingLoading ||
    (perpsItems.length > 0 && Boolean(perpsLoading)) ||
    (platformEnv.isNative &&
      ((spotItems.length > 0 && apiLoading !== false && !spotResult) ||
        (perpsItems.length > 0 && perpsLoading !== false && !perpsResult)));
  const isError = Boolean(
    (spotItems.length > 0 && spotResult?.failed) ||
    (perpsItems.length > 0 && perpsResult?.failed),
  );
  const refetch = useCallback(async () => {
    await Promise.all([refetchData(), refetchPerpsData(), refetchListings()]);
  }, [refetchData, refetchPerpsData, refetchListings]);

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
  const transformedData = useMemo(() => {
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
        if (watchlistItem.assetId || watchlistItem.stockId) {
          const key = getMarketWatchlistKey(watchlistItem);
          const entry = listingResult?.find((item) => item.key === key);
          // A batch that predates this favorite carries no entry for it, and a
          // row built from the watchlist record alone would render every metric
          // as NaN while spot rows are still missing entirely, so hold it back.
          // An entry that resolved to no quote still renders, which keeps
          // delisted favorites removable.
          if (!entry) return undefined;
          const { quote } = entry;
          const priceChangeValue = normalizeStockMetadataValue(
            quote?.priceChange24hPercent,
          );
          return {
            id: key,
            assetId: watchlistItem.assetId,
            stockId: watchlistItem.stockId,
            name:
              quote?.name ??
              watchlistItem.assetId ??
              watchlistItem.stockId ??
              '',
            symbol:
              quote?.symbol ??
              watchlistItem.assetId ??
              watchlistItem.stockId ??
              '',
            address: '',
            networkId: '',
            chainId: '',
            decimals: 0,
            price: Number(quote?.price ?? NaN),
            change24h: Number(priceChangeValue ?? NaN),
            priceChangeRaw: priceChangeValue ?? '-',
            marketCap: Number(quote?.marketCap ?? NaN),
            turnover: Number(quote?.volume24h ?? NaN),
            liquidity: 0,
            transactions: 0,
            uniqueTraders: 0,
            holders: 0,
            tokenImageUri: quote?.logoUrl ?? '',
            stockVariants: quote?.variants,
            networkLogoUri: '',
            sortIndex: watchlistItem.sortIndex ?? 0,
          } satisfies IMarketToken;
        }

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
        // Keep legacy chain favorites removable under their stored identity.
        return found ? { ...found, stockId: watchlistItem.stockId } : undefined;
      })
      .filter(Boolean);

    return merged;
  }, [
    apiResult,
    listingResult,
    watchlist,
    spotItems,
    perpsTokenMap,
    networkLogoUriMap,
  ]);

  useEffect(() => {
    if (
      isInitialLoad &&
      apiLoading === false &&
      listingLoading === false &&
      (perpsItems.length === 0 || perpsLoading === false)
    ) {
      setIsInitialLoad(false);
    }
  }, [
    apiLoading,
    isInitialLoad,
    listingLoading,
    perpsItems.length,
    perpsLoading,
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

  const watchlistGeneration = watchlist
    .map((item) => getMarketWatchlistKey(item))
    .join('\n');
  if (watchlistGenerationRef.current !== watchlistGeneration) {
    const isInitialGeneration = watchlistGenerationRef.current === null;
    watchlistGenerationRef.current = watchlistGeneration;
    if (!isInitialGeneration) {
      pendingGenerationRef.current = watchlistGeneration;
    }
    if (watchlist.length === 0) {
      hasCommittedWatchlistRowsRef.current = false;
    }
  }
  const watchlistFetchStarted =
    pendingGenerationRef.current !== watchlistGeneration;
  useEffect(() => {
    pendingGenerationRef.current = null;
    setWatchlistFetchEpoch((epoch) => epoch + 1);
  }, [watchlistGeneration]);
  const sourceHasSettled = (itemCount: number, loading: boolean | undefined) =>
    itemCount === 0 || (watchlistFetchStarted && loading === false);
  const watchlistSourcesSettled =
    watchlist.length > 0 &&
    sourceHasSettled(spotItems.length, apiLoading) &&
    sourceHasSettled(listingItems.length, listingLoading) &&
    sourceHasSettled(perpsItems.length, perpsLoading);
  if (watchlistSourcesSettled) {
    hasCommittedWatchlistRowsRef.current = true;
  }
  const showWatchlistRows =
    hasCommittedWatchlistRowsRef.current || hadCachedRowsOnMountRef.current;
  const displayData = useMemo(
    () => (showWatchlistRows ? sortedData : []),
    [showWatchlistRows, sortedData],
  );
  // While rows are held, the previous request can still report idle. Keep
  // loading true so the list shows a skeleton instead of an empty body.
  const isHoldingWatchlistFirstPaint =
    watchlist.length > 0 && !showWatchlistRows;

  const totalCount = displayData.length;
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 1;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [totalPages, currentPage]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return displayData.slice(start, start + pageSize);
  }, [displayData, currentPage, pageSize]);

  const loadMore = useCallback(() => {
    // Watchlist doesn't support load more - all data is loaded at once
  }, []);

  const refresh = useCallback(() => {
    setCurrentPage(1);
    void refetchData();
    void refetchListings();
  }, [refetchData, refetchListings]);

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
    isLoading: isLoading || isHoldingWatchlistFirstPaint,
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
