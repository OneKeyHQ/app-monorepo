import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';
import type { ITradingViewNativeIndicatorSettingsItem } from '@onekeyhq/shared/types/tradingViewNative';

import {
  TRADING_VIEW_NATIVE_INDICATOR_CYAN_COLOR,
  TRADING_VIEW_NATIVE_INDICATOR_ORANGE_COLOR,
  TRADING_VIEW_NATIVE_INDICATOR_PINK_COLOR,
} from '../../chartConstants';

import {
  getTradingViewNativeIndicatorLine,
  getTradingViewNativeIndicatorSeriesStyle,
} from './seriesSettings';

import type {
  ITradingViewNativeIndicatorPaint,
  ITradingViewNativeIndicatorSeries,
} from './types';

const MOVING_AVERAGE_PERIODS = [5, 10, 20] as const;
const MOVING_AVERAGE_PAINTS = [
  'indicatorOrangeStroke',
  'indicatorPinkStroke',
  'indicatorCyanStroke',
] as const satisfies readonly ITradingViewNativeIndicatorPaint[];
const MOVING_AVERAGE_COLORS = [
  TRADING_VIEW_NATIVE_INDICATOR_ORANGE_COLOR,
  TRADING_VIEW_NATIVE_INDICATOR_PINK_COLOR,
  TRADING_VIEW_NATIVE_INDICATOR_CYAN_COLOR,
] as const;

export function buildTradingViewNativeMovingAverageSeries({
  calculate,
  indicator,
  points,
  settings,
}: {
  calculate: (
    values: readonly number[],
    period: number,
  ) => Array<number | null>;
  indicator: 'EMA' | 'MA';
  points: readonly IMarketTokenKLineDataPoint[];
  settings?: ITradingViewNativeIndicatorSettingsItem;
}): ITradingViewNativeIndicatorSeries[] {
  const closeValues = points.map((point) => point.c);
  return MOVING_AVERAGE_PERIODS.flatMap((period, index) => {
    const line = getTradingViewNativeIndicatorLine(settings, `line:${index}`, {
      color:
        MOVING_AVERAGE_COLORS[index] ??
        TRADING_VIEW_NATIVE_INDICATOR_ORANGE_COLOR,
      enabled: true,
      period,
      style: 'solid',
    });
    if (!line.enabled) {
      return [];
    }
    return [
      {
        indicator,
        key: `${indicator.toLowerCase()}-${index + 1}`,
        kind: 'line' as const,
        legendLabel: `${indicator}${line.period}`,
        paint: MOVING_AVERAGE_PAINTS[index],
        style: getTradingViewNativeIndicatorSeriesStyle(line, settings),
        values: calculate(closeValues, line.period),
      },
    ];
  });
}
