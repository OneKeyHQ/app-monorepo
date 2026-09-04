import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';
import type { ITradingViewNativeChartSettings } from '@onekeyhq/shared/types/tradingViewNative';

import {
  TRADING_VIEW_NATIVE_AXIS_FONT_SIZE as AXIS_FONT_SIZE,
  TRADING_VIEW_NATIVE_CHART_DOWN_COLOR as CHART_DOWN_COLOR,
  TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING as CHART_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_CHART_UP_COLOR as CHART_UP_COLOR,
  TRADING_VIEW_NATIVE_CROSSHAIR_LABEL_BACKGROUND_COLOR as CROSSHAIR_LABEL_BACKGROUND_COLOR,
  TRADING_VIEW_NATIVE_CROSSHAIR_LABEL_HEIGHT as CROSSHAIR_LABEL_HEIGHT,
  TRADING_VIEW_NATIVE_CROSSHAIR_LABEL_HORIZONTAL_PADDING as CROSSHAIR_LABEL_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_CROSSHAIR_LABEL_TEXT_COLOR as CROSSHAIR_LABEL_TEXT_COLOR,
  TRADING_VIEW_NATIVE_CROSSHAIR_LINE_DASH_GAP as CROSSHAIR_LINE_DASH_GAP,
  TRADING_VIEW_NATIVE_CROSSHAIR_LINE_DASH_LENGTH as CROSSHAIR_LINE_DASH_LENGTH,
  TRADING_VIEW_NATIVE_CROSSHAIR_LINE_OPACITY as CROSSHAIR_LINE_OPACITY,
  TRADING_VIEW_NATIVE_CURRENT_PRICE_LABEL_HEIGHT as CURRENT_PRICE_LABEL_HEIGHT,
  TRADING_VIEW_NATIVE_CURRENT_PRICE_LABEL_TEXT_COLOR as CURRENT_PRICE_LABEL_TEXT_COLOR,
  TRADING_VIEW_NATIVE_CURRENT_PRICE_LINE_DASH_GAP as CURRENT_PRICE_LINE_DASH_GAP,
  TRADING_VIEW_NATIVE_CURRENT_PRICE_LINE_DASH_LENGTH as CURRENT_PRICE_LINE_DASH_LENGTH,
  TRADING_VIEW_NATIVE_GRID_LINE_DASH_GAP as GRID_LINE_DASH_GAP,
  TRADING_VIEW_NATIVE_GRID_LINE_DASH_LENGTH as GRID_LINE_DASH_LENGTH,
  TRADING_VIEW_NATIVE_INDICATOR_CYAN_COLOR as INDICATOR_CYAN_COLOR,
  TRADING_VIEW_NATIVE_INDICATOR_DARK_ORANGE_COLOR as INDICATOR_DARK_ORANGE_COLOR,
  TRADING_VIEW_NATIVE_INDICATOR_LINE_WIDTH as INDICATOR_LINE_WIDTH,
  TRADING_VIEW_NATIVE_INDICATOR_ORANGE_COLOR as INDICATOR_ORANGE_COLOR,
  TRADING_VIEW_NATIVE_INDICATOR_PINK_COLOR as INDICATOR_PINK_COLOR,
  TRADING_VIEW_NATIVE_INDICATOR_SAR_COLOR as INDICATOR_SAR_COLOR,
  TRADING_VIEW_NATIVE_INDICATOR_SAR_POINT_RADIUS as INDICATOR_SAR_POINT_RADIUS,
  TRADING_VIEW_NATIVE_LEGEND_BACKGROUND_OPACITY as LEGEND_BACKGROUND_OPACITY,
  TRADING_VIEW_NATIVE_LEGEND_FONT_SIZE as LEGEND_FONT_SIZE,
  TRADING_VIEW_NATIVE_PRICE_AXIS_LABEL_LEFT_PADDING as PRICE_AXIS_LABEL_LEFT_PADDING,
  TRADING_VIEW_NATIVE_PRICE_AXIS_TEXT_BASELINE_OFFSET as PRICE_AXIS_TEXT_BASELINE_OFFSET,
  TRADING_VIEW_NATIVE_PRICE_LEGEND_TOP as PRICE_LEGEND_TOP,
  TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT as TIME_AXIS_HEIGHT,
  TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH,
  TRADING_VIEW_NATIVE_CANDLE_STEP,
  TRADING_VIEW_NATIVE_LINE_WIDTH,
  TRADING_VIEW_NATIVE_VOLUME_LEGEND_TOP_PADDING as VOLUME_LEGEND_TOP_PADDING,
  TRADING_VIEW_NATIVE_VOLUME_OPACITY as VOLUME_OPACITY,
} from '../chartConstants';

import { appendTradingViewNativeChartComponentCommands } from './chartComponentScene';
import { getTradingViewNativeChartComponentPriceAxisLabel } from './chartComponentTree';
import {
  type ITradingViewNativeIndicatorPaint,
  type ITradingViewNativeIndicatorSeries,
  getTradingViewNativeIndicatorPriceRange,
} from './chartIndicators';
import {
  type ITradingViewNativeChartLayout,
  formatTradingViewNativeCrosshairTime,
  formatTradingViewNativePriceTick,
  getTradingViewNativeChartLayout,
  getTradingViewNativeChartWidth,
  getTradingViewNativeCurrentPriceLabel,
  getTradingViewNativeCurrentPriceLayout,
  getTradingViewNativePriceAtY,
  getTradingViewNativePriceAxisLabel,
  getTradingViewNativePriceAxisWidth,
  getTradingViewNativePriceExtremumHorizontalLayout,
  getTradingViewNativePriceY,
  getTradingViewNativeTimeTickMinimumIndexSpacing,
  getTradingViewNativeVolumeAtY,
  getTradingViewNativeVolumeBarHeight,
  getTradingViewNativeWatermarkLayout,
} from './chartLayout';
import {
  type ITradingViewNativeChartLegendRowLayout,
  formatTradingViewNativeVolume,
  getTradingViewNativeChartLegend,
  getTradingViewNativeChartLegendRowLayouts,
  getTradingViewNativeVolumeAxisLabel,
} from './chartLegend';
import { isTradingViewNativePriceUp } from './chartStyle';
import { getTradingViewNativePrimarySeriesModel } from './chartType';
import {
  type ITradingViewNativePriceRange,
  type ITradingViewNativeVisiblePointRange,
  clampTradingViewNativePanOffset,
  clampTradingViewNativeZoomScale,
  getTradingViewNativeCandleX,
  getTradingViewNativePointIndexAtX,
  getTradingViewNativePriceExtrema,
  getTradingViewNativeVisiblePointRange,
} from './chartViewport';
import {
  appendTradingViewNativePrimarySeriesCommands,
  appendTradingViewNativePrimarySeriesPaintStyles,
} from './primarySeriesScene';
import {
  appendTradingViewNativeSubIndicatorCommands,
  appendTradingViewNativeSubIndicatorLegendCommands,
  getTradingViewNativeSubIndicatorAxisLabel,
  getTradingViewNativeSubIndicatorCrosshairValueText,
  getTradingViewNativeSubIndicatorPaneLayouts,
  getTradingViewNativeSubIndicatorPaneStackLayout,
} from './subIndicatorRender';

import type {
  ITradingViewNativeChartRuntimeCrosshair,
  ITradingViewNativeChartRuntimeViewport,
} from './chartRuntime';
import type {
  ITradingViewNativeSubIndicatorLegendHitRegion,
  ITradingViewNativeSubIndicatorRenderPane,
} from './subIndicatorRender';
import type {
  ITradingViewNativeCandleLabels,
  ITradingViewNativeChartLeafComponent,
  ITradingViewNativeChartType,
  ITradingViewNativePriceScaleMode,
} from '../types';

export type ITradingViewNativeChartSceneFont = 'axis' | 'legend' | 'priceAxis';

export type ITradingViewNativeChartScenePaint =
  | 'axisText'
  | 'areaFill'
  | 'areaStroke'
  | 'background'
  | 'crosshairLabelBackground'
  | 'crosshairLabelText'
  | 'crosshairLine'
  | 'currentPriceLabelText'
  | 'down'
  | 'downCurrentPriceLine'
  | 'downVolume'
  | 'gridLine'
  | 'gridSolidLine'
  | 'legendBackground'
  | 'line'
  | 'lineStroke'
  | 'up'
  | 'upCurrentPriceLine'
  | 'upVolume'
  | ITradingViewNativeIndicatorPaint;

export interface ITradingViewNativeChartSceneColors {
  axisText: string;
  background: string;
  down?: string;
  grid: string;
  line: string;
  timeAxisBorder?: string;
  up?: string;
}

export interface ITradingViewNativeChartScenePaintStyle {
  color: string;
  dash?: [number, number];
  drawStyle?: 'fill' | 'stroke';
  opacity: number;
  strokeCap?: 'butt' | 'round' | 'square';
  strokeJoin?: 'bevel' | 'miter' | 'round';
  strokeWidth?: number;
}

export interface ITradingViewNativeChartSceneStyleOptions {
  timeAxisBorderWidth?: number;
}

export interface ITradingViewNativeChartSceneRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

export type ITradingViewNativeChartSceneCommand =
  | {
      kind: 'clip';
      rect: ITradingViewNativeChartSceneRect;
    }
  | {
      cx: number;
      cy: number;
      customPaintId?: string;
      kind: 'circle';
      paint: ITradingViewNativeChartScenePaint;
      radius: number;
    }
  | {
      height: number;
      customPaintId?: string;
      kind: 'rect';
      paint: ITradingViewNativeChartScenePaint;
      width: number;
      x: number;
      y: number;
    }
  | {
      colors: [string, string];
      kind: 'linearGradientRect';
      rect: ITradingViewNativeChartSceneRect;
    }
  | {
      kind: 'restore';
    }
  | {
      kind: 'line';
      customPaintId?: string;
      paint: ITradingViewNativeChartScenePaint;
      x1: number;
      x2: number;
      y1: number;
      y2: number;
    }
  | {
      kind: 'polyline';
      customPaintId?: string;
      paint: ITradingViewNativeChartScenePaint;
      points: { x: number; y: number }[];
    }
  | {
      customPaintId?: string;
      kind: 'polygon';
      paint: ITradingViewNativeChartScenePaint;
      points: { x: number; y: number }[];
    }
  | {
      customPaintId?: string;
      font: ITradingViewNativeChartSceneFont;
      kind: 'text';
      paint: ITradingViewNativeChartScenePaint;
      text: string;
      x: number;
      y: number;
    }
  | {
      kind: 'watermark';
      opacity: number;
      rect: ITradingViewNativeChartSceneRect;
    };

export interface IBuildTradingViewNativeChartSceneOptions {
  candleIntervalSeconds: number;
  chartComponents?: readonly ITradingViewNativeChartLeafComponent[];
  chartSettings?: ITradingViewNativeChartSettings;
  chartType: ITradingViewNativeChartType;
  crosshair: ITradingViewNativeChartRuntimeCrosshair;
  extendTimeAxisBorderToCanvasEdge?: boolean;
  hasVolume: boolean;
  height: number;
  indicatorSeries?: ITradingViewNativeIndicatorSeries[];
  measureTextWidth: (
    text: string,
    font: ITradingViewNativeChartSceneFont,
  ) => number;
  candleLabels: ITradingViewNativeCandleLabels;
  currentPriceLabel?: string;
  points: IMarketTokenKLineDataPoint[];
  pinnedPriceRange?: ITradingViewNativePriceRange | null;
  priceAxisFontSize?: number;
  priceAxisWidth?: number;
  priceAxisTickCount?: number;
  showLegend?: boolean;
  timeAxisFontSize?: number;
  timeAxisHeight?: number;
  priceRangeScale?: number;
  priceScaleMode?: ITradingViewNativePriceScaleMode;
  subIndicatorPanes?: readonly ITradingViewNativeSubIndicatorRenderPane[];
  viewport: ITradingViewNativeChartRuntimeViewport;
  watermarkOpacity: number;
  width: number;
}

const CROSSHAIR_PAINT_ID = 'chart.crosshair';
const GRID_HORIZONTAL_PAINT_ID = 'chart.grid.horizontal';
const GRID_VERTICAL_PAINT_ID = 'chart.grid.vertical';
const LATEST_PRICE_LINE_PAINT_IDS = {
  down: 'chart.latestPrice.line.down',
  up: 'chart.latestPrice.line.up',
} as const;
const LATEST_PRICE_LABEL_PAINT_IDS = {
  down: 'chart.latestPrice.label.down',
  up: 'chart.latestPrice.label.up',
} as const;
const BACKGROUND_PAINT_ID = 'chart.background';

function getMainIndicatorPaintId(series: ITradingViewNativeIndicatorSeries) {
  'worklet';

  return `chart.mainIndicator.${series.indicator}.${series.key}`;
}

export interface ITradingViewNativeChartScene {
  autoPriceRange: ITradingViewNativePriceRange | null;
  commands: ITradingViewNativeChartSceneCommand[];
  crosshairPointIndex: number | null;
  customPaintStyles: Record<string, ITradingViewNativeChartScenePaintStyle>;
  priceAxisWidth: number;
  subIndicatorLegendHitRegions: ITradingViewNativeSubIndicatorLegendHitRegion[];
  viewport: ITradingViewNativeChartRuntimeViewport;
  visiblePointRange: ITradingViewNativeVisiblePointRange;
}

export function getTradingViewNativeChartScenePaintStyles(
  {
    axisText,
    background,
    down = CHART_DOWN_COLOR,
    grid,
    line,
    timeAxisBorder,
    up = CHART_UP_COLOR,
  }: ITradingViewNativeChartSceneColors,
  { timeAxisBorderWidth = 1 }: ITradingViewNativeChartSceneStyleOptions = {},
): Record<
  ITradingViewNativeChartScenePaint,
  ITradingViewNativeChartScenePaintStyle
> {
  'worklet';

  return {
    axisText: { color: axisText, opacity: 1 },
    areaFill: { color: up, opacity: 0.12 },
    areaStroke: {
      color: up,
      drawStyle: 'stroke',
      opacity: 1,
      strokeCap: 'round',
      strokeJoin: 'round',
      strokeWidth: TRADING_VIEW_NATIVE_LINE_WIDTH,
    },
    background: { color: background, opacity: 1 },
    crosshairLabelBackground: {
      color: CROSSHAIR_LABEL_BACKGROUND_COLOR,
      opacity: 1,
    },
    crosshairLabelText: {
      color: CROSSHAIR_LABEL_TEXT_COLOR,
      opacity: 1,
    },
    crosshairLine: {
      color: axisText,
      dash: [CROSSHAIR_LINE_DASH_LENGTH, CROSSHAIR_LINE_DASH_GAP],
      opacity: CROSSHAIR_LINE_OPACITY,
    },
    currentPriceLabelText: {
      color: CURRENT_PRICE_LABEL_TEXT_COLOR,
      opacity: 1,
    },
    down: { color: down, opacity: 1 },
    downCurrentPriceLine: {
      color: down,
      dash: [CURRENT_PRICE_LINE_DASH_LENGTH, CURRENT_PRICE_LINE_DASH_GAP],
      opacity: 1,
    },
    downVolume: { color: down, opacity: VOLUME_OPACITY },
    gridLine: {
      color: grid,
      dash: [GRID_LINE_DASH_LENGTH, GRID_LINE_DASH_GAP],
      opacity: 1,
    },
    gridSolidLine: {
      color: timeAxisBorder ?? grid,
      opacity: 1,
      strokeWidth: timeAxisBorderWidth,
    },
    indicatorCyanStroke: {
      color: INDICATOR_CYAN_COLOR,
      drawStyle: 'stroke',
      opacity: 1,
      strokeJoin: 'round',
      strokeWidth: INDICATOR_LINE_WIDTH,
    },
    indicatorDarkOrangeStroke: {
      color: INDICATOR_DARK_ORANGE_COLOR,
      drawStyle: 'stroke',
      opacity: 1,
      strokeJoin: 'round',
      strokeWidth: INDICATOR_LINE_WIDTH,
    },
    indicatorOrangeStroke: {
      color: INDICATOR_ORANGE_COLOR,
      drawStyle: 'stroke',
      opacity: 1,
      strokeJoin: 'round',
      strokeWidth: INDICATOR_LINE_WIDTH,
    },
    indicatorPinkStroke: {
      color: INDICATOR_PINK_COLOR,
      drawStyle: 'stroke',
      opacity: 1,
      strokeJoin: 'round',
      strokeWidth: INDICATOR_LINE_WIDTH,
    },
    indicatorSarPoint: { color: INDICATOR_SAR_COLOR, opacity: 1 },
    legendBackground: {
      color: background,
      opacity: LEGEND_BACKGROUND_OPACITY,
    },
    line: { color: line, opacity: 1 },
    lineStroke: {
      color: line,
      drawStyle: 'stroke',
      opacity: 1,
      strokeCap: 'round',
      strokeJoin: 'round',
      strokeWidth: TRADING_VIEW_NATIVE_LINE_WIDTH,
    },
    up: { color: up, opacity: 1 },
    upCurrentPriceLine: {
      color: up,
      dash: [CURRENT_PRICE_LINE_DASH_LENGTH, CURRENT_PRICE_LINE_DASH_GAP],
      opacity: 1,
    },
    upVolume: { color: up, opacity: VOLUME_OPACITY },
  };
}

function appendIndicatorCommands({
  commands,
  customPaintStyles,
  endIndex,
  getPointX,
  indicatorSeries,
  layout,
  startIndex,
}: {
  commands: ITradingViewNativeChartSceneCommand[];
  customPaintStyles: Record<string, ITradingViewNativeChartScenePaintStyle>;
  endIndex: number;
  getPointX: (index: number) => number;
  indicatorSeries: ITradingViewNativeIndicatorSeries[];
  layout: ITradingViewNativeChartLayout;
  startIndex: number;
}) {
  'worklet';

  const visibleSeries = indicatorSeries.filter(
    (series) => series.visible !== false,
  );
  for (const series of visibleSeries) {
    const customPaintId = series.style
      ? getMainIndicatorPaintId(series)
      : undefined;
    if (customPaintId && series.style) {
      let dash: [number, number] | undefined;
      if (series.style.lineStyle === 'dashed') {
        dash = [6, 4];
      } else if (series.style.lineStyle === 'dotted') {
        dash = [2, 3];
      }
      customPaintStyles[customPaintId] = {
        color: series.style.color,
        ...(dash ? { dash } : {}),
        drawStyle: series.kind === 'line' ? 'stroke' : 'fill',
        opacity: series.style.opacity,
        strokeJoin: 'round',
        strokeWidth: series.style.lineWidth,
      };
      customPaintStyles[`${customPaintId}:legend`] = {
        color: series.style.color,
        drawStyle: 'fill',
        opacity: series.style.opacity,
      };
    }
    const firstIndex = Math.max(startIndex - 1, 0);
    const lastIndex = Math.min(endIndex + 1, series.values.length);
    if (series.kind === 'points') {
      for (let index = startIndex; index < endIndex; index += 1) {
        const value = series.values[index];
        if (value !== null && value !== undefined && Number.isFinite(value)) {
          commands.push({
            cx: getPointX(index),
            cy: getTradingViewNativePriceY(value, layout),
            ...(customPaintId ? { customPaintId } : {}),
            kind: 'circle',
            paint: series.paint,
            radius: INDICATOR_SAR_POINT_RADIUS,
          });
        }
      }
    } else {
      let linePoints: { x: number; y: number }[] = [];
      for (let index = firstIndex; index < lastIndex; index += 1) {
        const value = series.values[index];
        if (value !== null && value !== undefined && Number.isFinite(value)) {
          linePoints.push({
            x: getPointX(index),
            y: getTradingViewNativePriceY(value, layout),
          });
        } else {
          if (linePoints.length > 1) {
            commands.push({
              ...(customPaintId ? { customPaintId } : {}),
              kind: 'polyline',
              paint: series.paint,
              points: linePoints,
            });
          }
          linePoints = [];
        }
      }
      if (linePoints.length > 1) {
        commands.push({
          ...(customPaintId ? { customPaintId } : {}),
          kind: 'polyline',
          paint: series.paint,
          points: linePoints,
        });
      }
    }
  }
}

function appendIndicatorFillCommands({
  commands,
  customPaintStyles,
  endIndex,
  getPointX,
  indicatorSeries,
  layout,
  startIndex,
}: {
  commands: ITradingViewNativeChartSceneCommand[];
  customPaintStyles: Record<string, ITradingViewNativeChartScenePaintStyle>;
  endIndex: number;
  getPointX: (index: number) => number;
  indicatorSeries: ITradingViewNativeIndicatorSeries[];
  layout: ITradingViewNativeChartLayout;
  startIndex: number;
}) {
  'worklet';

  for (const series of indicatorSeries) {
    const fill = series.fill;
    const toSeries = fill
      ? indicatorSeries.find(({ key }) => key === fill.toSeriesKey)
      : undefined;
    if (fill && toSeries) {
      const customPaintId = `${getMainIndicatorPaintId(series)}:fill`;
      customPaintStyles[customPaintId] = {
        color: fill.color,
        drawStyle: 'fill',
        opacity: fill.opacity,
      };
      const firstIndex = Math.max(startIndex - 1, 0);
      const lastIndex = Math.min(
        endIndex + 1,
        series.values.length,
        toSeries.values.length,
      );
      let fromPoints: { x: number; y: number }[] = [];
      let toPoints: { x: number; y: number }[] = [];
      const appendFill = () => {
        if (fromPoints.length > 1 && fromPoints.length === toPoints.length) {
          const points = fromPoints.slice();
          for (let index = toPoints.length - 1; index >= 0; index -= 1) {
            const point = toPoints[index];
            if (point) {
              points.push(point);
            }
          }
          commands.push({
            customPaintId,
            kind: 'polygon',
            paint: series.paint,
            points,
          });
        }
        fromPoints = [];
        toPoints = [];
      };
      for (let index = firstIndex; index < lastIndex; index += 1) {
        const fromValue = series.values[index];
        const toValue = toSeries.values[index];
        if (
          fromValue !== null &&
          fromValue !== undefined &&
          Number.isFinite(fromValue) &&
          toValue !== null &&
          toValue !== undefined &&
          Number.isFinite(toValue)
        ) {
          const x = getPointX(index);
          fromPoints.push({
            x,
            y: getTradingViewNativePriceY(fromValue, layout),
          });
          toPoints.push({
            x,
            y: getTradingViewNativePriceY(toValue, layout),
          });
        } else {
          appendFill();
        }
      }
      appendFill();
    }
  }
}

function appendLegendCommands({
  commands,
  layout,
  trendValuePaint,
  valuePaint,
}: {
  commands: ITradingViewNativeChartSceneCommand[];
  layout: ITradingViewNativeChartLegendRowLayout | null;
  trendValuePaint: ITradingViewNativeChartScenePaint;
  valuePaint: ITradingViewNativeChartScenePaint;
}) {
  'worklet';

  if (!layout) {
    return;
  }
  commands.push(
    { kind: 'clip', rect: layout.clipRect },
    {
      ...layout.backgroundRect,
      kind: 'rect',
      paint: 'legendBackground',
    },
  );
  for (const segment of layout.segments) {
    const textBaselineY = segment.textBaselineY ?? layout.textBaselineY;
    commands.push(
      {
        ...(segment.customPaintId
          ? { customPaintId: segment.customPaintId }
          : {}),
        font: 'legend',
        kind: 'text',
        paint: 'axisText',
        text: segment.label,
        x: segment.labelX,
        y: textBaselineY,
      },
      {
        ...(segment.customPaintId
          ? { customPaintId: segment.customPaintId }
          : {}),
        font: 'legend',
        kind: 'text',
        paint:
          segment.valueColorRole === 'trend' ? trendValuePaint : valuePaint,
        text: segment.value,
        x: segment.valueX,
        y: textBaselineY,
      },
    );
  }
  commands.push({ kind: 'restore' });
}

export function buildTradingViewNativeChartScene({
  candleIntervalSeconds,
  chartComponents = [],
  chartSettings,
  chartType,
  crosshair,
  extendTimeAxisBorderToCanvasEdge = false,
  hasVolume,
  height,
  indicatorSeries = [],
  measureTextWidth,
  candleLabels,
  currentPriceLabel,
  points,
  pinnedPriceRange,
  priceAxisFontSize = AXIS_FONT_SIZE,
  priceAxisWidth,
  priceAxisTickCount,
  showLegend = true,
  timeAxisFontSize = AXIS_FONT_SIZE,
  timeAxisHeight = TIME_AXIS_HEIGHT,
  priceRangeScale,
  priceScaleMode,
  subIndicatorPanes = [],
  viewport,
  watermarkOpacity,
  width,
}: IBuildTradingViewNativeChartSceneOptions): ITradingViewNativeChartScene {
  'worklet';

  const primarySeries = getTradingViewNativePrimarySeriesModel(chartType);
  const visibleSubIndicatorPanes = subIndicatorPanes.filter(
    (pane) => pane.isVisible,
  );
  const showYAxis = chartSettings?.options.yAxis ?? true;
  const showHorizontalGrid =
    chartSettings === undefined ||
    chartSettings.grid.style === 'both' ||
    chartSettings.grid.style === 'horizontal';
  const showVerticalGrid =
    chartSettings === undefined ||
    chartSettings.grid.style === 'both' ||
    chartSettings.grid.style === 'vertical';
  const resolvedCurrentPriceLabel =
    currentPriceLabel ?? getTradingViewNativeCurrentPriceLabel(points);
  let resolvedPriceAxisWidth = showYAxis ? Math.max(priceAxisWidth ?? 0, 0) : 0;
  if (showYAxis && !Number.isFinite(priceAxisWidth)) {
    const volumeAxisLabel = hasVolume
      ? getTradingViewNativeVolumeAxisLabel(points)
      : '';
    const subIndicatorAxisLabel = getTradingViewNativeSubIndicatorAxisLabel(
      visibleSubIndicatorPanes,
    );
    const chartComponentPriceAxisLabel =
      getTradingViewNativeChartComponentPriceAxisLabel(chartComponents);
    const widestSecondaryAxisLabel =
      subIndicatorAxisLabel.length > volumeAxisLabel.length
        ? subIndicatorAxisLabel
        : volumeAxisLabel;
    resolvedPriceAxisWidth = getTradingViewNativePriceAxisWidth({
      currentPriceLabelWidth: measureTextWidth(
        chartSettings?.options.latestPrice === false
          ? ''
          : resolvedCurrentPriceLabel,
        'priceAxis',
      ),
      widestPriceLabelWidth: Math.max(
        measureTextWidth(
          getTradingViewNativePriceAxisLabel(points),
          'priceAxis',
        ),
        measureTextWidth(chartComponentPriceAxisLabel, 'priceAxis'),
      ),
      widestVolumeLabelWidth: measureTextWidth(
        widestSecondaryAxisLabel,
        'priceAxis',
      ),
    });
  }
  const chartWidth = getTradingViewNativeChartWidth(
    width,
    resolvedPriceAxisWidth,
  );
  const zoomScale = clampTradingViewNativeZoomScale(viewport.zoomScale);
  const offset = clampTradingViewNativePanOffset({
    chartWidth,
    initialRightOffset: viewport.initialRightOffset,
    offset: viewport.offset,
    pointCount: points.length,
    zoomScale,
  });
  const visiblePointRange = getTradingViewNativeVisiblePointRange({
    chartWidth,
    initialRightOffset: viewport.initialRightOffset,
    offset,
    pointCount: points.length,
    zoomScale,
  });
  const subIndicatorPaneStackLayout =
    getTradingViewNativeSubIndicatorPaneStackLayout({
      height,
      paneCount: visibleSubIndicatorPanes.length,
      timeAxisHeight,
    });
  const subIndicatorPaneStackHeight = subIndicatorPaneStackLayout.height;
  const customPaintStyles: Record<
    string,
    ITradingViewNativeChartScenePaintStyle
  > = {};
  if (chartSettings) {
    customPaintStyles[BACKGROUND_PAINT_ID] = {
      color: chartSettings.background.colors[0],
      opacity: 1,
    };
    customPaintStyles[GRID_HORIZONTAL_PAINT_ID] = {
      color: chartSettings.grid.horizontalColor,
      dash: [GRID_LINE_DASH_LENGTH, GRID_LINE_DASH_GAP],
      opacity: 1,
    };
    customPaintStyles[GRID_VERTICAL_PAINT_ID] = {
      color: chartSettings.grid.verticalColor,
      dash: [GRID_LINE_DASH_LENGTH, GRID_LINE_DASH_GAP],
      opacity: 1,
    };
    customPaintStyles[CROSSHAIR_PAINT_ID] = {
      color: chartSettings.crossLine.color,
      dash:
        chartSettings.crossLine.style === 'dashed'
          ? [CROSSHAIR_LINE_DASH_LENGTH, CROSSHAIR_LINE_DASH_GAP]
          : undefined,
      opacity: CROSSHAIR_LINE_OPACITY,
    };
    appendTradingViewNativePrimarySeriesPaintStyles({
      chartSettings,
      customPaintStyles,
    });
    for (const direction of ['up', 'down'] as const) {
      const colorKey = direction === 'up' ? 'upColor' : 'downColor';
      customPaintStyles[LATEST_PRICE_LINE_PAINT_IDS[direction]] = {
        color: chartSettings.latestPriceLine[colorKey],
        dash:
          chartSettings.latestPriceLine.style === 'dashed'
            ? [CURRENT_PRICE_LINE_DASH_LENGTH, CURRENT_PRICE_LINE_DASH_GAP]
            : undefined,
        opacity: 1,
      };
      customPaintStyles[LATEST_PRICE_LABEL_PAINT_IDS[direction]] = {
        color: chartSettings.latestPriceLine[colorKey],
        opacity: 1,
      };
    }
  }
  const backgroundRect = { height, width, x: 0, y: 0 };
  const commands: ITradingViewNativeChartSceneCommand[] =
    chartSettings?.background.style === 'gradient'
      ? [
          {
            colors: [...chartSettings.background.colors],
            kind: 'linearGradientRect',
            rect: backgroundRect,
          },
        ]
      : [
          {
            ...backgroundRect,
            customPaintId: chartSettings ? BACKGROUND_PAINT_ID : undefined,
            kind: 'rect',
            paint: 'background',
          },
        ];
  const watermarkRect = getTradingViewNativeWatermarkLayout({
    canvasWidth: width,
    mainChartBottom: subIndicatorPaneStackLayout.top,
  });
  if (watermarkRect) {
    commands.push({
      kind: 'watermark',
      opacity: watermarkOpacity,
      rect: watermarkRect,
    });
  }

  const normalizedViewport = {
    ...(viewport.initialRightOffset
      ? { initialRightOffset: viewport.initialRightOffset }
      : {}),
    ...(viewport.initialRightOffsetResolved
      ? { initialRightOffsetResolved: true as const }
      : {}),
    offset,
    zoomScale,
  };
  const emptyScene = {
    autoPriceRange: null,
    commands,
    crosshairPointIndex: null,
    customPaintStyles,
    priceAxisWidth: resolvedPriceAxisWidth,
    subIndicatorLegendHitRegions: [],
    viewport: normalizedViewport,
    visiblePointRange,
  };
  if (!points.length || chartWidth <= 0) {
    return emptyScene;
  }

  const layout = getTradingViewNativeChartLayout({
    additionalPriceRange: getTradingViewNativeIndicatorPriceRange({
      ...visiblePointRange,
      series: indicatorSeries,
    }),
    candleIntervalSeconds,
    chartType,
    contentBottomInset: subIndicatorPaneStackHeight,
    hasVolume,
    height,
    minimumTimeTickIndexSpacing:
      getTradingViewNativeTimeTickMinimumIndexSpacing(
        TRADING_VIEW_NATIVE_CANDLE_STEP * zoomScale,
      ),
    points,
    pinnedPriceRange,
    priceAxisWidth: resolvedPriceAxisWidth,
    priceAxisTickCount,
    timeAxisHeight,
    priceRangeScale,
    priceScaleMode,
    visiblePointRange,
    width,
  });
  if (!layout) {
    return emptyScene;
  }

  const {
    mainChartBottom,
    maxPrice,
    maxVolume,
    minPrice,
    priceAxisX,
    priceChartHeight,
    priceScaleMode: resolvedPriceScaleMode,
    priceTicks,
    timeAxisY,
    timeTicks,
    volumeBottom,
    volumeHeight,
    volumeTicks,
    volumeTop,
  } = layout;
  const subIndicatorLayouts = getTradingViewNativeSubIndicatorPaneLayouts({
    endIndex: visiblePointRange.endIndex,
    panes: visibleSubIndicatorPanes,
    stackBottom: subIndicatorPaneStackLayout.bottom,
    stackTop: subIndicatorPaneStackLayout.top,
    startIndex: visiblePointRange.startIndex,
  });
  const getPointX = (index: number) =>
    getTradingViewNativeCandleX({
      index,
      initialRightOffset: viewport.initialRightOffset,
      offset,
      pointCount: points.length,
      priceAxisX,
      zoomScale,
    });
  const chartClip = {
    height,
    width: chartWidth,
    x: CHART_HORIZONTAL_PADDING,
    y: 0,
  };
  const mainChartClip = {
    height: mainChartBottom,
    width,
    x: 0,
    y: 0,
  };

  commands.push({
    kind: 'line',
    paint: 'gridSolidLine',
    x1: CHART_HORIZONTAL_PADDING,
    x2: extendTimeAxisBorderToCanvasEdge ? width : priceAxisX,
    y1: timeAxisY,
    y2: timeAxisY,
  });
  for (const { price, y } of priceTicks) {
    const text = formatTradingViewNativePriceTick(price);
    if (showHorizontalGrid) {
      commands.push({
        ...(chartSettings ? { customPaintId: GRID_HORIZONTAL_PAINT_ID } : {}),
        kind: 'line',
        paint: 'gridLine',
        x1: CHART_HORIZONTAL_PADDING,
        x2: priceAxisX + 4,
        y1: y,
        y2: y,
      });
    }
    if (showYAxis) {
      commands.push({
        font: 'priceAxis',
        kind: 'text',
        paint: 'axisText',
        text,
        x: priceAxisX + PRICE_AXIS_LABEL_LEFT_PADDING,
        y: y + priceAxisFontSize / 2 + PRICE_AXIS_TEXT_BASELINE_OFFSET,
      });
    }
  }
  for (const { volume, y } of volumeTicks) {
    const text = formatTradingViewNativeVolume(volume);
    if (showHorizontalGrid) {
      commands.push({
        ...(chartSettings ? { customPaintId: GRID_HORIZONTAL_PAINT_ID } : {}),
        kind: 'line',
        paint: 'gridLine',
        x1: CHART_HORIZONTAL_PADDING,
        x2: priceAxisX + 4,
        y1: y,
        y2: y,
      });
    }
    if (showYAxis) {
      commands.push({
        font: 'priceAxis',
        kind: 'text',
        paint: 'axisText',
        text,
        x: priceAxisX + PRICE_AXIS_LABEL_LEFT_PADDING,
        y: y + priceAxisFontSize / 2 + PRICE_AXIS_TEXT_BASELINE_OFFSET,
      });
    }
  }

  commands.push({ kind: 'clip', rect: chartClip });
  const timeTextY = timeAxisY + (timeAxisHeight + timeAxisFontSize) / 2;
  for (const tick of timeTicks) {
    const x = getPointX(tick.index);
    if (showVerticalGrid) {
      commands.push({
        ...(chartSettings ? { customPaintId: GRID_VERTICAL_PAINT_ID } : {}),
        kind: 'line',
        paint: 'gridLine',
        x1: x,
        x2: x,
        y1: 0,
        y2: timeAxisY,
      });
    }
    commands.push({
      font: 'axis',
      kind: 'text',
      paint: 'axisText',
      text: tick.label,
      x: x - measureTextWidth(tick.label, 'axis') / 2,
      y: timeTextY,
    });
  }
  commands.push({ kind: 'restore' });

  const candleBodyWidth = TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH * zoomScale;
  commands.push({
    kind: 'clip',
    rect: {
      height: mainChartBottom,
      width: chartWidth,
      x: CHART_HORIZONTAL_PADDING,
      y: 0,
    },
  });
  appendIndicatorFillCommands({
    commands,
    customPaintStyles,
    endIndex: visiblePointRange.endIndex,
    getPointX,
    indicatorSeries,
    layout,
    startIndex: visiblePointRange.startIndex,
  });
  appendTradingViewNativePrimarySeriesCommands({
    candleBodyWidth,
    chartSettings,
    commands,
    getPointX,
    layout,
    points,
    primarySeries,
    visiblePointRange,
  });
  for (
    let index = visiblePointRange.startIndex;
    index < visiblePointRange.endIndex;
    index += 1
  ) {
    const point = points[index];
    if (point) {
      const paint = isTradingViewNativePriceUp(point) ? 'up' : 'down';
      const volumeBarHeight = getTradingViewNativeVolumeBarHeight({
        maxVolume,
        volume: point.v,
        volumeHeight,
      });
      if (volumeBarHeight > 0) {
        const renderedVolumeBarHeight = Math.max(volumeBarHeight, 1);
        commands.push({
          height: renderedVolumeBarHeight,
          kind: 'rect',
          paint: paint === 'up' ? 'upVolume' : 'downVolume',
          width: candleBodyWidth,
          x: getPointX(index) - candleBodyWidth / 2,
          y: volumeBottom - renderedVolumeBarHeight,
        });
      }
    }
  }
  appendIndicatorCommands({
    commands,
    customPaintStyles,
    endIndex: visiblePointRange.endIndex,
    getPointX,
    indicatorSeries,
    layout,
    startIndex: visiblePointRange.startIndex,
  });
  commands.push({ kind: 'restore' });

  appendTradingViewNativeSubIndicatorCommands({
    candleBodyWidth,
    chartWidth,
    commands,
    customPaintStyles,
    endIndex: visiblePointRange.endIndex,
    getPointX,
    layouts: subIndicatorLayouts,
    priceAxisX,
    startIndex: visiblePointRange.startIndex,
  });

  const visiblePriceExtrema =
    primarySeries.priceSource === 'close'
      ? null
      : getTradingViewNativePriceExtrema({
          ...visiblePointRange,
          points,
        });
  if (visiblePriceExtrema) {
    commands.push({ kind: 'clip', rect: mainChartClip });
    const extrema = visiblePriceExtrema.low
      ? [visiblePriceExtrema.high, visiblePriceExtrema.low]
      : [visiblePriceExtrema.high];
    const pointRadius = candleBodyWidth / 2;
    for (const extremum of extrema) {
      const anchorX = getPointX(extremum.index);
      const isPointVisible =
        anchorX >= CHART_HORIZONTAL_PADDING - pointRadius &&
        anchorX <= priceAxisX + pointRadius;
      if (isPointVisible) {
        const text = formatTradingViewNativePriceTick(extremum.price);
        const horizontalLayout =
          getTradingViewNativePriceExtremumHorizontalLayout({
            anchorX,
            canvasWidth: width,
            textWidth: measureTextWidth(text, 'legend'),
          });
        const y = getTradingViewNativePriceY(extremum.price, layout);
        commands.push(
          {
            kind: 'line',
            paint: 'axisText',
            x1: anchorX,
            x2: horizontalLayout.lineEndX,
            y1: y,
            y2: y,
          },
          {
            font: 'legend',
            kind: 'text',
            paint: 'axisText',
            text,
            x: horizontalLayout.textX,
            y: y + LEGEND_FONT_SIZE / 2 - 1,
          },
        );
      }
    }
    commands.push({ kind: 'restore' });
  }

  const crosshairPointIndex =
    crosshair.visible && (chartSettings?.options.crossLine ?? true)
      ? getTradingViewNativePointIndexAtX({
          initialRightOffset: viewport.initialRightOffset,
          offset,
          pointCount: points.length,
          priceAxisX,
          x: crosshair.x,
          zoomScale,
        })
      : null;
  const crosshairPoint =
    crosshairPointIndex === null ? null : points[crosshairPointIndex];
  const crosshairX =
    crosshairPointIndex === null ? null : getPointX(crosshairPointIndex);
  const crosshairY =
    crosshairX === null ? null : Math.min(Math.max(crosshair.y, 0), timeAxisY);
  if (crosshairX !== null && crosshairY !== null) {
    commands.push(
      {
        kind: 'clip',
        rect: {
          height: timeAxisY,
          width: chartWidth,
          x: CHART_HORIZONTAL_PADDING,
          y: 0,
        },
      },
      {
        ...(chartSettings ? { customPaintId: CROSSHAIR_PAINT_ID } : {}),
        kind: 'line',
        paint: 'crosshairLine',
        x1: crosshairX,
        x2: crosshairX,
        y1: 0,
        y2: timeAxisY,
      },
      {
        ...(chartSettings ? { customPaintId: CROSSHAIR_PAINT_ID } : {}),
        kind: 'line',
        paint: 'crosshairLine',
        x1: CHART_HORIZONTAL_PADDING,
        x2: priceAxisX,
        y1: crosshairY,
        y2: crosshairY,
      },
      { kind: 'restore' },
    );
  }

  const latestPointIndex = points.length - 1;
  const latestPoint = points[latestPointIndex];
  const legendPointIndex = crosshairPointIndex ?? latestPointIndex;
  const legendPoint = points[legendPointIndex] ?? latestPoint;
  const previousLegendPoint =
    legendPointIndex > 0 ? points[legendPointIndex - 1] : undefined;
  const legend = getTradingViewNativeChartLegend(
    crosshairPoint ?? legendPoint,
    candleLabels,
    chartType,
    previousLegendPoint?.c,
  );
  const trendValuePaint: ITradingViewNativeChartScenePaint = legend.isUp
    ? 'up'
    : 'down';
  const legendValuePaint: ITradingViewNativeChartScenePaint =
    primarySeries.colorRole === 'directional'
      ? trendValuePaint
      : primarySeries.colorRole;
  const measureLegendTextWidth = (text: string) =>
    measureTextWidth(text, 'legend');
  const appendLegendRows = (
    layouts: ITradingViewNativeChartLegendRowLayout[],
  ) => {
    for (const rowLayout of layouts) {
      appendLegendCommands({
        commands,
        layout: rowLayout,
        trendValuePaint,
        valuePaint: legendValuePaint,
      });
    }
  };
  if (showLegend) {
    const priceLegendLayouts = getTradingViewNativeChartLegendRowLayouts({
      items:
        chartSettings?.options.priceChange === false
          ? legend.priceItems.filter((item) => item.valueColorRole !== 'trend')
          : legend.priceItems,
      maxX: priceAxisX,
      measureTextWidth: measureLegendTextWidth,
      top: PRICE_LEGEND_TOP,
    });
    appendLegendRows(priceLegendLayouts);
    let mainIndicatorLegendTop =
      PRICE_LEGEND_TOP +
      priceLegendLayouts.reduce(
        (legendHeight, row) => legendHeight + row.backgroundRect.height,
        0,
      );
    for (const indicator of ['MA', 'EMA'] as const) {
      const items = indicatorSeries.flatMap((series) => {
        const value = series.values[legendPointIndex];
        return series.indicator === indicator &&
          series.legendLabel &&
          value !== null &&
          value !== undefined &&
          Number.isFinite(value) &&
          series.style
          ? [
              {
                customPaintId: `${getMainIndicatorPaintId(series)}:legend`,
                label: series.legendLabel,
                value: formatTradingViewNativePriceTick(value),
              },
            ]
          : [];
      });
      const layouts = getTradingViewNativeChartLegendRowLayouts({
        items,
        maxX: priceAxisX,
        measureTextWidth: measureLegendTextWidth,
        top: mainIndicatorLegendTop,
      });
      appendLegendRows(layouts);
      mainIndicatorLegendTop += layouts.reduce(
        (legendHeight, row) => legendHeight + row.backgroundRect.height,
        0,
      );
    }
    if (hasVolume) {
      appendLegendRows(
        getTradingViewNativeChartLegendRowLayouts({
          items: [legend.volumeItem],
          maxX: priceAxisX,
          measureTextWidth: measureLegendTextWidth,
          top: volumeTop + VOLUME_LEGEND_TOP_PADDING,
        }),
      );
    }
  }

  const chartComponentCommandLayers =
    appendTradingViewNativeChartComponentCommands({
      commands,
      components: chartComponents,
      customPaintStyles,
      maxPrice,
      measureTextWidth,
      minPrice,
      priceAxisX,
      priceChartHeight,
      priceScaleMode: resolvedPriceScaleMode,
      showYAxis,
      width,
    });

  const currentPriceLayout = getTradingViewNativeCurrentPriceLayout({
    labelHeight: CURRENT_PRICE_LABEL_HEIGHT,
    maxPrice,
    minPrice,
    price: latestPoint.c,
    priceChartHeight,
    priceScaleMode: resolvedPriceScaleMode,
  });
  const currentPriceLabelCommands: ITradingViewNativeChartSceneCommand[] = [];
  if (currentPriceLayout && (chartSettings?.options.latestPrice ?? true)) {
    const direction = isTradingViewNativePriceUp(latestPoint) ? 'up' : 'down';
    commands.push({
      ...(chartSettings
        ? { customPaintId: LATEST_PRICE_LINE_PAINT_IDS[direction] }
        : {}),
      kind: 'line',
      paint: direction === 'up' ? 'upCurrentPriceLine' : 'downCurrentPriceLine',
      x1: CHART_HORIZONTAL_PADDING,
      x2: priceAxisX,
      y1: currentPriceLayout.lineY,
      y2: currentPriceLayout.lineY,
    });
    if (showYAxis) {
      currentPriceLabelCommands.push(
        {
          ...(chartSettings
            ? { customPaintId: LATEST_PRICE_LABEL_PAINT_IDS[direction] }
            : {}),
          height: CURRENT_PRICE_LABEL_HEIGHT,
          kind: 'rect',
          paint: direction,
          width: width - priceAxisX,
          x: priceAxisX,
          y: currentPriceLayout.labelTop,
        },
        {
          font: 'priceAxis',
          kind: 'text',
          paint: 'currentPriceLabelText',
          text: resolvedCurrentPriceLabel,
          x: priceAxisX + PRICE_AXIS_LABEL_LEFT_PADDING,
          y:
            currentPriceLayout.labelTop +
            CURRENT_PRICE_LABEL_HEIGHT / 2 +
            priceAxisFontSize / 2 +
            PRICE_AXIS_TEXT_BASELINE_OFFSET,
        },
      );
    }
  }

  commands.push(
    ...chartComponentCommandLayers.priceLabelCommands,
    ...currentPriceLabelCommands,
    ...chartComponentCommandLayers.textLabelCommands,
  );

  if (crosshairPoint && crosshairX !== null && crosshairY !== null) {
    const crosshairPrice = getTradingViewNativePriceAtY({
      maxPrice,
      minPrice,
      priceChartHeight,
      priceScaleMode: resolvedPriceScaleMode,
      y: crosshairY,
    });
    const crosshairVolume = getTradingViewNativeVolumeAtY({
      maxVolume,
      volumeBottom,
      volumeHeight,
      volumeTop,
      y: crosshairY,
    });
    let crosshairValueText: string | null = null;
    if (crosshairPrice !== null) {
      crosshairValueText = formatTradingViewNativePriceTick(crosshairPrice);
    } else if (crosshairVolume !== null) {
      crosshairValueText = formatTradingViewNativeVolume(crosshairVolume);
    } else {
      crosshairValueText = getTradingViewNativeSubIndicatorCrosshairValueText({
        layouts: subIndicatorLayouts,
        y: crosshairY,
      });
    }
    if (showYAxis && crosshairValueText !== null) {
      const labelTop = Math.min(
        Math.max(crosshairY - CROSSHAIR_LABEL_HEIGHT / 2, 0),
        timeAxisY - CROSSHAIR_LABEL_HEIGHT,
      );
      commands.push(
        {
          height: CROSSHAIR_LABEL_HEIGHT,
          kind: 'rect',
          paint: 'crosshairLabelBackground',
          width: width - priceAxisX,
          x: priceAxisX,
          y: labelTop,
        },
        {
          font: 'priceAxis',
          kind: 'text',
          paint: 'crosshairLabelText',
          text: crosshairValueText,
          x: priceAxisX + PRICE_AXIS_LABEL_LEFT_PADDING,
          y:
            labelTop +
            CROSSHAIR_LABEL_HEIGHT / 2 +
            priceAxisFontSize / 2 +
            PRICE_AXIS_TEXT_BASELINE_OFFSET,
        },
      );
    }

    const timeLabel = formatTradingViewNativeCrosshairTime(
      crosshairPoint.t,
      candleIntervalSeconds,
    );
    const timeTextWidth = measureTextWidth(timeLabel, 'axis');
    const timeLabelWidth = Math.min(
      timeTextWidth + CROSSHAIR_LABEL_HORIZONTAL_PADDING * 2,
      chartWidth,
    );
    if (timeLabelWidth > 0) {
      const timeLabelLeft = Math.min(
        Math.max(crosshairX - timeLabelWidth / 2, CHART_HORIZONTAL_PADDING),
        Math.max(priceAxisX - timeLabelWidth, CHART_HORIZONTAL_PADDING),
      );
      const timeLabelTop =
        timeAxisY + (timeAxisHeight - CROSSHAIR_LABEL_HEIGHT) / 2;
      commands.push(
        {
          height: CROSSHAIR_LABEL_HEIGHT,
          kind: 'rect',
          paint: 'crosshairLabelBackground',
          width: timeLabelWidth,
          x: timeLabelLeft,
          y: timeLabelTop,
        },
        {
          font: 'axis',
          kind: 'text',
          paint: 'crosshairLabelText',
          text: timeLabel,
          x: timeLabelLeft + (timeLabelWidth - timeTextWidth) / 2,
          y:
            timeLabelTop +
            CROSSHAIR_LABEL_HEIGHT / 2 +
            timeAxisFontSize / 2 -
            1,
        },
      );
    }
  }

  const subIndicatorLegendHitRegions =
    appendTradingViewNativeSubIndicatorLegendCommands({
      commands,
      layouts: subIndicatorLayouts,
      measureTextWidth,
      pointIndex: legendPointIndex,
      priceAxisX,
    });

  return {
    autoPriceRange: layout.autoPriceRange,
    commands,
    crosshairPointIndex,
    customPaintStyles,
    priceAxisWidth: resolvedPriceAxisWidth,
    subIndicatorLegendHitRegions,
    viewport: normalizedViewport,
    visiblePointRange,
  };
}
