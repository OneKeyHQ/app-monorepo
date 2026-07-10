import {
  getMarketEmptyWatchlistContainerProps,
  getMarketMobileSecondaryHeaderHeight,
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

  it('uses normal-flow padding on mobile Web', () => {
    expect(
      getMarketEmptyWatchlistContainerProps({
        isNativeAndroid: false,
        isWeb: true,
      }),
    ).toEqual({ paddingTop: '$8' });
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
