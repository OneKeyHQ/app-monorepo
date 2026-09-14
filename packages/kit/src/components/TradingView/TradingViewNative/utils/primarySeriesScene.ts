import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';
import type { ITradingViewNativeChartSettings } from '@onekeyhq/shared/types/tradingViewNative';

import {
  TRADING_VIEW_NATIVE_CANDLE_WICK_WIDTH,
  TRADING_VIEW_NATIVE_LINE_POINT_RADIUS,
} from '../chartConstants';

import { getTradingViewNativePriceY } from './chartLayout';
import { isTradingViewNativePriceUp } from './chartStyle';

import type { ITradingViewNativeChartLayout } from './chartLayout';
import type {
  ITradingViewNativeChartSceneCommand,
  ITradingViewNativeChartScenePaint,
  ITradingViewNativeChartScenePaintStyle,
} from './chartScene';
import type { ITradingViewNativePrimarySeriesModel } from './chartType';
import type { ITradingViewNativeVisiblePointRange } from './chartViewport';

const TRADING_VIEW_NATIVE_CANDLE_BODY_PAINT_IDS = {
  down: 'chart.candle.body.down',
  up: 'chart.candle.body.up',
} as const;
const TRADING_VIEW_NATIVE_CANDLE_BORDER_PAINT_IDS = {
  down: 'chart.candle.border.down',
  up: 'chart.candle.border.up',
} as const;
const TRADING_VIEW_NATIVE_CANDLE_WICK_PAINT_IDS = {
  down: 'chart.candle.wick.down',
  up: 'chart.candle.wick.up',
} as const;

interface ITradingViewNativePrimarySeriesSceneOptions {
  candleBodyWidth: number;
  chartSettings?: ITradingViewNativeChartSettings;
  commands: ITradingViewNativeChartSceneCommand[];
  getPointX: (index: number) => number;
  layout: ITradingViewNativeChartLayout;
  points: IMarketTokenKLineDataPoint[];
  primarySeries: ITradingViewNativePrimarySeriesModel;
  visiblePointRange: ITradingViewNativeVisiblePointRange;
}

export function appendTradingViewNativePrimarySeriesPaintStyles({
  chartSettings,
  customPaintStyles,
}: {
  chartSettings: ITradingViewNativeChartSettings;
  customPaintStyles: Record<string, ITradingViewNativeChartScenePaintStyle>;
}): void {
  'worklet';

  for (const direction of ['up', 'down'] as const) {
    const colorKey = direction === 'up' ? 'upColor' : 'downColor';
    customPaintStyles[TRADING_VIEW_NATIVE_CANDLE_BODY_PAINT_IDS[direction]] = {
      color: chartSettings.candles.body[colorKey],
      opacity: 1,
    };
    customPaintStyles[TRADING_VIEW_NATIVE_CANDLE_BORDER_PAINT_IDS[direction]] =
      {
        color: chartSettings.candles.border[colorKey],
        drawStyle: 'stroke',
        opacity: 1,
        strokeWidth: 1,
      };
    customPaintStyles[TRADING_VIEW_NATIVE_CANDLE_WICK_PAINT_IDS[direction]] = {
      color: chartSettings.candles.wick[colorKey],
      opacity: 1,
    };
  }
}

function appendTradingViewNativeLineSeriesCommands({
  commands,
  getPointX,
  layout,
  points,
  primarySeries,
  visiblePointRange,
}: ITradingViewNativePrimarySeriesSceneOptions) {
  'worklet';

  const lineStartIndex = Math.max(visiblePointRange.startIndex - 1, 0);
  const lineEndIndex = Math.min(visiblePointRange.endIndex + 1, points.length);
  const lineSegments: { x: number; y: number }[][] = [];
  let linePoints: { x: number; y: number }[] = [];
  for (let index = lineStartIndex; index < lineEndIndex; index += 1) {
    const point = points[index];
    if (point && Number.isFinite(point.c)) {
      linePoints.push({
        x: getPointX(index),
        y: getTradingViewNativePriceY(point.c, layout),
      });
    } else {
      if (linePoints.length > 1) {
        lineSegments.push(linePoints);
      }
      linePoints = [];
    }
  }
  if (linePoints.length > 1) {
    lineSegments.push(linePoints);
  }

  if (primarySeries.fillArea) {
    const areaBottomY = getTradingViewNativePriceY(layout.minPrice, layout);
    for (const segment of lineSegments) {
      const firstPoint = segment[0];
      const lastPoint = segment[segment.length - 1];
      if (firstPoint && lastPoint) {
        commands.push({
          kind: 'polygon',
          paint: 'areaFill',
          points: [
            { x: firstPoint.x, y: areaBottomY },
            ...segment,
            { x: lastPoint.x, y: areaBottomY },
          ],
        });
      }
    }
  }
  for (const segment of lineSegments) {
    commands.push({
      kind: 'polyline',
      paint: primarySeries.colorRole === 'up' ? 'areaStroke' : 'lineStroke',
      points: segment,
    });
  }

  const latestPointIndex = points.length - 1;
  const latestPoint = points[latestPointIndex];
  if (latestPoint && Number.isFinite(latestPoint.c)) {
    commands.push({
      cx: getPointX(latestPointIndex),
      cy: getTradingViewNativePriceY(latestPoint.c, layout),
      kind: 'circle',
      paint: primarySeries.colorRole === 'up' ? 'up' : 'line',
      radius: TRADING_VIEW_NATIVE_LINE_POINT_RADIUS,
    });
  }
}

function appendTradingViewNativeBarSeriesCommands({
  candleBodyWidth,
  commands,
  getPointX,
  layout,
  points,
  visiblePointRange,
}: ITradingViewNativePrimarySeriesSceneOptions) {
  'worklet';

  const barTickWidth = Math.max(candleBodyWidth / 2, 1);
  for (
    let index = visiblePointRange.startIndex;
    index < visiblePointRange.endIndex;
    index += 1
  ) {
    const point = points[index];
    if (point) {
      const paint = isTradingViewNativePriceUp(point) ? 'up' : 'down';
      const x = getPointX(index);
      const openY = getTradingViewNativePriceY(point.o, layout);
      const highY = getTradingViewNativePriceY(point.h, layout);
      const lowY = getTradingViewNativePriceY(point.l, layout);
      const closeY = getTradingViewNativePriceY(point.c, layout);
      commands.push(
        {
          kind: 'line',
          paint,
          x1: x,
          x2: x,
          y1: highY,
          y2: lowY,
        },
        {
          kind: 'line',
          paint,
          x1: x - barTickWidth,
          x2: x,
          y1: openY,
          y2: openY,
        },
        {
          kind: 'line',
          paint,
          x1: x,
          x2: x + barTickWidth,
          y1: closeY,
          y2: closeY,
        },
      );
    }
  }
}

function appendTradingViewNativeCandleSeriesCommands({
  candleBodyWidth,
  chartSettings,
  commands,
  getPointX,
  layout,
  points,
  visiblePointRange,
}: ITradingViewNativePrimarySeriesSceneOptions) {
  'worklet';

  for (
    let index = visiblePointRange.startIndex;
    index < visiblePointRange.endIndex;
    index += 1
  ) {
    const point = points[index];
    if (point) {
      const direction = isTradingViewNativePriceUp(point) ? 'up' : 'down';
      const paint: ITradingViewNativeChartScenePaint = direction;
      const x = getPointX(index);
      const openY = getTradingViewNativePriceY(point.o, layout);
      const highY = getTradingViewNativePriceY(point.h, layout);
      const lowY = getTradingViewNativePriceY(point.l, layout);
      const closeY = getTradingViewNativePriceY(point.c, layout);
      const colorKey = direction === 'up' ? 'upColor' : 'downColor';
      const candleBodyRect = {
        height: Math.max(Math.abs(closeY - openY), 1),
        width: candleBodyWidth,
        x: x - candleBodyWidth / 2,
        y: Math.min(openY, closeY),
      };
      if (chartSettings?.candles.wick.enabled ?? true) {
        commands.push({
          ...(chartSettings
            ? {
                customPaintId:
                  TRADING_VIEW_NATIVE_CANDLE_WICK_PAINT_IDS[direction],
              }
            : {}),
          height: Math.max(lowY - highY, 1),
          kind: 'rect',
          paint,
          width: TRADING_VIEW_NATIVE_CANDLE_WICK_WIDTH,
          x: x - TRADING_VIEW_NATIVE_CANDLE_WICK_WIDTH / 2,
          y: highY,
        });
      }
      if (chartSettings?.candles.body.enabled ?? true) {
        commands.push({
          ...candleBodyRect,
          ...(chartSettings
            ? {
                customPaintId:
                  TRADING_VIEW_NATIVE_CANDLE_BODY_PAINT_IDS[direction],
              }
            : {}),
          kind: 'rect',
          paint,
        });
      }
      const bodyAlreadyDrawsBorderColor = Boolean(
        chartSettings?.candles.body.enabled &&
        chartSettings.candles.body[colorKey] ===
          chartSettings.candles.border[colorKey],
      );
      if (
        chartSettings?.candles.border.enabled &&
        !bodyAlreadyDrawsBorderColor
      ) {
        commands.push({
          ...candleBodyRect,
          customPaintId: TRADING_VIEW_NATIVE_CANDLE_BORDER_PAINT_IDS[direction],
          kind: 'rect',
          paint,
        });
      }
    }
  }
}

export function appendTradingViewNativePrimarySeriesCommands(
  options: ITradingViewNativePrimarySeriesSceneOptions,
): void {
  'worklet';

  if (options.primarySeries.renderKind === 'line') {
    appendTradingViewNativeLineSeriesCommands(options);
    return;
  }
  if (options.primarySeries.renderKind === 'bars') {
    appendTradingViewNativeBarSeriesCommands(options);
    return;
  }
  appendTradingViewNativeCandleSeriesCommands(options);
}
