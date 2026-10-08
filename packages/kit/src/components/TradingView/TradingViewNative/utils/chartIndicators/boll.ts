// cspell:ignore Bollinger
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';
import {
  type ITradingViewNativeIndicatorSettingsItem,
  TRADING_VIEW_NATIVE_THEME_COLORS,
} from '@onekeyhq/shared/types/tradingViewNative';

import { TRADING_VIEW_NATIVE_INDICATOR_ORANGE_COLOR } from '../../chartConstants';

import { normalizeTradingViewNativeIndicatorPeriod } from './normalizePeriod';
import {
  getTradingViewNativeIndicatorLine,
  getTradingViewNativeIndicatorParameter,
  getTradingViewNativeIndicatorSeriesStyle,
} from './seriesSettings';

import type { ITradingViewNativeIndicatorSeries } from './types';

const BOLL_PERIOD = 20;
const BOLL_STANDARD_DEVIATION_MULTIPLIER = 2;
const BOLL_BACKGROUND_OPACITY = 0.1;

export function calculateTradingViewNativeBollingerBands(
  values: readonly number[],
  period: number,
  standardDeviationMultiplier: number,
) {
  const normalizedPeriod = normalizeTradingViewNativeIndicatorPeriod(period);
  const normalizedMultiplier = Number.isFinite(standardDeviationMultiplier)
    ? Math.max(standardDeviationMultiplier, 0)
    : 0;
  const middle = Array<number | null>(values.length).fill(null);
  const upper = Array<number | null>(values.length).fill(null);
  const lower = Array<number | null>(values.length).fill(null);
  let sum = 0;
  let squaredSum = 0;
  let validValueCount = 0;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (Number.isFinite(value)) {
      sum += value;
      squaredSum += value * value;
      validValueCount += 1;
    }

    const expiredIndex = index - normalizedPeriod;
    if (expiredIndex >= 0) {
      const expiredValue = values[expiredIndex];
      if (Number.isFinite(expiredValue)) {
        sum -= expiredValue;
        squaredSum -= expiredValue * expiredValue;
        validValueCount -= 1;
      }
    }

    if (index >= normalizedPeriod - 1 && validValueCount === normalizedPeriod) {
      const average = sum / normalizedPeriod;
      const variance = Math.max(
        squaredSum / normalizedPeriod - average * average,
        0,
      );
      const deviation = Math.sqrt(variance) * normalizedMultiplier;
      middle[index] = average;
      upper[index] = average + deviation;
      lower[index] = average - deviation;
    }
  }

  return { lower, middle, upper };
}

export function buildTradingViewNativeBollSeries(
  points: readonly IMarketTokenKLineDataPoint[],
  settings?: ITradingViewNativeIndicatorSettingsItem,
): ITradingViewNativeIndicatorSeries[] {
  const period = getTradingViewNativeIndicatorParameter(
    settings,
    'period',
    BOLL_PERIOD,
  );
  const deviation = getTradingViewNativeIndicatorParameter(
    settings,
    'deviation',
    BOLL_STANDARD_DEVIATION_MULTIPLIER,
  );
  const bands = calculateTradingViewNativeBollingerBands(
    points.map((point) => point.c),
    period,
    deviation,
  );
  const background = getTradingViewNativeIndicatorLine(settings, 'background', {
    color: TRADING_VIEW_NATIVE_THEME_COLORS.indicatorSecondary,
    enabled: true,
    period: 0,
    style: 'solid',
  });
  const definitions = [
    {
      color: TRADING_VIEW_NATIVE_INDICATOR_ORANGE_COLOR,
      id: 'middle',
      paint: 'indicatorOrangeStroke' as const,
      values: bands.middle,
    },
    {
      color: TRADING_VIEW_NATIVE_INDICATOR_ORANGE_COLOR,
      id: 'upper',
      paint: 'indicatorOrangeStroke' as const,
      values: bands.upper,
    },
    {
      color: TRADING_VIEW_NATIVE_INDICATOR_ORANGE_COLOR,
      id: 'lower',
      paint: 'indicatorOrangeStroke' as const,
      values: bands.lower,
    },
  ];
  const series: ITradingViewNativeIndicatorSeries[] = definitions.flatMap(
    (definition) => {
      const line = getTradingViewNativeIndicatorLine(settings, definition.id, {
        color: definition.color,
        enabled: true,
        period: 0,
        style: 'solid',
      });
      const isFillBoundary =
        definition.id === 'upper' || definition.id === 'lower';
      return line.enabled || (background.enabled && isFillBoundary)
        ? [
            {
              indicator: 'BOLL' as const,
              key: `boll-${definition.id}`,
              kind: 'line' as const,
              paint: definition.paint,
              style: getTradingViewNativeIndicatorSeriesStyle(line, settings),
              values: definition.values,
              visible: line.enabled,
            },
          ]
        : [];
    },
  );
  const upperSeries = series.find(({ key }) => key === 'boll-upper');
  const lowerSeries = series.find(({ key }) => key === 'boll-lower');
  if (background.enabled && upperSeries && lowerSeries) {
    const backgroundStyle = getTradingViewNativeIndicatorSeriesStyle(
      background,
      settings,
    );
    upperSeries.fill = {
      color: backgroundStyle.color,
      opacity: backgroundStyle.opacity * BOLL_BACKGROUND_OPACITY,
      toSeriesKey: lowerSeries.key,
    };
  }
  return series;
}
