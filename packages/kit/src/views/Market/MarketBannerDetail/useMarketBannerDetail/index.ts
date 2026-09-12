import { useCallback, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useMarketBasicConfig } from '@onekeyhq/kit/src/views/Market/hooks';
import { useMarketBannerListSortAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type {
  IMarketBannerIndexPreview,
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

function mapStockBannerItemToToken(
  item: IMarketStockPublicItem,
): IMarketTokenListItem {
  return {
    address: item.stockId,
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
    },
  };
}

function mapIndexBannerItemToToken(
  item: IMarketBannerIndexPreview,
): IMarketTokenListItem {
  return {
    address: item.symbol,
    name: item.name,
    symbol: item.symbol,
    decimals: 0,
    logoUrl: item.logo,
    price: item.price ?? undefined,
    priceChange24hPercent: item.priceChange24hPercent ?? undefined,
    stock: {
      subtitle: item.name,
      source: 'index',
      sourceLogoUri: item.logo,
    },
  };
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
      if (isIndex) {
        const banners =
          await backgroundApiProxy.serviceMarketV2.fetchMarketBannerList();
        const banner = banners.find((item) => item.tokenListId === tokenListId);
        return (banner?.indices ?? []).map(mapIndexBannerItemToToken);
      }
      if (isStock) {
        const data =
          await backgroundApiProxy.serviceMarketV2.fetchMarketBannerStockTokenList(
            { id: tokenListId },
          );
        return data.map(mapStockBannerItemToToken);
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
    tickerIsLoading,
  };
}
