import { getMarketMobileSecondaryHeaderHeight } from './mobileLayoutUtils';

describe('getMarketMobileSecondaryHeaderHeight', () => {
  it('collapses the Android secondary header for an empty watchlist', () => {
    expect(
      getMarketMobileSecondaryHeaderHeight({
        isNativeAndroid: true,
        isWatchlistEmpty: true,
        showWatchlistSubHeader: true,
      }),
    ).toBe(0);
  });

  it('keeps the secondary header for a populated Android watchlist', () => {
    expect(
      getMarketMobileSecondaryHeaderHeight({
        isNativeAndroid: true,
        isWatchlistEmpty: false,
        showWatchlistSubHeader: true,
      }),
    ).toBe(74);
  });

  it('keeps the secondary header outside Android', () => {
    expect(
      getMarketMobileSecondaryHeaderHeight({
        isNativeAndroid: false,
        isWatchlistEmpty: true,
        showWatchlistSubHeader: true,
      }),
    ).toBe(74);
  });
});
