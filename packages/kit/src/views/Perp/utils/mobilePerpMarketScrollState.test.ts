import {
  getMobilePerpMarketPageScrollState,
  getMobilePerpMarketPagerHeight,
} from './mobilePerpMarketScrollState';

describe('getMobilePerpMarketPagerHeight', () => {
  const pageHeights = {
    orderbook: 1200,
    info: 900,
    funding: 760,
  };

  it('uses the active page content height instead of the tallest page', () => {
    expect(
      getMobilePerpMarketPagerHeight({
        activeTab: 'funding',
        pageHeights,
        useIntrinsicHeight: true,
      }),
    ).toBe(760);
  });

  it('lets fixed-height layouts keep control of the pager height', () => {
    expect(
      getMobilePerpMarketPagerHeight({
        activeTab: 'funding',
        pageHeights,
        useIntrinsicHeight: false,
      }),
    ).toBeUndefined();
  });
});

describe('getMobilePerpMarketPageScrollState', () => {
  it('keeps the page scroll container mounted while disabling native scroll during TradingView overlays', () => {
    expect(
      getMobilePerpMarketPageScrollState({
        isInteractionOverlayOpen: true,
        isNativeIOS: false,
      }),
    ).toEqual({
      pageScrollContainerEnabled: true,
      pageNativeScrollEnabled: false,
    });
  });

  it('keeps page scrolling enabled when no TradingView overlay is open', () => {
    expect(
      getMobilePerpMarketPageScrollState({
        isInteractionOverlayOpen: false,
        isNativeIOS: false,
      }),
    ).toEqual({
      pageScrollContainerEnabled: true,
      pageNativeScrollEnabled: true,
    });
  });

  it('keeps iOS on its Tabs-internal scrolling', () => {
    expect(
      getMobilePerpMarketPageScrollState({
        isInteractionOverlayOpen: true,
        isNativeIOS: true,
      }),
    ).toEqual({
      pageScrollContainerEnabled: false,
      pageNativeScrollEnabled: true,
    });
  });

  it('lets mobile web scroll the chart tab and pauses it during overlays', () => {
    expect(
      getMobilePerpMarketPageScrollState({
        isInteractionOverlayOpen: false,
        isNativeIOS: false,
      }),
    ).toEqual({
      pageScrollContainerEnabled: true,
      pageNativeScrollEnabled: true,
    });

    expect(
      getMobilePerpMarketPageScrollState({
        isInteractionOverlayOpen: true,
        isNativeIOS: false,
      }),
    ).toEqual({
      pageScrollContainerEnabled: true,
      pageNativeScrollEnabled: false,
    });
  });
});
