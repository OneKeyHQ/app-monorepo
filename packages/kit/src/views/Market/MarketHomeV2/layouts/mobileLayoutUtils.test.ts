import {
  getMarketEmptyWatchlistContainerProps,
  getMarketMobileSecondaryHeaderHeight,
} from './mobileLayoutUtils';

describe('getMarketEmptyWatchlistContainerProps', () => {
  it('uses normal-flow padding on Android', () => {
    expect(
      getMarketEmptyWatchlistContainerProps({ isNativeAndroid: true }),
    ).toEqual({ paddingTop: '$8' });
  });

  it('preserves the negative offset outside Android', () => {
    expect(
      getMarketEmptyWatchlistContainerProps({ isNativeAndroid: false }),
    ).toEqual({ y: -25 });
  });
});

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
