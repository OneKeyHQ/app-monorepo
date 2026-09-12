import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_LEGEND_BACKGROUND_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_LEGEND_BACKGROUND_VERTICAL_PADDING,
  TRADING_VIEW_NATIVE_LEGEND_FONT_SIZE,
  TRADING_VIEW_NATIVE_LEGEND_HORIZONTAL_PADDING,
  TRADING_VIEW_NATIVE_LEGEND_ITEM_GAP,
  TRADING_VIEW_NATIVE_LEGEND_LABEL_VALUE_GAP,
} from '../chartConstants';

import { formatTradingViewNativePriceTick } from './chartLayout';
import { getTradingViewNativePrimarySeriesModel } from './chartType';

import type {
  ITradingViewNativeCandleLabels,
  ITradingViewNativeChartType,
} from '../types';

export interface ITradingViewNativeLegendItem {
  customPaintId?: string;
  label: string;
  value: string;
  valueColorRole?: 'trend';
}

export interface ITradingViewNativeChartLegend {
  isUp: boolean;
  priceItems: ITradingViewNativeLegendItem[];
  volumeItem: ITradingViewNativeLegendItem;
}

export interface ITradingViewNativeLegendRect {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface ITradingViewNativeLegendTextSegmentLayout extends ITradingViewNativeLegendItem {
  labelX: number;
  textBaselineY?: number;
  valueX: number;
}

export interface ITradingViewNativeChartLegendRowLayout {
  backgroundRect: ITradingViewNativeLegendRect;
  clipRect: ITradingViewNativeLegendRect;
  segments: ITradingViewNativeLegendTextSegmentLayout[];
  textBaselineY: number;
}

export type ITradingViewNativeChartLegendRowLayouts =
  ITradingViewNativeChartLegendRowLayout[];

const VOLUME_UNITS = [
  { divisor: 1_000_000_000_000, suffix: 'T' },
  { divisor: 1_000_000_000, suffix: 'B' },
  { divisor: 1_000_000, suffix: 'M' },
  { divisor: 1000, suffix: 'K' },
] as const;
const WIDEST_COMMON_VOLUME_AXIS_LABEL = '888.888';

function formatPrice(value: number) {
  'worklet';

  return Number.isFinite(value)
    ? formatTradingViewNativePriceTick(value)
    : '--';
}

function expandTradingViewNativeScientificNumber(value: string) {
  'worklet';

  const exponentIndex = value.search(/[eE]/);
  if (exponentIndex < 0) {
    return value;
  }

  const coefficient = value.slice(0, exponentIndex);
  const exponent = Number(value.slice(exponentIndex + 1));
  if (!Number.isInteger(exponent)) {
    return value;
  }
  const sign = coefficient.startsWith('-') ? '-' : '';
  const unsignedCoefficient = sign ? coefficient.slice(1) : coefficient;
  const decimalIndex = unsignedCoefficient.indexOf('.');
  const digits = unsignedCoefficient.replace('.', '');
  const coefficientDecimalIndex =
    decimalIndex < 0 ? digits.length : decimalIndex;
  const targetDecimalIndex = coefficientDecimalIndex + exponent;

  let expanded: string;
  if (targetDecimalIndex <= 0) {
    expanded = `0.${'0'.repeat(-targetDecimalIndex)}${digits}`;
  } else if (targetDecimalIndex >= digits.length) {
    expanded = `${digits}${'0'.repeat(targetDecimalIndex - digits.length)}`;
  } else {
    expanded = `${digits.slice(0, targetDecimalIndex)}.${digits.slice(
      targetDecimalIndex,
    )}`;
  }

  const decimalPointIndex = expanded.indexOf('.');
  if (decimalPointIndex >= 0) {
    let trimmedEnd = expanded.length;
    while (
      trimmedEnd > decimalPointIndex + 1 &&
      expanded[trimmedEnd - 1] === '0'
    ) {
      trimmedEnd -= 1;
    }
    if (trimmedEnd === decimalPointIndex + 1) {
      trimmedEnd = decimalPointIndex;
    }
    expanded = expanded.slice(0, trimmedEnd);
  }

  return `${sign}${expanded}`;
}

function formatTradingViewNativePriceChangeValue(value: number) {
  'worklet';

  if (!Number.isFinite(value)) {
    return '--';
  }
  if (value === 0) {
    return '0';
  }

  if (Math.abs(value) >= 1e-6) {
    return Number(value.toPrecision(6)).toString();
  }

  const preciseValue = value.toPrecision(6);
  return preciseValue.search(/[eE]/) >= 0
    ? expandTradingViewNativeScientificNumber(preciseValue)
    : Number(preciseValue).toString();
}

export function formatTradingViewNativePriceChange({
  close,
  open,
  previousClose,
}: {
  close: number;
  open: number;
  previousClose?: number;
}) {
  'worklet';

  const referencePrice = previousClose ?? open;
  if (
    !Number.isFinite(referencePrice) ||
    !Number.isFinite(close) ||
    referencePrice === 0
  ) {
    return '--';
  }

  const change = close - referencePrice;
  const percentage = (change / referencePrice) * 100;
  if (!Number.isFinite(change) || !Number.isFinite(percentage)) {
    return '--';
  }

  const roundedPercentage = Number(percentage.toFixed(2));
  const changeSign = change > 0 ? '+' : '';
  const percentageSign = roundedPercentage > 0 ? '+' : '';
  return `${changeSign}${formatTradingViewNativePriceChangeValue(
    change,
  )} (${percentageSign}${roundedPercentage.toString()}%)`;
}

export function formatTradingViewNativeVolume(volume: number) {
  'worklet';

  if (!Number.isFinite(volume) || volume < 0) {
    return '--';
  }

  const unit = VOLUME_UNITS.find(({ divisor }) => volume >= divisor);
  if (!unit) {
    return Number(volume.toPrecision(6)).toString();
  }

  const value = Number((volume / unit.divisor).toPrecision(4));
  return `${value}${unit.suffix}`;
}

export function getTradingViewNativeVolumeAxisLabel(
  points: IMarketTokenKLineDataPoint[],
) {
  'worklet';

  let maxVolume = 0;
  let minVolume = Number.POSITIVE_INFINITY;
  for (const point of points) {
    if (Number.isFinite(point.v) && point.v > 0) {
      maxVolume = Math.max(maxVolume, point.v);
      minVolume = Math.min(minVolume, point.v);
    }
  }
  if (maxVolume <= 0) {
    return '';
  }

  const candidateVolumes = [
    minVolume,
    maxVolume / 3,
    maxVolume / 2,
    (maxVolume * 2) / 3,
    maxVolume,
  ];
  let widestLabel = WIDEST_COMMON_VOLUME_AXIS_LABEL;
  for (const volume of candidateVolumes) {
    const label = formatTradingViewNativeVolume(volume);
    if (label.length > widestLabel.length) {
      widestLabel = label;
    }
  }
  return widestLabel;
}

export function getTradingViewNativeChartLegend(
  point: IMarketTokenKLineDataPoint,
  candleLabels: ITradingViewNativeCandleLabels,
  chartType: ITradingViewNativeChartType = 'candlestick',
  previousClose?: number,
): ITradingViewNativeChartLegend {
  'worklet';

  // TradingView compares each close with the prior bar's close and falls back
  // to the current bar's open when there is no prior bar.
  const changeReference = previousClose ?? point.o;
  const priceChangeItem: ITradingViewNativeLegendItem = {
    label: '',
    value: formatTradingViewNativePriceChange({
      close: point.c,
      open: changeReference,
    }),
    valueColorRole: 'trend',
  };
  const primarySeries = getTradingViewNativePrimarySeriesModel(chartType);
  return {
    isUp: point.c >= changeReference,
    priceItems:
      primarySeries.priceSource === 'close'
        ? [{ label: 'Price', value: formatPrice(point.c) }, priceChangeItem]
        : [
            { label: candleLabels.open, value: formatPrice(point.o) },
            { label: candleLabels.high, value: formatPrice(point.h) },
            { label: candleLabels.low, value: formatPrice(point.l) },
            { label: candleLabels.close, value: formatPrice(point.c) },
            priceChangeItem,
          ],
    volumeItem: {
      label: 'Volume',
      value: formatTradingViewNativeVolume(point.v),
    },
  };
}

function getLegendRowLayout({
  items,
  maxX,
  measureTextWidth,
  top,
}: {
  items: ITradingViewNativeLegendItem[];
  maxX: number;
  measureTextWidth: (text: string) => number;
  top: number;
}): ITradingViewNativeChartLegendRowLayout | null {
  'worklet';

  const backgroundLeft = Math.max(
    TRADING_VIEW_NATIVE_LEGEND_HORIZONTAL_PADDING -
      TRADING_VIEW_NATIVE_LEGEND_BACKGROUND_HORIZONTAL_PADDING,
    TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
  );
  const backgroundTop = Math.max(
    top - TRADING_VIEW_NATIVE_LEGEND_BACKGROUND_VERTICAL_PADDING,
    0,
  );
  const clipWidth = Math.max(maxX - backgroundLeft, 0);
  if (!items.length || clipWidth <= 0) {
    return null;
  }

  let x = TRADING_VIEW_NATIVE_LEGEND_HORIZONTAL_PADDING;
  const segments = items.map((item) => {
    const labelX = x;
    const valueX =
      labelX +
      measureTextWidth(item.label) +
      TRADING_VIEW_NATIVE_LEGEND_LABEL_VALUE_GAP;
    x =
      valueX +
      measureTextWidth(item.value) +
      TRADING_VIEW_NATIVE_LEGEND_ITEM_GAP;
    return { ...item, labelX, valueX };
  });
  const contentRight = Math.max(
    x - TRADING_VIEW_NATIVE_LEGEND_ITEM_GAP,
    TRADING_VIEW_NATIVE_LEGEND_HORIZONTAL_PADDING,
  );
  const rowHeight =
    TRADING_VIEW_NATIVE_LEGEND_FONT_SIZE +
    TRADING_VIEW_NATIVE_LEGEND_BACKGROUND_VERTICAL_PADDING * 2;

  return {
    backgroundRect: {
      height: rowHeight,
      width: Math.min(
        contentRight -
          TRADING_VIEW_NATIVE_LEGEND_HORIZONTAL_PADDING +
          TRADING_VIEW_NATIVE_LEGEND_BACKGROUND_HORIZONTAL_PADDING * 2,
        clipWidth,
      ),
      x: backgroundLeft,
      y: backgroundTop,
    },
    clipRect: {
      height: rowHeight,
      width: clipWidth,
      x: backgroundLeft,
      y: backgroundTop,
    },
    segments,
    textBaselineY: top + TRADING_VIEW_NATIVE_LEGEND_FONT_SIZE,
  };
}

export function getTradingViewNativeChartLegendRowLayouts({
  items,
  maxX,
  measureTextWidth,
  top,
}: {
  items: ITradingViewNativeLegendItem[];
  maxX: number;
  measureTextWidth: (text: string) => number;
  top: number;
}): ITradingViewNativeChartLegendRowLayouts {
  'worklet';

  const backgroundLeft = Math.max(
    TRADING_VIEW_NATIVE_LEGEND_HORIZONTAL_PADDING -
      TRADING_VIEW_NATIVE_LEGEND_BACKGROUND_HORIZONTAL_PADDING,
    TRADING_VIEW_NATIVE_CHART_HORIZONTAL_PADDING,
  );
  const clipWidth = Math.max(maxX - backgroundLeft, 0);
  if (!items.length || clipWidth <= 0) {
    return [];
  }
  const clipRight = backgroundLeft + clipWidth;

  const rowHeight =
    TRADING_VIEW_NATIVE_LEGEND_FONT_SIZE +
    TRADING_VIEW_NATIVE_LEGEND_BACKGROUND_VERTICAL_PADDING * 2;
  const rows: ITradingViewNativeLegendItem[][] = [];
  let currentRow: ITradingViewNativeLegendItem[] = [];
  let currentWidth = 0;
  for (const item of items) {
    const itemWidth =
      measureTextWidth(item.label) +
      TRADING_VIEW_NATIVE_LEGEND_LABEL_VALUE_GAP +
      measureTextWidth(item.value);
    const nextWidth =
      currentRow.length === 0
        ? itemWidth
        : currentWidth + TRADING_VIEW_NATIVE_LEGEND_ITEM_GAP + itemWidth;
    if (
      currentRow.length > 0 &&
      TRADING_VIEW_NATIVE_LEGEND_HORIZONTAL_PADDING + nextWidth > clipRight
    ) {
      rows.push(currentRow);
      currentRow = [];
      currentWidth = 0;
    }
    currentRow.push(item);
    currentWidth =
      currentRow.length === 1
        ? itemWidth
        : currentWidth + TRADING_VIEW_NATIVE_LEGEND_ITEM_GAP + itemWidth;
  }
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  const layouts: ITradingViewNativeChartLegendRowLayouts = [];
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    if (row) {
      const rowLayout = getLegendRowLayout({
        items: row,
        maxX,
        measureTextWidth,
        top: top + rowIndex * rowHeight,
      });
      if (rowLayout) {
        layouts.push(rowLayout);
      }
    }
  }
  return layouts;
}

export function getTradingViewNativeChartLegendRowLayout({
  items,
  maxX,
  measureTextWidth,
  top,
}: {
  items: ITradingViewNativeLegendItem[];
  maxX: number;
  measureTextWidth: (text: string) => number;
  top: number;
}): ITradingViewNativeChartLegendRowLayout | null {
  'worklet';

  const layouts = getTradingViewNativeChartLegendRowLayouts({
    items,
    maxX,
    measureTextWidth,
    top,
  });
  const firstLayout = layouts[0];
  if (!firstLayout) {
    return null;
  }
  if (layouts.length === 1) {
    return firstLayout;
  }

  let backgroundBottom =
    firstLayout.backgroundRect.y + firstLayout.backgroundRect.height;
  let backgroundWidth = firstLayout.backgroundRect.width;
  let clipBottom = firstLayout.clipRect.y + firstLayout.clipRect.height;
  let clipWidth = firstLayout.clipRect.width;
  const segments: ITradingViewNativeLegendTextSegmentLayout[] = [];

  for (let layoutIndex = 0; layoutIndex < layouts.length; layoutIndex += 1) {
    const layout = layouts[layoutIndex];
    if (layout) {
      backgroundBottom = Math.max(
        backgroundBottom,
        layout.backgroundRect.y + layout.backgroundRect.height,
      );
      backgroundWidth = Math.max(backgroundWidth, layout.backgroundRect.width);
      clipBottom = Math.max(
        clipBottom,
        layout.clipRect.y + layout.clipRect.height,
      );
      clipWidth = Math.max(clipWidth, layout.clipRect.width);
      for (const segment of layout.segments) {
        segments.push(
          layoutIndex === 0
            ? segment
            : { ...segment, textBaselineY: layout.textBaselineY },
        );
      }
    }
  }

  return {
    backgroundRect: {
      ...firstLayout.backgroundRect,
      height: backgroundBottom - firstLayout.backgroundRect.y,
      width: backgroundWidth,
    },
    clipRect: {
      ...firstLayout.clipRect,
      height: clipBottom - firstLayout.clipRect.y,
      width: clipWidth,
    },
    segments,
    textBaselineY: firstLayout.textBaselineY,
  };
}
