import {
  buildPerpTokenSelectorCategoryTabs,
  buildPerpTokenSelectorTabs,
  buildPrimaryTabs,
  comparePerpTokenSelectorSortValues,
  getNextPerpTokenSelectorActiveTabConfig,
  getNextPerpTokenSelectorSortConfig,
  getPerpTokenSelectorDynamicTabItems,
  getPerpTokenSelectorFallbackTabId,
  getPerpTokenSelectorPrimaryTabId,
  getPerpTokenSelectorSortAssetCtxsByDex,
  isPerpTokenSelectorAllTab,
  isPerpTokenSelectorDynamicTabUserSort,
  isPerpTokenSelectorFavoritesTab,
  isPerpTokenSelectorPerpsTab,
  isPerpTokenSelectorPrimaryTab,
  isPerpTokenSelectorSortFieldActive,
  isPerpTokenSelectorSpotTab,
  shouldRefreshPerpTokenSelectorSortSnapshot,
  sortPerpTokenSelectorItemsByServerOrder,
  sortPerpTokenSelectorItemsBySortValue,
} from './tokenSelectorTabs';

const fixedTabNames = {
  favorites: 'Favorites',
  all: 'All',
  perps: 'PERPS',
  spot: 'Spot',
};

describe('tokenSelectorTabs', () => {
  it('builds the fixed primary tabs without an all tab', () => {
    expect(buildPrimaryTabs(fixedTabNames)).toEqual([
      { tabId: 'favorites', name: 'Favorites', tokens: [] },
      { tabId: 'perps', name: 'PERPS', tokens: [] },
      { tabId: 'spot', name: 'Spot', tokens: [] },
    ]);
  });

  it('keeps the perps all category before server-configured category tabs', () => {
    const tabs = buildPerpTokenSelectorCategoryTabs({
      serverTabs: [
        { tabId: 'crypto', name: 'Crypto', tokens: ['BTC'] },
        { tabId: 'stocks', name: 'Stocks', tokens: ['AAPL'] },
      ],
      fixedTabNames,
    });

    expect(tabs).toEqual([
      { tabId: 'perps', name: 'All', tokens: [] },
      { tabId: 'crypto', name: 'Crypto', tokens: ['BTC'] },
      { tabId: 'stocks', name: 'Stocks', tokens: ['AAPL'] },
    ]);
  });

  it('keeps primary tabs before perps category tabs for validation', () => {
    const tabs = buildPerpTokenSelectorTabs({
      serverTabs: [
        { tabId: 'crypto', name: 'Crypto', tokens: ['BTC'] },
        { tabId: 'stocks', name: 'Stocks', tokens: ['AAPL'] },
      ],
      fixedTabNames,
    });

    expect(tabs).toEqual([
      { tabId: 'favorites', name: 'Favorites', tokens: [] },
      { tabId: 'perps', name: 'PERPS', tokens: [] },
      { tabId: 'spot', name: 'Spot', tokens: [] },
      { tabId: 'perps', name: 'All', tokens: [] },
      { tabId: 'crypto', name: 'Crypto', tokens: ['BTC'] },
      { tabId: 'stocks', name: 'Stocks', tokens: ['AAPL'] },
    ]);
  });

  it('uses primary and perps all tabs when server config is missing', () => {
    expect(
      buildPerpTokenSelectorTabs({
        serverTabs: [],
        fixedTabNames,
      }),
    ).toEqual([
      { tabId: 'favorites', name: 'Favorites', tokens: [] },
      { tabId: 'perps', name: 'PERPS', tokens: [] },
      { tabId: 'spot', name: 'Spot', tokens: [] },
      { tabId: 'perps', name: 'All', tokens: [] },
    ]);
  });

  it('sanitizes invalid and duplicate server tabs', () => {
    expect(
      buildPerpTokenSelectorTabs({
        serverTabs: [
          {
            tabId: ' perps ',
            name: ' Perps ',
            tokens: undefined as unknown as string[],
          },
          { tabId: 'PERPS', name: 'Duplicate', tokens: [] },
          { tabId: '', name: 'Missing id', tokens: [] },
          { tabId: 'empty-name', name: ' ', tokens: [] },
        ],
        fixedTabNames,
      }),
    ).toEqual([
      { tabId: 'favorites', name: 'Favorites', tokens: [] },
      { tabId: 'perps', name: 'PERPS', tokens: [] },
      { tabId: 'spot', name: 'Spot', tokens: [] },
      { tabId: 'perps', name: 'All', tokens: [] },
    ]);
  });

  it('deduplicates server tabs that collide with fixed semantic tab ids', () => {
    expect(
      buildPerpTokenSelectorTabs({
        serverTabs: [
          { tabId: ' Favorites ', name: 'Favs', tokens: [] },
          { tabId: ' ALL ', name: 'Contracts', tokens: ['BTC'] },
          { tabId: ' Spot ', name: 'Spot Pairs', tokens: [] },
          { tabId: ' Metals ', name: 'Metals', tokens: ['GOLD'] },
        ],
        fixedTabNames,
      }),
    ).toEqual([
      { tabId: 'favorites', name: 'Favorites', tokens: [] },
      { tabId: 'perps', name: 'PERPS', tokens: [] },
      { tabId: 'spot', name: 'Spot', tokens: [] },
      { tabId: 'perps', name: 'All', tokens: [] },
      { tabId: 'Metals', name: 'Metals', tokens: ['GOLD'] },
    ]);
  });

  it('recognizes semantic tab ids independent of server-provided labels', () => {
    expect(isPerpTokenSelectorAllTab(' ALL ')).toBe(true);
    expect(isPerpTokenSelectorPerpsTab('perps')).toBe(true);
    expect(isPerpTokenSelectorFavoritesTab('favorites')).toBe(true);
    expect(isPerpTokenSelectorSpotTab('spot')).toBe(true);
    expect(isPerpTokenSelectorPrimaryTab('favorites')).toBe(true);
    expect(isPerpTokenSelectorPrimaryTab('all')).toBe(false);
  });

  it('maps legacy and category tab ids back to a primary tab', () => {
    expect(getPerpTokenSelectorPrimaryTabId('favorites')).toBe('favorites');
    expect(getPerpTokenSelectorPrimaryTabId('spot')).toBe('spot');
    expect(getPerpTokenSelectorPrimaryTabId('all')).toBe('perps');
    expect(getPerpTokenSelectorPrimaryTabId('perps')).toBe('perps');
    expect(getPerpTokenSelectorPrimaryTabId('AI')).toBe('perps');
  });

  it('prefers the configured perps tab as invalid-tab fallback', () => {
    expect(
      getPerpTokenSelectorFallbackTabId([
        { tabId: 'favorites', name: 'Favs', tokens: [] },
        { tabId: 'perps', name: 'Perps', tokens: [] },
      ]),
    ).toBe('perps');
    expect(
      getPerpTokenSelectorFallbackTabId([
        { tabId: 'stocks', name: 'Stocks', tokens: ['AAPL'] },
      ]),
    ).toBe('stocks');
  });

  it('keeps missing mixed-column values at the bottom while sorting', () => {
    expect(
      comparePerpTokenSelectorSortValues({
        a: undefined,
        b: 10,
        direction: 'desc',
      }),
    ).toBe(1);
    expect(
      comparePerpTokenSelectorSortValues({
        a: undefined,
        b: 10,
        direction: 'asc',
      }),
    ).toBe(1);
    expect(
      comparePerpTokenSelectorSortValues({
        a: 10,
        b: undefined,
        direction: 'desc',
      }),
    ).toBe(-1);
    expect(
      comparePerpTokenSelectorSortValues({
        a: 5,
        b: 10,
        direction: 'desc',
      }),
    ).toBeGreaterThan(0);
    expect(
      comparePerpTokenSelectorSortValues({
        a: 'BTC',
        b: 'ETH',
        direction: 'asc',
      }),
    ).toBeLessThan(0);
  });

  it('precomputes mixed sort values once per item', () => {
    const items = [
      { id: 'perp-btc', value: undefined },
      { id: 'spot-btc', value: 20 },
      { id: 'spot-eth', value: 10 },
    ];
    const getValue = jest.fn((item: (typeof items)[number]) => item.value);

    expect(
      sortPerpTokenSelectorItemsBySortValue({
        items,
        getValue,
        direction: 'desc',
      }).map((item) => item.id),
    ).toEqual(['spot-btc', 'spot-eth', 'perp-btc']);
    expect(getValue).toHaveBeenCalledTimes(items.length);
  });

  it('keeps dynamic tab items in server token order with stable fallback', () => {
    const items = [
      { id: 'btc', name: 'BTC' },
      { id: 'eth', name: 'ETH' },
      { id: 'sol', name: 'SOL' },
      { id: 'unknown', name: undefined },
    ];

    expect(
      sortPerpTokenSelectorItemsByServerOrder({
        items,
        tokenOrder: ['SOL', 'BTC', 'ETH', 'BTC'],
        getTokenName: (item) => item.name,
      }).map((item) => item.id),
    ).toEqual(['sol', 'btc', 'eth', 'unknown']);
  });

  it('keeps dynamic tab items in server token order instead of sorted-list order', () => {
    const volumeSortedItems = [
      { tokenName: 'BTC', volume24h: 100 },
      { tokenName: 'ETH', volume24h: 80 },
      { tokenName: 'MU', volume24h: 60 },
      { tokenName: 'SOL', volume24h: 40 },
    ];

    expect(
      getPerpTokenSelectorDynamicTabItems({
        items: volumeSortedItems,
        tokens: ['SOL', 'BTC', 'MU'],
      }).map((item) => item.tokenName),
    ).toEqual(['SOL', 'BTC', 'MU']);
  });

  it('uses sorted-list order for dynamic tab items after a header sort', () => {
    const volumeSortedItems = [
      { tokenName: 'BTC', volume24h: 100 },
      { tokenName: 'ETH', volume24h: 80 },
      { tokenName: 'MU', volume24h: 60 },
      { tokenName: 'SOL', volume24h: 40 },
    ];

    expect(
      getPerpTokenSelectorDynamicTabItems({
        items: volumeSortedItems,
        tokens: ['SOL', 'BTC', 'MU'],
        useSortedItemsOrder: true,
      }).map((item) => item.tokenName),
    ).toEqual(['BTC', 'MU', 'SOL']);
  });

  it('keeps dynamic tab user sort aligned with the sorted volume order', () => {
    const defaultHotTokens = ['ZRO', 'AAVE', 'JUP', 'BTC'];
    const volumeDescItems = [
      { tokenName: 'BTC', volume24h: 3_690_000_000 },
      { tokenName: 'AAVE', volume24h: 52_520_000 },
      { tokenName: 'JUP', volume24h: 11_850_000 },
      { tokenName: 'ZRO', volume24h: 5_950_000 },
    ];

    const result = getPerpTokenSelectorDynamicTabItems({
      items: volumeDescItems,
      tokens: defaultHotTokens,
      useSortedItemsOrder: true,
    });

    expect(result.map((item) => item.tokenName)).toEqual([
      'BTC',
      'AAVE',
      'JUP',
      'ZRO',
    ]);
    expect(result.map((item) => item.volume24h)).toEqual(
      result.map((item) => item.volume24h).toSorted((a, b) => b - a),
    );
  });

  it('does not treat the default dynamic tab order as an active header sort', () => {
    expect(
      isPerpTokenSelectorSortFieldActive({
        activeTab: 'hot',
        field: 'volume24h',
        sortField: 'volume24h',
        sortSource: 'default',
      }),
    ).toBe(false);
    expect(
      isPerpTokenSelectorSortFieldActive({
        activeTab: 'hot',
        field: 'volume24h',
        sortField: 'volume24h',
        sortSource: 'user',
      }),
    ).toBe(false);
    expect(
      isPerpTokenSelectorSortFieldActive({
        activeTab: 'hot',
        field: 'volume24h',
        sortField: 'volume24h',
        sortSource: 'user',
        sortSourceTab: 'hot',
      }),
    ).toBe(true);
    expect(
      isPerpTokenSelectorSortFieldActive({
        activeTab: 'perps',
        field: 'volume24h',
        sortField: 'volume24h',
        sortSource: 'default',
      }),
    ).toBe(true);
  });

  it('scopes dynamic tab user sorting to the clicked tab', () => {
    expect(
      isPerpTokenSelectorDynamicTabUserSort({
        activeTab: 'hot',
        sortSource: 'user',
        sortSourceTab: 'perps',
      }),
    ).toBe(false);
    expect(
      isPerpTokenSelectorDynamicTabUserSort({
        activeTab: 'hot',
        sortSource: 'user',
      }),
    ).toBe(false);
    expect(
      isPerpTokenSelectorDynamicTabUserSort({
        activeTab: 'hot',
        sortSource: 'user',
        sortSourceTab: 'hot',
      }),
    ).toBe(true);
    expect(
      isPerpTokenSelectorDynamicTabUserSort({
        activeTab: 'perps',
        sortSource: 'user',
        sortSourceTab: 'perps',
      }),
    ).toBe(false);
  });

  it('resets user sort source when switching tabs', () => {
    expect(
      getNextPerpTokenSelectorActiveTabConfig({
        prev: {
          field: 'volume24h',
          direction: 'asc',
          activeTab: 'perps',
          sortSource: 'user',
          sortSourceTab: 'perps',
        },
        tab: 'hot',
      }),
    ).toEqual({
      field: 'volume24h',
      direction: 'asc',
      activeTab: 'hot',
      sortSource: 'default',
      sortSourceTab: undefined,
    });
  });

  it('starts user sorting from descending on a dynamic tab default order', () => {
    expect(
      getNextPerpTokenSelectorSortConfig({
        prev: {
          field: 'volume24h',
          direction: 'desc',
          activeTab: 'hot',
          sortSource: 'default',
        },
        field: 'volume24h',
      }),
    ).toEqual({
      field: 'volume24h',
      direction: 'desc',
      activeTab: 'hot',
      sortSource: 'user',
      sortSourceTab: 'hot',
    });
  });

  it('toggles and resets user sorting on dynamic tabs', () => {
    expect(
      getNextPerpTokenSelectorSortConfig({
        prev: {
          field: 'volume24h',
          direction: 'desc',
          activeTab: 'hot',
          sortSource: 'user',
          sortSourceTab: 'hot',
        },
        field: 'volume24h',
      }),
    ).toEqual({
      field: 'volume24h',
      direction: 'asc',
      activeTab: 'hot',
      sortSource: 'user',
      sortSourceTab: 'hot',
    });
    expect(
      getNextPerpTokenSelectorSortConfig({
        prev: {
          field: 'volume24h',
          direction: 'asc',
          activeTab: 'hot',
          sortSource: 'user',
          sortSourceTab: 'hot',
        },
        field: 'volume24h',
      }),
    ).toEqual({
      field: 'volume24h',
      direction: 'desc',
      activeTab: 'hot',
      sortSource: 'default',
      sortSourceTab: undefined,
    });
  });

  it('refreshes the sort snapshot when only sort source changes', () => {
    expect(
      shouldRefreshPerpTokenSelectorSortSnapshot({
        lastSort: {
          field: 'volume24h',
          direction: 'desc',
          sortSource: 'default',
        },
        field: 'volume24h',
        direction: 'desc',
        sortSource: 'user',
        sortSourceTab: 'hot',
        snapshotEmpty: false,
      }),
    ).toBe(true);
  });

  it('always uses snapshot asset ctxs for the full perp list sort', () => {
    const snapshotAssetCtxsByDex = [[{ volume: '8' }]];

    expect(
      getPerpTokenSelectorSortAssetCtxsByDex({
        snapshotAssetCtxsByDex,
      }),
    ).toBe(snapshotAssetCtxsByDex);
  });

  it('only refreshes sort snapshots on sort changes or first data arrival', () => {
    expect(
      shouldRefreshPerpTokenSelectorSortSnapshot({
        lastSort: { field: 'change24hPercent', direction: 'desc' },
        field: 'change24hPercent',
        direction: 'desc',
        snapshotEmpty: false,
      }),
    ).toBe(false);

    expect(
      shouldRefreshPerpTokenSelectorSortSnapshot({
        lastSort: { field: 'change24hPercent', direction: 'desc' },
        field: 'change24hPercent',
        direction: 'asc',
        snapshotEmpty: false,
      }),
    ).toBe(true);

    expect(
      shouldRefreshPerpTokenSelectorSortSnapshot({
        lastSort: { field: 'change24hPercent', direction: 'desc' },
        field: 'change24hPercent',
        direction: 'desc',
        snapshotEmpty: true,
      }),
    ).toBe(true);
  });

  it('keeps all-tab instruments visible when sorting unsupported mixed columns', () => {
    const items = [
      { id: 'perp-btc', type: 'perp', fundingRate: 0.01 },
      { id: 'spot-eth', type: 'spot', marketCap: 300 },
      { id: 'spot-sol', type: 'spot', marketCap: 100 },
      { id: 'perp-doge', type: 'perp', fundingRate: 0.02 },
    ];

    expect(
      sortPerpTokenSelectorItemsBySortValue({
        items,
        getValue: (item) =>
          item.type === 'spot' ? undefined : item.fundingRate,
        direction: 'desc',
      }).map((item) => item.id),
    ).toEqual(['perp-doge', 'perp-btc', 'spot-eth', 'spot-sol']);

    expect(
      sortPerpTokenSelectorItemsBySortValue({
        items,
        getValue: (item) => (item.type === 'perp' ? undefined : item.marketCap),
        direction: 'desc',
      }).map((item) => item.id),
    ).toEqual(['spot-eth', 'spot-sol', 'perp-btc', 'perp-doge']);
  });
});
