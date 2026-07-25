import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

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

const VOLUME_UNITS = [
  { divisor: 1_000_000_000_000, suffix: 'T' },
  { divisor: 1_000_000_000, suffix: 'B' },
  { divisor: 1_000_000, suffix: 'M' },
  { divisor: 1000, suffix: 'K' },
] as const;

function formatPrice(value: number) {
  return Number.isFinite(value)
    ? formatTradingViewNativePriceTick(value)
    : '--';
}

export function formatTradingViewNativeVolume(volume: number) {
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
): ITradingViewNativeChartLegend {
  return {
    isUp: isTradingViewNativePriceUp(point),
    priceItems:
      chartType === 'line'
        ? [{ label: 'Price', value: formatPrice(point.c) }]
        : [
            { label: 'O', value: formatPrice(point.o) },
            { label: 'H', value: formatPrice(point.h) },
            { label: 'L', value: formatPrice(point.l) },
            { label: 'C', value: formatPrice(point.c) },
          ],
    volumeItem: {
      label: 'Volume',
      value: formatTradingViewNativeVolume(point.v),
    },
  };
}
