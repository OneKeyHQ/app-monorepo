import type { IDApp } from '@onekeyhq/shared/types/discovery';

import {
  mergeSearchResultsWithLocalData,
  rankSearchResultsChromeLike,
  searchTrendingDappsByKeyword,
  shouldSkipRemoteSearchByKeyword,
} from './searchResultRanking';

import type { IBrowserBookmark, IBrowserHistory } from '../types';

function createDApp({
  dappId,
  name,
  url,
  origins,
  isExactUrl,
}: {
  dappId: string;
  name?: string;
  url: string;
  origins?: string[];
  isExactUrl?: boolean;
}): IDApp {
  return {
    dappId,
    name: name ?? dappId,
    url,
    origins,
    isExactUrl,
    logo: '',
    description: '',
    networkIds: [],
    tags: [],
  };
}

function createHistory({
  id,
  title,
  url,
  createdAt,
}: {
  id: string;
  title?: string;
  url: string;
  createdAt: number;
}): IBrowserHistory {
  return {
    id,
    title: title ?? id,
    url,
    createdAt,
  };
}

function createBookmark({
  title,
  url,
}: {
  title: string;
  url: string;
}): IBrowserBookmark {
  return {
    title,
    url,
    logo: '',
    sortIndex: 0,
  };
}

describe('searchResultRanking', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-04-20T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses frecency to move visited dapps ahead within the same topicality bucket', () => {
    const result = rankSearchResultsChromeLike({
      keyword: 'swap',
      searchResult: [
        createDApp({
          dappId: 'alpha',
          name: 'Alpha Swap',
          url: 'https://alpha.example',
        }),
        createDApp({
          dappId: 'beta',
          name: 'Beta Swap',
          url: 'https://beta.example',
        }),
      ],
      rankingHistoryData: [
        createHistory({
          id: 'history-beta',
          url: 'https://beta.example/trade',
          createdAt: Date.now() - 1 * 60 * 60 * 1000,
        }),
      ],
    });

    expect(result.map((item) => item.dappId)).toEqual(['beta', 'alpha']);
  });

  it('keeps stronger topicality ahead of weaker but more frequent matches', () => {
    const result = rankSearchResultsChromeLike({
      keyword: 'uni',
      searchResult: [
        createDApp({
          dappId: 'strong',
          name: 'Uniswap',
          url: 'https://app.uniswap.org',
        }),
        createDApp({
          dappId: 'weak',
          name: 'Community Portal',
          url: 'https://weak.example/universe',
        }),
      ],
      rankingHistoryData: Array.from({ length: 10 }, (_, index) =>
        createHistory({
          id: `history-weak-${index}`,
          url: `https://weak.example/page-${index}`,
          createdAt: Date.now() - index * 60 * 60 * 1000,
        }),
      ),
    });

    expect(result.map((item) => item.dappId)).toEqual(['strong', 'weak']);
  });

  it('keeps original order when candidates share topicality and frecency', () => {
    const result = rankSearchResultsChromeLike({
      keyword: 'swap',
      searchResult: [
        createDApp({
          dappId: 'first',
          name: 'First Swap',
          url: 'https://first.example',
        }),
        createDApp({
          dappId: 'second',
          name: 'Second Swap',
          url: 'https://second.example',
        }),
      ],
      rankingHistoryData: [],
    });

    expect(result.map((item) => item.dappId)).toEqual(['first', 'second']);
  });

  it('matches dapps through alternate origins', () => {
    const result = rankSearchResultsChromeLike({
      keyword: 'llama',
      searchResult: [
        createDApp({ dappId: 'paraswap', url: 'https://www.paraswap.io' }),
        createDApp({
          dappId: 'llama',
          name: 'DefiLlama',
          url: 'https://defillama.com',
          origins: ['https://llama.fi'],
        }),
      ],
      rankingHistoryData: [
        createHistory({
          id: 'history-llama',
          url: 'https://llama.fi/protocols',
          createdAt: Date.now() - 1 * 60 * 60 * 1000,
        }),
      ],
    });

    expect(result.map((item) => item.dappId)).toEqual(['llama', 'paraswap']);
  });

  it('keeps exact url matches ahead of chrome-like ranked results', () => {
    const result = rankSearchResultsChromeLike({
      keyword: 'https://exact.example',
      searchResult: [
        createDApp({
          dappId: 'visited',
          name: 'Visited App',
          url: 'https://visited.example',
        }),
        createDApp({
          dappId: 'exact',
          name: 'Exact App',
          url: 'https://exact.example',
          isExactUrl: true,
        }),
      ],
      rankingHistoryData: [
        createHistory({
          id: 'history-visited',
          url: 'https://visited.example/path',
          createdAt: Date.now() - 1 * 60 * 60 * 1000,
        }),
      ],
    });

    expect(result.map((item) => item.dappId)).toEqual(['exact', 'visited']);
  });

  it('ranks local host matches ahead of weaker title-only matches before merging remote results', () => {
    const result = mergeSearchResultsWithLocalData({
      keyword: 'app.uni',
      searchResult: [
        createDApp({
          dappId: 'remote',
          name: 'Remote App Uni',
          url: 'https://remote.example',
        }),
      ],
      rankingHistoryData: [
        createHistory({
          id: 'history-local',
          url: 'https://example.com/posts/1',
          createdAt: Date.now() - 1 * 60 * 60 * 1000,
        }),
      ],
      bookmarkSearchData: [
        createBookmark({
          title: 'Portfolio',
          url: 'https://app.uniswap.org/swap',
        }),
      ],
      historySearchData: [
        createHistory({
          id: 'history-title-match',
          title: 'App unit tests',
          url: 'https://example.com/posts/1',
          createdAt: Date.now() - 1 * 60 * 60 * 1000,
        }),
      ],
    });

    expect(
      result.map((item) => ({
        type: item.type,
        url: item.url,
      })),
    ).toEqual([
      {
        type: 'bookmark',
        url: 'https://app.uniswap.org/swap',
      },
      {
        type: 'history',
        url: 'https://example.com/posts/1',
      },
      {
        type: 'dapp',
        url: 'https://remote.example',
      },
    ]);
  });

  it('keeps exact url results ahead of local fused items', () => {
    const result = mergeSearchResultsWithLocalData({
      keyword: 'swap',
      searchResult: [
        createDApp({
          dappId: 'exact',
          name: 'Exact App',
          url: 'https://exact.example',
          isExactUrl: true,
        }),
        createDApp({
          dappId: 'remote',
          name: 'Remote Swap',
          url: 'https://remote.example',
        }),
      ],
      rankingHistoryData: [],
      bookmarkSearchData: [
        createBookmark({
          title: 'Bookmark Swap',
          url: 'https://bookmark.example',
        }),
      ],
      historySearchData: [
        createHistory({
          id: 'history-1',
          title: 'History Swap',
          url: 'https://history.example/path',
          createdAt: Date.now() - 1 * 60 * 60 * 1000,
        }),
      ],
    });

    expect(
      result.map((item) => ({
        type: item.type,
        url: item.url,
      })),
    ).toEqual([
      {
        type: 'dapp',
        url: 'https://exact.example',
      },
      {
        type: 'bookmark',
        url: 'https://bookmark.example',
      },
      {
        type: 'history',
        url: 'https://history.example/path',
      },
      {
        type: 'dapp',
        url: 'https://remote.example',
      },
    ]);
  });

  it('applies source priority as bookmark then history then trending then remote', () => {
    const result = mergeSearchResultsWithLocalData({
      keyword: 'swap',
      searchResult: [
        createDApp({
          dappId: 'remote',
          name: 'Remote Swap',
          url: 'https://remote.example',
        }),
      ],
      rankingHistoryData: [],
      bookmarkSearchData: [
        createBookmark({
          title: 'Bookmark Swap',
          url: 'https://bookmark.example',
        }),
      ],
      historySearchData: [
        createHistory({
          id: 'history-1',
          title: 'History Swap',
          url: 'https://history.example/path',
          createdAt: Date.now() - 1 * 60 * 60 * 1000,
        }),
      ],
      trendingSearchData: [
        createDApp({
          dappId: 'trending',
          name: 'Trending Swap',
          url: 'https://trending.example',
        }),
      ],
    });

    expect(
      result.map((item) => ({
        type: item.type,
        url: item.url,
      })),
    ).toEqual([
      {
        type: 'bookmark',
        url: 'https://bookmark.example',
      },
      {
        type: 'history',
        url: 'https://history.example/path',
      },
      {
        type: 'dapp',
        url: 'https://trending.example',
      },
      {
        type: 'dapp',
        url: 'https://remote.example',
      },
    ]);
  });

  it('dedupes trending ahead of remote when they share the same origin', () => {
    const result = mergeSearchResultsWithLocalData({
      keyword: 'swap',
      searchResult: [
        createDApp({
          dappId: 'remote',
          name: 'Remote Swap',
          url: 'https://app.uniswap.org',
        }),
      ],
      rankingHistoryData: [],
      bookmarkSearchData: [],
      historySearchData: [],
      trendingSearchData: [
        createDApp({
          dappId: 'trending',
          name: 'Trending Swap',
          url: 'https://app.uniswap.org/swap',
        }),
      ],
    });

    expect(
      result.map((item) => ({
        type: item.type,
        url: item.url,
      })),
    ).toEqual([
      {
        type: 'dapp',
        url: 'https://app.uniswap.org/swap',
      },
    ]);
  });

  it('keeps distinct local matches from the same origin', () => {
    const result = mergeSearchResultsWithLocalData({
      keyword: 'swap',
      searchResult: [
        createDApp({
          dappId: 'remote',
          name: 'Remote Swap',
          url: 'https://app.uniswap.org',
        }),
      ],
      rankingHistoryData: [],
      bookmarkSearchData: [
        createBookmark({
          title: 'Swap',
          url: 'https://app.uniswap.org/swap',
        }),
      ],
      historySearchData: [
        createHistory({
          id: 'history-pool',
          title: 'Pool Swap',
          url: 'https://app.uniswap.org/pool',
          createdAt: Date.now() - 1 * 60 * 60 * 1000,
        }),
      ],
      trendingSearchData: [
        createDApp({
          dappId: 'trending',
          name: 'Trending Swap',
          url: 'https://app.uniswap.org/explore',
        }),
      ],
    });

    expect(
      result.map((item) => ({
        type: item.type,
        url: item.url,
      })),
    ).toEqual([
      {
        type: 'bookmark',
        url: 'https://app.uniswap.org/swap',
      },
      {
        type: 'history',
        url: 'https://app.uniswap.org/pool',
      },
    ]);
  });

  it('dedupes identical local urls across bookmark and history', () => {
    const result = mergeSearchResultsWithLocalData({
      keyword: 'swap',
      searchResult: [],
      rankingHistoryData: [],
      bookmarkSearchData: [
        createBookmark({
          title: 'Swap',
          url: 'https://app.uniswap.org/swap',
        }),
      ],
      historySearchData: [
        createHistory({
          id: 'history-swap',
          title: 'Swap',
          url: 'https://app.uniswap.org/swap',
          createdAt: Date.now() - 1 * 60 * 60 * 1000,
        }),
      ],
    });

    expect(
      result.map((item) => ({
        type: item.type,
        url: item.url,
      })),
    ).toEqual([
      {
        type: 'bookmark',
        url: 'https://app.uniswap.org/swap',
      },
    ]);
  });

  it('searches trending dapps locally by keyword', () => {
    const result = searchTrendingDappsByKeyword({
      keyword: 'uni',
      trendingData: [
        createDApp({ dappId: 'uniswap', url: 'https://app.uniswap.org' }),
        createDApp({ dappId: 'aave', url: 'https://app.aave.com' }),
      ],
    });

    expect(result.map((item) => item.dappId)).toEqual(['uniswap']);
  });

  it('skips remote search for queries with length up to three', () => {
    expect(shouldSkipRemoteSearchByKeyword('a')).toBe(true);
    expect(shouldSkipRemoteSearchByKeyword('ab')).toBe(true);
    expect(shouldSkipRemoteSearchByKeyword(' Ab ')).toBe(true);
    expect(shouldSkipRemoteSearchByKeyword('abc')).toBe(true);
    expect(shouldSkipRemoteSearchByKeyword('abcd')).toBe(false);
    expect(shouldSkipRemoteSearchByKeyword('a1')).toBe(true);
    expect(shouldSkipRemoteSearchByKeyword('你我')).toBe(true);
    expect(shouldSkipRemoteSearchByKeyword('okx')).toBe(true);
    expect(shouldSkipRemoteSearchByKeyword('okxx')).toBe(false);
  });
});
