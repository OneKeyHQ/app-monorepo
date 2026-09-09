import {
  TRADING_VIEW_NATIVE_LEGEND_BACKGROUND_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_LEGEND_BACKGROUND_VERTICAL_PADDING,
  TRADING_VIEW_NATIVE_LEGEND_FONT_SIZE,
  TRADING_VIEW_NATIVE_SUB_INDICATOR_LEGEND_HIT_MIN_HEIGHT,
  TRADING_VIEW_NATIVE_SUB_INDICATOR_LEGEND_HIT_MIN_WIDTH,
} from '../../chartConstants';
import { getTradingViewNativeChartLegendRowLayout } from '../chartLegend';

import { formatTradingViewNativeSubIndicatorValue } from './coordinates';
import {
  getTradingViewNativeSubIndicatorPaneLayouts,
  getTradingViewNativeSubIndicatorPaneStackLayout,
} from './layout';

import type { ITradingViewNativeSubIndicatorPaneLayout } from './layout';
import type {
  ITradingViewNativeSubIndicatorRenderPane,
  ITradingViewNativeSubIndicatorRenderSeries,
} from './types';
import type { ITradingViewNativeSubIndicator } from '../chartIndicators';
import type {
  ITradingViewNativeLegendRect,
  ITradingViewNativeLegendTextSegmentLayout,
} from '../chartLegend';

export interface ITradingViewNativeSubIndicatorLegendTextEntry {
  segment: ITradingViewNativeLegendTextSegmentLayout;
  series?: ITradingViewNativeSubIndicatorRenderSeries;
}

export interface ITradingViewNativeSubIndicatorLegendLayout {
  backgroundRect: ITradingViewNativeLegendRect;
  clipRect: ITradingViewNativeLegendRect;
  hitRect: ITradingViewNativeLegendRect;
  paneLayout: ITradingViewNativeSubIndicatorPaneLayout;
  textBaselineY: number;
  textEntries: ITradingViewNativeSubIndicatorLegendTextEntry[];
}

export interface ITradingViewNativeSubIndicatorLegendHitRegion {
  indicator: ITradingViewNativeSubIndicator;
  rect: ITradingViewNativeLegendRect;
}

function getTradingViewNativeSubIndicatorLegendTitle(
  pane: ITradingViewNativeSubIndicatorRenderPane,
) {
  'worklet';

  if (pane.indicator !== 'MACD') {
    return pane.shortTitle;
  }
  const { fastPeriod, signalPeriod, slowPeriod } = pane.inputValues;
  return `${pane.shortTitle}(${String(fastPeriod)}, ${String(
    slowPeriod,
  )}, ${String(signalPeriod)})`;
}

function getTradingViewNativeSubIndicatorLegendLayout({
  measureTextWidth,
  paneLayout,
  pointIndex,
  priceAxisX,
}: {
  measureTextWidth: (text: string) => number;
  paneLayout: ITradingViewNativeSubIndicatorPaneLayout;
  pointIndex: number;
  priceAxisX: number;
}): ITradingViewNativeSubIndicatorLegendLayout | null {
  'worklet';

  if (paneLayout.height < TRADING_VIEW_NATIVE_LEGEND_FONT_SIZE + 6) {
    return null;
  }

  const visibleSeriesEntries = paneLayout.pane.series.flatMap((series) => {
    const value = series.values[pointIndex];
    return series.style.visible &&
      value !== null &&
      value !== undefined &&
      Number.isFinite(value)
      ? [{ series, value }]
      : [];
  });
  const rowLayout = getTradingViewNativeChartLegendRowLayout({
    items: [
      {
        label: getTradingViewNativeSubIndicatorLegendTitle(paneLayout.pane),
        value: '',
      },
      ...visibleSeriesEntries.map(({ series, value }) => ({
        label: series.title,
        value: formatTradingViewNativeSubIndicatorValue(
          value,
          paneLayout.pane.format,
        ),
      })),
    ],
    maxX: priceAxisX,
    measureTextWidth,
    top:
      paneLayout.top + TRADING_VIEW_NATIVE_LEGEND_BACKGROUND_VERTICAL_PADDING,
  });
  if (!rowLayout) {
    return null;
  }

  const textEntries: ITradingViewNativeSubIndicatorLegendTextEntry[] = [];
  let contentRight = rowLayout.backgroundRect.x;
  let contentBottom = rowLayout.backgroundRect.y;
  for (let index = 0; index < rowLayout.segments.length; index += 1) {
    const segment = rowLayout.segments[index];
    if (segment) {
      const textBaselineY = segment.textBaselineY ?? rowLayout.textBaselineY;
      if (textBaselineY <= paneLayout.bottom) {
        const series =
          index > 0 ? visibleSeriesEntries[index - 1]?.series : undefined;
        textEntries.push({ segment, ...(series ? { series } : {}) });
        contentRight = Math.max(
          contentRight,
          segment.labelX + measureTextWidth(segment.label),
          segment.valueX + measureTextWidth(segment.value),
        );
        contentBottom = Math.max(
          contentBottom,
          textBaselineY +
            TRADING_VIEW_NATIVE_LEGEND_BACKGROUND_VERTICAL_PADDING,
        );
      }
    }
  }
  if (!textEntries.length) {
    return null;
  }

  const backgroundRect = {
    height: Math.min(
      contentBottom - rowLayout.backgroundRect.y,
      Math.max(paneLayout.bottom - rowLayout.backgroundRect.y, 0),
    ),
    width: Math.min(
      contentRight -
        rowLayout.backgroundRect.x +
        TRADING_VIEW_NATIVE_LEGEND_BACKGROUND_HORIZONTAL_PADDING,
      Math.max(priceAxisX - rowLayout.backgroundRect.x, 0),
    ),
    x: rowLayout.backgroundRect.x,
    y: rowLayout.backgroundRect.y,
  };
  if (backgroundRect.height <= 0 || backgroundRect.width <= 0) {
    return null;
  }

  return {
    backgroundRect,
    clipRect: {
      height: paneLayout.height,
      width: Math.max(priceAxisX - rowLayout.clipRect.x, 0),
      x: rowLayout.clipRect.x,
      y: paneLayout.top,
    },
    hitRect: {
      ...backgroundRect,
      height: Math.min(
        Math.max(
          backgroundRect.height,
          TRADING_VIEW_NATIVE_SUB_INDICATOR_LEGEND_HIT_MIN_HEIGHT,
        ),
        Math.max(paneLayout.bottom - backgroundRect.y, 0),
      ),
      width: Math.min(
        Math.max(
          backgroundRect.width,
          TRADING_VIEW_NATIVE_SUB_INDICATOR_LEGEND_HIT_MIN_WIDTH,
        ),
        Math.max(priceAxisX - backgroundRect.x, 0),
      ),
    },
    paneLayout,
    textBaselineY: rowLayout.textBaselineY,
    textEntries,
  };
}

export function getTradingViewNativeSubIndicatorLegendLayouts({
  layouts,
  measureTextWidth,
  pointIndex,
  priceAxisX,
}: {
  layouts: readonly ITradingViewNativeSubIndicatorPaneLayout[];
  measureTextWidth: (text: string) => number;
  pointIndex: number;
  priceAxisX: number;
}): ITradingViewNativeSubIndicatorLegendLayout[] {
  'worklet';

  if (!Number.isInteger(pointIndex) || pointIndex < 0) {
    return [];
  }

  const legendLayouts: ITradingViewNativeSubIndicatorLegendLayout[] = [];
  for (const paneLayout of layouts) {
    const legendLayout = getTradingViewNativeSubIndicatorLegendLayout({
      measureTextWidth,
      paneLayout,
      pointIndex,
      priceAxisX,
    });
    if (legendLayout) {
      legendLayouts.push(legendLayout);
    }
  }
  return legendLayouts;
}

export function getTradingViewNativeSubIndicatorLegendHitRegions({
  height,
  measureTextWidth,
  panes,
  pointIndex,
  priceAxisX,
  timeAxisHeight,
}: {
  height: number;
  measureTextWidth: (text: string) => number;
  panes: readonly ITradingViewNativeSubIndicatorRenderPane[];
  pointIndex: number;
  priceAxisX: number;
  timeAxisHeight?: number;
}): ITradingViewNativeSubIndicatorLegendHitRegion[] {
  'worklet';

  const visiblePaneCount = panes.reduce(
    (count, pane) => count + (pane.isVisible ? 1 : 0),
    0,
  );
  const stackLayout = getTradingViewNativeSubIndicatorPaneStackLayout({
    height,
    paneCount: visiblePaneCount,
    timeAxisHeight,
  });
  if (stackLayout.height <= 0) {
    return [];
  }
  const paneLayouts = getTradingViewNativeSubIndicatorPaneLayouts({
    endIndex: 0,
    panes,
    stackBottom: stackLayout.bottom,
    stackTop: stackLayout.top,
    startIndex: 0,
  });
  return getTradingViewNativeSubIndicatorLegendLayouts({
    layouts: paneLayouts,
    measureTextWidth,
    pointIndex,
    priceAxisX,
  }).map(({ hitRect, paneLayout }) => ({
    indicator: paneLayout.pane.indicator,
    rect: hitRect,
  }));
}

export function getTradingViewNativeSubIndicatorLegendIndicatorAtPoint({
  regions,
  x,
  y,
}: {
  regions: readonly ITradingViewNativeSubIndicatorLegendHitRegion[];
  x: number;
  y: number;
}) {
  'worklet';

  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  for (const region of regions) {
    const { rect } = region;
    if (
      x >= rect.x &&
      x <= rect.x + rect.width &&
      y >= rect.y &&
      y <= rect.y + rect.height
    ) {
      return region.indicator;
    }
  }
  return null;
}
