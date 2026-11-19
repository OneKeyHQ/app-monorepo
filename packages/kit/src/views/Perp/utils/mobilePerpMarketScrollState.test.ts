import { getTradingViewNativeSubIndicatorPaneStackLayout } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/utils/subIndicatorRender/layout';

import {
  getMobilePerpMarketChartHeight,
  getMobilePerpMarketPageScrollState,
  getMobilePerpMarketPagerHeight,
} from './mobilePerpMarketScrollState';

describe('getMobilePerpMarketChartHeight', () => {
  it('keeps the native main chart height when adding and removing sub-indicators', () => {
    const layouts = [0, 1, 2, 1, 0].map((paneCount) =>
      getTradingViewNativeSubIndicatorPaneStackLayout({
        height: getMobilePerpMarketChartHeight({
          isNativeChart: true,
          isNative: true,
          subIndicatorCount: paneCount,
        }),
        paneCount,
      }),
    );

    expect(layouts.map(({ top }) => top)).toEqual([476, 476, 476, 476, 476]);
    expect(layouts.map(({ bottom }) => bottom)).toEqual([
      476, 532, 588, 532, 476,
    ]);
  });

  it.each([
    { isNativeChart: false, isNative: true },
    { isNativeChart: true, isNative: false },
  ])(
    'keeps the existing height for TradingView and web charts: %j',
    (platform) => {
      expect(
        getMobilePerpMarketChartHeight({ ...platform, subIndicatorCount: 2 }),
      ).toBe(500);
    },
  );
});

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
