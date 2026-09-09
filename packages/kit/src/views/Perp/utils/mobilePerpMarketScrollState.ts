import type { IMobilePerpMarketTab } from '@onekeyhq/shared/src/routes/perp';

export type { IMobilePerpMarketTab };

export function getMobilePerpMarketPagerHeight({
  activeTab,
  pageHeights,
  useIntrinsicHeight,
}: {
  activeTab: IMobilePerpMarketTab;
  pageHeights: Partial<Record<IMobilePerpMarketTab, number>>;
  useIntrinsicHeight: boolean;
}) {
  if (!useIntrinsicHeight) {
    return undefined;
  }

  const activePageHeight = pageHeights[activeTab];
  return activePageHeight && activePageHeight > 0
    ? activePageHeight
    : undefined;
}

export function getMobilePerpMarketPageScrollState({
  isInteractionOverlayOpen,
  isNativeIOS,
}: {
  isInteractionOverlayOpen: boolean;
  isNativeIOS: boolean;
}) {
  return {
    // Web and Android scroll at the page level; iOS scrolls inside its Tabs
    // container. Web used to enable this only on the info tab, which left the
    // chart+orderbook column taller than the viewport with no scroll path —
    // the chart X-axis was clipped and the order book unreachable.
    pageScrollContainerEnabled: !isNativeIOS,
    // Pause page scrolling while a TradingView interaction overlay is open so
    // chart gestures do not fight the page (iOS keeps its own Tabs gating).
    pageNativeScrollEnabled: isNativeIOS || !isInteractionOverlayOpen,
  };
}
