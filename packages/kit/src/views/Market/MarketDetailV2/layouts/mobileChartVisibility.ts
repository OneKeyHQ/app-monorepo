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
