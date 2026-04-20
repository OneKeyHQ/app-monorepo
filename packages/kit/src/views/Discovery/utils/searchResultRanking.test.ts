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
  keyword,
  tags,
}: {
  dappId: string;
  name?: string;
  url: string;
  origins?: string[];
  isExactUrl?: boolean;
  keyword?: string;
  tags?: IDApp['tags'];
}): IDApp {
  return {
    dappId,
    name: name ?? dappId,
    url,
    origins,
    isExactUrl,
    keyword,
    logo: '',
    description: '',
    networkIds: [],
    tags: tags ?? [],
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

const REAL_DISCOVERY_DAPPS = {
  aave: createDApp({
    dappId: 'f1346f86-ff4b-489c-9dc0-98362f8eab95',
    name: 'AAVE',
    url: 'https://app.aave.com/',
    origins: ['okx', 'bitget', 'defillama', 'tp', 'dappradar'],
  }),
  uniswap: createDApp({
    dappId: 'e7642615-0d2c-496a-9d9e-2042f1623447',
    name: 'Uniswap',
    url: 'https://uniswap.org',
    origins: ['okx', 'bitget', 'defillama', 'tp', 'dappradar'],
  }),
  pendle: createDApp({
    dappId: 'e193d6d2-c919-4e6e-8c31-2d7208706037',
    name: 'Pendle',
    url: 'https://pendle.finance/',
    origins: ['okx', 'defillama', 'tp', 'dappradar'],
  }),
  aster: createDApp({
    dappId: '93ba2378-b2c4-47c8-b05e-b80d8cfd4375',
    name: 'Aster',
    url: 'https://www.asterdex.com',
    origins: ['defillama', 'tp'],
  }),
};

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

  it('uses dapp keyword matches in chrome-like ranking', () => {
    const result = rankSearchResultsChromeLike({
      keyword: 'dex',
      searchResult: [
        createDApp({
          dappId: 'keyword-match',
          name: 'Aggregator',
          url: 'https://keyword.example',
          keyword: 'dex',
        }),
        createDApp({
          dappId: 'name-substring',
          name: 'Indexer',
          url: 'https://name.example',
        }),
      ],
      rankingHistoryData: [],
    });

    expect(result.map((item) => item.dappId)).toEqual([
      'keyword-match',
      'name-substring',
    ]);
  });

  it('uses dapp tag matches in chrome-like ranking', () => {
    const result = rankSearchResultsChromeLike({
      keyword: 'social',
      searchResult: [
        createDApp({
          dappId: 'tag-match',
          name: 'Community Hub',
          url: 'https://tag.example',
          tags: [
            {
              tagId: 'social',
              name: 'social',
              type: 'category',
            },
          ],
        }),
        createDApp({
          dappId: 'name-substring',
          name: 'Unsocialized',
          url: 'https://name.example',
        }),
      ],
      rankingHistoryData: [],
    });

    expect(result.map((item) => item.dappId)).toEqual([
      'tag-match',
      'name-substring',
    ]);
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

  it('normalizes protocol, www prefix, and trailing slash for exact url matching', () => {
    const result = rankSearchResultsChromeLike({
      keyword: 'app.uniswap.org/swap',
      searchResult: [
        createDApp({
          dappId: 'normalized-exact',
          url: 'https://www.app.uniswap.org/swap/',
          isExactUrl: true,
        }),
        createDApp({
          dappId: 'other',
          url: 'https://app.uniswap.org/pool',
        }),
      ],
      rankingHistoryData: [],
    });

    expect(result.map((item) => item.dappId)).toEqual([
      'normalized-exact',
      'other',
    ]);
  });

  it('normalizes protocol and www prefix for host-level matching', () => {
    const result = rankSearchResultsChromeLike({
      keyword: 'app.uni',
      searchResult: [
        createDApp({
          dappId: 'host-prefix',
          url: 'https://www.app.uniswap.org/swap',
        }),
        createDApp({
          dappId: 'weaker',
          name: 'Application unit',
          url: 'https://example.com/path',
        }),
      ],
      rankingHistoryData: [],
    });

    expect(result.map((item) => item.dappId)).toEqual([
      'host-prefix',
      'weaker',
    ]);
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

  it('prioritizes exact dapp name matches ahead while deduping same-url local items', () => {
    const result = mergeSearchResultsWithLocalData({
      keyword: 'pendle',
      searchResult: [REAL_DISCOVERY_DAPPS.pendle],
      rankingHistoryData: [],
      bookmarkSearchData: [
        createBookmark({
          title: 'Pendle - Liberating Yield',
          url: 'https://pendle.finance/',
        }),
      ],
      historySearchData: [
        createHistory({
          id: 'pendle-history',
          title: 'Pendle V2 - Fixed Yield & Yield Trading',
          url: 'https://pendle.finance/pendle',
          createdAt: Date.now() - 1 * 60 * 60 * 1000,
        }),
      ],
    });

    expect(
      result.map((item) => ({
        type: item.type,
        title: item.title,
      })),
    ).toEqual([
      {
        type: 'dapp',
        title: 'Pendle',
      },
      {
        type: 'history',
        title: 'Pendle V2 - Fixed Yield & Yield Trading',
      },
    ]);
  });

  it('prioritizes dapps with multiple same-origin local matches for shorter queries', () => {
    const result = mergeSearchResultsWithLocalData({
      keyword: 'ast',
      searchResult: [REAL_DISCOVERY_DAPPS.aster],
      rankingHistoryData: [],
      bookmarkSearchData: [
        createBookmark({
          title: '74,419.1 | BTCUSDT | Trade | Aster',
          url: 'https://www.asterdex.com/en/trade/pro/futures/BTCUSDT',
        }),
      ],
      historySearchData: [
        createHistory({
          id: 'aster-history',
          title: 'Aster Spot',
          url: 'https://www.asterdex.com/en/trade/spot/BTCUSDT',
          createdAt: Date.now() - 1 * 60 * 60 * 1000,
        }),
      ],
    });

    expect(
      result.map((item) => ({
        type: item.type,
        title: item.title,
      })),
    ).toEqual([
      {
        type: 'dapp',
        title: 'Aster',
      },
      {
        type: 'bookmark',
        title: '74,419.1 | BTCUSDT | Trade | Aster',
      },
      {
        type: 'history',
        title: 'Aster Spot',
      },
    ]);
  });

  it('prioritizes near-complete dapp name prefixes ahead of local items', () => {
    const result = mergeSearchResultsWithLocalData({
      keyword: 'aste',
      searchResult: [REAL_DISCOVERY_DAPPS.aster],
      rankingHistoryData: [],
      bookmarkSearchData: [
        createBookmark({
          title: '74,419.1 | BTCUSDT | Trade | Aster',
          url: 'https://www.asterdex.com/en/trade/pro/futures/BTCUSDT',
        }),
      ],
      historySearchData: [],
    });

    expect(
      result.map((item) => ({
        type: item.type,
        title: item.title,
      })),
    ).toEqual([
      {
        type: 'dapp',
        title: 'Aster',
      },
      {
        type: 'bookmark',
        title: '74,419.1 | BTCUSDT | Trade | Aster',
      },
    ]);
  });

  it('keeps shorter dapp matches behind local items when same-origin support is weak', () => {
    const result = mergeSearchResultsWithLocalData({
      keyword: 'ast',
      searchResult: [REAL_DISCOVERY_DAPPS.aster],
      rankingHistoryData: [],
      bookmarkSearchData: [
        createBookmark({
          title: 'Astrolabe Notes',
          url: 'https://notes.example/ast',
        }),
      ],
      historySearchData: [],
    });

    expect(
      result.map((item) => ({
        type: item.type,
        title: item.title,
      })),
    ).toEqual([
      {
        type: 'bookmark',
        title: 'Astrolabe Notes',
      },
      {
        type: 'dapp',
        title: 'Aster',
      },
    ]);
  });

  it('uses real discovery URLs to promote site-backed dapps ahead of weaker text matches', () => {
    const result = mergeSearchResultsWithLocalData({
      keyword: 'aav',
      searchResult: [REAL_DISCOVERY_DAPPS.aave],
      rankingHistoryData: [],
      bookmarkSearchData: [
        createBookmark({
          title: 'Aave Markets',
          url: 'https://app.aave.com/markets',
        }),
        createBookmark({
          title: 'Aave Borrow',
          url: 'https://app.aave.com/borrow',
        }),
      ],
      historySearchData: [
        createHistory({
          id: 'history-weak-aav',
          title: 'Available notes',
          url: 'https://notes.example/available',
          createdAt: Date.now() - 1 * 60 * 60 * 1000,
        }),
      ],
    });

    expect(
      result.map((item) => ({
        type: item.type,
        title: item.title,
      })),
    ).toEqual([
      {
        type: 'dapp',
        title: 'AAVE',
      },
      {
        type: 'bookmark',
        title: 'Aave Markets',
      },
      {
        type: 'bookmark',
        title: 'Aave Borrow',
      },
      {
        type: 'history',
        title: 'Available notes',
      },
    ]);
  });

  it('prioritizes dapps with same-site local support across root and app subdomains', () => {
    const result = mergeSearchResultsWithLocalData({
      keyword: 'uni',
      searchResult: [REAL_DISCOVERY_DAPPS.uniswap],
      rankingHistoryData: [],
      bookmarkSearchData: [
        createBookmark({
          title: 'Swap | Uniswap',
          url: 'https://app.uniswap.org/swap',
        }),
      ],
      historySearchData: [
        createHistory({
          id: 'uniswap-history',
          title: 'Uniswap Pool',
          url: 'https://app.uniswap.org/pool',
          createdAt: Date.now() - 1 * 60 * 60 * 1000,
        }),
      ],
    });

    expect(
      result.map((item) => ({
        type: item.type,
        title: item.title,
      })),
    ).toEqual([
      {
        type: 'dapp',
        title: 'Uniswap',
      },
      {
        type: 'bookmark',
        title: 'Swap | Uniswap',
      },
      {
        type: 'history',
        title: 'Uniswap Pool',
      },
    ]);
  });

  it('keeps a same-url dapp behind local history when it is not promoted', () => {
    const result = mergeSearchResultsWithLocalData({
      keyword: 'aav',
      searchResult: [
        REAL_DISCOVERY_DAPPS.aave,
        createDApp({
          dappId: 'aavegotchi',
          name: 'Aavegotchi',
          url: 'https://www.aavegotchi.com',
        }),
        createDApp({
          dappId: 'aave-chan',
          name: 'Aave-Chan',
          url: 'https://www.aavechan.com',
        }),
      ],
      rankingHistoryData: [],
      bookmarkSearchData: [],
      historySearchData: [
        createHistory({
          id: 'history-aave-home',
          title: 'Aave - Open Source Liquidity Protocol',
          url: 'https://app.aave.com',
          createdAt: Date.now() - 1 * 60 * 60 * 1000,
        }),
      ],
    });

    expect(
      result.map((item) => ({
        type: item.type,
        title: item.title,
      })),
    ).toEqual([
      {
        type: 'history',
        title: 'Aave - Open Source Liquidity Protocol',
      },
      {
        type: 'dapp',
        title: 'AAVE',
      },
      {
        type: 'dapp',
        title: 'Aavegotchi',
      },
      {
        type: 'dapp',
        title: 'Aave-Chan',
      },
    ]);
  });

  it('does not dedupe different dapps that only share metadata origins in real payloads', () => {
    const result = mergeSearchResultsWithLocalData({
      keyword: 'e',
      searchResult: [REAL_DISCOVERY_DAPPS.aster, REAL_DISCOVERY_DAPPS.pendle],
      rankingHistoryData: [],
      bookmarkSearchData: [],
      historySearchData: [],
    });

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.title)).toEqual(
      expect.arrayContaining(['Aster', 'Pendle']),
    );
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

  it('keeps distinct local matches and one same-origin dapp result', () => {
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
      {
        type: 'dapp',
        url: 'https://app.uniswap.org/explore',
      },
    ]);
  });

  it('uses history item itself as a visit when no exact url history match exists', () => {
    const result = mergeSearchResultsWithLocalData({
      keyword: 'swap',
      searchResult: [],
      rankingHistoryData: [],
      bookmarkSearchData: [],
      historySearchData: [
        createHistory({
          id: 'history-older',
          title: 'Swap Alpha',
          url: 'https://alpha.example/trade',
          createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
        }),
        createHistory({
          id: 'history-newer',
          title: 'Swap Beta',
          url: 'https://beta.example/trade',
          createdAt: Date.now() - 1 * 60 * 60 * 1000,
        }),
      ],
    });

    expect(
      result.map((item) => ({
        type: item.type,
        key: item.key,
      })),
    ).toEqual([
      {
        type: 'history',
        key: 'history:history-newer',
      },
      {
        type: 'history',
        key: 'history:history-older',
      },
    ]);
  });

  it('keeps bookmark ahead of history when local scores tie', () => {
    const result = mergeSearchResultsWithLocalData({
      keyword: 'swap',
      searchResult: [],
      rankingHistoryData: [],
      bookmarkSearchData: [
        createBookmark({
          title: 'Swap Alpha',
          url: 'https://alpha.example',
        }),
      ],
      historySearchData: [
        createHistory({
          id: 'history-beta',
          title: 'Swap Beta',
          url: 'https://beta.example',
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
        url: 'https://alpha.example',
      },
      {
        type: 'history',
        url: 'https://beta.example',
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

  it('skips remote search only for queries shorter than three characters', () => {
    expect(shouldSkipRemoteSearchByKeyword('a')).toBe(true);
    expect(shouldSkipRemoteSearchByKeyword('ab')).toBe(true);
    expect(shouldSkipRemoteSearchByKeyword(' Ab ')).toBe(true);
    expect(shouldSkipRemoteSearchByKeyword('abc')).toBe(false);
    expect(shouldSkipRemoteSearchByKeyword('abcd')).toBe(false);
    expect(shouldSkipRemoteSearchByKeyword('a1')).toBe(true);
    expect(shouldSkipRemoteSearchByKeyword('你我')).toBe(true);
    expect(shouldSkipRemoteSearchByKeyword('okx')).toBe(false);
    expect(shouldSkipRemoteSearchByKeyword('okxx')).toBe(false);
  });
});
