import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  GOOGLE_LOGO_URL,
  SEARCH_ITEM_ID,
} from '@onekeyhq/shared/src/consts/discovery';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IDApp } from '@onekeyhq/shared/types/discovery';

import {
  DISCOVERY_LOCAL_SEARCH_CANDIDATE_LIMIT,
  DISCOVERY_RANKING_HISTORY_LIMIT,
  type IDiscoverySearchListItem,
  mergeSearchResultsWithLocalData,
  searchTrendingDappsByKeyword,
  shouldSkipRemoteSearchByKeyword,
} from './searchResultRanking';

import type { IBrowserBookmark, IBrowserHistory } from '../types';

export const DISCOVERY_SEARCH_DEBUG_SNAPSHOT_TYPE =
  'onekey.discovery.search.debugSnapshot';
export const DISCOVERY_SEARCH_DEBUG_SNAPSHOT_VERSION = 1;

export interface IDiscoverySearchLocalData {
  bookmarkData: IBrowserBookmark[];
  historyData: IBrowserHistory[];
}

export interface IDiscoverySearchDebugSnapshotFactors {
  showSearchResult: boolean;
  shouldSkipRemoteSearch: boolean;
  localData: IDiscoverySearchLocalData | null;
  localSearchData: IDiscoverySearchLocalData;
  rankingHistoryData: IBrowserHistory[];
  trendingData: IDApp[];
  remoteSearchResult: IDApp[];
}

export interface IDiscoverySearchDebugSnapshotOutput {
  trendingSearchData: IDApp[];
  searchList: IDiscoverySearchListItem[];
  displaySearchList: boolean;
  displayBookmarkList: boolean;
  displayHistoryList: boolean;
  totalItems: number;
}

export interface IDiscoverySearchDebugSnapshot {
  type: typeof DISCOVERY_SEARCH_DEBUG_SNAPSHOT_TYPE;
  version: typeof DISCOVERY_SEARCH_DEBUG_SNAPSHOT_VERSION;
  createdAt: number;
  source: 'latest-hook' | 'manual-query';
  searchValue: string;
  meta: {
    platform: {
      isNative: boolean;
      isDesktop: boolean;
      isWeb: boolean;
      isExtension: boolean;
      isRuntimeBrowser: boolean;
    };
    limits: {
      localSearchCandidateLimit: number;
      rankingHistoryLimit: number;
    };
  };
  factors: IDiscoverySearchDebugSnapshotFactors;
  output: IDiscoverySearchDebugSnapshotOutput;
}

interface IBuildDiscoverySearchListParams {
  searchValue: string;
  searchActionTitle: string;
  showSearchResult: boolean;
  searchResult?: IDApp[];
  rankingHistoryData?: IBrowserHistory[];
  localSearchData: IDiscoverySearchLocalData;
  trendingData?: IDApp[];
}

interface IBuildDiscoverySearchDebugSnapshotParams extends IBuildDiscoverySearchListParams {
  source: IDiscoverySearchDebugSnapshot['source'];
  shouldSkipRemoteSearch: boolean;
  localData: IDiscoverySearchLocalData | null;
}

interface ICollectDiscoverySearchDebugSnapshotParams {
  searchValue: string;
  showSearchResult: boolean;
  searchActionTitle: string;
  source?: IDiscoverySearchDebugSnapshot['source'];
}

function buildSnapshotMeta(): IDiscoverySearchDebugSnapshot['meta'] {
  return {
    platform: {
      isNative: Boolean(platformEnv.isNative),
      isDesktop: Boolean(platformEnv.isDesktop),
      isWeb: Boolean(platformEnv.isWeb),
      isExtension: Boolean(platformEnv.isExtension),
      isRuntimeBrowser: Boolean(platformEnv.isRuntimeBrowser),
    },
    limits: {
      localSearchCandidateLimit: DISCOVERY_LOCAL_SEARCH_CANDIDATE_LIMIT,
      rankingHistoryLimit: DISCOVERY_RANKING_HISTORY_LIMIT,
    },
  };
}

export function buildDiscoverySearchListFromFactors({
  searchValue,
  searchActionTitle,
  showSearchResult,
  searchResult,
  rankingHistoryData,
  localSearchData,
  trendingData,
}: IBuildDiscoverySearchListParams) {
  if (!searchValue) {
    return {
      trendingSearchData: [],
      searchList: [],
    };
  }

  const trendingSearchData = showSearchResult
    ? searchTrendingDappsByKeyword({
        keyword: searchValue,
        trendingData,
      })
    : [];

  const searchList: IDiscoverySearchListItem[] = [
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
      title: searchActionTitle,
      url: '',
      logo: GOOGLE_LOGO_URL,
    },
  ];

  return {
    trendingSearchData,
    searchList,
  };
}

export function buildDiscoverySearchDebugSnapshot({
  source,
  searchValue,
  searchActionTitle,
  showSearchResult,
  shouldSkipRemoteSearch,
  localData,
  localSearchData,
  rankingHistoryData,
  trendingData,
  searchResult,
}: IBuildDiscoverySearchDebugSnapshotParams): IDiscoverySearchDebugSnapshot {
  const { searchList, trendingSearchData } =
    buildDiscoverySearchListFromFactors({
      searchValue,
      searchActionTitle,
      showSearchResult,
      searchResult,
      rankingHistoryData,
      localSearchData,
      trendingData,
    });

  const displaySearchList =
    Boolean(searchValue) && Array.isArray(searchList) && searchList.length > 0;
  const displayBookmarkList =
    !searchValue && (localData?.bookmarkData ?? []).length > 0;
  const displayHistoryList =
    !searchValue && (localData?.historyData ?? []).length > 0;
  const totalItems =
    (displaySearchList ? searchList.length : 0) +
    (displayHistoryList ? localData?.historyData?.length || 0 : 0);

  return {
    type: DISCOVERY_SEARCH_DEBUG_SNAPSHOT_TYPE,
    version: DISCOVERY_SEARCH_DEBUG_SNAPSHOT_VERSION,
    createdAt: Date.now(),
    source,
    searchValue,
    meta: buildSnapshotMeta(),
    factors: {
      showSearchResult,
      shouldSkipRemoteSearch,
      localData,
      localSearchData,
      rankingHistoryData: rankingHistoryData ?? [],
      trendingData: trendingData ?? [],
      remoteSearchResult: searchResult ?? [],
    },
    output: {
      trendingSearchData,
      searchList,
      displaySearchList,
      displayBookmarkList,
      displayHistoryList,
      totalItems,
    },
  };
}

export async function collectDiscoverySearchDebugSnapshot({
  searchValue,
  showSearchResult,
  searchActionTitle,
  source = 'manual-query',
}: ICollectDiscoverySearchDebugSnapshotParams) {
  const { serviceDiscovery } = backgroundApiProxy;
  const shouldSkipRemoteSearch = shouldSkipRemoteSearchByKeyword(searchValue);

  const localDataPromise = Promise.all([
    serviceDiscovery.getBookmarkData({
      generateIcon: true,
      sliceCount: 6,
    }),
    serviceDiscovery.getHistoryData({
      generateIcon: true,
      sliceCount: 6,
    }),
  ]).then(([bookmarkData, historyData]) => ({ bookmarkData, historyData }));

  const localSearchDataPromise = searchValue
    ? Promise.all([
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
      ]).then(([bookmarkData, historyData]) => ({
        bookmarkData,
        historyData,
      }))
    : Promise.resolve({
        bookmarkData: [],
        historyData: [],
      });

  const rankingHistoryDataPromise = serviceDiscovery.getHistoryData({
    generateIcon: false,
    sliceCount: DISCOVERY_RANKING_HISTORY_LIMIT,
  });

  const trendingDataPromise = showSearchResult
    ? serviceDiscovery
        .fetchDiscoveryHomePageData()
        .then((data) => data?.trending ?? [])
    : Promise.resolve([]);

  const remoteSearchResultPromise =
    showSearchResult && !shouldSkipRemoteSearch
      ? serviceDiscovery.searchDApp(searchValue)
      : Promise.resolve([]);

  const [
    localData,
    localSearchData,
    rankingHistoryData,
    trendingData,
    searchResult,
  ] = await Promise.all([
    localDataPromise,
    localSearchDataPromise,
    rankingHistoryDataPromise,
    trendingDataPromise,
    remoteSearchResultPromise,
  ]);

  return buildDiscoverySearchDebugSnapshot({
    source,
    searchValue,
    searchActionTitle,
    showSearchResult,
    shouldSkipRemoteSearch,
    localData,
    localSearchData,
    rankingHistoryData,
    trendingData,
    searchResult,
  });
}

export function stringifyDiscoverySearchDebugSnapshot(
  snapshot: IDiscoverySearchDebugSnapshot,
) {
  return JSON.stringify(snapshot, null, 2);
}

type IDiscoverySearchDebugGlobal = typeof globalThis & {
  $$onekeyDiscoverySearchDebug?: {
    getLatestSnapshot: () => IDiscoverySearchDebugSnapshot | null;
    exportLatestSnapshot: () => string | null;
  };
};

let latestDiscoverySearchDebugSnapshot: IDiscoverySearchDebugSnapshot | null =
  null;

export function setLatestDiscoverySearchDebugSnapshot(
  snapshot: IDiscoverySearchDebugSnapshot,
) {
  latestDiscoverySearchDebugSnapshot = snapshot;

  if (process.env.NODE_ENV !== 'production') {
    const debugGlobal = globalThis as IDiscoverySearchDebugGlobal;
    debugGlobal.$$onekeyDiscoverySearchDebug = {
      getLatestSnapshot: () => latestDiscoverySearchDebugSnapshot,
      exportLatestSnapshot: () =>
        latestDiscoverySearchDebugSnapshot
          ? stringifyDiscoverySearchDebugSnapshot(
              latestDiscoverySearchDebugSnapshot,
            )
          : null,
    };
  }
}

export function getLatestDiscoverySearchDebugSnapshot() {
  return latestDiscoverySearchDebugSnapshot;
}
