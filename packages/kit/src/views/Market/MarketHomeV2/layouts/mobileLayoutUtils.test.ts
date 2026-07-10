import {
  getMarketEmptyWatchlistContainerProps,
  getMarketMobileSecondaryHeaderHeight,
  getMarketWebSecondaryHeaderHeight,
} from './mobileLayoutUtils';

describe('getMarketEmptyWatchlistContainerProps', () => {
  it('uses normal-flow padding on Android', () => {
    expect(
      getMarketEmptyWatchlistContainerProps({
        isNativeAndroid: true,
        isWeb: false,
      }),
    ).toEqual({ paddingTop: '$8' });
  });

  it('uses the recommendation list intrinsic spacing on mobile Web', () => {
    expect(
      getMarketEmptyWatchlistContainerProps({
        isNativeAndroid: false,
        isWeb: true,
      }),
    ).toEqual({});
  });

  it('preserves the existing offset on iOS', () => {
    expect(
      getMarketEmptyWatchlistContainerProps({
        isNativeAndroid: false,
        isWeb: false,
      }),
    ).toEqual({ y: -25 });
  });
});

describe('getMarketMobileSecondaryHeaderHeight', () => {
  it('keeps one stable height while the pager changes tabs', () => {
    expect(getMarketMobileSecondaryHeaderHeight()).toBe(74);
  });
});

describe('getMarketWebSecondaryHeaderHeight', () => {
  it('removes the unused secondary header for an empty watchlist', () => {
    expect(
      getMarketWebSecondaryHeaderHeight({
        isWatchlistEmpty: true,
        showWatchlistSubHeader: true,
        showSpotSubHeader: false,
        hasSpotSecondaryControls: false,
      }),
    ).toBe(0);
  });

  it('uses only the column header height for stock data without controls', () => {
    expect(
      getMarketWebSecondaryHeaderHeight({
        isWatchlistEmpty: false,
        showWatchlistSubHeader: false,
        showSpotSubHeader: true,
        hasSpotSecondaryControls: false,
      }),
    ).toBe(32);
  });

  it('keeps the full height when spot controls are visible', () => {
    expect(
      getMarketWebSecondaryHeaderHeight({
        isWatchlistEmpty: false,
        showWatchlistSubHeader: false,
        showSpotSubHeader: true,
        hasSpotSecondaryControls: true,
      }),
    ).toBe(74);
  });

  it('keeps the full height for non-spot tabs with secondary controls', () => {
    expect(
      getMarketWebSecondaryHeaderHeight({
        isWatchlistEmpty: false,
        showWatchlistSubHeader: true,
        showSpotSubHeader: false,
        hasSpotSecondaryControls: false,
      }),
    ).toBe(74);
  });
});
