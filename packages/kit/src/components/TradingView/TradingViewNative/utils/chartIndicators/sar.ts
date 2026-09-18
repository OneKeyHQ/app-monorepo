import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';
import {
  type ITradingViewNativeIndicatorSettingsItem,
  TRADING_VIEW_NATIVE_THEME_COLORS,
} from '@onekeyhq/shared/types/tradingViewNative';

import { TRADING_VIEW_NATIVE_INDICATOR_SAR_COLOR } from '../../chartConstants';

import {
  getTradingViewNativeIndicatorLine,
  getTradingViewNativeIndicatorParameter,
  getTradingViewNativeIndicatorSeriesStyle,
} from './seriesSettings';

import type { ITradingViewNativeIndicatorSeries } from './types';

const SAR_ACCELERATION_START = 0.02;
const SAR_ACCELERATION_STEP = 0.02;
const SAR_ACCELERATION_MAX = 0.2;

function isValidSarPoint(point: IMarketTokenKLineDataPoint | undefined) {
  return Boolean(
    point &&
    Number.isFinite(point.c) &&
    Number.isFinite(point.h) &&
    Number.isFinite(point.l),
  );
}

export function calculateTradingViewNativeParabolicSar(
  points: readonly IMarketTokenKLineDataPoint[],
  {
    accelerationMax = SAR_ACCELERATION_MAX,
    accelerationStart = SAR_ACCELERATION_START,
    accelerationStep = SAR_ACCELERATION_STEP,
  }: {
    accelerationMax?: number;
    accelerationStart?: number;
    accelerationStep?: number;
  } = {},
): Array<number | null> {
  const result = Array<number | null>(points.length).fill(null);
  const normalizedAccelerationStart = Math.max(accelerationStart, 0);
  const normalizedAccelerationStep = Math.max(accelerationStep, 0);
  const normalizedAccelerationMax = Math.max(
    accelerationMax,
    normalizedAccelerationStart,
  );
  let acceleration = normalizedAccelerationStart;
  let extremePoint = 0;
  let isUpTrend = true;
  let previousValidIndex = -1;
  let trendPointCount = 0;

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    if (!isValidSarPoint(point)) {
      previousValidIndex = -1;
      trendPointCount = 0;
    } else if (previousValidIndex < 0) {
      previousValidIndex = index;
      trendPointCount = 1;
    } else {
      const previousPoint = points[previousValidIndex];
      if (index !== previousValidIndex + 1 || !isValidSarPoint(previousPoint)) {
        previousValidIndex = index;
        trendPointCount = 1;
      } else if (trendPointCount === 1) {
        isUpTrend = point.c >= previousPoint.c;
        result[index] = isUpTrend ? previousPoint.l : previousPoint.h;
        extremePoint = isUpTrend
          ? Math.max(previousPoint.h, point.h)
          : Math.min(previousPoint.l, point.l);
        acceleration = normalizedAccelerationStart;
        previousValidIndex = index;
        trendPointCount = 2;
      } else {
        const previousSar = result[previousValidIndex];
        if (previousSar === null) {
          previousValidIndex = index;
          trendPointCount = 1;
        } else {
          let nextSar =
            previousSar + acceleration * (extremePoint - previousSar);
          const previousPreviousPoint = points[index - 2];

          if (isUpTrend) {
            nextSar = Math.min(
              nextSar,
              previousPoint.l,
              isValidSarPoint(previousPreviousPoint)
                ? previousPreviousPoint.l
                : previousPoint.l,
            );
            if (point.l < nextSar) {
              isUpTrend = false;
              nextSar = extremePoint;
              extremePoint = point.l;
              acceleration = normalizedAccelerationStart;
            } else if (point.h > extremePoint) {
              extremePoint = point.h;
              acceleration = Math.min(
                acceleration + normalizedAccelerationStep,
                normalizedAccelerationMax,
              );
            }
          } else {
            nextSar = Math.max(
              nextSar,
              previousPoint.h,
              isValidSarPoint(previousPreviousPoint)
                ? previousPreviousPoint.h
                : previousPoint.h,
            );
            if (point.h > nextSar) {
              isUpTrend = true;
              nextSar = extremePoint;
              extremePoint = point.h;
              acceleration = normalizedAccelerationStart;
            } else if (point.l < extremePoint) {
              extremePoint = point.l;
              acceleration = Math.min(
                acceleration + normalizedAccelerationStep,
                normalizedAccelerationMax,
              );
            }
          }

          result[index] = nextSar;
          previousValidIndex = index;
          trendPointCount += 1;
        }
      }
    }
  }

  return result;
}

export function buildTradingViewNativeSarSeries(
  points: readonly IMarketTokenKLineDataPoint[],
  settings?: ITradingViewNativeIndicatorSettingsItem,
): ITradingViewNativeIndicatorSeries[] {
  const line = getTradingViewNativeIndicatorLine(settings, 'sar', {
    color: TRADING_VIEW_NATIVE_INDICATOR_SAR_COLOR,
    enabled: true,
    period: 0,
    style: 'solid',
  });
  if (!line.enabled) {
    return [];
  }
  const values = calculateTradingViewNativeParabolicSar(points, {
    accelerationMax: getTradingViewNativeIndicatorParameter(
      settings,
      'accelerationMax',
      SAR_ACCELERATION_MAX,
    ),
    accelerationStart: getTradingViewNativeIndicatorParameter(
      settings,
      'accelerationStart',
      SAR_ACCELERATION_START,
    ),
    accelerationStep: getTradingViewNativeIndicatorParameter(
      settings,
      'accelerationStep',
      SAR_ACCELERATION_STEP,
    ),
  });
  const upValues = Array<number | null>(values.length).fill(null);
  const downValues = Array<number | null>(values.length).fill(null);
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const point = points[index];
    if (value !== null && point) {
      if (value <= point.c) {
        upValues[index] = value;
      } else {
        downValues[index] = value;
      }
    }
  }
  const baseStyle = getTradingViewNativeIndicatorSeriesStyle(line, settings);
  return [
    {
      indicator: 'SAR',
      key: 'sar-up',
      kind: 'points',
      paint: 'indicatorSarPoint',
      style: {
        ...baseStyle,
        color:
          settings?.opacityColors?.upColor ??
          TRADING_VIEW_NATIVE_THEME_COLORS.positive,
      },
      values: upValues,
    },
    {
      indicator: 'SAR',
      key: 'sar-down',
      kind: 'points',
      paint: 'indicatorSarPoint',
      style: {
        ...baseStyle,
        color:
          settings?.opacityColors?.downColor ??
          TRADING_VIEW_NATIVE_THEME_COLORS.negative,
      },
      values: downValues,
    },
  ];
}
