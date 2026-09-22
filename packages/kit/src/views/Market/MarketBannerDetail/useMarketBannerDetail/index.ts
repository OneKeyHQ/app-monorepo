import { useCallback, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks';
import { useMarketBannerListSortAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IMarketStockPublicItem,
  IMarketTokenListItem,
} from '@onekeyhq/shared/types/marketV2';

import {
  buildMarketNetworkLogoUriMap,
  getNetworkLogoUri,
  transformApiItemToToken,
} from '../../MarketHomeV2/components/MarketTokenList/utils/tokenListHelpers';

import type { IMarketTokenListResult } from '../../MarketHomeV2/components/MarketTokenList/MarketTokenListBase';

const BANNER_DETAIL_CHANGE_SORT_BY = 'change24h';
type IBannerDetailSortBy = typeof BANNER_DETAIL_CHANGE_SORT_BY;

function isBannerDetailSortBy(
  sortBy: string | undefined,
): sortBy is IBannerDetailSortBy {
  return sortBy === BANNER_DETAIL_CHANGE_SORT_BY;
}

type IUseMarketBannerDetailParams = {
  tokenListId: string;
  isPerps: boolean;
  isStock?: boolean;
  isIndex?: boolean;
};

type IBannerStockToken = IMarketTokenListItem & {
  bannerStockItem: IMarketStockPublicItem;
};

function mapStockBannerItemToToken(
  item: IMarketStockPublicItem,
): IBannerStockToken {
  return {
    address: '',
    name: item.name,
    symbol: item.symbol,
    decimals: 0,
    logoUrl: item.logoUrl,
    price: item.price,
    priceChange24hPercent: item.priceChange24hPercent,
    marketCap: item.marketCap,
    stockId: item.stockId,
    stock: {
      stockId: item.stockId,
      subtitle: item.name,
      source: item.assetType,
      sourceLogoUri: item.logoUrl,
      marketCap: item.marketCap,
      assetAnalysis: { volume24h: item.volume24h },
      tradingActivity: { peRatio: item.peRatio },
    },
    // The desktop stock table renders the server row as-is.
    bannerStockItem: item,
  };
}

function isBannerStockToken(
  item: IMarketTokenListItem,
): item is IBannerStockToken {
  return 'bannerStockItem' in item;
}

// The banner endpoint only lists the stocks; the batch endpoint answers with
// the Stocks tab's rows (variants included) for the same ids. Keep the banner
// order, and keep the banner rows when the batch call fails so the page still
// renders.
async function enrichBannerStockRows(
  bannerRows: IMarketStockPublicItem[],
): Promise<IMarketStockPublicItem[]> {
  if (bannerRows.length === 0) {
    return bannerRows;
  }
  try {
    const batchRows =
      await backgroundApiProxy.serviceMarketV2.fetchMarketStockBatch({
        stockIds: bannerRows.map((row) => row.stockId),
      });
    const batchRowsByStockId = new Map(
      batchRows.map((row) => [row.stockId, row] as const),
    );
    return bannerRows.map((row) => {
      const batchRow = batchRowsByStockId.get(row.stockId);
      return batchRow ? { ...row, ...batchRow } : row;
    });
  } catch {
    return bannerRows;
  }
}

export function useMarketBannerDetail({
  tokenListId,
  isPerps,
  isStock = false,
  isIndex = false,
}: IUseMarketBannerDetailParams) {
  const { networkList } = useMarketBasicConfig();
  const networkLogoUriMap = useMemo(
    () => buildMarketNetworkLogoUriMap(networkList),
    [networkList],
  );
  const [bannerSort, setBannerSort] = useMarketBannerListSortAtom();
  const sortRef = useRef(bannerSort);
  sortRef.current = bannerSort;

  const { result: tickerResult, isLoading: tickerIsLoading } = usePromiseResult(
    async () => {
      if (isPerps) return null;
      // Index quotes are display-only; restored legacy routes have no tradable rows.
      if (isIndex) return [];
      if (isStock) {
        const bannerRows =
          await backgroundApiProxy.serviceMarketV2.fetchMarketBannerStockTokenList(
            { id: tokenListId },
          );
        const rows = await enrichBannerStockRows(bannerRows);
        return rows.map(mapStockBannerItemToToken);
      }
      return backgroundApiProxy.serviceMarketV2.fetchMarketBannerTokenList({
        tokenListId,
      });
    },
    [tokenListId, isPerps, isStock, isIndex],
    {
      watchLoading: true,
    },
  );

  const transformedData = useMemo(() => {
    if (!tickerResult) return [];
    return tickerResult.map((item, index) => {
      const chainId = item.networkId || '';
      const networkLogoUri =
        networkLogoUriMap.get(chainId) || getNetworkLogoUri(chainId);
      return transformApiItemToToken(item, {
        chainId,
        networkLogoUriMap,
        networkLogoUri,
        sortIndex: index,
      });
    });
  }, [networkLogoUriMap, tickerResult]);

  const stockItems = useMemo<IMarketStockPublicItem[]>(() => {
    // The request resolves to one of two row types; widen to the shared base
    // so the filter is callable on the union.
    const items: IMarketTokenListItem[] = tickerResult ?? [];
    return items.filter(isBannerStockToken).map((item) => item.bannerStockItem);
  }, [tickerResult]);

  const currentSortBy = isBannerDetailSortBy(bannerSort.sortBy)
    ? bannerSort.sortBy
    : undefined;
  const currentSortType = currentSortBy ? bannerSort.sortType : undefined;
  const changeSortType =
    currentSortBy === BANNER_DETAIL_CHANGE_SORT_BY
      ? currentSortType
      : undefined;
  const setSortBy = useCallback(
    (val: string | undefined) => {
      const next = { ...sortRef.current, sortBy: val };
      sortRef.current = next;
      setBannerSort(next);
    },
    [setBannerSort],
  );

  const setSortType = useCallback(
    (val: 'asc' | 'desc' | undefined) => {
      const next = { ...sortRef.current, sortType: val };
      sortRef.current = next;
      setBannerSort(next);
    },
    [setBannerSort],
  );

  const toggleSort = useCallback(
    (sortBy: IBannerDetailSortBy) => {
      const activeSortType =
        sortRef.current.sortBy === sortBy
          ? sortRef.current.sortType
          : undefined;
      let nextSortType: 'asc' | 'desc' | undefined = 'desc';
      if (activeSortType === 'desc') {
        nextSortType = 'asc';
      } else if (activeSortType === 'asc') {
        nextSortType = undefined;
      }
      const next = {
        sortBy: nextSortType ? sortBy : undefined,
        sortType: nextSortType,
      };
      sortRef.current = next;
      setBannerSort(next);
    },
    [setBannerSort],
  );

  const handleChangeSortPress = useCallback(() => {
    toggleSort(BANNER_DETAIL_CHANGE_SORT_BY);
  }, [toggleSort]);

  const listResult = useMemo<IMarketTokenListResult>(
    () => ({
      data: transformedData,
      isLoading: tickerIsLoading,
      setSortBy,
      setSortType,
      currentSortBy,
      currentSortType,
    }),
    [
      transformedData,
      tickerIsLoading,
      setSortBy,
      setSortType,
      currentSortBy,
      currentSortType,
    ],
  );

  return {
    changeSortType,
    handleChangeSortPress,
    listResult,
    mobileData: transformedData,
    stockItems,
    tickerIsLoading,
  };
}
