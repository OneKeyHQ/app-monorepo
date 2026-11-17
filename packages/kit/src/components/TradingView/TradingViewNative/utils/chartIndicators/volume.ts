import { isTradingViewNativeFiniteValue } from './indicatorMath';
import { calculateTradingViewNativeSimpleMovingAverage } from './ma';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';

const DEFAULT_VOLUME_MOVING_AVERAGE_PERIOD = 20;
const DEFAULT_VOLUME_SMOOTHING_PERIOD = 9;

export interface ITradingViewNativeVolumeResult {
  movingAverage: ITradingViewNativeIndicatorValues;
  smoothedMovingAverage: ITradingViewNativeIndicatorValues;
  volume: ITradingViewNativeIndicatorValues;
}

export function calculateTradingViewNativeVolume(
  values: readonly (number | null | undefined)[],
  movingAveragePeriod = DEFAULT_VOLUME_MOVING_AVERAGE_PERIOD,
  smoothingPeriod = DEFAULT_VOLUME_SMOOTHING_PERIOD,
): ITradingViewNativeVolumeResult {
  const movingAverage = calculateTradingViewNativeSimpleMovingAverage(
    values,
    movingAveragePeriod,
  );

  return {
    movingAverage,
    smoothedMovingAverage: calculateTradingViewNativeSimpleMovingAverage(
      movingAverage,
      smoothingPeriod,
    ),
    volume: values.map((value) =>
      isTradingViewNativeFiniteValue(value) ? value : null,
    ),
  };
}
