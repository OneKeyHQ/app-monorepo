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
  return `${changeSign}${formatTradingViewNativePriceTick(
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
): ITradingViewNativeChartLegend {
  'worklet';

  return {
    isUp: isTradingViewNativePriceUp(point),
    priceItems: [
      { label: 'O', value: formatPrice(point.o) },
      { label: 'H', value: formatPrice(point.h) },
      { label: 'L', value: formatPrice(point.l) },
      { label: 'C', value: formatPrice(point.c) },
      {
        label: '',
        value: formatTradingViewNativePriceChange({
          close: point.c,
          open: point.o,
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
