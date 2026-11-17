// cspell:ignore Nadaraya
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';
import {
  type ITradingViewNativeIndicatorSettingsItem,
  TRADING_VIEW_NATIVE_THEME_COLORS,
} from '@onekeyhq/shared/types/tradingViewNative';

import {
  buildTradingViewNativeIndicatorValues,
  getTradingViewNativePointValues,
  isTradingViewNativeFiniteValue,
} from './indicatorMath';
import { calculateTradingViewNativeSimpleMovingAverage } from './ma';
import { normalizeTradingViewNativeIndicatorPeriod } from './normalizePeriod';
import {
  getTradingViewNativeIndicatorLine,
  getTradingViewNativeIndicatorParameter,
  getTradingViewNativeIndicatorSeriesStyle,
} from './seriesSettings';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';
import type { ITradingViewNativeIndicatorSeries } from './types';

const ENVELOPE_BANDWIDTH = 8;
const ENVELOPE_MULTIPLIER = 3;
const ENVELOPE_LOOKBACK = 100;
const ENVELOPE_BACKGROUND_OPACITY = 0.08;

export interface ITradingViewNativeEnvelopeOptions {
  bandwidth?: number;
  lookback?: number;
  multiplier?: number;
}

export interface ITradingViewNativeEnvelopeResult {
  lower: ITradingViewNativeIndicatorValues;
  upper: ITradingViewNativeIndicatorValues;
}

/**
 * Kernel-smoothed envelope. The centre is a Gaussian-weighted average of the
 * latest `lookback` values, so it never uses future bars and never repaints.
 * The band is that centre plus and minus `multiplier` times the average
 * distance between the values and the centre over the previous `lookback - 1`
 * bars.
 */
export function calculateTradingViewNativeEnvelope(
  values: readonly (number | null | undefined)[],
  {
    bandwidth = ENVELOPE_BANDWIDTH,
    lookback = ENVELOPE_LOOKBACK,
    multiplier = ENVELOPE_MULTIPLIER,
  }: ITradingViewNativeEnvelopeOptions = {},
): ITradingViewNativeEnvelopeResult {
  const normalizedLookback =
    normalizeTradingViewNativeIndicatorPeriod(lookback);
  const normalizedMultiplier = Number.isFinite(multiplier)
    ? Math.max(multiplier, 0)
    : ENVELOPE_MULTIPLIER;
  const weights: number[] = [];
  let weightSum = 0;
  for (let offset = 0; offset < normalizedLookback; offset += 1) {
    // A zero bandwidth leaves all the weight on the latest bar.
    const weight =
      Number.isFinite(bandwidth) && bandwidth > 0
        ? Math.exp(-(offset * offset) / (2 * bandwidth * bandwidth))
        : Number(offset === 0);
    weights.push(weight);
    weightSum += weight;
  }

  const centres = buildTradingViewNativeIndicatorValues(
    values.length,
    (endIndex) => {
      if (endIndex < normalizedLookback - 1) {
        return null;
      }
      let sum = 0;
      for (let offset = 0; offset < normalizedLookback; offset += 1) {
        const value = values[endIndex - offset];
        if (!isTradingViewNativeFiniteValue(value)) {
          return null;
        }
        sum += value * (weights[offset] ?? 0);
      }
      return sum / weightSum;
    },
  );
  const distances = buildTradingViewNativeIndicatorValues(
    values.length,
    (index) => {
      const value = values[index];
      const centre = centres[index];
      return isTradingViewNativeFiniteValue(value) &&
        isTradingViewNativeFiniteValue(centre)
        ? Math.abs(value - centre)
        : null;
    },
  );
  const averageDistances = calculateTradingViewNativeSimpleMovingAverage(
    distances,
    Math.max(normalizedLookback - 1, 1),
  );
  const getBand = (direction: 1 | -1) =>
    buildTradingViewNativeIndicatorValues(values.length, (index) => {
      const centre = centres[index];
      const averageDistance = averageDistances[index];
      return isTradingViewNativeFiniteValue(centre) &&
        isTradingViewNativeFiniteValue(averageDistance)
        ? centre + direction * normalizedMultiplier * averageDistance
        : null;
    });

  return { lower: getBand(-1), upper: getBand(1) };
}

export function buildTradingViewNativeEnvelopeSeries(
  points: readonly IMarketTokenKLineDataPoint[],
  settings?: ITradingViewNativeIndicatorSettingsItem,
): ITradingViewNativeIndicatorSeries[] {
  const bands = calculateTradingViewNativeEnvelope(
    getTradingViewNativePointValues(points, 'c'),
    {
      bandwidth: getTradingViewNativeIndicatorParameter(
        settings,
        'bandwidth',
        ENVELOPE_BANDWIDTH,
      ),
      lookback: getTradingViewNativeIndicatorParameter(
        settings,
        'lookback',
        ENVELOPE_LOOKBACK,
      ),
      multiplier: getTradingViewNativeIndicatorParameter(
        settings,
        'multiplier',
        ENVELOPE_MULTIPLIER,
      ),
    },
  );
  const background = getTradingViewNativeIndicatorLine(settings, 'background', {
    color: TRADING_VIEW_NATIVE_THEME_COLORS.quinary,
    enabled: true,
    period: 0,
    style: 'solid',
  });
  const definitions = [
    {
      color: TRADING_VIEW_NATIVE_THEME_COLORS.warning,
      id: 'upper',
      legendLabel: 'ENV UB',
      values: bands.upper,
    },
    {
      color: TRADING_VIEW_NATIVE_THEME_COLORS.quaternary,
      id: 'lower',
      legendLabel: 'ENV LB',
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
      // A hidden boundary is still needed as an edge of the background fill.
      return line.enabled || background.enabled
        ? [
            {
              indicator: 'ENV' as const,
              key: `env-${definition.id}`,
              kind: 'line' as const,
              legendLabel: definition.legendLabel,
              paint: 'indicatorOrangeStroke' as const,
              style: getTradingViewNativeIndicatorSeriesStyle(line, settings),
              values: definition.values,
              visible: line.enabled,
            },
          ]
        : [];
    },
  );
  const upperSeries = series.find(({ key }) => key === 'env-upper');
  const lowerSeries = series.find(({ key }) => key === 'env-lower');
  if (background.enabled && upperSeries && lowerSeries) {
    const backgroundStyle = getTradingViewNativeIndicatorSeriesStyle(
      background,
      settings,
    );
    upperSeries.fill = {
      color: backgroundStyle.color,
      opacity: backgroundStyle.opacity * ENVELOPE_BACKGROUND_OPACITY,
      toSeriesKey: lowerSeries.key,
    };
  }
  return series;
}
