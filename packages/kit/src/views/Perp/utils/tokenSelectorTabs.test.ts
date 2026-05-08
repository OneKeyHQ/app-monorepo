import {
  buildPerpTokenSelectorTabs,
  comparePerpTokenSelectorSortValues,
  getPerpTokenSelectorFallbackTabId,
  isPerpTokenSelectorAllTab,
  isPerpTokenSelectorFavoritesTab,
  isPerpTokenSelectorPerpsTab,
  isPerpTokenSelectorSpotTab,
  sortPerpTokenSelectorItemsBySortValue,
} from './tokenSelectorTabs';

const fixedTabNames = {
  favorites: 'Favorites',
  all: 'All',
  perps: 'PERPS',
  spot: 'Spot',
};

describe('tokenSelectorTabs', () => {
  it('keeps fixed tabs before server-configured category tabs', () => {
    const tabs = buildPerpTokenSelectorTabs({
      serverTabs: [
        { tabId: 'crypto', name: 'Crypto', tokens: ['BTC'] },
        { tabId: 'stocks', name: 'Stocks', tokens: ['AAPL'] },
      ],
      fixedTabNames,
    });

    expect(tabs).toEqual([
      { tabId: 'favorites', name: 'Favorites', tokens: [] },
      { tabId: 'all', name: 'All', tokens: [] },
      { tabId: 'perps', name: 'PERPS', tokens: [] },
      { tabId: 'spot', name: 'Spot', tokens: [] },
      { tabId: 'crypto', name: 'Crypto', tokens: ['BTC'] },
      { tabId: 'stocks', name: 'Stocks', tokens: ['AAPL'] },
    ]);
  });

  it('uses fixed tabs when server config is missing', () => {
    expect(
      buildPerpTokenSelectorTabs({
        serverTabs: [],
        fixedTabNames,
      }),
    ).toEqual([
      { tabId: 'favorites', name: 'Favorites', tokens: [] },
      { tabId: 'all', name: 'All', tokens: [] },
      { tabId: 'perps', name: 'PERPS', tokens: [] },
      { tabId: 'spot', name: 'Spot', tokens: [] },
    ]);
  });

  it('sanitizes invalid and duplicate server tabs', () => {
    expect(
      buildPerpTokenSelectorTabs({
        serverTabs: [
          { tabId: ' perps ', name: ' Perps ', tokens: undefined as never },
          { tabId: 'PERPS', name: 'Duplicate', tokens: [] },
          { tabId: '', name: 'Missing id', tokens: [] },
          { tabId: 'empty-name', name: ' ', tokens: [] },
        ],
        fixedTabNames,
      }),
    ).toEqual([
      { tabId: 'favorites', name: 'Favorites', tokens: [] },
      { tabId: 'all', name: 'All', tokens: [] },
      { tabId: 'perps', name: 'PERPS', tokens: [] },
      { tabId: 'spot', name: 'Spot', tokens: [] },
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
      { tabId: 'all', name: 'All', tokens: [] },
      { tabId: 'perps', name: 'PERPS', tokens: [] },
      { tabId: 'spot', name: 'Spot', tokens: [] },
      { tabId: 'Metals', name: 'Metals', tokens: ['GOLD'] },
    ]);
  });

  it('recognizes semantic tab ids independent of server-provided labels', () => {
    expect(isPerpTokenSelectorAllTab(' ALL ')).toBe(true);
    expect(isPerpTokenSelectorPerpsTab('perps')).toBe(true);
    expect(isPerpTokenSelectorFavoritesTab('favorites')).toBe(true);
    expect(isPerpTokenSelectorSpotTab('spot')).toBe(true);
  });

  it('prefers the configured all/perps tab as invalid-tab fallback', () => {
    expect(
      getPerpTokenSelectorFallbackTabId([
        { tabId: 'favorites', name: 'Favs', tokens: [] },
        { tabId: 'all', name: 'All', tokens: [] },
      ]),
    ).toBe('all');
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
});
