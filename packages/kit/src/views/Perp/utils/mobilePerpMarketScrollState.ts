export type IMobilePerpMarketTab = 'orderbook' | 'info';

export function getMobilePerpMarketPageScrollState({
  activeTab,
  isInteractionOverlayOpen,
  isNativeAndroid,
  isNativeIOS,
}: {
  activeTab: IMobilePerpMarketTab;
  isInteractionOverlayOpen: boolean;
  isNativeAndroid: boolean;
  isNativeIOS: boolean;
}) {
  return {
    pageScrollContainerEnabled:
      isNativeAndroid || (!isNativeIOS && activeTab === 'info'),
    pageNativeScrollEnabled: !isNativeAndroid || !isInteractionOverlayOpen,
  };
}
