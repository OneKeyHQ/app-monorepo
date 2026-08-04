import { getMobilePerpMarketPageScrollState } from './mobilePerpMarketScrollState';

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
