import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  GOOGLE_LOGO_URL,
  SEARCH_ITEM_ID,
} from '@onekeyhq/shared/src/consts/discovery';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IDApp } from '@onekeyhq/shared/types/discovery';

import { useReviewControl } from '../../../components/ReviewControl';
import {
  DISCOVERY_LOCAL_SEARCH_CANDIDATE_LIMIT,
  DISCOVERY_RANKING_HISTORY_LIMIT,
  type IDiscoverySearchListItem,
  mergeSearchResultsWithLocalData,
  searchTrendingDappsByKeyword,
  shouldSkipRemoteSearchByKeyword,
} from '../utils/searchResultRanking';

import type { IBrowserBookmark, IBrowserHistory } from '../types';

export interface ILocalDataType {
  bookmarkData: IBrowserBookmark[];
  historyData: IBrowserHistory[];
}

export function useSearchModalData(searchValue: string) {
  const intl = useIntl();
  const { serviceDiscovery } = backgroundApiProxy;
  const showSearchResult = useReviewControl();

  const { result: localData, run: refreshDisplayLocalData } =
    usePromiseResult<ILocalDataType | null>(async () => {
      const [bookmarkData, historyData] = await Promise.all([
        serviceDiscovery.getBookmarkData({
          generateIcon: true,
          sliceCount: 6,
        }),
        serviceDiscovery.getHistoryData({
          generateIcon: true,
          sliceCount: 6,
        }),
      ]);
      return {
        bookmarkData,
        historyData,
      };
    }, [serviceDiscovery]);

  const { result: localSearchData, run: refreshLocalSearchData } =
    usePromiseResult<ILocalDataType>(
      async () => {
        if (!searchValue) {
          return {
            bookmarkData: [],
            historyData: [],
          };
        }
        const [bookmarkData, historyData] = await Promise.all([
          serviceDiscovery.getBookmarkData({
            generateIcon: true,
            keyword: searchValue,
            sliceCount: DISCOVERY_LOCAL_SEARCH_CANDIDATE_LIMIT,
          }),
          serviceDiscovery.getHistoryData({
            generateIcon: true,
            keyword: searchValue,
            sliceCount: DISCOVERY_LOCAL_SEARCH_CANDIDATE_LIMIT,
          }),
        ]);
        return {
          bookmarkData,
          historyData,
        };
      },
      [serviceDiscovery, searchValue],
      {
        initResult: {
          bookmarkData: [],
          historyData: [],
        },
      },
    );

  const { result: rankingHistoryData, run: refreshRankingHistoryData } =
    usePromiseResult(
      () =>
        serviceDiscovery.getHistoryData({
          generateIcon: false,
          sliceCount: DISCOVERY_RANKING_HISTORY_LIMIT,
        }),
      [serviceDiscovery],
    );

  const { result: trendingData, run: refreshTrendingData } = usePromiseResult(
    async (): Promise<IDApp[]> => {
      if (!showSearchResult) {
        return [];
      }
      return (
        (await serviceDiscovery.fetchDiscoveryHomePageData())?.trending ?? []
      );
    },
    [serviceDiscovery, showSearchResult],
    {
      initResult: [],
    },
  );

  const refreshLocalData = useCallback(async () => {
    await Promise.all([
      refreshDisplayLocalData(),
      refreshLocalSearchData(),
      refreshRankingHistoryData(),
      refreshTrendingData(),
    ]);
  }, [
    refreshDisplayLocalData,
    refreshLocalSearchData,
    refreshRankingHistoryData,
    refreshTrendingData,
  ]);

  const shouldSkipRemoteSearch = useMemo(
    () => shouldSkipRemoteSearchByKeyword(searchValue),
    [searchValue],
  );

  // Search for DApps
  const { result: searchResult } = usePromiseResult(async () => {
    if (!showSearchResult || shouldSkipRemoteSearch) {
      return [];
    }
    const res = await serviceDiscovery.searchDApp(searchValue);
    return res;
  }, [searchValue, serviceDiscovery, showSearchResult, shouldSkipRemoteSearch]);

  const trendingSearchData = useMemo(() => {
    if (!showSearchResult) {
      return [];
    }
    return searchTrendingDappsByKeyword({
      keyword: searchValue,
      trendingData,
    });
  }, [searchValue, showSearchResult, trendingData]);

  const searchList = useMemo<IDiscoverySearchListItem[]>(() => {
    if (!searchValue) {
      return [];
    }

    return [
      ...mergeSearchResultsWithLocalData({
        keyword: searchValue,
        searchResult,
        rankingHistoryData,
        bookmarkSearchData: localSearchData.bookmarkData,
        historySearchData: localSearchData.historyData,
        trendingSearchData,
      }),
      {
        type: 'search-action',
        key: SEARCH_ITEM_ID,
        title: `${intl.formatMessage({
          id: ETranslations.explore_search_placeholder,
        })} "${searchValue}"`,
        url: '',
        logo: GOOGLE_LOGO_URL,
      },
    ];
  }, [
    searchValue,
    searchResult,
    rankingHistoryData,
    localSearchData.bookmarkData,
    localSearchData.historyData,
    trendingSearchData,
    intl,
  ]);

  // Determine what to display
  const displaySearchList =
    Boolean(searchValue) && Array.isArray(searchList) && searchList.length > 0;
  const displayBookmarkList =
    !searchValue && (localData?.bookmarkData ?? []).length > 0;
  const displayHistoryList =
    !searchValue && (localData?.historyData ?? []).length > 0;

  // Calculate total items
  const totalItems = useMemo(() => {
    const searchCount = displaySearchList ? searchList.length : 0;
    const historyCount = displayHistoryList
      ? localData?.historyData?.length || 0
      : 0;
    return searchCount + historyCount;
  }, [
    displaySearchList,
    searchList.length,
    displayHistoryList,
    localData?.historyData?.length,
  ]);

  return {
    localData: localData ?? null,
    refreshLocalData,
    searchList,
    displaySearchList,
    displayBookmarkList,
    displayHistoryList,
    SEARCH_ITEM_ID,
    isEmpty: !displaySearchList && !displayBookmarkList && !displayHistoryList,
    totalItems,
  };
}
