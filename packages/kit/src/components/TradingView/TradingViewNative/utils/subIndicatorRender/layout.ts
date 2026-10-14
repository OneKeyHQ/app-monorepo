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

export interface ITradingViewNativeSubIndicatorPaneStackLayout {
  bottom: number;
  height: number;
  top: number;
}

interface ITradingViewNativeSubIndicatorPaneStackOptions {
  height: number;
  paneCount: number;
  panes?: readonly ITradingViewNativeSubIndicatorRenderPane[];
  timeAxisHeight?: number;
}

export function getSubIndicatorPreferredHeight(
  pane: ITradingViewNativeSubIndicatorRenderPane,
) {
  'worklet';
  return typeof pane.preferredHeight === 'number' &&
    Number.isFinite(pane.preferredHeight)
    ? Math.max(36, Math.min(2000, pane.preferredHeight))
    : TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_HEIGHT;
}

function getTradingViewNativeTimeAxisY(
  height: number,
  timeAxisHeight?: number,
) {
  'worklet';

  const normalizedHeight = Number.isFinite(height) ? Math.max(height, 0) : 0;
  const normalizedTimeAxisHeight =
    typeof timeAxisHeight === 'number' && Number.isFinite(timeAxisHeight)
      ? Math.max(timeAxisHeight, 0)
      : TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT;
  return Math.max(normalizedHeight - normalizedTimeAxisHeight, 0);
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
  panes,
  timeAxisHeight,
}: ITradingViewNativeSubIndicatorPaneStackOptions) {
  'worklet';

  const normalizedPaneCount = Number.isFinite(paneCount)
    ? Math.max(Math.floor(paneCount), 0)
    : 0;
  const timeAxisY = getTradingViewNativeTimeAxisY(height, timeAxisHeight);
  const minimumMainChartBottom =
    TRADING_VIEW_NATIVE_CHART_TOP_PADDING +
    TRADING_VIEW_NATIVE_SUB_INDICATOR_MIN_MAIN_CHART_HEIGHT;
  const availableHeight = Math.max(timeAxisY - minimumMainChartBottom, 0);
  return Math.min(
    panes
      ? panes.reduce(
          (sum, pane) =>
            sum + (pane.isVisible ? getSubIndicatorPreferredHeight(pane) : 0),
          0,
        )
      : normalizedPaneCount * TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_HEIGHT,
    availableHeight,
  );
}

export function getTradingViewNativeSubIndicatorPaneStackLayout({
  height,
  paneCount,
  panes,
  timeAxisHeight,
}: ITradingViewNativeSubIndicatorPaneStackOptions): ITradingViewNativeSubIndicatorPaneStackLayout {
  'worklet';

  const bottom = getTradingViewNativeTimeAxisY(height, timeAxisHeight);
  const stackHeight = getTradingViewNativeSubIndicatorPaneStackHeight({
    height,
    paneCount,
    panes,
    timeAxisHeight,
  });
  return {
    bottom,
    height: stackHeight,
    top: bottom - stackHeight,
  };
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
  const preferredTotal = visiblePanes.reduce(
    (sum, pane) => sum + getSubIndicatorPreferredHeight(pane),
    0,
  );
  let offset = stackTop;
  return visiblePanes.map((pane, index) => {
    const top = offset;
    const bottom =
      index === visiblePanes.length - 1
        ? stackBottom
        : top +
          (stackHeight * getSubIndicatorPreferredHeight(pane)) / preferredTotal;
    offset = bottom;
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
