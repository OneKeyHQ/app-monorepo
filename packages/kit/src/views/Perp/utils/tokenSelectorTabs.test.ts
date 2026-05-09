import {
  buildPerpTokenSelectorCategoryTabs,
  buildPerpTokenSelectorTabs,
  buildPrimaryTabs,
  comparePerpTokenSelectorSortValues,
  getPerpTokenSelectorFallbackTabId,
  getPerpTokenSelectorPrimaryTabId,
  isPerpTokenSelectorAllTab,
  isPerpTokenSelectorFavoritesTab,
  isPerpTokenSelectorPerpsTab,
  isPerpTokenSelectorPrimaryTab,
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
});
