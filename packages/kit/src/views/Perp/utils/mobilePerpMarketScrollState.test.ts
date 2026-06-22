import { getMobilePerpMarketPageScrollState } from './mobilePerpMarketScrollState';

describe('getMobilePerpMarketPageScrollState', () => {
  it('keeps the Android page scroll container mounted while disabling native scroll during TradingView overlays', () => {
    expect(
      getMobilePerpMarketPageScrollState({
        activeTab: 'orderbook',
        isInteractionOverlayOpen: true,
        isNativeAndroid: true,
        isNativeIOS: false,
      }),
    ).toEqual({
      pageScrollContainerEnabled: true,
      pageNativeScrollEnabled: false,
    });
  });

  it('keeps Android page scrolling enabled when no TradingView overlay is open', () => {
    expect(
      getMobilePerpMarketPageScrollState({
        activeTab: 'orderbook',
        isInteractionOverlayOpen: false,
        isNativeAndroid: true,
        isNativeIOS: false,
      }),
    ).toEqual({
      pageScrollContainerEnabled: true,
      pageNativeScrollEnabled: true,
    });
  });

  it('preserves the existing iOS and info-tab container rules', () => {
    expect(
      getMobilePerpMarketPageScrollState({
        activeTab: 'orderbook',
        isInteractionOverlayOpen: true,
        isNativeAndroid: false,
        isNativeIOS: true,
      }),
    ).toEqual({
      pageScrollContainerEnabled: false,
      pageNativeScrollEnabled: true,
    });

    expect(
      getMobilePerpMarketPageScrollState({
        activeTab: 'info',
        isInteractionOverlayOpen: false,
        isNativeAndroid: false,
        isNativeIOS: false,
      }),
    ).toEqual({
      pageScrollContainerEnabled: true,
      pageNativeScrollEnabled: true,
    });
  });
});
