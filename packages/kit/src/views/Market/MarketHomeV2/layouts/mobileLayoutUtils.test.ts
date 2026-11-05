import {
  getMarketEmptyWatchlistContainerProps,
  getMarketMobileBannerHeaderHeight,
  getMarketMobileSecondaryHeaderHeight,
  getMarketMobileSecondaryLayoutHeight,
  getMarketNativeCompactListStyle,
  getMarketRecommendContainerPaddingTop,
  getMarketWebSecondaryHeaderHeight,
  resolveMarketBannerHeaderDecision,
  resolveMarketBannerHeaderHeight,
  resolveMarketProgressDisplayKey,
} from './mobileLayoutUtils';

describe('getMarketMobileBannerHeaderHeight', () => {
  it('uses the legacy height when every banner omits token previews', () => {
    expect(getMarketMobileBannerHeaderHeight([{}, {}])).toBe(150);
  });

  it('uses the modern height when every banner renders token previews', () => {
    expect(
      getMarketMobileBannerHeaderHeight([{ tokens: [] }, { tokens: [] }]),
    ).toBe(212);
  });
});

describe('resolveMarketBannerHeaderHeight', () => {
  it('updates a legacy height when a successful refresh becomes modern', () => {
    expect(
      resolveMarketBannerHeaderHeight({
        current: { scope: 'en-US:false', height: 150 },
        scope: 'en-US:false',
        isFetched: true,
        bannerList: [{ tokens: [] }],
      }),
    ).toEqual({ scope: 'en-US:false', height: 212 });
  });

  it('preserves the occupied height when a refresh returns no banners', () => {
    const current = { scope: 'en-US:false', height: 212 };
    expect(
      resolveMarketBannerHeaderHeight({
        current,
        scope: 'en-US:false',
        isFetched: true,
        bannerList: [],
      }),
    ).toBe(current);
  });
});

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
    ).toEqual({ y: -72 });
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
    ).toEqual({ y: -72 });
  });
});

describe('getMarketNativeCompactListStyle', () => {
  it('visually reclaims the unused space without overriding list padding', () => {
    expect(getMarketNativeCompactListStyle(true)).toEqual({
      transform: [{ translateY: -44 }],
    });
  });

  it('does not transform tabs that render secondary controls', () => {
    expect(getMarketNativeCompactListStyle(false)).toEqual({});
  });
});

describe('getMarketRecommendContainerPaddingTop', () => {
  it('does not add top padding on native', () => {
    expect(getMarketRecommendContainerPaddingTop({ isNative: true })).toBe(0);
  });

  it('uses a fixed 24px top gap outside native', () => {
    expect(getMarketRecommendContainerPaddingTop({ isNative: false })).toBe(24);
  });
});

describe('getMarketMobileSecondaryHeaderHeight', () => {
  it('keeps one stable height while the pager changes tabs', () => {
    expect(getMarketMobileSecondaryHeaderHeight()).toBe(88);
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

  it('leaves a 12px lead above the column header for tabs without controls', () => {
    expect(
      getMarketWebSecondaryHeaderHeight({
        isWatchlistEmpty: false,
        showWatchlistSubHeader: false,
        showSpotSubHeader: true,
        hasSpotSecondaryControls: false,
      }),
    ).toBe(44);
  });

  it('keeps the full height when spot controls are visible', () => {
    expect(
      getMarketWebSecondaryHeaderHeight({
        isWatchlistEmpty: false,
        showWatchlistSubHeader: false,
        showSpotSubHeader: true,
        hasSpotSecondaryControls: true,
      }),
    ).toBe(88);
  });

  it('keeps the full height for non-spot tabs with secondary controls', () => {
    expect(
      getMarketWebSecondaryHeaderHeight({
        isWatchlistEmpty: false,
        showWatchlistSubHeader: true,
        showSpotSubHeader: false,
        hasSpotSecondaryControls: false,
      }),
    ).toBe(88);
  });
});

describe('Market secondary display ownership', () => {
  it.each([
    [false, false, false, 88],
    [true, false, false, 56],
    [false, false, true, 44],
    [true, false, true, 0],
    [false, true, false, 0],
    [true, true, false, 0],
  ])(
    'preserves existing secondary layout branches',
    (wideColumns, isEmptyWatchlist, isCompactSpot, expected) => {
      expect(
        getMarketMobileSecondaryLayoutHeight({
          wideColumns,
          isEmptyWatchlist,
          isCompactSpot,
        }),
      ).toBe(expected);
    },
  );

  const pages = [
    { key: 'stocks', height: 88 },
    { key: 'robinhood', height: 88 },
    { key: 'compact', height: 44 },
  ];
  const resolve = (
    position: number,
    offset: number,
    enabled = true,
    sourceKey: string | undefined = 'stocks',
  ) =>
    resolveMarketProgressDisplayKey({
      pages,
      position,
      offset,
      enabled,
      sourceKey,
    });
  it('uses the nearest equal-height page and follows a return before UP', () => {
    expect(resolve(0, 0.6)).toBe('robinhood');
    expect(resolve(0, 0.4)).toBe('stocks');
    expect(resolve(1, 0.6)).toBeUndefined();
  });
  it('rejects late progress after a command or idle and invalid source identities', () => {
    expect(resolve(0, 0.9, false)).toBeUndefined();
    expect(resolve(0, 0.9, true, 'removed')).toBeUndefined();
  });
  it('rejects invalid progress and clamps valid endpoints', () => {
    expect(resolve(NaN, 0.5)).toBeUndefined();
    expect(resolve(0, Infinity)).toBeUndefined();
    expect(resolve(Number.MAX_VALUE, Number.MAX_VALUE)).toBeUndefined();
    expect(resolve(-1, 0)).toBe('stocks');
    expect(resolve(9, 0)).toBeUndefined();
  });
  it('resolves reordered pages by stable key and rechecks current heights', () => {
    expect(
      resolveMarketProgressDisplayKey({
        pages: [pages[1], pages[0]],
        sourceKey: 'stocks',
        position: 0,
        offset: 0,
        enabled: true,
      }),
    ).toBe('robinhood');
    expect(
      resolveMarketProgressDisplayKey({
        pages: [{ key: 'stocks', height: 56 }, pages[1]],
        sourceKey: 'stocks',
        position: 0,
        offset: 0.8,
        enabled: true,
      }),
    ).toBeUndefined();
  });
});
