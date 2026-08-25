import {
  TRADING_VIEW_NATIVE_CHART_TOP_PADDING,
  TRADING_VIEW_NATIVE_SUB_INDICATOR_MIN_MAIN_CHART_HEIGHT,
  TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_HEIGHT,
  TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_PADDING,
  TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT,
} from '../../chartConstants';

import { getTradingViewNativeSubIndicatorValueRange } from './range';

import type {
  ITradingViewNativeSubIndicatorRenderPane,
  ITradingViewNativeSubIndicatorValueRange,
} from './types';

export interface ITradingViewNativeSubIndicatorPaneLayout {
  bottom: number;
  height: number;
  pane: ITradingViewNativeSubIndicatorRenderPane;
  plotBottom: number;
  plotTop: number;
  range: ITradingViewNativeSubIndicatorValueRange | null;
  top: number;
}

export function getTradingViewNativeVisibleSubIndicatorPaneCount(
  panes: readonly ITradingViewNativeSubIndicatorRenderPane[],
) {
  'worklet';

  return panes.reduce((count, pane) => count + (pane.isVisible ? 1 : 0), 0);
}

export function getTradingViewNativeSubIndicatorPaneStackHeight({
  height,
  paneCount,
}: {
  height: number;
  paneCount: number;
}) {
  'worklet';

  const normalizedHeight = Number.isFinite(height) ? Math.max(height, 0) : 0;
  const normalizedPaneCount = Number.isFinite(paneCount)
    ? Math.max(Math.floor(paneCount), 0)
    : 0;
  const timeAxisY = Math.max(
    normalizedHeight - TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT,
    0,
  );
  const minimumMainChartBottom =
    TRADING_VIEW_NATIVE_CHART_TOP_PADDING +
    TRADING_VIEW_NATIVE_SUB_INDICATOR_MIN_MAIN_CHART_HEIGHT;
  const availableHeight = Math.max(timeAxisY - minimumMainChartBottom, 0);
  return Math.min(
    normalizedPaneCount * TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_HEIGHT,
    availableHeight,
  );
}

export function getTradingViewNativeSubIndicatorPaneLayouts({
  endIndex,
  panes,
  stackBottom,
  stackTop,
  startIndex,
}: {
  endIndex: number;
  panes: readonly ITradingViewNativeSubIndicatorRenderPane[];
  stackBottom: number;
  stackTop: number;
  startIndex: number;
}): ITradingViewNativeSubIndicatorPaneLayout[] {
  'worklet';

  const visiblePanes = panes.filter((pane) => pane.isVisible);
  const stackHeight = Math.max(stackBottom - stackTop, 0);
  if (!visiblePanes.length || stackHeight <= 0) {
    return [];
  }
  const paneHeight = stackHeight / visiblePanes.length;
  return visiblePanes.map((pane, index) => {
    const top = stackTop + paneHeight * index;
    const bottom =
      index === visiblePanes.length - 1
        ? stackBottom
        : stackTop + paneHeight * (index + 1);
    const plotTop = Math.min(
      top + TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_PADDING,
      bottom,
    );
    const plotBottom = Math.max(
      bottom - TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_PADDING,
      plotTop,
    );
    return {
      bottom,
      height: bottom - top,
      pane,
      plotBottom,
      plotTop,
      range: getTradingViewNativeSubIndicatorValueRange({
        endIndex,
        pane,
        startIndex,
      }),
      top,
    };
  });
}

export function getTradingViewNativeSubIndicatorPaneLayoutAtY(
  layouts: readonly ITradingViewNativeSubIndicatorPaneLayout[],
  y: number,
) {
  'worklet';

  if (!Number.isFinite(y)) {
    return null;
  }
  for (const layout of layouts) {
    if (y >= layout.top && y <= layout.bottom) {
      return layout;
    }
  }
  return null;
}
