import type { IMarketDetailChartDisplayMode } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

// Fullscreen only exists on the Pro chart. A persisted Simple choice comes
// back once that overlay closes.
export function shouldShowMobileSimpleChart({
  mode,
  isChartFullscreen,
}: {
  mode: IMarketDetailChartDisplayMode;
  isChartFullscreen: boolean;
}): boolean {
  return mode === 'simple' && !isChartFullscreen;
}

// TradingView needs the token's chart params and cannot plot a stock's share
// price, so the native chart stands in until it can draw the page.
export function shouldShowMobileNativeChart({
  isNativeChartPreferred,
  hasTradingViewParams,
  isSharePrice,
}: {
  isNativeChartPreferred: boolean;
  hasTradingViewParams: boolean;
  isSharePrice: boolean;
}): boolean {
  return isNativeChartPreferred || isSharePrice || !hasTradingViewParams;
}

// The native chart fullscreen lays the page out in landscape underneath the
// chart while the window rotates in and out. While the page keeps its portrait
// layout through that, a layout wider than the window's shortest edge is one of
// those; measuring it would bring the page, and the chart sized from it, back
// at landscape height.
export function isTransientLandscapePageLayout({
  keepsPortraitLayout,
  layoutWidth,
  windowHeight,
  windowWidth,
}: {
  keepsPortraitLayout: boolean;
  layoutWidth: number;
  windowHeight: number;
  windowWidth: number;
}): boolean {
  return (
    keepsPortraitLayout &&
    Math.round(layoutWidth) > Math.round(Math.min(windowWidth, windowHeight))
  );
}
