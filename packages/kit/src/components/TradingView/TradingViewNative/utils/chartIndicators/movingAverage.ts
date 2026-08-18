import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

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

export function buildTradingViewNativeMovingAverageSeries({
  calculate,
  indicator,
  points,
}: {
  calculate: (
    values: readonly number[],
    period: number,
  ) => Array<number | null>;
  indicator: 'EMA' | 'MA';
  points: readonly IMarketTokenKLineDataPoint[];
}): ITradingViewNativeIndicatorSeries[] {
  const closeValues = points.map((point) => point.c);
  return MOVING_AVERAGE_PERIODS.map((period, index) => ({
    indicator,
    key: `${indicator.toLowerCase()}-${period}`,
    kind: 'line' as const,
    paint: MOVING_AVERAGE_PAINTS[index],
    values: calculate(closeValues, period),
  }));
}
