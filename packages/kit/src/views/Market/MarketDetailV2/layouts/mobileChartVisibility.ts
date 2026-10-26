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
