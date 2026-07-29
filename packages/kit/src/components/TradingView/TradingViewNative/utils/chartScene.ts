import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

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
  TRADING_VIEW_NATIVE_LEGEND_BACKGROUND_OPACITY as LEGEND_BACKGROUND_OPACITY,
  TRADING_VIEW_NATIVE_LEGEND_FONT_SIZE as LEGEND_FONT_SIZE,
  TRADING_VIEW_NATIVE_PRICE_AXIS_LABEL_RIGHT_PADDING as PRICE_AXIS_LABEL_RIGHT_PADDING,
  TRADING_VIEW_NATIVE_PRICE_LEGEND_TOP as PRICE_LEGEND_TOP,
  TRADING_VIEW_NATIVE_TIME_AXIS_HEIGHT as TIME_AXIS_HEIGHT,
  TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH,
  TRADING_VIEW_NATIVE_CANDLE_STEP,
  TRADING_VIEW_NATIVE_CANDLE_WICK_WIDTH,
  TRADING_VIEW_NATIVE_LINE_POINT_RADIUS,
  TRADING_VIEW_NATIVE_LINE_WIDTH,
  TRADING_VIEW_NATIVE_VOLUME_LEGEND_TOP_PADDING as VOLUME_LEGEND_TOP_PADDING,
  TRADING_VIEW_NATIVE_VOLUME_OPACITY as VOLUME_OPACITY,
} from '../chartConstants';

import {
  formatTradingViewNativeCrosshairTime,
  formatTradingViewNativePriceTick,
  getTradingViewNativeChartLayout,
  getTradingViewNativeChartWidth,
  getTradingViewNativeCurrentPriceLayout,
  getTradingViewNativePriceAtY,
  getTradingViewNativePriceExtremumHorizontalLayout,
  getTradingViewNativePriceY,
  getTradingViewNativeTimeTickMinimumIndexSpacing,
  getTradingViewNativeVolumeBarHeight,
  getTradingViewNativeWatermarkLayout,
} from './chartLayout';
import {
  type ITradingViewNativeChartLegendRowLayout,
  getTradingViewNativeChartLegend,
  getTradingViewNativeChartLegendRowLayouts,
} from './chartLegend';
import { isTradingViewNativePriceUp } from './chartStyle';
import {
  type ITradingViewNativeVisiblePointRange,
  clampTradingViewNativePanOffset,
  clampTradingViewNativeZoomScale,
  getTradingViewNativeCandleX,
  getTradingViewNativePointIndexAtX,
  getTradingViewNativePriceExtrema,
  getTradingViewNativeVisiblePointRange,
} from './chartViewport';

import type {
  ITradingViewNativeChartRuntimeCrosshair,
  ITradingViewNativeChartRuntimeViewport,
} from './chartRuntime';
import type { ITradingViewNativeChartType } from '../types';

export type ITradingViewNativeChartSceneFont = 'axis' | 'legend';

export type ITradingViewNativeChartScenePaint =
  | 'axisText'
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
  | 'upVolume';

export interface ITradingViewNativeChartSceneColors {
  axisText: string;
  background: string;
  down?: string;
  grid: string;
  line: string;
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
      kind: 'circle';
      paint: ITradingViewNativeChartScenePaint;
      radius: number;
    }
  | {
      height: number;
      kind: 'rect';
      paint: ITradingViewNativeChartScenePaint;
      width: number;
      x: number;
      y: number;
    }
  | {
      kind: 'restore';
    }
  | {
      kind: 'line';
      paint: ITradingViewNativeChartScenePaint;
      x1: number;
      x2: number;
      y1: number;
      y2: number;
    }
  | {
      kind: 'polyline';
      paint: ITradingViewNativeChartScenePaint;
      points: { x: number; y: number }[];
    }
  | {
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
  chartType: ITradingViewNativeChartType;
  crosshair: ITradingViewNativeChartRuntimeCrosshair;
  height: number;
  measureTextWidth: (
    text: string,
    font: ITradingViewNativeChartSceneFont,
  ) => number;
  points: IMarketTokenKLineDataPoint[];
  viewport: ITradingViewNativeChartRuntimeViewport;
  watermarkOpacity: number;
  width: number;
}

export interface ITradingViewNativeChartScene {
  commands: ITradingViewNativeChartSceneCommand[];
  crosshairPointIndex: number | null;
  viewport: ITradingViewNativeChartRuntimeViewport;
  visiblePointRange: ITradingViewNativeVisiblePointRange;
}

export function getTradingViewNativeChartScenePaintStyles({
  axisText,
  background,
  down = CHART_DOWN_COLOR,
  grid,
  line,
  up = CHART_UP_COLOR,
}: ITradingViewNativeChartSceneColors): Record<
  ITradingViewNativeChartScenePaint,
  ITradingViewNativeChartScenePaintStyle
> {
  'worklet';

  return {
    axisText: { color: axisText, opacity: 1 },
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
    gridSolidLine: { color: grid, opacity: 1 },
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

function appendLegendCommands({
  commands,
  layout,
  valuePaint,
}: {
  commands: ITradingViewNativeChartSceneCommand[];
  layout: ITradingViewNativeChartLegendRowLayout | null;
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
    commands.push(
      {
        font: 'legend',
        kind: 'text',
        paint: 'axisText',
        text: segment.label,
        x: segment.labelX,
        y: layout.textBaselineY,
      },
      {
        font: 'legend',
        kind: 'text',
        paint: valuePaint,
        text: segment.value,
        x: segment.valueX,
        y: layout.textBaselineY,
      },
    );
  }
  commands.push({ kind: 'restore' });
}

export function buildTradingViewNativeChartScene({
  candleIntervalSeconds,
  chartType,
  crosshair,
  height,
  measureTextWidth,
  points,
  viewport,
  watermarkOpacity,
  width,
}: IBuildTradingViewNativeChartSceneOptions): ITradingViewNativeChartScene {
  'worklet';

  const chartWidth = getTradingViewNativeChartWidth(width);
  const zoomScale = clampTradingViewNativeZoomScale(viewport.zoomScale);
  const offset = clampTradingViewNativePanOffset({
    chartWidth,
    offset: viewport.offset,
    pointCount: points.length,
    zoomScale,
  });
  const visiblePointRange = getTradingViewNativeVisiblePointRange({
    chartWidth,
    offset,
    pointCount: points.length,
    zoomScale,
  });
  const commands: ITradingViewNativeChartSceneCommand[] = [
    {
      height,
      kind: 'rect',
      paint: 'background',
      width,
      x: 0,
      y: 0,
    },
  ];
  const watermarkRect = getTradingViewNativeWatermarkLayout({ height, width });
  if (watermarkRect) {
    commands.push({
      kind: 'watermark',
      opacity: watermarkOpacity,
      rect: watermarkRect,
    });
  }

  const normalizedViewport = { offset, zoomScale };
  const emptyScene = {
    commands,
    crosshairPointIndex: null,
    viewport: normalizedViewport,
    visiblePointRange,
  };
  if (!points.length || chartWidth <= 0) {
    return emptyScene;
  }

  const layout = getTradingViewNativeChartLayout({
    candleIntervalSeconds,
    chartType,
    height,
    minimumTimeTickIndexSpacing:
      getTradingViewNativeTimeTickMinimumIndexSpacing(
        TRADING_VIEW_NATIVE_CANDLE_STEP * zoomScale,
      ),
    points,
    visiblePointRange,
    width,
  });
  if (!layout) {
    return emptyScene;
  }

  const {
    maxPrice,
    maxVolume,
    minPrice,
    priceAxisX,
    priceChartHeight,
    priceTicks,
    timeAxisY,
    timeTicks,
    volumeBottom,
    volumeHeight,
    volumeTop,
  } = layout;
  const getPointX = (index: number) =>
    getTradingViewNativeCandleX({
      index,
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

  commands.push({
    kind: 'line',
    paint: 'gridSolidLine',
    x1: CHART_HORIZONTAL_PADDING,
    x2: priceAxisX,
    y1: timeAxisY,
    y2: timeAxisY,
  });
  for (const { price, y } of priceTicks) {
    const text = formatTradingViewNativePriceTick(price);
    commands.push(
      {
        kind: 'line',
        paint: 'gridLine',
        x1: CHART_HORIZONTAL_PADDING,
        x2: priceAxisX + 4,
        y1: y,
        y2: y,
      },
      {
        font: 'axis',
        kind: 'text',
        paint: 'axisText',
        text,
        x:
          width -
          PRICE_AXIS_LABEL_RIGHT_PADDING -
          measureTextWidth(text, 'axis'),
        y: y + AXIS_FONT_SIZE / 2 - 1,
      },
    );
  }

  commands.push({ kind: 'clip', rect: chartClip });
  const timeTextY = timeAxisY + (TIME_AXIS_HEIGHT + AXIS_FONT_SIZE) / 2;
  for (const tick of timeTicks) {
    const x = getPointX(tick.index);
    commands.push(
      {
        kind: 'line',
        paint: 'gridLine',
        x1: x,
        x2: x,
        y1: 0,
        y2: timeAxisY,
      },
      {
        font: 'axis',
        kind: 'text',
        paint: 'axisText',
        text: tick.label,
        x: x - measureTextWidth(tick.label, 'axis') / 2,
        y: timeTextY,
      },
    );
  }
  commands.push({ kind: 'restore' });

  const candleBodyWidth = TRADING_VIEW_NATIVE_CANDLE_BODY_WIDTH * zoomScale;
  commands.push({
    kind: 'clip',
    rect: {
      height: timeAxisY,
      width: chartWidth,
      x: CHART_HORIZONTAL_PADDING,
      y: 0,
    },
  });
  if (chartType === 'line') {
    const lineStartIndex = Math.max(visiblePointRange.startIndex - 1, 0);
    const lineEndIndex = Math.min(
      visiblePointRange.endIndex + 1,
      points.length,
    );
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
    for (const segment of lineSegments) {
      commands.push({
        kind: 'polyline',
        paint: 'lineStroke',
        points: segment,
      });
    }

    const latestPointIndex = points.length - 1;
    const latestLinePoint = points[latestPointIndex];
    if (latestLinePoint && Number.isFinite(latestLinePoint.c)) {
      commands.push({
        cx: getPointX(latestPointIndex),
        cy: getTradingViewNativePriceY(latestLinePoint.c, layout),
        kind: 'circle',
        paint: 'line',
        radius: TRADING_VIEW_NATIVE_LINE_POINT_RADIUS,
      });
    }
  } else {
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
            height: Math.max(lowY - highY, 1),
            kind: 'rect',
            paint,
            width: TRADING_VIEW_NATIVE_CANDLE_WICK_WIDTH,
            x: x - TRADING_VIEW_NATIVE_CANDLE_WICK_WIDTH / 2,
            y: highY,
          },
          {
            height: Math.max(Math.abs(closeY - openY), 1),
            kind: 'rect',
            paint,
            width: candleBodyWidth,
            x: x - candleBodyWidth / 2,
            y: Math.min(openY, closeY),
          },
        );
      }
    }
  }
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
  commands.push({ kind: 'restore' });

  const visiblePriceExtrema =
    chartType === 'candlestick'
      ? getTradingViewNativePriceExtrema({
          ...visiblePointRange,
          chartType,
          points,
        })
      : null;
  if (visiblePriceExtrema) {
    const extrema = visiblePriceExtrema.low
      ? [visiblePriceExtrema.high, visiblePriceExtrema.low]
      : [visiblePriceExtrema.high];
    const pointRadius =
      chartType === 'line'
        ? TRADING_VIEW_NATIVE_LINE_POINT_RADIUS
        : candleBodyWidth / 2;
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
  }

  const crosshairPointIndex = crosshair.visible
    ? getTradingViewNativePointIndexAtX({
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
        kind: 'line',
        paint: 'crosshairLine',
        x1: crosshairX,
        x2: crosshairX,
        y1: 0,
        y2: timeAxisY,
      },
      {
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
    chartType,
    previousLegendPoint?.c,
  );
  let legendValuePaint: ITradingViewNativeChartScenePaint = 'line';
  if (chartType !== 'line') {
    legendValuePaint = legend.isUp ? 'up' : 'down';
  }
  const measureLegendTextWidth = (text: string) =>
    measureTextWidth(text, 'legend');
  const appendLegendRows = (
    layouts: ITradingViewNativeChartLegendRowLayout[],
  ) => {
    for (const rowLayout of layouts) {
      appendLegendCommands({
        commands,
        layout: rowLayout,
        valuePaint: legendValuePaint,
      });
    }
  };
  appendLegendRows(
    getTradingViewNativeChartLegendRowLayouts({
      items: legend.priceItems,
      maxX: priceAxisX,
      measureTextWidth: measureLegendTextWidth,
      top: PRICE_LEGEND_TOP,
    }),
  );
  appendLegendRows(
    getTradingViewNativeChartLegendRowLayouts({
      items: [legend.volumeItem],
      maxX: priceAxisX,
      measureTextWidth: measureLegendTextWidth,
      top: volumeTop + VOLUME_LEGEND_TOP_PADDING,
    }),
  );

  const currentPriceLayout = getTradingViewNativeCurrentPriceLayout({
    labelHeight: CURRENT_PRICE_LABEL_HEIGHT,
    maxPrice,
    minPrice,
    price: latestPoint.c,
    priceChartHeight,
  });
  if (currentPriceLayout) {
    const isUp = isTradingViewNativePriceUp(latestPoint);
    const text = formatTradingViewNativePriceTick(latestPoint.c);
    commands.push(
      {
        kind: 'line',
        paint: isUp ? 'upCurrentPriceLine' : 'downCurrentPriceLine',
        x1: CHART_HORIZONTAL_PADDING,
        x2: priceAxisX,
        y1: currentPriceLayout.lineY,
        y2: currentPriceLayout.lineY,
      },
      {
        height: CURRENT_PRICE_LABEL_HEIGHT,
        kind: 'rect',
        paint: isUp ? 'up' : 'down',
        width: width - priceAxisX,
        x: priceAxisX,
        y: currentPriceLayout.labelTop,
      },
      {
        font: 'axis',
        kind: 'text',
        paint: 'currentPriceLabelText',
        text,
        x:
          width -
          PRICE_AXIS_LABEL_RIGHT_PADDING -
          measureTextWidth(text, 'axis'),
        y:
          currentPriceLayout.labelTop +
          CURRENT_PRICE_LABEL_HEIGHT / 2 +
          AXIS_FONT_SIZE / 2 -
          1,
      },
    );
  }

  if (crosshairPoint && crosshairX !== null && crosshairY !== null) {
    const crosshairPrice = getTradingViewNativePriceAtY({
      maxPrice,
      minPrice,
      priceChartHeight,
      y: crosshairY,
    });
    if (crosshairPrice !== null) {
      const text = formatTradingViewNativePriceTick(crosshairPrice);
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
          font: 'axis',
          kind: 'text',
          paint: 'crosshairLabelText',
          text,
          x:
            width -
            PRICE_AXIS_LABEL_RIGHT_PADDING -
            measureTextWidth(text, 'axis'),
          y: labelTop + CROSSHAIR_LABEL_HEIGHT / 2 + AXIS_FONT_SIZE / 2 - 1,
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
        timeAxisY + (TIME_AXIS_HEIGHT - CROSSHAIR_LABEL_HEIGHT) / 2;
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
          y: timeLabelTop + CROSSHAIR_LABEL_HEIGHT / 2 + AXIS_FONT_SIZE / 2 - 1,
        },
      );
    }
  }

  return {
    commands,
    crosshairPointIndex,
    viewport: normalizedViewport,
    visiblePointRange,
  };
}
