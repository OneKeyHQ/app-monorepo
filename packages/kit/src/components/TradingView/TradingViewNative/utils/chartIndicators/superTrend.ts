// cspell:ignore supertrend
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';
import {
  type ITradingViewNativeIndicatorSettingsItem,
  TRADING_VIEW_NATIVE_THEME_COLORS,
} from '@onekeyhq/shared/types/tradingViewNative';

import { calculateTradingViewNativeAverageTrueRange } from './atr';
import { isTradingViewNativeFiniteValue } from './indicatorMath';
import {
  getTradingViewNativeIndicatorLine,
  getTradingViewNativeIndicatorParameter,
  getTradingViewNativeIndicatorSeriesStyle,
} from './seriesSettings';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';
import type { ITradingViewNativeIndicatorSeries } from './types';

const SUPER_TREND_ATR_PERIOD = 14;
const SUPER_TREND_MULTIPLIER = 3;

export interface ITradingViewNativeSuperTrendOptions {
  atrPeriod?: number;
  multiplier?: number;
}

export interface ITradingViewNativeSuperTrendResult {
  /** The band above price while the trend is down, empty elsewhere. */
  downTrend: ITradingViewNativeIndicatorValues;
  /** The band below price while the trend is up, empty elsewhere. */
  upTrend: ITradingViewNativeIndicatorValues;
}

export function calculateTradingViewNativeSuperTrend(
  points: readonly IMarketTokenKLineDataPoint[],
  {
    atrPeriod = SUPER_TREND_ATR_PERIOD,
    multiplier = SUPER_TREND_MULTIPLIER,
  }: ITradingViewNativeSuperTrendOptions = {},
): ITradingViewNativeSuperTrendResult {
  const averageTrueRanges = calculateTradingViewNativeAverageTrueRange(
    points,
    atrPeriod,
  );
  const normalizedMultiplier = Number.isFinite(multiplier)
    ? Math.max(multiplier, 0)
    : SUPER_TREND_MULTIPLIER;
  const downTrend: ITradingViewNativeIndicatorValues = Array(
    points.length,
  ).fill(null);
  const upTrend: ITradingViewNativeIndicatorValues = Array(points.length).fill(
    null,
  );
  let previousUpperBand: number | null = null;
  let previousLowerBand: number | null = null;
  let isUpTrend = false;

  for (let index = 0; index < points.length; index += 1) {
    const point = points[index];
    const averageTrueRange = averageTrueRanges[index];
    if (
      !point ||
      !isTradingViewNativeFiniteValue(averageTrueRange) ||
      !isTradingViewNativeFiniteValue(point.h) ||
      !isTradingViewNativeFiniteValue(point.l) ||
      !isTradingViewNativeFiniteValue(point.c)
    ) {
      previousUpperBand = null;
      previousLowerBand = null;
    } else {
      const middle = (point.h + point.l) / 2;
      let upperBand = middle + normalizedMultiplier * averageTrueRange;
      let lowerBand = middle - normalizedMultiplier * averageTrueRange;
      const previousClose = points[index - 1]?.c;
      if (
        previousUpperBand !== null &&
        previousLowerBand !== null &&
        isTradingViewNativeFiniteValue(previousClose)
      ) {
        // A band only moves toward price until price closes through it.
        if (
          upperBand >= previousUpperBand &&
          previousClose <= previousUpperBand
        ) {
          upperBand = previousUpperBand;
        }
        if (
          lowerBand <= previousLowerBand &&
          previousClose >= previousLowerBand
        ) {
          lowerBand = previousLowerBand;
        }
        isUpTrend = isUpTrend ? point.c >= lowerBand : point.c > upperBand;
      } else {
        isUpTrend = false;
      }
      if (isUpTrend) {
        upTrend[index] = lowerBand;
      } else {
        downTrend[index] = upperBand;
      }
      previousUpperBand = upperBand;
      previousLowerBand = lowerBand;
    }
  }

  return { downTrend, upTrend };
}

export function buildTradingViewNativeSuperTrendSeries(
  points: readonly IMarketTokenKLineDataPoint[],
  settings?: ITradingViewNativeIndicatorSettingsItem,
): ITradingViewNativeIndicatorSeries[] {
  const result = calculateTradingViewNativeSuperTrend(points, {
    atrPeriod: getTradingViewNativeIndicatorParameter(
      settings,
      'atrPeriod',
      SUPER_TREND_ATR_PERIOD,
    ),
    multiplier: getTradingViewNativeIndicatorParameter(
      settings,
      'multiplier',
      SUPER_TREND_MULTIPLIER,
    ),
  });
  const definitions = [
    {
      color: TRADING_VIEW_NATIVE_THEME_COLORS.positive,
      id: 'up',
      values: result.upTrend,
    },
    {
      color: TRADING_VIEW_NATIVE_THEME_COLORS.negative,
      id: 'down',
      values: result.downTrend,
    },
  ];
  return definitions.flatMap((definition) => {
    const line = getTradingViewNativeIndicatorLine(settings, definition.id, {
      color: definition.color,
      enabled: true,
      period: 0,
      style: 'solid',
    });
    return line.enabled
      ? [
          {
            indicator: 'SUPERTREND' as const,
            key: `supertrend-${definition.id}`,
            kind: 'line' as const,
            legendLabel: 'SUPERTREND',
            paint: 'indicatorOrangeStroke' as const,
            style: getTradingViewNativeIndicatorSeriesStyle(line, settings),
            values: definition.values,
          },
        ]
      : [];
  });
}
