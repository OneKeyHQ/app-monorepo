import { useCallback, useMemo, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useMarketBannerListSortAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import {
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
};

export function useMarketBannerDetail({
  tokenListId,
  isPerps,
}: IUseMarketBannerDetailParams) {
  const [bannerSort, setBannerSort] = useMarketBannerListSortAtom();
  const sortRef = useRef(bannerSort);
  sortRef.current = bannerSort;

  const { result: tickerResult, isLoading: tickerIsLoading } = usePromiseResult(
    async () => {
      if (isPerps) return null;
      const data =
        await backgroundApiProxy.serviceMarketV2.fetchMarketBannerTokenList({
          tokenListId,
        });
      return data;
    },
    [tokenListId, isPerps],
    {
      watchLoading: true,
    },
  );

  const transformedData = useMemo(() => {
    if (!tickerResult) return [];
    return tickerResult.map((item, index) => {
      const chainId = item.networkId || '';
      const networkLogoUri = getNetworkLogoUri(chainId);
      return transformApiItemToToken(item, {
        chainId,
        networkLogoUri,
        sortIndex: index,
      });
    });
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
    tickerIsLoading,
  };
}
