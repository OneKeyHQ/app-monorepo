import type { IFuseResultMatch } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import { buildFuse } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import type { IDApp } from '@onekeyhq/shared/types/discovery';

import type { IBrowserBookmark, IBrowserHistory } from '../types';

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MAX_RECENT_VISITS_PER_ITEM = 10;
const MAX_FRECENCY_VISIT_SCORE = 6;
const BOOKMARK_FRECENCY_BONUS = 0.2;
const REMOTE_SEARCH_MIN_QUERY_LENGTH = 3;
const REMOTE_SEARCH_MAX_QUERY_LENGTH = 64;
const DAPP_PROMOTION_LOCAL_SUPPORT_MIN_COUNT = 2;
const DAPP_PROMOTION_PREFIX_COVERAGE_DIRECT = 0.8;
const DAPP_PROMOTION_PREFIX_COVERAGE_WITH_SUPPORT = 0.6;

export const DISCOVERY_RANKING_HISTORY_LIMIT = 200;
export const DISCOVERY_LOCAL_SEARCH_CANDIDATE_LIMIT = 200;

export type IDiscoverySearchListItem =
  | {
      type: 'dapp';
      source: 'remote' | 'trending';
      key: string;
      title: string;
      url: string;
      logo?: string;
      originLogo?: string;
      isExactUrl?: boolean;
      keyword?: string;
      dapp: IDApp;
    }
  | {
      type: 'bookmark';
      key: string;
      title: string;
      url: string;
      logo?: string;
      titleMatch?: IFuseResultMatch;
      urlMatch?: IFuseResultMatch;
      bookmark: IBrowserBookmark;
    }
  | {
      type: 'history';
      key: string;
      title: string;
      url: string;
      logo?: string;
      titleMatch?: IFuseResultMatch;
      urlMatch?: IFuseResultMatch;
      history: IBrowserHistory;
    }
  | {
      type: 'search-action';
      key: string;
      title: string;
      url: string;
      logo?: string;
    };

type ITopicalityScore = {
  bucket: number;
  score: number;
};

type IHistoryVisitMaps = {
  originVisitMap: Map<string, IBrowserHistory[]>;
  urlVisitMap: Map<string, IBrowserHistory[]>;
};

type IDappRankedSearchEntry = {
  item: IDApp;
  index: number;
  topicality: ITopicalityScore;
  namePrefixCoverage: number;
  visits: IBrowserHistory[];
  finalScore: number;
};

type ILocalCandidate =
  | {
      type: 'bookmark';
      item: IBrowserBookmark;
      index: number;
    }
  | {
      type: 'history';
      item: IBrowserHistory;
      index: number;
    };

function normalizeText(text?: string) {
  return (text ?? '').trim().toLowerCase();
}

function isWebUrl(text?: string): text is string {
  return /^https?:\/\//.test(normalizeText(text));
}

function getWebOrigins(origins?: string[]) {
  return (origins ?? []).filter((origin) => isWebUrl(origin));
}

function normalizeUrlLikeText(text?: string) {
  return normalizeText(text)
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

function escapeRegExp(value: string) {
  return value.replace(/[[\]()+?*^$.|\\{}]/g, '\\$&');
}

function makeTopicalityScore(bucket: number, score: number): ITopicalityScore {
  return { bucket, score };
}

function compareTopicalityScore(a: ITopicalityScore, b: ITopicalityScore) {
  if (a.bucket !== b.bucket) {
    return a.bucket - b.bucket;
  }
  return a.score - b.score;
}

function pickHigherTopicalityScore(
  current: ITopicalityScore,
  next: ITopicalityScore,
) {
  return compareTopicalityScore(next, current) > 0 ? next : current;
}

function getHostFromUrl(url?: string) {
  if (!isWebUrl(url)) {
    return '';
  }
  return normalizeUrlLikeText(uriUtils.getHostNameFromUrl({ url }));
}

function isIpHostname(hostname: string) {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/u.test(hostname) || hostname.includes(':');
}

function getHostnameSiteKey(hostname?: string) {
  const normalizedHostname = normalizeText(hostname)
    .replace(/^www\./, '')
    .replace(/\.+$/u, '');

  if (!normalizedHostname) {
    return '';
  }

  if (isIpHostname(normalizedHostname)) {
    return normalizedHostname;
  }

  const labels = normalizedHostname.split('.').filter(Boolean);
  if (labels.length <= 2) {
    return normalizedHostname;
  }

  const tld = labels[labels.length - 1];
  const sld = labels[labels.length - 2];

  if (tld.length === 2 && sld.length <= 3) {
    return labels.slice(-3).join('.');
  }

  return labels.slice(-2).join('.');
}

function getOriginMatchKeys({
  url,
  origins,
}: {
  url?: string;
  origins?: string[];
}) {
  return Array.from(
    new Set(
      [url, ...getWebOrigins(origins)]
        .filter((item): item is string => Boolean(item))
        .map((item) => uriUtils.getOriginFromUrl({ url: item }) || item),
    ),
  );
}

function getSiteMatchKeys({
  url,
  origins,
}: {
  url?: string;
  origins?: string[];
}) {
  return Array.from(
    new Set(
      [url, ...getWebOrigins(origins)]
        .filter((item): item is string => Boolean(item))
        .map((item) => {
          const parsedUrl = uriUtils.safeParseURL(item);
          if (!parsedUrl || !['http:', 'https:'].includes(parsedUrl.protocol)) {
            return '';
          }

          const siteKey = getHostnameSiteKey(parsedUrl.hostname);
          return siteKey ? `${parsedUrl.protocol}//${siteKey}` : '';
        })
        .filter(Boolean),
    ),
  );
}

function getExactUrlVisitKey(url?: string) {
  return normalizeUrlLikeText(url);
}

function isExactDappNameMatch({
  dapp,
  keyword,
}: {
  dapp: Pick<IDApp, 'name'>;
  keyword: string;
}) {
  const normalizedKeyword = normalizeText(keyword);
  const normalizedName = normalizeText(dapp.name);

  return Boolean(normalizedKeyword) && normalizedKeyword === normalizedName;
}

function getDappNamePrefixCoverage({
  dapp,
  keyword,
}: {
  dapp: Pick<IDApp, 'name'>;
  keyword: string;
}) {
  const normalizedKeyword = normalizeText(keyword);
  const normalizedName = normalizeText(dapp.name);

  if (
    !normalizedKeyword ||
    !normalizedName ||
    !normalizedName.startsWith(normalizedKeyword)
  ) {
    return 0;
  }

  return normalizedKeyword.length / normalizedName.length;
}

function getDappLocalSupportCount({
  dapp,
  rankedLocalItems,
}: {
  dapp: Pick<IDApp, 'url' | 'origins'>;
  rankedLocalItems: ILocalCandidate[];
}) {
  const dappOriginKeySet = new Set(
    getOriginMatchKeys({
      url: dapp.url,
      origins: dapp.origins,
    }),
  );
  const dappSiteKeySet = new Set(
    getSiteMatchKeys({
      url: dapp.url,
      origins: dapp.origins,
    }),
  );
  const supportedUrlKeySet = new Set<string>();

  rankedLocalItems.forEach((candidate) => {
    const candidateOriginKeys = getOriginMatchKeys({ url: candidate.item.url });
    const candidateSiteKeys = getSiteMatchKeys({ url: candidate.item.url });
    const hasOriginSupport = candidateOriginKeys.some((key) =>
      dappOriginKeySet.has(key),
    );
    const hasSiteSupport = candidateSiteKeys.some((key) =>
      dappSiteKeySet.has(key),
    );

    if (!hasOriginSupport && !hasSiteSupport) {
      return;
    }

    const urlKey = getExactUrlVisitKey(candidate.item.url);
    if (urlKey) {
      supportedUrlKeySet.add(urlKey);
    }
  });

  return supportedUrlKeySet.size;
}

function hasWordBoundaryMatch(text: string, query: string) {
  if (!text || !query) {
    return false;
  }

  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(query)}`);
  return pattern.test(text);
}

function getTextTopicalityScore({
  text,
  query,
  exactBucket,
  prefixBucket,
  substringBucket,
  exactScore,
  prefixScore,
  wordBoundaryScore,
  substringScore,
}: {
  text?: string;
  query: string;
  exactBucket: number;
  prefixBucket: number;
  substringBucket: number;
  exactScore: number;
  prefixScore: number;
  wordBoundaryScore: number;
  substringScore: number;
}) {
  const normalizedText = normalizeText(text);
  if (!normalizedText || !query) {
    return makeTopicalityScore(0, 0);
  }

  if (normalizedText === query) {
    return makeTopicalityScore(exactBucket, exactScore);
  }

  if (normalizedText.startsWith(query)) {
    return makeTopicalityScore(prefixBucket, prefixScore);
  }

  if (hasWordBoundaryMatch(normalizedText, query)) {
    return makeTopicalityScore(prefixBucket, wordBoundaryScore);
  }

  if (normalizedText.includes(query)) {
    return makeTopicalityScore(substringBucket, substringScore);
  }

  return makeTopicalityScore(0, 0);
}

function getUrlTopicalityScore({
  url,
  query,
}: {
  url?: string;
  query: string;
}) {
  const normalizedUrl = normalizeUrlLikeText(url);
  const normalizedHost = getHostFromUrl(url);

  if (!query || (!normalizedUrl && !normalizedHost)) {
    return makeTopicalityScore(0, 0);
  }

  if (normalizedUrl === query) {
    return makeTopicalityScore(6, 120);
  }

  if (normalizedHost === query) {
    return makeTopicalityScore(5, 110);
  }

  if (normalizedHost.startsWith(query)) {
    return makeTopicalityScore(4, 94);
  }

  if (hasWordBoundaryMatch(normalizedHost, query)) {
    return makeTopicalityScore(4, 96);
  }

  if (normalizedUrl.startsWith(query)) {
    return makeTopicalityScore(4, 92);
  }

  if (normalizedUrl.includes(query)) {
    return makeTopicalityScore(3, 80);
  }

  return makeTopicalityScore(0, 0);
}

function getDappSiteTopicalityScore({
  dapp,
  query,
}: {
  dapp: Pick<IDApp, 'url' | 'origins'>;
  query: string;
}) {
  let bestScore = getUrlTopicalityScore({ url: dapp.url, query });

  getWebOrigins(dapp.origins).forEach((origin) => {
    bestScore = pickHigherTopicalityScore(
      bestScore,
      getUrlTopicalityScore({ url: origin, query }),
    );
  });

  return bestScore;
}

function shouldPrioritizeDappAheadOfLocal({
  dapp,
  keyword,
  localSupportCount,
}: {
  dapp: Pick<IDApp, 'name' | 'url' | 'origins' | 'keyword' | 'tags'>;
  keyword: string;
  localSupportCount: number;
}) {
  if (isExactDappNameMatch({ dapp, keyword })) {
    return true;
  }

  const namePrefixCoverage = getDappNamePrefixCoverage({ dapp, keyword });
  if (namePrefixCoverage >= DAPP_PROMOTION_PREFIX_COVERAGE_DIRECT) {
    return true;
  }

  if (localSupportCount < DAPP_PROMOTION_LOCAL_SUPPORT_MIN_COUNT) {
    return false;
  }

  if (namePrefixCoverage >= DAPP_PROMOTION_PREFIX_COVERAGE_WITH_SUPPORT) {
    return true;
  }

  return (
    getDappSiteTopicalityScore({
      dapp,
      query: normalizeUrlLikeText(keyword),
    }).bucket >= 4
  );
}

function getLocalItemTopicalityScore({
  title,
  url,
  query,
}: {
  title: string;
  url: string;
  query: string;
}) {
  let bestScore = getUrlTopicalityScore({ url, query });

  bestScore = pickHigherTopicalityScore(
    bestScore,
    getTextTopicalityScore({
      text: title,
      query,
      exactBucket: 5,
      prefixBucket: 4,
      substringBucket: 2,
      exactScore: 106,
      prefixScore: 94,
      wordBoundaryScore: 88,
      substringScore: 64,
    }),
  );

  return bestScore;
}

function getDappTopicalityScore({
  dapp,
  query,
}: {
  dapp: Pick<IDApp, 'name' | 'url' | 'origins' | 'keyword' | 'tags'>;
  query: string;
}) {
  let bestScore = getUrlTopicalityScore({ url: dapp.url, query });

  getWebOrigins(dapp.origins).forEach((origin) => {
    bestScore = pickHigherTopicalityScore(
      bestScore,
      getUrlTopicalityScore({ url: origin, query }),
    );
  });

  bestScore = pickHigherTopicalityScore(
    bestScore,
    getTextTopicalityScore({
      text: dapp.name,
      query,
      exactBucket: 5,
      prefixBucket: 4,
      substringBucket: 2,
      exactScore: 108,
      prefixScore: 98,
      wordBoundaryScore: 90,
      substringScore: 68,
    }),
  );

  if (dapp.keyword) {
    bestScore = pickHigherTopicalityScore(
      bestScore,
      getTextTopicalityScore({
        text: dapp.keyword,
        query,
        exactBucket: 4,
        prefixBucket: 3,
        substringBucket: 2,
        exactScore: 95,
        prefixScore: 82,
        wordBoundaryScore: 76,
        substringScore: 60,
      }),
    );
  }

  (dapp.tags ?? []).forEach((tag) => {
    bestScore = pickHigherTopicalityScore(
      bestScore,
      getTextTopicalityScore({
        text: tag.name,
        query,
        exactBucket: 3,
        prefixBucket: 2,
        substringBucket: 2,
        exactScore: 74,
        prefixScore: 66,
        wordBoundaryScore: 62,
        substringScore: 56,
      }),
    );
  });

  return bestScore;
}

function buildVisitMap({
  history,
  keyBuilder,
}: {
  history: IBrowserHistory[];
  keyBuilder: (item: IBrowserHistory) => string[];
}) {
  const visitMap = new Map<string, IBrowserHistory[]>();

  history.forEach((item) => {
    keyBuilder(item).forEach((key) => {
      if (!key) {
        return;
      }
      const visits = visitMap.get(key) ?? [];
      visits.push(item);
      visitMap.set(key, visits);
    });
  });

  visitMap.forEach((visits, key) => {
    visitMap.set(
      key,
      visits.toSorted((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)),
    );
  });

  return visitMap;
}

function buildHistoryVisitMaps(history: IBrowserHistory[]): IHistoryVisitMaps {
  return {
    originVisitMap: buildVisitMap({
      history,
      keyBuilder: (item) => getOriginMatchKeys({ url: item.url }),
    }),
    urlVisitMap: buildVisitMap({
      history,
      keyBuilder: (item) => [getExactUrlVisitKey(item.url)],
    }),
  };
}

function getLatestVisitTimestamp(visits: IBrowserHistory[]) {
  return visits[0]?.createdAt ?? 0;
}

function interpolateScore({
  value,
  fromStart,
  fromEnd,
  scoreStart,
  scoreEnd,
}: {
  value: number;
  fromStart: number;
  fromEnd: number;
  scoreStart: number;
  scoreEnd: number;
}) {
  if (fromEnd <= fromStart) {
    return scoreEnd;
  }

  const progress = (value - fromStart) / (fromEnd - fromStart);
  return scoreStart + progress * (scoreEnd - scoreStart);
}

function getRecencyBucketScore({
  createdAt,
  now,
}: {
  createdAt: number;
  now: number;
}) {
  if (!Number.isFinite(createdAt) || createdAt <= 0) {
    return 0.1;
  }

  const ageDays = Math.max(0, (now - createdAt) / DAY_IN_MS);

  if (ageDays <= 4) {
    return 1;
  }
  if (ageDays <= 14) {
    return interpolateScore({
      value: ageDays,
      fromStart: 4,
      fromEnd: 14,
      scoreStart: 1,
      scoreEnd: 0.7,
    });
  }
  if (ageDays <= 31) {
    return interpolateScore({
      value: ageDays,
      fromStart: 14,
      fromEnd: 31,
      scoreStart: 0.7,
      scoreEnd: 0.5,
    });
  }
  if (ageDays <= 90) {
    return interpolateScore({
      value: ageDays,
      fromStart: 31,
      fromEnd: 90,
      scoreStart: 0.5,
      scoreEnd: 0.3,
    });
  }
  if (ageDays <= 365) {
    return interpolateScore({
      value: ageDays,
      fromStart: 90,
      fromEnd: 365,
      scoreStart: 0.3,
      scoreEnd: 0.1,
    });
  }

  return 0.1;
}

function getVisitFrecencyScore({
  visits,
  now,
}: {
  visits: IBrowserHistory[];
  now: number;
}) {
  return visits.slice(0, MAX_RECENT_VISITS_PER_ITEM).reduce(
    (score, visit, index) =>
      score +
      getRecencyBucketScore({
        createdAt: visit.createdAt,
        now,
      }) *
        Math.max(0.65, 1 - index * 0.05),
    0,
  );
}

function getFrecencyMultiplier({
  visits,
  now,
  bookmarkBonus = 0,
}: {
  visits: IBrowserHistory[];
  now: number;
  bookmarkBonus?: number;
}) {
  const visitScore = Math.min(
    getVisitFrecencyScore({
      visits,
      now,
    }),
    MAX_FRECENCY_VISIT_SCORE,
  );

  return 1 + visitScore * 0.2 + bookmarkBonus;
}

function getDappMatchedVisits({
  dapp,
  originVisitMap,
}: {
  dapp: Pick<IDApp, 'url' | 'origins'>;
  originVisitMap: Map<string, IBrowserHistory[]>;
}) {
  const dedupeSet = new Set<string>();
  const visits: IBrowserHistory[] = [];

  getOriginMatchKeys({
    url: dapp.url,
    origins: dapp.origins,
  }).forEach((key) => {
    (originVisitMap.get(key) ?? []).forEach((visit) => {
      const visitKey = visit.id || `${visit.url}:${visit.createdAt}`;
      if (dedupeSet.has(visitKey)) {
        return;
      }
      dedupeSet.add(visitKey);
      visits.push(visit);
    });
  });

  return visits.toSorted((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

function getLocalItemMatchedVisits({
  candidate,
  urlVisitMap,
}: {
  candidate: ILocalCandidate;
  urlVisitMap: Map<string, IBrowserHistory[]>;
}) {
  const visits = urlVisitMap.get(getExactUrlVisitKey(candidate.item.url)) ?? [];

  if (candidate.type === 'history' && visits.length === 0) {
    return [candidate.item];
  }

  return visits;
}

function compareRankedDappSearchEntries(
  a: IDappRankedSearchEntry,
  b: IDappRankedSearchEntry,
  options?: {
    getLocalSupportCount?: (dapp: IDApp) => number;
  },
) {
  if (Boolean(a.item.isExactUrl) !== Boolean(b.item.isExactUrl)) {
    return (
      Number(Boolean(b.item.isExactUrl)) - Number(Boolean(a.item.isExactUrl))
    );
  }
  if (a.topicality.bucket !== b.topicality.bucket) {
    return b.topicality.bucket - a.topicality.bucket;
  }
  if (a.finalScore !== b.finalScore) {
    return b.finalScore - a.finalScore;
  }
  if (a.namePrefixCoverage !== b.namePrefixCoverage) {
    return b.namePrefixCoverage - a.namePrefixCoverage;
  }

  const localSupportCountDiff =
    (options?.getLocalSupportCount?.(b.item) ?? 0) -
    (options?.getLocalSupportCount?.(a.item) ?? 0);
  if (localSupportCountDiff !== 0) {
    return localSupportCountDiff;
  }

  const latestVisitDiff =
    getLatestVisitTimestamp(b.visits) - getLatestVisitTimestamp(a.visits);
  if (latestVisitDiff !== 0) {
    return latestVisitDiff;
  }
  return a.index - b.index;
}

function buildRankedDappSearchEntries({
  keyword,
  searchResult,
  rankingHistoryData,
}: {
  keyword: string;
  searchResult?: IDApp[];
  rankingHistoryData?: IBrowserHistory[];
}): IDappRankedSearchEntry[] {
  const normalizedQuery = normalizeUrlLikeText(keyword);
  const historyVisitMaps = buildHistoryVisitMaps(rankingHistoryData ?? []);
  const now = Date.now();

  return (searchResult ?? []).map((item, index) => {
    const topicality = getDappTopicalityScore({
      dapp: item,
      query: normalizedQuery,
    });
    const visits = getDappMatchedVisits({
      dapp: item,
      originVisitMap: historyVisitMaps.originVisitMap,
    });
    const frecencyMultiplier = getFrecencyMultiplier({
      visits,
      now,
    });

    return {
      item,
      index,
      topicality,
      namePrefixCoverage: getDappNamePrefixCoverage({
        dapp: item,
        keyword,
      }),
      visits,
      finalScore: topicality.score * frecencyMultiplier,
    };
  });
}

export function rankSearchResultsChromeLike({
  keyword,
  searchResult,
  rankingHistoryData,
}: {
  keyword: string;
  searchResult?: IDApp[];
  rankingHistoryData?: IBrowserHistory[];
}) {
  return buildRankedDappSearchEntries({
    keyword,
    searchResult,
    rankingHistoryData,
  })
    .toSorted((a, b) => compareRankedDappSearchEntries(a, b))
    .map(({ item }) => item);
}

function rankLocalSearchItems({
  keyword,
  rankingHistoryData,
  bookmarkSearchData,
  historySearchData,
}: {
  keyword: string;
  rankingHistoryData?: IBrowserHistory[];
  bookmarkSearchData?: IBrowserBookmark[];
  historySearchData?: IBrowserHistory[];
}) {
  const normalizedQuery = normalizeUrlLikeText(keyword);
  const historyVisitMaps = buildHistoryVisitMaps(rankingHistoryData ?? []);
  const now = Date.now();
  const candidates: ILocalCandidate[] = [
    ...(bookmarkSearchData ?? []).map(
      (item, index) =>
        ({
          type: 'bookmark',
          item,
          index,
        }) as const,
    ),
    ...(historySearchData ?? []).map(
      (item, index) =>
        ({
          type: 'history',
          item,
          index,
        }) as const,
    ),
  ];

  return candidates
    .map((candidate) => {
      const topicality = getLocalItemTopicalityScore({
        title: candidate.item.title,
        url: candidate.item.url,
        query: normalizedQuery,
      });
      const visits = getLocalItemMatchedVisits({
        candidate,
        urlVisitMap: historyVisitMaps.urlVisitMap,
      });
      const frecencyMultiplier = getFrecencyMultiplier({
        visits,
        now,
        bookmarkBonus:
          candidate.type === 'bookmark' ? BOOKMARK_FRECENCY_BONUS : 0,
      });

      return {
        candidate,
        topicality,
        visits,
        finalScore: topicality.score * frecencyMultiplier,
      };
    })
    .toSorted((a, b) => {
      if (a.topicality.bucket !== b.topicality.bucket) {
        return b.topicality.bucket - a.topicality.bucket;
      }
      if (a.finalScore !== b.finalScore) {
        return b.finalScore - a.finalScore;
      }
      if (a.candidate.type !== b.candidate.type) {
        return a.candidate.type === 'bookmark' ? -1 : 1;
      }
      const latestVisitDiff =
        getLatestVisitTimestamp(b.visits) - getLatestVisitTimestamp(a.visits);
      if (latestVisitDiff !== 0) {
        return latestVisitDiff;
      }
      return a.candidate.index - b.candidate.index;
    })
    .map(({ candidate }) => candidate);
}

export function searchTrendingDappsByKeyword({
  keyword,
  trendingData,
}: {
  keyword: string;
  trendingData?: IDApp[];
}) {
  if (!keyword) {
    return [];
  }

  const fuse = buildFuse(trendingData ?? [], {
    keys: ['name', 'url', 'origins', 'keyword', 'tags.name'],
  });

  return fuse.search(keyword).map((item) => item.item);
}

export function shouldSkipRemoteSearchByKeyword(keyword: string) {
  const trimmedLength = keyword.trim().length;
  const normalizedKeyword = keyword.trim();
  const normalizedUrl = uriUtils.safeParseURL(
    uriUtils.ensureHttpsPrefix(normalizedKeyword),
  );
  const isLongUrlLikeQuery = Boolean(
    normalizedUrl &&
    normalizedUrl.hostname &&
    ['http:', 'https:'].includes(normalizedUrl.protocol),
  );

  return (
    trimmedLength < REMOTE_SEARCH_MIN_QUERY_LENGTH ||
    (trimmedLength > REMOTE_SEARCH_MAX_QUERY_LENGTH && !isLongUrlLikeQuery)
  );
}

function hasMatchKeyOverlap({
  keys,
  dedupeKeySet,
}: {
  keys: string[];
  dedupeKeySet: Set<string>;
}) {
  return keys.some((key) => dedupeKeySet.has(key));
}

function appendMatchKeys({
  keys,
  dedupeKeySet,
}: {
  keys: string[];
  dedupeKeySet: Set<string>;
}) {
  keys.forEach((key) => dedupeKeySet.add(key));
}

function appendDappSearchResults({
  items,
  source,
  keyword,
  mergedItems,
  originDedupeKeySet,
  urlDedupeKeySet,
  reserveLocalUrlKey = false,
}: {
  items: IDApp[];
  source: 'remote' | 'trending';
  keyword: string;
  mergedItems: IDiscoverySearchListItem[];
  originDedupeKeySet: Set<string>;
  urlDedupeKeySet: Set<string>;
  reserveLocalUrlKey?: boolean;
}) {
  items.forEach((item) => {
    appendDappSearchResult({
      item,
      source,
      keyword,
      mergedItems,
      originDedupeKeySet,
      urlDedupeKeySet,
      reserveLocalUrlKey,
    });
  });
}

function appendDappSearchResult({
  item,
  source,
  keyword,
  mergedItems,
  originDedupeKeySet,
  urlDedupeKeySet,
  reserveLocalUrlKey = false,
}: {
  item: IDApp;
  source: 'remote' | 'trending';
  keyword: string;
  mergedItems: IDiscoverySearchListItem[];
  originDedupeKeySet: Set<string>;
  urlDedupeKeySet: Set<string>;
  reserveLocalUrlKey?: boolean;
}) {
  const urlKey = getExactUrlVisitKey(item.url);
  const keys = getOriginMatchKeys({ url: item.url, origins: item.origins });
  if (hasMatchKeyOverlap({ keys, dedupeKeySet: originDedupeKeySet })) {
    return;
  }

  appendMatchKeys({ keys, dedupeKeySet: originDedupeKeySet });
  if (reserveLocalUrlKey && urlKey) {
    urlDedupeKeySet.add(urlKey);
  }

  mergedItems.push({
    type: 'dapp',
    source,
    key: `${source === 'trending' ? 'trending' : 'dapp'}:${item.dappId}`,
    title: item.name,
    url: item.url,
    logo: item.logo,
    originLogo: item.originLogo,
    isExactUrl: item.isExactUrl,
    keyword: keyword || item.keyword,
    dapp: item,
  });
}

export function mergeSearchResultsWithLocalData({
  keyword,
  searchResult,
  rankingHistoryData,
  bookmarkSearchData,
  historySearchData,
  trendingSearchData,
}: {
  keyword: string;
  searchResult?: IDApp[];
  rankingHistoryData?: IBrowserHistory[];
  bookmarkSearchData?: IBrowserBookmark[];
  historySearchData?: IBrowserHistory[];
  trendingSearchData?: IDApp[];
}): IDiscoverySearchListItem[] {
  const mergedItems: IDiscoverySearchListItem[] = [];
  const dappOriginDedupeKeySet = new Set<string>();
  const urlDedupeKeySet = new Set<string>();

  const rankedRemoteSearchEntries = buildRankedDappSearchEntries({
    keyword,
    searchResult,
    rankingHistoryData,
  });
  const rankedTrendingSearchEntries = buildRankedDappSearchEntries({
    keyword,
    searchResult: trendingSearchData,
    rankingHistoryData,
  });
  const rankedLocalItems = rankLocalSearchItems({
    keyword,
    rankingHistoryData,
    bookmarkSearchData,
    historySearchData,
  });
  const localSupportCountCache = new Map<string, number>();
  const getLocalSupportCount = (dapp: IDApp) => {
    const cached = localSupportCountCache.get(dapp.dappId);
    if (cached !== undefined) {
      return cached;
    }

    const count = getDappLocalSupportCount({
      dapp,
      rankedLocalItems,
    });
    localSupportCountCache.set(dapp.dappId, count);
    return count;
  };
  const rankedTrendingResults = rankedTrendingSearchEntries
    .toSorted((a, b) =>
      compareRankedDappSearchEntries(a, b, {
        getLocalSupportCount,
      }),
    )
    .map(({ item }) => item);
  const rankedRemoteResults = rankedRemoteSearchEntries
    .toSorted((a, b) =>
      compareRankedDappSearchEntries(a, b, {
        getLocalSupportCount,
      }),
    )
    .map(({ item }) => item);

  const shouldPrioritize = (dapp: IDApp) =>
    shouldPrioritizeDappAheadOfLocal({
      dapp,
      keyword,
      localSupportCount: getLocalSupportCount(dapp),
    });

  const exactUrlResults: IDApp[] = [];
  const prioritizedRemoteResults: IDApp[] = [];
  const remainingRemoteResults: IDApp[] = [];
  let hasStartedRemainingRemoteResults = false;
  for (const item of rankedRemoteResults) {
    if (item.isExactUrl) {
      exactUrlResults.push(item);
    } else if (!hasStartedRemainingRemoteResults && shouldPrioritize(item)) {
      prioritizedRemoteResults.push(item);
    } else {
      hasStartedRemainingRemoteResults = true;
      remainingRemoteResults.push(item);
    }
  }

  const prioritizedTrendingResults: IDApp[] = [];
  const otherTrendingResults: IDApp[] = [];
  let hasStartedOtherTrendingResults = false;
  for (const item of rankedTrendingResults) {
    if (!hasStartedOtherTrendingResults && shouldPrioritize(item)) {
      prioritizedTrendingResults.push(item);
    } else {
      hasStartedOtherTrendingResults = true;
      otherTrendingResults.push(item);
    }
  }

  appendDappSearchResults({
    items: exactUrlResults,
    source: 'remote',
    keyword,
    mergedItems,
    originDedupeKeySet: dappOriginDedupeKeySet,
    urlDedupeKeySet,
    reserveLocalUrlKey: true,
  });

  appendDappSearchResults({
    items: prioritizedTrendingResults,
    source: 'trending',
    keyword,
    mergedItems,
    originDedupeKeySet: dappOriginDedupeKeySet,
    urlDedupeKeySet,
    reserveLocalUrlKey: true,
  });

  appendDappSearchResults({
    items: prioritizedRemoteResults,
    source: 'remote',
    keyword,
    mergedItems,
    originDedupeKeySet: dappOriginDedupeKeySet,
    urlDedupeKeySet,
    reserveLocalUrlKey: true,
  });

  rankedLocalItems.forEach((candidate) => {
    const urlKey = getExactUrlVisitKey(candidate.item.url);
    if (urlKey && urlDedupeKeySet.has(urlKey)) {
      return;
    }
    if (urlKey) {
      urlDedupeKeySet.add(urlKey);
    }

    if (candidate.type === 'bookmark') {
      const item = candidate.item;
      mergedItems.push({
        type: 'bookmark',
        key: `bookmark:${item.url}:${candidate.index}`,
        title: item.title,
        url: item.url,
        logo: item.logo,
        titleMatch: item.titleMatch,
        urlMatch: item.urlMatch,
        bookmark: item,
      });
      return;
    }

    const item = candidate.item;
    mergedItems.push({
      type: 'history',
      key: `history:${item.id}`,
      title: item.title,
      url: item.url,
      logo: item.logo,
      titleMatch: item.titleMatch,
      urlMatch: item.urlMatch,
      history: item,
    });
  });

  appendDappSearchResults({
    items: otherTrendingResults,
    source: 'trending',
    keyword,
    mergedItems,
    originDedupeKeySet: dappOriginDedupeKeySet,
    urlDedupeKeySet,
  });

  appendDappSearchResults({
    items: remainingRemoteResults,
    source: 'remote',
    keyword,
    mergedItems,
    originDedupeKeySet: dappOriginDedupeKeySet,
    urlDedupeKeySet,
  });

  return mergedItems;
}
