import {
  dedupeTokenSelectorFavoriteCoins,
  dedupeTokenSelectorFavoritesOrder,
  getTokenSelectorFavoriteItems,
  reconcileTokenSelectorFavoritesOrder,
  sortTokenSelectorFavoriteItems,
  toggleTokenSelectorFavoriteCoin,
  updateTokenSelectorFavoriteCoins,
} from './tokenSelectorFavorites';

describe('tokenSelectorFavorites', () => {
  it('keeps spot favorites in the favorites selector list', () => {
    const perpItems = [
      { dexIndex: 0, assetId: 0, tokenName: 'BTC' },
      { dexIndex: 0, assetId: 1, tokenName: 'ETH' },
    ];
    const spotItems = [
      { dexIndex: -1, assetId: 0, tokenName: 'BTC' },
      { dexIndex: -1, assetId: 1, tokenName: 'ETH' },
    ];

    expect(
      getTokenSelectorFavoriteItems({
        favoriteItems: [
          { mode: 'perp', coinName: 'ETH', dexIndex: 0, assetId: 1 },
          { mode: 'spot', coinName: '@142', dexIndex: -1, assetId: 0 },
        ],
        favoritesOrder: [
          { mode: 'spot', coinName: '@142' },
          { mode: 'perp', coinName: 'ETH' },
        ],
        perpItems,
        spotItems,
      }),
    ).toEqual([
      { dexIndex: -1, assetId: 0, tokenName: 'BTC' },
      { dexIndex: 0, assetId: 1, tokenName: 'ETH' },
    ]);
  });

  it('does not keep a spot row after the spot favorite is removed', () => {
    expect(
      getTokenSelectorFavoriteItems({
        favoriteItems: [
          { mode: 'perp', coinName: 'BTC', dexIndex: 0, assetId: 0 },
        ],
        favoritesOrder: [
          { mode: 'perp', coinName: 'BTC' },
          { mode: 'spot', coinName: '@142' },
        ],
        perpItems: [{ dexIndex: 0, assetId: 0, tokenName: 'BTC' }],
        spotItems: [{ dexIndex: -1, assetId: 0, tokenName: 'BTC' }],
      }),
    ).toEqual([{ dexIndex: 0, assetId: 0, tokenName: 'BTC' }]);
  });

  it('ignores duplicate favorites order entries', () => {
    expect(
      getTokenSelectorFavoriteItems({
        favoriteItems: [
          { mode: 'spot', coinName: '@234', dexIndex: -1, assetId: 10_234 },
        ],
        favoritesOrder: [
          { mode: 'spot', coinName: '@234' },
          { mode: 'spot', coinName: '@234' },
        ],
        perpItems: [],
        spotItems: [{ dexIndex: -1, assetId: 10_234, tokenName: '@234' }],
      }),
    ).toEqual([{ dexIndex: -1, assetId: 10_234, tokenName: '@234' }]);
  });

  it('ignores duplicate favorite membership entries', () => {
    expect(
      getTokenSelectorFavoriteItems({
        favoriteItems: [
          { mode: 'spot', coinName: '@234', dexIndex: -1, assetId: 10_234 },
          { mode: 'spot', coinName: '@234', dexIndex: -1, assetId: 10_234 },
        ],
        favoritesOrder: [],
        perpItems: [],
        spotItems: [{ dexIndex: -1, assetId: 10_234, tokenName: '@234' }],
      }),
    ).toEqual([{ dexIndex: -1, assetId: 10_234, tokenName: '@234' }]);
  });

  it('sorts mixed spot and perp favorites globally', () => {
    const items = [
      { dexIndex: 0, assetId: 1, tokenName: 'SOL' },
      { dexIndex: -1, assetId: 10_234, tokenName: 'BTC/USDH' },
      { dexIndex: 0, assetId: 2, tokenName: 'HYPE' },
      { dexIndex: -1, assetId: 10_142, tokenName: 'ZEC/USDC' },
    ];
    const changeByTokenName: Record<string, number> = {
      SOL: -1.21,
      'BTC/USDH': 0.46,
      HYPE: 6.2,
      'ZEC/USDC': 0.4,
    };

    expect(
      sortTokenSelectorFavoriteItems({
        items,
        sortField: 'change24hPercent',
        sortDirection: 'desc',
        getSortEntry: (item, order) => ({
          item,
          order,
          name: item.tokenName,
          change24hPercent: changeByTokenName[item.tokenName],
        }),
      }).map((item) => item.tokenName),
    ).toEqual(['HYPE', 'BTC/USDH', 'ZEC/USDC', 'SOL']);
  });

  it('dedupes favorite coin lists while preserving order', () => {
    expect(dedupeTokenSelectorFavoriteCoins(['BTC', 'ETH', 'BTC'])).toEqual([
      'BTC',
      'ETH',
    ]);
  });

  it('dedupes favorite order entries by mode and coin', () => {
    expect(
      dedupeTokenSelectorFavoritesOrder([
        { mode: 'perp', coinName: 'BTC' },
        { mode: 'perp', coinName: 'BTC' },
        { mode: 'spot', coinName: 'BTC' },
      ]),
    ).toEqual([
      { mode: 'perp', coinName: 'BTC' },
      { mode: 'spot', coinName: 'BTC' },
    ]);
  });

  it('removes all duplicate copies when toggling off a favorite', () => {
    expect(
      toggleTokenSelectorFavoriteCoin({
        favorites: ['BTC', 'ETH', 'BTC'],
        coin: 'BTC',
      }),
    ).toEqual({
      favorites: ['ETH'],
      action: 'remove',
    });
  });

  it('normalizes existing duplicates when toggling on a favorite', () => {
    expect(
      toggleTokenSelectorFavoriteCoin({
        favorites: ['ETH', 'ETH'],
        coin: 'BTC',
      }),
    ).toEqual({
      favorites: ['ETH', 'BTC'],
      action: 'add',
    });
  });

  it('removes all duplicate copies with an explicit remove action', () => {
    expect(
      updateTokenSelectorFavoriteCoins({
        favorites: ['HYPE', 'xyz:SILVER', 'xyz:SILVER'],
        coin: 'xyz:SILVER',
        action: 'remove',
      }),
    ).toEqual({
      favorites: ['HYPE'],
      action: 'remove',
    });
  });

  it('reconciles mixed favorite order from current membership', () => {
    expect(
      reconcileTokenSelectorFavoritesOrder({
        sequence: [
          { mode: 'perp', coinName: 'xyz:SILVER' },
          { mode: 'spot', coinName: '@230' },
          { mode: 'perp', coinName: 'stale' },
          { mode: 'spot', coinName: '@230' },
        ],
        perpFavorites: ['HYPE'],
        spotFavorites: ['@230', '@156'],
      }),
    ).toEqual([
      { mode: 'spot', coinName: '@230' },
      { mode: 'perp', coinName: 'HYPE' },
      { mode: 'spot', coinName: '@156' },
    ]);
  });
});
