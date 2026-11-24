import {
  TRADING_VIEW_NATIVE_CHART_TOP_PADDING,
  TRADING_VIEW_NATIVE_SUB_INDICATOR_MIN_MAIN_CHART_HEIGHT,
  TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_HEIGHT,
  TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_MAX_HEIGHT,
  TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_MIN_HEIGHT,
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
    ? Math.max(
        TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_MIN_HEIGHT,
        Math.min(
          TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_MAX_HEIGHT,
          pane.preferredHeight,
        ),
      )
    : TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_HEIGHT;
}

/**
 * Splits `stackHeight` between panes by the heights they prefer.
 *
 * Panes keep their shares of a stack that is taller or shorter than they
 * prefer, but a pane stops shrinking at the minimum height and the taller ones
 * give up the rest. One tall pane therefore cannot squeeze the others below a
 * height that can still be read and resized. A stack too short for every
 * minimum is split equally.
 */
export function getTradingViewNativeSubIndicatorPaneHeights(
  preferredHeights: readonly number[],
  stackHeight: number,
): number[] {
  'worklet';

  const count = preferredHeights.length;
  if (!count) {
    return [];
  }
  const total = Number.isFinite(stackHeight) ? Math.max(stackHeight, 0) : 0;
  const floor = Math.min(
    TRADING_VIEW_NATIVE_SUB_INDICATOR_PANE_MIN_HEIGHT,
    total / count,
  );
  const heights: number[] = [];
  const isFloored: boolean[] = [];
  for (let index = 0; index < count; index += 1) {
    heights.push(floor);
    isFloored.push(false);
  }
  // Flooring a pane leaves less for the others, which can floor more of them.
  let flooredCount = 0;
  while (flooredCount < count) {
    const sharedHeight = total - flooredCount * floor;
    let sharedPreferredHeight = 0;
    for (let index = 0; index < count; index += 1) {
      if (!isFloored[index]) {
        sharedPreferredHeight += preferredHeights[index];
      }
    }
    if (!(sharedPreferredHeight > 0)) {
      break;
    }
    let hasNewFloor = false;
    for (let index = 0; index < count; index += 1) {
      if (!isFloored[index]) {
        const share =
          (sharedHeight * preferredHeights[index]) / sharedPreferredHeight;
        if (share < floor) {
          heights[index] = floor;
          isFloored[index] = true;
          flooredCount += 1;
          hasNewFloor = true;
        } else {
          heights[index] = share;
        }
      }
    }
    if (!hasNewFloor) {
      break;
    }
  }
  return heights;
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
  const heights = getTradingViewNativeSubIndicatorPaneHeights(
    visiblePanes.map((pane) => getSubIndicatorPreferredHeight(pane)),
    stackHeight,
  );
  let offset = stackTop;
  return visiblePanes.map((pane, index) => {
    const top = offset;
    const bottom =
      index === visiblePanes.length - 1 ? stackBottom : top + heights[index];
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
