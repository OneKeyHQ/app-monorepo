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
// The band starts once the history covers this many bandwidths: a Gaussian
// weight three bandwidths back is about 1% of the latest bar's.
const ENVELOPE_WARM_UP_BANDWIDTHS = 3;
const ENVELOPE_MIN_WARM_UP_LENGTH = 2;

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
 * distance between the values and the centre over the latest `lookback - 1`
 * bars.
 *
 * Both windows shrink to the bars that exist while the history is shorter
 * than they are, and the band starts once the history covers three
 * bandwidths, where the weights of older bars are already negligible. Waiting
 * for both full windows would leave the default settings without a band for
 * the first 197 bars, which is more history than some charts load at first.
 * From the bar that has both full windows on, the values are those of the
 * full windows.
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
  const hasBandwidth = Number.isFinite(bandwidth) && bandwidth > 0;
  const warmUpLength = Math.min(
    normalizedLookback,
    Math.max(
      hasBandwidth ? Math.ceil(ENVELOPE_WARM_UP_BANDWIDTHS * bandwidth) : 0,
      ENVELOPE_MIN_WARM_UP_LENGTH,
    ),
  );
  // weightSums[count] is the total weight of the latest `count` bars.
  const weights: number[] = [];
  const weightSums: number[] = [0];
  for (let offset = 0; offset < normalizedLookback; offset += 1) {
    // A zero bandwidth leaves all the weight on the latest bar.
    const weight = hasBandwidth
      ? Math.exp(-(offset * offset) / (2 * bandwidth * bandwidth))
      : Number(offset === 0);
    weights.push(weight);
    weightSums.push((weightSums[offset] ?? 0) + weight);
  }

  const centres = buildTradingViewNativeIndicatorValues(
    values.length,
    (endIndex) => {
      const windowLength = Math.min(endIndex + 1, normalizedLookback);
      let sum = 0;
      for (let offset = 0; offset < windowLength; offset += 1) {
        const value = values[endIndex - offset];
        if (!isTradingViewNativeFiniteValue(value)) {
          return null;
        }
        sum += value * (weights[offset] ?? 0);
      }
      return sum / (weightSums[windowLength] ?? 1);
    },
  );

  const distanceWindowLength = Math.max(normalizedLookback - 1, 1);
  const lower: ITradingViewNativeIndicatorValues = Array(values.length).fill(
    null,
  );
  const upper: ITradingViewNativeIndicatorValues = Array(values.length).fill(
    null,
  );
  let distanceSum = 0;
  let distanceCount = 0;
  const getDistance = (index: number) => {
    const value = values[index];
    const centre = centres[index];
    return isTradingViewNativeFiniteValue(value) &&
      isTradingViewNativeFiniteValue(centre)
      ? Math.abs(value - centre)
      : null;
  };
  for (let index = 0; index < values.length; index += 1) {
    const distance = getDistance(index);
    if (distance !== null) {
      distanceSum += distance;
      distanceCount += 1;
    }
    const expiredDistance = getDistance(index - distanceWindowLength);
    if (expiredDistance !== null) {
      distanceSum -= expiredDistance;
      distanceCount -= 1;
    }
    const windowLength = Math.min(index + 1, distanceWindowLength);
    const centre = centres[index];
    if (
      index + 1 >= warmUpLength &&
      distanceCount === windowLength &&
      isTradingViewNativeFiniteValue(centre)
    ) {
      const width = (normalizedMultiplier * distanceSum) / windowLength;
      if (Number.isFinite(width)) {
        lower[index] = centre - width;
        upper[index] = centre + width;
      }
    }
  }

  return { lower, upper };
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
