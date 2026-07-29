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
import { isTradingViewNativePriceUp } from './chartStyle';

import type { ITradingViewNativeChartType } from '../types';

export interface ITradingViewNativeLegendItem {
  label: string;
  value: string;
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

function formatPrice(value: number) {
  'worklet';

  return Number.isFinite(value)
    ? formatTradingViewNativePriceTick(value)
    : '--';
}

function expandTradingViewNativeScientificNotation(value: string) {
  'worklet';

  const exponentIndex = value.indexOf('e');
  if (exponentIndex < 0) {
    return value;
  }

  const mantissa = value.slice(0, exponentIndex);
  const exponent = Number(value.slice(exponentIndex + 1));
  if (!Number.isInteger(exponent)) {
    return value;
  }

  const sign = mantissa.startsWith('-') ? '-' : '';
  const unsignedMantissa = mantissa.replace(/^[+-]/, '');
  const decimalIndex = unsignedMantissa.indexOf('.');
  const digits = unsignedMantissa.replace('.', '');
  const decimalPosition =
    (decimalIndex < 0 ? unsignedMantissa.length : decimalIndex) + exponent;

  if (decimalPosition <= 0) {
    return `${sign}0.${'0'.repeat(-decimalPosition)}${digits}`;
  }
  if (decimalPosition >= digits.length) {
    return `${sign}${digits}${'0'.repeat(decimalPosition - digits.length)}`;
  }
  return `${sign}${digits.slice(0, decimalPosition)}.${digits.slice(
    decimalPosition,
  )}`;
}

function formatTradingViewNativePriceChangeValue(value: number) {
  'worklet';

  if (!Number.isFinite(value)) {
    return '--';
  }

  const roundedValue = Number(value.toPrecision(6));
  if (!Number.isFinite(roundedValue)) {
    return '--';
  }
  return expandTradingViewNativeScientificNotation(roundedValue.toString());
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

  // Match TradingView's bar-change status line when the previous close is available.
  const referencePrice = previousClose === undefined ? open : previousClose;
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

export function getTradingViewNativeChartLegend(
  point: IMarketTokenKLineDataPoint,
  chartType: ITradingViewNativeChartType = 'candlestick',
  previousClose?: number,
): ITradingViewNativeChartLegend {
  'worklet';

  const priceChangeItem = {
    label: '',
    value: formatTradingViewNativePriceChange({
      close: point.c,
      open: point.o,
      previousClose,
    }),
  };
  return {
    isUp: isTradingViewNativePriceUp(point),
    priceItems:
      chartType === 'line'
        ? [{ label: 'Price', value: formatPrice(point.c) }, priceChangeItem]
        : [
            { label: 'O', value: formatPrice(point.o) },
            { label: 'H', value: formatPrice(point.h) },
            { label: 'L', value: formatPrice(point.l) },
            { label: 'C', value: formatPrice(point.c) },
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

  return (
    getTradingViewNativeChartLegendRowLayouts({
      items,
      maxX,
      measureTextWidth,
      top,
    })[0] ?? null
  );
}
