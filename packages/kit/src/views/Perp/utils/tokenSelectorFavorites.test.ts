import { getTokenSelectorFavoriteItems } from './tokenSelectorFavorites';

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
});
