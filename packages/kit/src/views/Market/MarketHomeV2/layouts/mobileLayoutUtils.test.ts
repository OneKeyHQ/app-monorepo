import {
  getMarketEmptyWatchlistContainerProps,
  getMarketMobileSecondaryHeaderHeight,
  getMarketNativeCompactListStyle,
  getMarketRecommendContainerPaddingTop,
  getMarketWebSecondaryHeaderHeight,
  resolveMarketBannerHeaderDecision,
} from './mobileLayoutUtils';

describe('resolveMarketBannerHeaderDecision', () => {
  it('waits for recovery after an initial failure before locking banner height', () => {
    const initial = {
      scope: 'en-US',
      isDecided: false,
      hasBanners: false,
    };
    const failed = resolveMarketBannerHeaderDecision({
      current: initial,
      scope: 'en-US',
      isFetched: false,
      bannerCount: 0,
    });
    expect(failed).toBe(initial);

    const recovered = resolveMarketBannerHeaderDecision({
      current: failed,
      scope: 'en-US',
      isFetched: true,
      bannerCount: 2,
    });
    expect(recovered).toEqual({
      scope: 'en-US',
      isDecided: true,
      hasBanners: true,
    });
    expect(
      resolveMarketBannerHeaderDecision({
        current: recovered,
        scope: 'en-US',
        isFetched: true,
        bannerCount: 0,
      }),
    ).toBe(recovered);
  });

  it('resets the decision for a new scope and locks successful empty data', () => {
    const changed = resolveMarketBannerHeaderDecision({
      current: { scope: 'en-US', isDecided: true, hasBanners: true },
      scope: 'zh-CN',
      isFetched: false,
      bannerCount: 0,
    });
    expect(changed).toEqual({
      scope: 'zh-CN',
      isDecided: false,
      hasBanners: false,
    });
    expect(
      resolveMarketBannerHeaderDecision({
        current: changed,
        scope: 'zh-CN',
        isFetched: true,
        bannerCount: 0,
      }),
    ).toEqual({
      scope: 'zh-CN',
      isDecided: true,
      hasBanners: false,
    });
  });
});

describe('getMarketEmptyWatchlistContainerProps', () => {
  it('keeps a 16px visual gap below the stable header on Android', () => {
    expect(
      getMarketEmptyWatchlistContainerProps({
        isNativeAndroid: true,
        isWeb: false,
      }),
    ).toEqual({ y: -58 });
  });

  it('uses the recommendation list intrinsic spacing on mobile Web', () => {
    expect(
      getMarketEmptyWatchlistContainerProps({
        isNativeAndroid: false,
        isWeb: true,
      }),
    ).toEqual({});
  });

  it('keeps a 16px visual gap below the stable header on iOS', () => {
    expect(
      getMarketEmptyWatchlistContainerProps({
        isNativeAndroid: false,
        isWeb: false,
      }),
    ).toEqual({ y: -58 });
  });
});

describe('getMarketNativeCompactListStyle', () => {
  it('visually reclaims the unused space without overriding list padding', () => {
    expect(getMarketNativeCompactListStyle(true)).toEqual({
      transform: [{ translateY: -42 }],
    });
  });

  it('does not transform tabs that render secondary controls', () => {
    expect(getMarketNativeCompactListStyle(false)).toEqual({});
  });
});

describe('getMarketRecommendContainerPaddingTop', () => {
  it('does not add viewport-based padding on native', () => {
    expect(
      getMarketRecommendContainerPaddingTop({
        isNative: true,
        windowHeight: 874,
      }),
    ).toBe(0);
  });

  it('preserves viewport-based padding outside native', () => {
    expect(
      getMarketRecommendContainerPaddingTop({
        isNative: false,
        windowHeight: 874,
      }),
    ).toBe(37);
  });

  it('keeps a minimum top gap on short windows outside native', () => {
    expect(
      getMarketRecommendContainerPaddingTop({
        isNative: false,
        windowHeight: 800,
      }),
    ).toBe(16);
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
