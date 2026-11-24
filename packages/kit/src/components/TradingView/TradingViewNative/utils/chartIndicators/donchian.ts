// cspell:ignore Donchian
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';
import {
  type ITradingViewNativeIndicatorSettingsItem,
  TRADING_VIEW_NATIVE_THEME_COLORS,
} from '@onekeyhq/shared/types/tradingViewNative';

import {
  buildTradingViewNativeIndicatorValues,
  calculateTradingViewNativeRollingHighest,
  calculateTradingViewNativeRollingLowest,
  getTradingViewNativePointValues,
  isTradingViewNativeFiniteValue,
} from './indicatorMath';
import {
  getTradingViewNativeIndicatorLine,
  getTradingViewNativeIndicatorParameter,
  getTradingViewNativeIndicatorSeriesStyle,
} from './seriesSettings';

import type { ITradingViewNativeIndicatorValues } from './subIndicatorTypes';
import type { ITradingViewNativeIndicatorSeries } from './types';

const DONCHIAN_PERIOD = 20;
const DONCHIAN_BACKGROUND_OPACITY = 0.08;

export interface ITradingViewNativeDonchianChannelResult {
  basis: ITradingViewNativeIndicatorValues;
  lower: ITradingViewNativeIndicatorValues;
  upper: ITradingViewNativeIndicatorValues;
}

/** Highest high and lowest low of the latest `period` bars, and their midpoint. */
export function calculateTradingViewNativeDonchianChannel(
  points: readonly IMarketTokenKLineDataPoint[],
  period = DONCHIAN_PERIOD,
): ITradingViewNativeDonchianChannelResult {
  const upper = calculateTradingViewNativeRollingHighest(
    getTradingViewNativePointValues(points, 'h'),
    period,
  );
  const lower = calculateTradingViewNativeRollingLowest(
    getTradingViewNativePointValues(points, 'l'),
    period,
  );
  const basis = buildTradingViewNativeIndicatorValues(
    points.length,
    (index) => {
      const upperValue = upper[index];
      const lowerValue = lower[index];
      return isTradingViewNativeFiniteValue(upperValue) &&
        isTradingViewNativeFiniteValue(lowerValue)
        ? (upperValue + lowerValue) / 2
        : null;
    },
  );
  return { basis, lower, upper };
}

export function buildTradingViewNativeDonchianChannelSeries(
  points: readonly IMarketTokenKLineDataPoint[],
  settings?: ITradingViewNativeIndicatorSettingsItem,
): ITradingViewNativeIndicatorSeries[] {
  const channel = calculateTradingViewNativeDonchianChannel(
    points,
    getTradingViewNativeIndicatorParameter(settings, 'period', DONCHIAN_PERIOD),
  );
  const background = getTradingViewNativeIndicatorLine(settings, 'background', {
    color: TRADING_VIEW_NATIVE_THEME_COLORS.indicatorSecondary,
    enabled: true,
    period: 0,
    style: 'solid',
  });
  const definitions = [
    { id: 'basis', legendLabel: 'DC', values: channel.basis },
    { id: 'upper', legendLabel: 'UB', values: channel.upper },
    { id: 'lower', legendLabel: 'LB', values: channel.lower },
  ];
  const series: ITradingViewNativeIndicatorSeries[] = definitions.flatMap(
    (definition) => {
      const line = getTradingViewNativeIndicatorLine(settings, definition.id, {
        color: TRADING_VIEW_NATIVE_THEME_COLORS.indicatorSecondary,
        enabled: true,
        period: 0,
        style: 'solid',
      });
      const isFillBoundary = definition.id !== 'basis';
      // A hidden boundary is still needed as an edge of the background fill.
      return line.enabled || (background.enabled && isFillBoundary)
        ? [
            {
              indicator: 'DC' as const,
              key: `dc-${definition.id}`,
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
  const upperSeries = series.find(({ key }) => key === 'dc-upper');
  const lowerSeries = series.find(({ key }) => key === 'dc-lower');
  if (background.enabled && upperSeries && lowerSeries) {
    const backgroundStyle = getTradingViewNativeIndicatorSeriesStyle(
      background,
      settings,
    );
    upperSeries.fill = {
      color: backgroundStyle.color,
      opacity: backgroundStyle.opacity * DONCHIAN_BACKGROUND_OPACITY,
      toSeriesKey: lowerSeries.key,
    };
  }
  return series;
}
