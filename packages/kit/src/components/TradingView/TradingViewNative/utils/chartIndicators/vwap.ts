// cspell:ignore VWAP
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';
import {
  type ITradingViewNativeIndicatorSettingsItem,
  TRADING_VIEW_NATIVE_THEME_COLORS,
} from '@onekeyhq/shared/types/tradingViewNative';

import {
  getTradingViewNativePointValues,
  getTradingViewNativeTypicalPrice,
} from './indicatorMath';
import {
  getTradingViewNativeIndicatorLine,
  getTradingViewNativeIndicatorParameter,
  getTradingViewNativeIndicatorSeriesStyle,
} from './seriesSettings';
import { calculateTradingViewNativeVolumeWeightedAverage } from './vwma';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';
import type { ITradingViewNativeIndicatorSeries } from './types';

const VWAP_PERIOD = 14;

/**
 * Rolling volume-weighted average price: the typical price `(H + L + C) / 3`
 * of the latest `period` bars, each weighted by its volume.
 */
export function calculateTradingViewNativeVolumeWeightedAveragePrice(
  points: readonly IMarketTokenKLineDataPoint[],
  period = VWAP_PERIOD,
): ITradingViewNativeIndicatorValues {
  return calculateTradingViewNativeVolumeWeightedAverage(
    points.map((point) => getTradingViewNativeTypicalPrice(point)),
    getTradingViewNativePointValues(points, 'v'),
    period,
  );
}

export function buildTradingViewNativeVwapSeries(
  points: readonly IMarketTokenKLineDataPoint[],
  settings?: ITradingViewNativeIndicatorSettingsItem,
): ITradingViewNativeIndicatorSeries[] {
  const line = getTradingViewNativeIndicatorLine(settings, 'vwap', {
    color: TRADING_VIEW_NATIVE_THEME_COLORS.quinary,
    enabled: true,
    period: 0,
    style: 'solid',
  });
  if (!line.enabled) {
    return [];
  }
  return [
    {
      indicator: 'VWAP',
      key: 'vwap',
      kind: 'line',
      legendLabel: 'VWAP',
      paint: 'indicatorCyanStroke',
      style: getTradingViewNativeIndicatorSeriesStyle(line, settings),
      values: calculateTradingViewNativeVolumeWeightedAveragePrice(
        points,
        getTradingViewNativeIndicatorParameter(settings, 'period', VWAP_PERIOD),
      ),
    },
  ];
}
