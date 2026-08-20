import {
  TRADING_VIEW_NATIVE_AXIS_FONT_SIZE,
  TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_LEGEND_FONT_SIZE,
  TRADING_VIEW_NATIVE_PRICE_AXIS_LABEL_LEFT_PADDING,
  TRADING_VIEW_NATIVE_PRICE_AXIS_TEXT_BASELINE_OFFSET,
} from '../../chartConstants';

import {
  formatTradingViewNativeSubIndicatorValue,
  getTradingViewNativeSubIndicatorValueAtY,
  getTradingViewNativeSubIndicatorY,
} from './coordinates';
import { getTradingViewNativeSubIndicatorPaneLayoutAtY } from './layout';

import type { ITradingViewNativeSubIndicatorPaneLayout } from './layout';
import type {
  ITradingViewNativeSubIndicatorLineStyle,
  ITradingViewNativeSubIndicatorRenderBand,
  ITradingViewNativeSubIndicatorRenderFill,
  ITradingViewNativeSubIndicatorRenderSeries,
} from './types';
import type {
  ITradingViewNativeChartSceneCommand,
  ITradingViewNativeChartSceneFont,
  ITradingViewNativeChartScenePaintStyle,
} from '../chartScene';

interface ISubIndicatorSceneItem {
  item:
    | ITradingViewNativeSubIndicatorRenderBand
    | ITradingViewNativeSubIndicatorRenderFill
    | ITradingViewNativeSubIndicatorRenderSeries;
  kind: 'band' | 'fill' | 'series';
  order: number;
  zOrder: number;
}

interface IAppendSubIndicatorCommandsOptions {
  candleBodyWidth: number;
  chartWidth: number;
  commands: ITradingViewNativeChartSceneCommand[];
  customPaintStyles: Record<string, ITradingViewNativeChartScenePaintStyle>;
  endIndex: number;
  getPointX: (index: number) => number;
  layouts: readonly ITradingViewNativeSubIndicatorPaneLayout[];
  priceAxisX: number;
  startIndex: number;
}

function getOpacity(transparency: number) {
  'worklet';

  const normalizedTransparency = Number.isFinite(transparency)
    ? Math.min(Math.max(transparency, 0), 100)
    : 0;
  return 1 - normalizedTransparency / 100;
}

function getDash(lineStyle: ITradingViewNativeSubIndicatorLineStyle) {
  'worklet';

  if (lineStyle === 'dashed') {
    return [4, 3] as [number, number];
  }
  if (lineStyle === 'dotted') {
    return [1, 3] as [number, number];
  }
  return undefined;
}

function getStrokePaintStyle({
  color,
  lineStyle,
  lineWidth,
  transparency,
}: {
  color: string;
  lineStyle: ITradingViewNativeSubIndicatorLineStyle;
  lineWidth: number;
  transparency: number;
}): ITradingViewNativeChartScenePaintStyle {
  'worklet';

  return {
    color,
    ...(getDash(lineStyle) ? { dash: getDash(lineStyle) } : {}),
    drawStyle: 'stroke',
    opacity: getOpacity(transparency),
    strokeCap: lineStyle === 'dotted' ? 'round' : 'butt',
    strokeJoin: 'round',
    strokeWidth: Number.isFinite(lineWidth) ? Math.max(lineWidth, 1) : 1,
  };
}

function getFillPaintStyle({
  color,
  transparency,
}: {
  color: string;
  transparency: number;
}): ITradingViewNativeChartScenePaintStyle {
  'worklet';

  return { color, drawStyle: 'fill', opacity: getOpacity(transparency) };
}

function getSeriesPaintId(
  layout: ITradingViewNativeSubIndicatorPaneLayout,
  series: ITradingViewNativeSubIndicatorRenderSeries,
) {
  'worklet';

  return `subIndicator:${layout.pane.key}:series:${series.id}`;
}

function getSeriesPalettePaintId(
  layout: ITradingViewNativeSubIndicatorPaneLayout,
  series: ITradingViewNativeSubIndicatorRenderSeries,
  paletteIndex: number,
) {
  'worklet';

  return `${getSeriesPaintId(layout, series)}:palette:${paletteIndex}`;
}

function getBandPaintId(
  layout: ITradingViewNativeSubIndicatorPaneLayout,
  band: ITradingViewNativeSubIndicatorRenderBand,
) {
  'worklet';

  return `subIndicator:${layout.pane.key}:band:${band.id}`;
}

function getFillPaintId(
  layout: ITradingViewNativeSubIndicatorPaneLayout,
  fill: ITradingViewNativeSubIndicatorRenderFill,
) {
  'worklet';

  return `subIndicator:${layout.pane.key}:fill:${fill.id}`;
}

function registerSeriesPaintStyles({
  customPaintStyles,
  layout,
  series,
}: {
  customPaintStyles: Record<string, ITradingViewNativeChartScenePaintStyle>;
  layout: ITradingViewNativeSubIndicatorPaneLayout;
  series: ITradingViewNativeSubIndicatorRenderSeries;
}) {
  'worklet';

  const style = series.style;
  const isLine = style.type === 'line';
  const seriesPaintId = getSeriesPaintId(layout, series);
  customPaintStyles[seriesPaintId] = isLine
    ? getStrokePaintStyle(style)
    : getFillPaintStyle(style);
  if (isLine) {
    customPaintStyles[`${seriesPaintId}:legend`] = getFillPaintStyle(style);
  }
  const paletteColors = series.palette?.colors ?? [];
  for (let index = 0; index < paletteColors.length; index += 1) {
    const palettePaintId = getSeriesPalettePaintId(layout, series, index);
    const paletteColor = paletteColors[index] ?? style.color;
    customPaintStyles[palettePaintId] = isLine
      ? getStrokePaintStyle({ ...style, color: paletteColor })
      : getFillPaintStyle({
          color: paletteColor,
          transparency: style.transparency,
        });
    if (isLine) {
      customPaintStyles[`${palettePaintId}:legend`] = getFillPaintStyle({
        color: paletteColor,
        transparency: style.transparency,
      });
    }
  }
}

function getSeriesPointPaintId({
  index,
  layout,
  series,
}: {
  index: number;
  layout: ITradingViewNativeSubIndicatorPaneLayout;
  series: ITradingViewNativeSubIndicatorRenderSeries;
}) {
  'worklet';

  const paletteIndex = series.palette?.indexes[index];
  return typeof paletteIndex === 'number' &&
    Number.isInteger(paletteIndex) &&
    paletteIndex >= 0 &&
    paletteIndex < (series.palette?.colors.length ?? 0)
    ? getSeriesPalettePaintId(layout, series, paletteIndex)
    : getSeriesPaintId(layout, series);
}

function appendLineSeriesCommands({
  commands,
  endIndex,
  getPointX,
  layout,
  series,
  startIndex,
}: Pick<
  IAppendSubIndicatorCommandsOptions,
  'commands' | 'endIndex' | 'getPointX' | 'startIndex'
> & {
  layout: ITradingViewNativeSubIndicatorPaneLayout;
  series: ITradingViewNativeSubIndicatorRenderSeries;
}) {
  'worklet';

  if (!layout.range) {
    return;
  }
  const firstIndex = Math.max(startIndex - 1, 0);
  const lastIndex = Math.min(endIndex + 1, series.values.length);
  let linePoints: { x: number; y: number }[] = [];
  let linePaintId: string | null = null;
  const appendLine = () => {
    if (linePoints.length > 1 && linePaintId) {
      commands.push({
        customPaintId: linePaintId,
        kind: 'polyline',
        paint: 'axisText',
        points: linePoints,
      });
    }
    linePoints = [];
    linePaintId = null;
  };
  for (let index = firstIndex; index < lastIndex; index += 1) {
    const value = series.values[index];
    if (value !== null && value !== undefined && Number.isFinite(value)) {
      const point = {
        x: getPointX(index),
        y: getTradingViewNativeSubIndicatorY({
          bottom: layout.plotBottom,
          range: layout.range,
          top: layout.plotTop,
          value,
        }),
      };
      const pointPaintId = getSeriesPointPaintId({ index, layout, series });
      if (linePaintId && linePaintId !== pointPaintId) {
        const previousPoint = linePoints[linePoints.length - 1];
        appendLine();
        if (previousPoint) {
          linePoints.push(previousPoint);
        }
      }
      linePaintId = pointPaintId;
      linePoints.push(point);
    } else if (!series.style.joinPoints) {
      appendLine();
    }
  }
  appendLine();
}

function appendBarSeriesCommands({
  candleBodyWidth,
  commands,
  endIndex,
  getPointX,
  layout,
  series,
  startIndex,
}: Pick<
  IAppendSubIndicatorCommandsOptions,
  'candleBodyWidth' | 'commands' | 'endIndex' | 'getPointX' | 'startIndex'
> & {
  layout: ITradingViewNativeSubIndicatorPaneLayout;
  series: ITradingViewNativeSubIndicatorRenderSeries;
}) {
  'worklet';

  if (!layout.range) {
    return;
  }
  const baselineY = getTradingViewNativeSubIndicatorY({
    bottom: layout.plotBottom,
    range: layout.range,
    top: layout.plotTop,
    value: series.style.baseline,
  });
  const barWidth =
    series.style.type === 'columns'
      ? Math.max(candleBodyWidth, 1)
      : Math.max(series.style.lineWidth, 1);
  const lastIndex = Math.min(endIndex, series.values.length);
  for (let index = Math.max(startIndex, 0); index < lastIndex; index += 1) {
    const value = series.values[index];
    if (value !== null && value !== undefined && Number.isFinite(value)) {
      const valueY = getTradingViewNativeSubIndicatorY({
        bottom: layout.plotBottom,
        range: layout.range,
        top: layout.plotTop,
        value,
      });
      const barHeight = Math.abs(valueY - baselineY);
      if (barHeight > 0) {
        commands.push({
          customPaintId: getSeriesPointPaintId({ index, layout, series }),
          height: Math.max(barHeight, 1),
          kind: 'rect',
          paint: 'axisText',
          width: barWidth,
          x: getPointX(index) - barWidth / 2,
          y: Math.min(valueY, baselineY),
        });
      }
    }
  }
}

function appendPlotFillCommands({
  commands,
  endIndex,
  fill,
  getPointX,
  layout,
  startIndex,
}: Pick<
  IAppendSubIndicatorCommandsOptions,
  'commands' | 'endIndex' | 'getPointX' | 'startIndex'
> & {
  fill: ITradingViewNativeSubIndicatorRenderFill;
  layout: ITradingViewNativeSubIndicatorPaneLayout;
}) {
  'worklet';

  if (!layout.range) {
    return;
  }
  const fromSeries = layout.pane.series.find(
    (series) => series.id === fill.fromId,
  );
  const toSeries = layout.pane.series.find((series) => series.id === fill.toId);
  if (!fromSeries || !toSeries) {
    return;
  }
  const firstIndex = Math.max(startIndex - 1, 0);
  const lastIndex = Math.min(
    endIndex + 1,
    fromSeries.values.length,
    toSeries.values.length,
  );
  let fromPoints: { x: number; y: number }[] = [];
  let toPoints: { x: number; y: number }[] = [];
  const appendPolygon = () => {
    if (fromPoints.length > 1 && toPoints.length === fromPoints.length) {
      const polygonPoints = fromPoints.slice();
      for (let index = toPoints.length - 1; index >= 0; index -= 1) {
        const point = toPoints[index];
        if (point) {
          polygonPoints.push(point);
        }
      }
      commands.push({
        customPaintId: getFillPaintId(layout, fill),
        kind: 'polygon',
        paint: 'axisText',
        points: polygonPoints,
      });
    }
    fromPoints = [];
    toPoints = [];
  };
  for (let index = firstIndex; index < lastIndex; index += 1) {
    const fromValue = fromSeries.values[index];
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
        y: getTradingViewNativeSubIndicatorY({
          bottom: layout.plotBottom,
          range: layout.range,
          top: layout.plotTop,
          value: fromValue,
        }),
      });
      toPoints.push({
        x,
        y: getTradingViewNativeSubIndicatorY({
          bottom: layout.plotBottom,
          range: layout.range,
          top: layout.plotTop,
          value: toValue,
        }),
      });
    } else {
      appendPolygon();
    }
  }
  appendPolygon();
}

function appendSceneItem({
  candleBodyWidth,
  chartWidth,
  commands,
  endIndex,
  getPointX,
  item,
  layout,
  startIndex,
}: Pick<
  IAppendSubIndicatorCommandsOptions,
  | 'candleBodyWidth'
  | 'chartWidth'
  | 'commands'
  | 'endIndex'
  | 'getPointX'
  | 'startIndex'
> & {
  item: ISubIndicatorSceneItem;
  layout: ITradingViewNativeSubIndicatorPaneLayout;
}) {
  'worklet';

  if (!layout.range) {
    return;
  }
  if (item.kind === 'fill') {
    const fill = item.item as ITradingViewNativeSubIndicatorRenderFill;
    if (!fill.style.visible) {
      return;
    }
    if (fill.type === 'plot-plot') {
      appendPlotFillCommands({
        commands,
        endIndex,
        fill,
        getPointX,
        layout,
        startIndex,
      });
      return;
    }
    const fromBand = layout.pane.bands.find((band) => band.id === fill.fromId);
    const toBand = layout.pane.bands.find((band) => band.id === fill.toId);
    if (!fromBand || !toBand) {
      return;
    }
    const fromY = getTradingViewNativeSubIndicatorY({
      bottom: layout.plotBottom,
      range: layout.range,
      top: layout.plotTop,
      value: fromBand.style.value,
    });
    const toY = getTradingViewNativeSubIndicatorY({
      bottom: layout.plotBottom,
      range: layout.range,
      top: layout.plotTop,
      value: toBand.style.value,
    });
    const fillHeight = Math.abs(toY - fromY);
    if (fillHeight > 0) {
      commands.push({
        customPaintId: getFillPaintId(layout, fill),
        height: Math.max(fillHeight, 1),
        kind: 'rect',
        paint: 'axisText',
        width: chartWidth,
        x: TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
        y: Math.min(fromY, toY),
      });
    }
    return;
  }
  if (item.kind === 'band') {
    const band = item.item as ITradingViewNativeSubIndicatorRenderBand;
    if (!band.style.visible) {
      return;
    }
    const y = getTradingViewNativeSubIndicatorY({
      bottom: layout.plotBottom,
      range: layout.range,
      top: layout.plotTop,
      value: band.style.value,
    });
    commands.push({
      customPaintId: getBandPaintId(layout, band),
      kind: 'line',
      paint: 'axisText',
      x1: TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
      x2: TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING + chartWidth,
      y1: y,
      y2: y,
    });
    return;
  }
  const series = item.item as ITradingViewNativeSubIndicatorRenderSeries;
  if (!series.style.visible) {
    return;
  }
  if (series.style.type === 'line') {
    appendLineSeriesCommands({
      commands,
      endIndex,
      getPointX,
      layout,
      series,
      startIndex,
    });
  } else {
    appendBarSeriesCommands({
      candleBodyWidth,
      commands,
      endIndex,
      getPointX,
      layout,
      series,
      startIndex,
    });
  }
}

function getSceneItems(
  layout: ITradingViewNativeSubIndicatorPaneLayout,
): ISubIndicatorSceneItem[] {
  'worklet';

  const items: ISubIndicatorSceneItem[] = [];
  let order = 0;
  for (const fill of layout.pane.fills) {
    items.push({ item: fill, kind: 'fill', order, zOrder: fill.zOrder });
    order += 1;
  }
  for (const band of layout.pane.bands) {
    items.push({ item: band, kind: 'band', order, zOrder: band.zOrder });
    order += 1;
  }
  for (const series of layout.pane.series) {
    items.push({ item: series, kind: 'series', order, zOrder: series.zOrder });
    order += 1;
  }
  for (let index = 1; index < items.length; index += 1) {
    const current = items[index];
    if (current) {
      let insertIndex = index;
      while (insertIndex > 0) {
        const previous = items[insertIndex - 1];
        if (
          !previous ||
          previous.zOrder < current.zOrder ||
          (previous.zOrder === current.zOrder &&
            previous.order <= current.order)
        ) {
          break;
        }
        items[insertIndex] = previous;
        insertIndex -= 1;
      }
      items[insertIndex] = current;
    }
  }
  return items;
}

function appendAxisCommands({
  commands,
  layout,
  priceAxisX,
}: {
  commands: ITradingViewNativeChartSceneCommand[];
  layout: ITradingViewNativeSubIndicatorPaneLayout;
  priceAxisX: number;
}) {
  'worklet';

  if (!layout.range || layout.height < TRADING_VIEW_NATIVE_AXIS_FONT_SIZE + 4) {
    return;
  }
  let tickCount = 1;
  if (layout.height >= 84) {
    tickCount = 3;
  } else if (layout.height >= 36) {
    tickCount = 2;
  }
  for (let index = 0; index < tickCount; index += 1) {
    let progress = 0.5;
    if (tickCount === 2) {
      progress = 0.25 + index * 0.5;
    } else if (tickCount === 3) {
      progress = index / 2;
    }
    const value =
      layout.range.maxValue -
      (layout.range.maxValue - layout.range.minValue) * progress;
    const y = getTradingViewNativeSubIndicatorY({
      bottom: layout.plotBottom,
      range: layout.range,
      top: layout.plotTop,
      value,
    });
    commands.push(
      {
        kind: 'line',
        paint: 'gridLine',
        x1: TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
        x2: priceAxisX + 4,
        y1: y,
        y2: y,
      },
      {
        font: 'priceAxis',
        kind: 'text',
        paint: 'axisText',
        text: formatTradingViewNativeSubIndicatorValue(
          value,
          layout.pane.format,
        ),
        x: priceAxisX + TRADING_VIEW_NATIVE_PRICE_AXIS_LABEL_LEFT_PADDING,
        y:
          y +
          TRADING_VIEW_NATIVE_AXIS_FONT_SIZE / 2 +
          TRADING_VIEW_NATIVE_PRICE_AXIS_TEXT_BASELINE_OFFSET,
      },
    );
  }
}

export function appendTradingViewNativeSubIndicatorCommands({
  candleBodyWidth,
  chartWidth,
  commands,
  customPaintStyles,
  endIndex,
  getPointX,
  layouts,
  priceAxisX,
  startIndex,
}: IAppendSubIndicatorCommandsOptions) {
  'worklet';

  for (const layout of layouts) {
    commands.push({
      kind: 'line',
      paint: 'gridSolidLine',
      x1: TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
      x2: priceAxisX,
      y1: layout.top,
      y2: layout.top,
    });
    appendAxisCommands({ commands, layout, priceAxisX });
    for (const fill of layout.pane.fills) {
      customPaintStyles[getFillPaintId(layout, fill)] = getFillPaintStyle(
        fill.style,
      );
    }
    for (const band of layout.pane.bands) {
      customPaintStyles[getBandPaintId(layout, band)] = getStrokePaintStyle(
        band.style,
      );
    }
    for (const series of layout.pane.series) {
      registerSeriesPaintStyles({ customPaintStyles, layout, series });
    }
    commands.push({
      kind: 'clip',
      rect: {
        height: Math.max(layout.plotBottom - layout.plotTop, 0),
        width: chartWidth,
        x: TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
        y: layout.plotTop,
      },
    });
    for (const item of getSceneItems(layout)) {
      appendSceneItem({
        candleBodyWidth,
        chartWidth,
        commands,
        endIndex,
        getPointX,
        item,
        layout,
        startIndex,
      });
    }
    commands.push({ kind: 'restore' });
  }
}

export function appendTradingViewNativeSubIndicatorLegendCommands({
  commands,
  layouts,
  measureTextWidth,
  pointIndex,
  priceAxisX,
}: {
  commands: ITradingViewNativeChartSceneCommand[];
  layouts: readonly ITradingViewNativeSubIndicatorPaneLayout[];
  measureTextWidth: (
    text: string,
    font: ITradingViewNativeChartSceneFont,
  ) => number;
  pointIndex: number;
  priceAxisX: number;
}) {
  'worklet';

  for (const layout of layouts) {
    if (layout.height >= TRADING_VIEW_NATIVE_LEGEND_FONT_SIZE + 6) {
      const left = TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING + 4;
      const rowHeight = TRADING_VIEW_NATIVE_LEGEND_FONT_SIZE + 2;
      let baselineY = Math.min(layout.top + rowHeight, layout.bottom);
      let x = left;
      commands.push({
        kind: 'clip',
        rect: {
          height: layout.height,
          width: Math.max(
            priceAxisX - TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
            0,
          ),
          x: TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
          y: layout.top,
        },
      });
      commands.push({
        font: 'legend',
        kind: 'text',
        paint: 'axisText',
        text: layout.pane.shortTitle,
        x,
        y: baselineY,
      });
      x += measureTextWidth(layout.pane.shortTitle, 'legend') + 8;
      for (const series of layout.pane.series) {
        const value = series.values[pointIndex];
        if (
          series.style.visible &&
          value !== null &&
          value !== undefined &&
          Number.isFinite(value)
        ) {
          const text = `${series.title} ${formatTradingViewNativeSubIndicatorValue(
            value,
            layout.pane.format,
          )}`;
          const textWidth = measureTextWidth(text, 'legend');
          if (x > left && x + textWidth > priceAxisX) {
            x = left;
            baselineY += rowHeight;
          }
          if (baselineY > layout.bottom) {
            break;
          }
          const pointPaintId = getSeriesPointPaintId({
            index: pointIndex,
            layout,
            series,
          });
          const legendPaintId =
            series.style.type === 'line'
              ? `${pointPaintId}:legend`
              : pointPaintId;
          commands.push({
            customPaintId: legendPaintId,
            font: 'legend',
            kind: 'text',
            paint: 'axisText',
            text,
            x,
            y: baselineY,
          });
          x += textWidth + 8;
        }
      }
      commands.push({ kind: 'restore' });
    }
  }
}

export function getTradingViewNativeSubIndicatorCrosshairValueText({
  layouts,
  y,
}: {
  layouts: readonly ITradingViewNativeSubIndicatorPaneLayout[];
  y: number;
}) {
  'worklet';

  const layout = getTradingViewNativeSubIndicatorPaneLayoutAtY(layouts, y);
  if (!layout?.range) {
    return null;
  }
  const value = getTradingViewNativeSubIndicatorValueAtY({
    bottom: layout.plotBottom,
    range: layout.range,
    top: layout.plotTop,
    y,
  });
  return value === null
    ? null
    : formatTradingViewNativeSubIndicatorValue(value, layout.pane.format);
}
