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

  const changeSortType =
    bannerSort.sortBy === BANNER_DETAIL_CHANGE_SORT_BY
      ? bannerSort.sortType
      : undefined;

  const mobileSortedData = useMemo(() => {
    if (!changeSortType) {
      return transformedData;
    }

    return transformedData.toSorted((a, b) =>
      changeSortType === 'asc'
        ? a.change24h - b.change24h
        : b.change24h - a.change24h,
    );
  }, [changeSortType, transformedData]);

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

  const handleChangeSortPress = useCallback(() => {
    const currentSortType =
      sortRef.current.sortBy === BANNER_DETAIL_CHANGE_SORT_BY
        ? sortRef.current.sortType
        : undefined;
    let nextSortType: 'asc' | 'desc' | undefined = 'desc';
    if (currentSortType === 'desc') {
      nextSortType = 'asc';
    } else if (currentSortType === 'asc') {
      nextSortType = undefined;
    }
    const next = {
      sortBy: nextSortType ? BANNER_DETAIL_CHANGE_SORT_BY : undefined,
      sortType: nextSortType,
    };
    sortRef.current = next;
    setBannerSort(next);
  }, [setBannerSort]);

  const listResult = useMemo<IMarketTokenListResult>(
    () => ({
      data: transformedData,
      isLoading: tickerIsLoading,
      setSortBy,
      setSortType,
      currentSortBy: bannerSort.sortBy,
      currentSortType: bannerSort.sortType,
    }),
    [
      transformedData,
      tickerIsLoading,
      setSortBy,
      setSortType,
      bannerSort.sortBy,
      bannerSort.sortType,
    ],
  );

  return {
    changeSortType,
    handleChangeSortPress,
    listResult,
    mobileSortedData,
    tickerIsLoading,
  };
}
