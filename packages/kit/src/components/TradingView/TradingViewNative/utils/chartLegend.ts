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
  textBaselineY?: number;
  valueX: number;
}

export interface ITradingViewNativeChartLegendRowLayout {
  backgroundRect: ITradingViewNativeLegendRect;
  clipRect: ITradingViewNativeLegendRect;
  segments: ITradingViewNativeLegendTextSegmentLayout[];
  textBaselineY: number;
}

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

function expandTradingViewNativeScientificNumber(value: string) {
  'worklet';

  const exponentIndex = value.search(/[eE]/);
  if (exponentIndex < 0) {
    return value;
  }

  const coefficient = value.slice(0, exponentIndex);
  const exponent = Number(value.slice(exponentIndex + 1));
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
    return formatTradingViewNativePriceTick(value);
  }

  const preciseValue = value.toPrecision(6);
  return preciseValue.search(/[eE]/) >= 0
    ? expandTradingViewNativeScientificNumber(preciseValue)
    : Number(preciseValue).toString();
}

export function formatTradingViewNativePriceChange({
  close,
  open,
}: {
  close: number;
  open: number;
}) {
  'worklet';

  if (!Number.isFinite(open) || !Number.isFinite(close) || open === 0) {
    return '--';
  }

  const change = close - open;
  const percentage = (change / open) * 100;
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
  previousClose?: number,
): ITradingViewNativeChartLegend {
  'worklet';

  // TradingView's bar-change status line compares the close with the prior
  // bar's close; the first bar has no prior close and falls back to its open.
  const changeReference = previousClose ?? point.o;

  return {
    isUp: point.c >= changeReference,
    priceItems: [
      { label: 'O', value: formatPrice(point.o) },
      { label: 'H', value: formatPrice(point.h) },
      { label: 'L', value: formatPrice(point.l) },
      { label: 'C', value: formatPrice(point.c) },
      {
        label: '',
        value: formatTradingViewNativePriceChange({
          close: point.c,
          open: changeReference,
        }),
      },
    ],
    volumeItem: {
      label: 'Volume',
      value: formatTradingViewNativeVolume(point.v),
    },
  };
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

  const rowHeight =
    TRADING_VIEW_NATIVE_LEGEND_FONT_SIZE +
    TRADING_VIEW_NATIVE_LEGEND_BACKGROUND_VERTICAL_PADDING * 2;
  const rows: {
    contentRight: number;
    segments: ITradingViewNativeLegendTextSegmentLayout[];
  }[] = [];
  let currentRow: ITradingViewNativeLegendTextSegmentLayout[] = [];
  let x = TRADING_VIEW_NATIVE_LEGEND_HORIZONTAL_PADDING;
  let contentRight = TRADING_VIEW_NATIVE_LEGEND_HORIZONTAL_PADDING;

  for (const item of items) {
    const itemWidth =
      measureTextWidth(item.label) +
      TRADING_VIEW_NATIVE_LEGEND_LABEL_VALUE_GAP +
      measureTextWidth(item.value);
    const nextX = x + itemWidth;
    // Keep a measured segment intact by starting it on the next row when it
    // would cross the price-axis boundary.
    if (currentRow.length > 0 && nextX > maxX) {
      rows.push({
        contentRight,
        segments: currentRow,
      });
      currentRow = [];
      x = TRADING_VIEW_NATIVE_LEGEND_HORIZONTAL_PADDING;
      contentRight = TRADING_VIEW_NATIVE_LEGEND_HORIZONTAL_PADDING;
    }

    const labelX = x;
    const valueX =
      labelX +
      measureTextWidth(item.label) +
      TRADING_VIEW_NATIVE_LEGEND_LABEL_VALUE_GAP;
    x =
      valueX +
      measureTextWidth(item.value) +
      TRADING_VIEW_NATIVE_LEGEND_ITEM_GAP;
    currentRow.push({
      ...item,
      labelX,
      ...(rows.length > 0
        ? {
            textBaselineY:
              top +
              TRADING_VIEW_NATIVE_LEGEND_FONT_SIZE +
              rows.length * rowHeight,
          }
        : {}),
      valueX,
    });
    contentRight = Math.max(
      x - TRADING_VIEW_NATIVE_LEGEND_ITEM_GAP,
      TRADING_VIEW_NATIVE_LEGEND_HORIZONTAL_PADDING,
    );
  }

  rows.push({ contentRight, segments: currentRow });
  const segments: ITradingViewNativeLegendTextSegmentLayout[] = [];
  let maxContentRight = TRADING_VIEW_NATIVE_LEGEND_HORIZONTAL_PADDING;
  for (const row of rows) {
    maxContentRight = Math.max(maxContentRight, row.contentRight);
    for (const segment of row.segments) {
      segments.push(segment);
    }
  }

  return {
    backgroundRect: {
      height: rowHeight * rows.length,
      width: Math.min(
        maxContentRight -
          TRADING_VIEW_NATIVE_LEGEND_HORIZONTAL_PADDING +
          TRADING_VIEW_NATIVE_LEGEND_BACKGROUND_HORIZONTAL_PADDING * 2,
        clipWidth,
      ),
      x: backgroundLeft,
      y: backgroundTop,
    },
    clipRect: {
      height: rowHeight * rows.length,
      width: clipWidth,
      x: backgroundLeft,
      y: backgroundTop,
    },
    segments,
    textBaselineY: top + TRADING_VIEW_NATIVE_LEGEND_FONT_SIZE,
  };
}
