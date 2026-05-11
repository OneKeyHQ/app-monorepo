import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  GOOGLE_LOGO_URL,
  SEARCH_ITEM_ID,
} from '@onekeyhq/shared/src/consts/discovery';
import type { IFuseResultMatch } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import type { IDApp } from '@onekeyhq/shared/types/discovery';

import {
  DISCOVERY_LOCAL_SEARCH_CANDIDATE_LIMIT,
  DISCOVERY_RANKING_HISTORY_LIMIT,
  type IDiscoverySearchListItem,
  type IDiscoverySearchRankingDebugEntry,
  buildSearchRankingDebugEntries,
  isWebUrlLikeSearchKeyword,
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

export interface IDiscoverySearchDebugSnapshotQuery {
  redacted: true;
  length: number;
  trimmedLength: number;
  isUrlLike: boolean;
}

export interface IDiscoverySearchDebugDataSetSummary {
  count: number;
}

export interface IDiscoverySearchDebugLocalDataSummary {
  bookmarkData: IDiscoverySearchDebugDataSetSummary;
  historyData: IDiscoverySearchDebugDataSetSummary;
}

export interface IDiscoverySearchDebugSanitizedRankingEntry {
  type: IDiscoverySearchRankingDebugEntry['type'];
  source: IDiscoverySearchRankingDebugEntry['source'];
  inputIndex: number;
  rankIndex: number;
  matchKeys: string[];
  topicality: {
    bucket: number;
    score: number;
  };
  finalScore: number;
  visitCount: number;
  isExactUrl?: boolean;
  namePrefixCoverage?: number;
  localSupportCount?: number;
}

export interface IDiscoverySearchDebugSnapshotFactors {
  showSearchResult: boolean;
  shouldSkipRemoteSearch: boolean;
  inputs: {
    localData: IDiscoverySearchDebugLocalDataSummary | null;
    localSearchData: IDiscoverySearchDebugLocalDataSummary;
    rankingHistoryData: IDiscoverySearchDebugDataSetSummary;
    trendingData: IDiscoverySearchDebugDataSetSummary;
    remoteSearchResult: IDiscoverySearchDebugDataSetSummary;
  };
  rankingEntries: IDiscoverySearchDebugSanitizedRankingEntry[];
}

export interface IDiscoverySearchDebugOutputItem {
  type: IDiscoverySearchListItem['type'];
  source?: IDiscoverySearchRankingDebugEntry['source'];
  outputIndex: number;
  itemKey: string;
  matchKeys: string[];
  matchedFields?: {
    key?: string;
    indices: number[][];
  }[];
  isExactUrl?: boolean;
}

export interface IDiscoverySearchDebugSnapshotOutput {
  trendingSearchData: IDiscoverySearchDebugDataSetSummary;
  searchList: IDiscoverySearchDebugOutputItem[];
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
  query: IDiscoverySearchDebugSnapshotQuery;
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

function buildQuerySnapshot(
  searchValue: string,
): IDiscoverySearchDebugSnapshotQuery {
  const trimmedValue = searchValue.trim();

  return {
    redacted: true,
    length: searchValue.length,
    trimmedLength: trimmedValue.length,
    isUrlLike: isWebUrlLikeSearchKeyword(searchValue),
  };
}

function buildDataSetSummary<T>(
  data?: T[] | null,
): IDiscoverySearchDebugDataSetSummary {
  return {
    count: data?.length ?? 0,
  };
}

function buildLocalDataSummary(
  data?: IDiscoverySearchLocalData | null,
): IDiscoverySearchDebugLocalDataSummary | null {
  if (!data) {
    return null;
  }

  return {
    bookmarkData: buildDataSetSummary(data.bookmarkData),
    historyData: buildDataSetSummary(data.historyData),
  };
}

function sanitizeMatchKey(key?: string) {
  const trimmedKey = key?.trim();
  if (!trimmedKey) {
    return '';
  }

  const parsedUrl = uriUtils.safeParseURL(
    uriUtils.ensureHttpsPrefix(trimmedKey),
  );
  if (
    parsedUrl &&
    parsedUrl.hostname &&
    ['http:', 'https:'].includes(parsedUrl.protocol)
  ) {
    return parsedUrl.origin;
  }

  const normalizedKey = trimmedKey.toLowerCase();
  if (/^[a-z0-9_.:-]{1,64}$/u.test(normalizedKey)) {
    return normalizedKey;
  }

  return `redacted:${trimmedKey.length}`;
}

function sanitizeMatchKeys(keys: string[]) {
  return Array.from(
    new Set(keys.map((key) => sanitizeMatchKey(key)).filter(Boolean)),
  );
}

function sanitizeFuseMatches(matches: (IFuseResultMatch | undefined)[]) {
  return matches
    .filter((match): match is IFuseResultMatch => Boolean(match))
    .map((match) => ({
      ...(match.key ? { key: String(match.key) } : {}),
      indices: match.indices.map(([start, end]) => [start, end]),
    }))
    .filter((match) => match.indices.length > 0);
}

function sanitizeRankingEntries(
  entries: IDiscoverySearchRankingDebugEntry[],
): IDiscoverySearchDebugSanitizedRankingEntry[] {
  return entries.map((entry) => ({
    ...entry,
    matchKeys: sanitizeMatchKeys(entry.matchKeys),
  }));
}

function buildSearchListDebugItem(
  item: IDiscoverySearchListItem,
  outputIndex: number,
): IDiscoverySearchDebugOutputItem {
  const base = {
    type: item.type,
    outputIndex,
    itemKey: `${item.type}:${outputIndex}`,
  };

  if (item.type === 'dapp') {
    return {
      ...base,
      source: item.source,
      matchKeys: sanitizeMatchKeys([item.url, ...(item.dapp.origins ?? [])]),
      isExactUrl: item.isExactUrl,
    };
  }

  if (item.type === 'bookmark') {
    const matchedFields = sanitizeFuseMatches([item.titleMatch, item.urlMatch]);
    return {
      ...base,
      source: 'bookmark',
      matchKeys: sanitizeMatchKeys([item.url]),
      ...(matchedFields.length ? { matchedFields } : {}),
    };
  }

  if (item.type === 'history') {
    const matchedFields = sanitizeFuseMatches([item.titleMatch, item.urlMatch]);
    return {
      ...base,
      source: 'history',
      matchKeys: sanitizeMatchKeys([item.url]),
      ...(matchedFields.length ? { matchedFields } : {}),
    };
  }

  return {
    ...base,
    matchKeys: [],
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
      url: uriUtils.buildGoogleSearchUrl(searchValue),
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
  const rankingEntries = searchValue
    ? buildSearchRankingDebugEntries({
        keyword: searchValue,
        searchResult,
        rankingHistoryData,
        bookmarkSearchData: localSearchData.bookmarkData,
        historySearchData: localSearchData.historyData,
        trendingSearchData,
      })
    : [];

  return {
    type: DISCOVERY_SEARCH_DEBUG_SNAPSHOT_TYPE,
    version: DISCOVERY_SEARCH_DEBUG_SNAPSHOT_VERSION,
    createdAt: Date.now(),
    source,
    query: buildQuerySnapshot(searchValue),
    meta: buildSnapshotMeta(),
    factors: {
      showSearchResult,
      shouldSkipRemoteSearch,
      inputs: {
        localData: buildLocalDataSummary(localData),
        localSearchData:
          buildLocalDataSummary(localSearchData) ??
          ({
            bookmarkData: buildDataSetSummary(),
            historyData: buildDataSetSummary(),
          } satisfies IDiscoverySearchDebugLocalDataSummary),
        rankingHistoryData: buildDataSetSummary(rankingHistoryData),
        trendingData: buildDataSetSummary(trendingData),
        remoteSearchResult: buildDataSetSummary(searchResult),
      },
      rankingEntries: sanitizeRankingEntries(rankingEntries),
    },
    output: {
      trendingSearchData: buildDataSetSummary(trendingSearchData),
      searchList: searchList.map(buildSearchListDebugItem),
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
    clearLatestSnapshot: () => void;
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
      clearLatestSnapshot: clearLatestDiscoverySearchDebugSnapshot,
    };
  }
}

export function clearLatestDiscoverySearchDebugSnapshot() {
  latestDiscoverySearchDebugSnapshot = null;
}

export function getLatestDiscoverySearchDebugSnapshot() {
  return latestDiscoverySearchDebugSnapshot;
}
