import type { IDApp } from '@onekeyhq/shared/types/discovery';

import {
  isWebUrlLikeSearchKeyword,
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

  it('keeps stronger dapp name prefixes ahead of weaker host prefix matches', () => {
    const result = rankSearchResultsChromeLike({
      keyword: 'aav',
      searchResult: [
        REAL_DISCOVERY_DAPPS.aave,
        createDApp({
          dappId: 'aavegotchi',
          name: 'Aavegotchi',
          url: 'https://www.aavegotchi.com',
        }),
      ],
      rankingHistoryData: [],
    });

    expect(result.map((item) => item.dappId)).toEqual([
      REAL_DISCOVERY_DAPPS.aave.dappId,
      'aavegotchi',
    ]);
  });

  it('does not let local support move weaker remote dapps ahead of stronger remote relevance', () => {
    const result = mergeSearchResultsWithLocalData({
      keyword: 'aav',
      searchResult: [
        REAL_DISCOVERY_DAPPS.aave,
        createDApp({
          dappId: 'aavegotchi',
          name: 'Aavegotchi',
          url: 'https://www.aavegotchi.com',
        }),
      ],
      rankingHistoryData: [],
      bookmarkSearchData: [
        createBookmark({
          title: 'Aavegotchi Lending',
          url: 'https://www.aavegotchi.com/lending',
        }),
      ],
      historySearchData: [
        createHistory({
          id: 'history-aavegotchi',
          title: 'Aavegotchi Wearables',
          url: 'https://www.aavegotchi.com/wearables',
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
        type: 'bookmark',
        title: 'Aavegotchi Lending',
      },
      {
        type: 'history',
        title: 'Aavegotchi Wearables',
      },
      {
        type: 'dapp',
        title: 'AAVE',
      },
      {
        type: 'dapp',
        title: 'Aavegotchi',
      },
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

  it('keeps visited remote dapps ahead of local history when a trending dapp is first', () => {
    const result = mergeSearchResultsWithLocalData({
      keyword: 'hyper',
      searchResult: [
        createDApp({
          dappId: 'hyperlane',
          name: 'Hyperlane',
          url: 'https://hyperlane.xyz',
        }),
        createDApp({
          dappId: 'hyperbeat',
          name: 'Hyperbeat',
          url: 'https://hyperbeat.org',
        }),
      ],
      trendingSearchData: [
        createDApp({
          dappId: 'hyperliquid',
          name: 'Hyperliquid',
          url: 'https://app.hyperliquid.xyz/join/1KGO',
        }),
      ],
      rankingHistoryData: [
        createHistory({
          id: 'history-hyperlane-ranking',
          title: 'Hyperlane',
          url: 'https://hyperlane.xyz',
          createdAt: Date.now() - 1 * 60 * 60 * 1000,
        }),
        createHistory({
          id: 'history-hyperliquid-ranking',
          title: 'Hyperliquid',
          url: 'https://app.hyperliquid.xyz/join/1KGO',
          createdAt: Date.now() - 2 * 60 * 60 * 1000,
        }),
      ],
      historySearchData: [
        createHistory({
          id: 'history-hyperliquid',
          title: 'Hyperliquid',
          url: 'https://app.hyperliquid.xyz/join/1KGO',
          createdAt: Date.now() - 2 * 60 * 60 * 1000,
        }),
        createHistory({
          id: 'history-hyperliquid-trade',
          title: 'Hyperliquid Trade',
          url: 'https://app.hyperliquid.xyz/trade/BTC',
          createdAt: Date.now() - 3 * 60 * 60 * 1000,
        }),
        createHistory({
          id: 'history-hyperlane',
          title: 'Hyperlane',
          url: 'https://hyperlane.xyz',
          createdAt: Date.now() - 1 * 60 * 60 * 1000,
        }),
      ],
    });

    expect(
      result.slice(0, 2).map((item) => ({
        type: item.type,
        title: item.title,
      })),
    ).toEqual([
      {
        type: 'dapp',
        title: 'Hyperliquid',
      },
      {
        type: 'dapp',
        title: 'Hyperlane',
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

  it('hides same-url history when the dapp is not promoted', () => {
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
        type: 'dapp',
        title: 'AAVE',
      },
      {
        type: 'dapp',
        title: 'Aave-Chan',
      },
      {
        type: 'dapp',
        title: 'Aavegotchi',
      },
    ]);
  });

  it('keeps stronger remote relevance ahead of weaker locally supported matches', () => {
    const result = mergeSearchResultsWithLocalData({
      keyword: 'aav',
      searchResult: [
        REAL_DISCOVERY_DAPPS.aave,
        createDApp({
          dappId: 'weaker-local-support',
          name: 'DeFi Club',
          url: 'https://defi.example/aav',
        }),
      ],
      rankingHistoryData: [],
      bookmarkSearchData: [
        createBookmark({
          title: 'AAV Guide',
          url: 'https://defi.example/aav-guide',
        }),
      ],
      historySearchData: [
        createHistory({
          id: 'history-weaker-local-support',
          title: 'AAV Tools',
          url: 'https://defi.example/aav-tools',
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
        type: 'bookmark',
        title: 'AAV Guide',
      },
      {
        type: 'history',
        title: 'AAV Tools',
      },
      {
        type: 'dapp',
        title: 'AAVE',
      },
      {
        type: 'dapp',
        title: 'DeFi Club',
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

  it('does not crash when an exact url dapp payload is missing dappId', () => {
    const exactUrlDappWithoutId = {
      ...createDApp({
        dappId: 'exact-url:https://api-v2.pendle.finance/dashboard/dashboard',
        name: 'https://api-v2.pendle.finance/dashboard/dashboard',
        url: 'https://api-v2.pendle.finance/dashboard/dashboard',
        isExactUrl: true,
      }),
      dappId: undefined,
    } as unknown as IDApp;

    const result = mergeSearchResultsWithLocalData({
      keyword: 'api-v2.pendle.finance',
      searchResult: [exactUrlDappWithoutId],
      rankingHistoryData: [],
      bookmarkSearchData: [
        createBookmark({
          title: 'Pendle API',
          url: 'https://api-v2.pendle.finance/core/docs',
        }),
      ],
      historySearchData: [],
    });

    expect(result.map((item) => item.type)).toEqual(['dapp', 'bookmark']);
    expect(result[0]?.url).toBe(
      'https://api-v2.pendle.finance/dashboard/dashboard',
    );
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

  it('hides exact history duplicates while keeping history weight on dapps', () => {
    const result = mergeSearchResultsWithLocalData({
      keyword: 'swap',
      searchResult: [
        createDApp({
          dappId: 'alpha',
          name: 'Swap Alpha',
          url: 'https://alpha.example',
        }),
        createDApp({
          dappId: 'bravo',
          name: 'Swap Bravo',
          url: 'https://bravo.example',
        }),
      ],
      rankingHistoryData: [
        createHistory({
          id: 'history-bravo',
          title: 'Swap Bravo',
          url: 'https://bravo.example',
          createdAt: Date.now() - 1 * 60 * 60 * 1000,
        }),
      ],
      bookmarkSearchData: [],
      historySearchData: [
        createHistory({
          id: 'history-bravo',
          title: 'Swap Bravo',
          url: 'https://bravo.example',
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
        url: 'https://bravo.example',
      },
      {
        type: 'dapp',
        url: 'https://alpha.example',
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

  it('returns all local items without scoring when keyword is empty', () => {
    const result = mergeSearchResultsWithLocalData({
      keyword: '',
      searchResult: [
        createDApp({ dappId: 'dapp', url: 'https://example.com' }),
      ],
      rankingHistoryData: [],
      bookmarkSearchData: [
        createBookmark({ title: 'Bookmark', url: 'https://bookmark.example' }),
      ],
      historySearchData: [
        createHistory({
          id: 'history-1',
          title: 'History',
          url: 'https://history.example',
          createdAt: Date.now(),
        }),
      ],
    });

    expect(result.map((item) => item.type)).toEqual([
      'bookmark',
      'history',
      'dapp',
    ]);
  });

  it('handles special regex characters in keyword without errors', () => {
    const result = mergeSearchResultsWithLocalData({
      keyword: 'test(.*)+?[]',
      searchResult: [],
      rankingHistoryData: [],
      bookmarkSearchData: [
        createBookmark({
          title: 'Test (.*)+?[] Page',
          url: 'https://example.com',
        }),
      ],
      historySearchData: [],
    });

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('bookmark');
  });

  it('ranks recent visits ahead of older ones following time decay buckets', () => {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    const result = rankSearchResultsChromeLike({
      keyword: 'swap',
      searchResult: [
        createDApp({
          dappId: 'day-400',
          name: 'Swap 400',
          url: 'https://400.example',
        }),
        createDApp({
          dappId: 'day-100',
          name: 'Swap 100',
          url: 'https://100.example',
        }),
        createDApp({
          dappId: 'day-50',
          name: 'Swap 50',
          url: 'https://50.example',
        }),
        createDApp({
          dappId: 'day-20',
          name: 'Swap 20',
          url: 'https://20.example',
        }),
        createDApp({
          dappId: 'day-10',
          name: 'Swap 10',
          url: 'https://10.example',
        }),
        createDApp({
          dappId: 'day-2',
          name: 'Swap 2',
          url: 'https://2.example',
        }),
      ],
      rankingHistoryData: [
        createHistory({
          id: 'h-400',
          url: 'https://400.example',
          createdAt: now - 400 * DAY,
        }),
        createHistory({
          id: 'h-100',
          url: 'https://100.example',
          createdAt: now - 100 * DAY,
        }),
        createHistory({
          id: 'h-50',
          url: 'https://50.example',
          createdAt: now - 50 * DAY,
        }),
        createHistory({
          id: 'h-20',
          url: 'https://20.example',
          createdAt: now - 20 * DAY,
        }),
        createHistory({
          id: 'h-10',
          url: 'https://10.example',
          createdAt: now - 10 * DAY,
        }),
        createHistory({
          id: 'h-2',
          url: 'https://2.example',
          createdAt: now - 2 * DAY,
        }),
      ],
    });

    expect(result.map((item) => item.dappId)).toEqual([
      'day-2',
      'day-10',
      'day-20',
      'day-50',
      'day-100',
      'day-400',
    ]);
  });

  it('treats ccTLD domains as same site across subdomains', () => {
    const result = mergeSearchResultsWithLocalData({
      keyword: 'bbc',
      searchResult: [
        createDApp({
          dappId: 'bbc-dapp',
          name: 'BBC News',
          url: 'https://www.bbc.co.uk',
        }),
      ],
      rankingHistoryData: [],
      bookmarkSearchData: [
        createBookmark({
          title: 'BBC Sport',
          url: 'https://sport.bbc.co.uk/football',
        }),
        createBookmark({
          title: 'BBC Weather',
          url: 'https://weather.bbc.co.uk',
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
      { type: 'dapp', title: 'BBC News' },
      { type: 'bookmark', title: 'BBC Sport' },
      { type: 'bookmark', title: 'BBC Weather' },
    ]);
  });

  it('treats com.cn domains as same site with ccTLD logic', () => {
    const result = mergeSearchResultsWithLocalData({
      keyword: 'taobao',
      searchResult: [
        createDApp({
          dappId: 'taobao-dapp',
          name: 'Taobao',
          url: 'https://www.taobao.com.cn',
        }),
      ],
      rankingHistoryData: [],
      bookmarkSearchData: [
        createBookmark({
          title: 'Taobao Mobile',
          url: 'https://m.taobao.com.cn/page',
        }),
        createBookmark({
          title: 'Taobao App',
          url: 'https://app.taobao.com.cn',
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
      { type: 'dapp', title: 'Taobao' },
      { type: 'bookmark', title: 'Taobao Mobile' },
      { type: 'bookmark', title: 'Taobao App' },
    ]);
  });

  it('dedupes IP address URLs by origin like regular hostnames', () => {
    const result = mergeSearchResultsWithLocalData({
      keyword: 'local',
      searchResult: [
        createDApp({
          dappId: 'local-dapp',
          name: 'Local Server',
          url: 'http://192.168.1.1:8080',
        }),
      ],
      rankingHistoryData: [],
      bookmarkSearchData: [
        createBookmark({
          title: 'Local Admin',
          url: 'http://192.168.1.1:8080/admin',
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
      { type: 'bookmark', title: 'Local Admin' },
      { type: 'dapp', title: 'Local Server' },
    ]);
  });

  it('treats visits at decay boundary days with expected scores', () => {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    const result = rankSearchResultsChromeLike({
      keyword: 'swap',
      searchResult: [
        createDApp({
          dappId: 'day-4',
          name: 'Swap 4',
          url: 'https://4.example',
        }),
        createDApp({
          dappId: 'day-14',
          name: 'Swap 14',
          url: 'https://14.example',
        }),
        createDApp({
          dappId: 'day-31',
          name: 'Swap 31',
          url: 'https://31.example',
        }),
        createDApp({
          dappId: 'day-90',
          name: 'Swap 90',
          url: 'https://90.example',
        }),
        createDApp({
          dappId: 'day-365',
          name: 'Swap 365',
          url: 'https://365.example',
        }),
      ],
      rankingHistoryData: [
        createHistory({
          id: 'h-4',
          url: 'https://4.example',
          createdAt: now - 4 * DAY,
        }),
        createHistory({
          id: 'h-14',
          url: 'https://14.example',
          createdAt: now - 14 * DAY,
        }),
        createHistory({
          id: 'h-31',
          url: 'https://31.example',
          createdAt: now - 31 * DAY,
        }),
        createHistory({
          id: 'h-90',
          url: 'https://90.example',
          createdAt: now - 90 * DAY,
        }),
        createHistory({
          id: 'h-365',
          url: 'https://365.example',
          createdAt: now - 365 * DAY,
        }),
      ],
    });

    expect(result.map((item) => item.dappId)).toEqual([
      'day-4',
      'day-14',
      'day-31',
      'day-90',
      'day-365',
    ]);
  });

  it('skips remote search for short queries and overlong non-url queries', () => {
    expect(shouldSkipRemoteSearchByKeyword('a')).toBe(true);
    expect(shouldSkipRemoteSearchByKeyword('ab')).toBe(true);
    expect(shouldSkipRemoteSearchByKeyword(' Ab ')).toBe(true);
    expect(shouldSkipRemoteSearchByKeyword('abc')).toBe(false);
    expect(shouldSkipRemoteSearchByKeyword('abcd')).toBe(false);
    expect(shouldSkipRemoteSearchByKeyword('a1')).toBe(true);
    expect(shouldSkipRemoteSearchByKeyword('你我')).toBe(true);
    expect(shouldSkipRemoteSearchByKeyword('okx')).toBe(false);
    expect(shouldSkipRemoteSearchByKeyword('okxx')).toBe(false);
    expect(shouldSkipRemoteSearchByKeyword('a'.repeat(64))).toBe(false);
    expect(shouldSkipRemoteSearchByKeyword('a'.repeat(65))).toBe(true);
    expect(shouldSkipRemoteSearchByKeyword(`  ${'a'.repeat(64)}  `)).toBe(
      false,
    );
    expect(shouldSkipRemoteSearchByKeyword('a'.repeat(200))).toBe(true);
    expect(
      shouldSkipRemoteSearchByKeyword(
        'https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=USDC&chain=ethereum',
      ),
    ).toBe(false);
    expect(
      shouldSkipRemoteSearchByKeyword(
        'app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=USDC&chain=ethereum',
      ),
    ).toBe(false);
    expect(shouldSkipRemoteSearchByKeyword('6.6.6.6/'.repeat(20))).toBe(false);
  });

  it('detects URL-like search keywords without parsing invalid input', () => {
    expect(isWebUrlLikeSearchKeyword('https://app.uniswap.org/swap')).toBe(
      true,
    );
    expect(isWebUrlLikeSearchKeyword('app.uniswap.org/swap')).toBe(true);
    expect(isWebUrlLikeSearchKeyword('http://localhost:3000')).toBe(true);
    expect(isWebUrlLikeSearchKeyword('localhost:3000')).toBe(true);
    expect(isWebUrlLikeSearchKeyword('6.6.6.6')).toBe(true);
    expect(isWebUrlLikeSearchKeyword('6.6.6.6:8080/path')).toBe(true);
    expect(isWebUrlLikeSearchKeyword('http://')).toBe(false);
    expect(isWebUrlLikeSearchKeyword('https:// app.uniswap.org')).toBe(false);
    expect(isWebUrlLikeSearchKeyword('search query')).toBe(false);
  });
});
