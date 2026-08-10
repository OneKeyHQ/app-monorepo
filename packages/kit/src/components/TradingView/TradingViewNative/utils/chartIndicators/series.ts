import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { buildTradingViewNativeBollSeries } from './boll';
import { buildTradingViewNativeEmaSeries } from './ema';
import { buildTradingViewNativeMaSeries } from './ma';
import { buildTradingViewNativeSarSeries } from './sar';
import { TRADING_VIEW_NATIVE_INDICATORS } from './types';

import type {
  ITradingViewNativeIndicator,
  ITradingViewNativeIndicatorSeries,
  ITradingViewNativeIndicatorSeriesBuilder,
} from './types';

const INDICATOR_SERIES_BUILDERS = {
  BOLL: buildTradingViewNativeBollSeries,
  EMA: buildTradingViewNativeEmaSeries,
  MA: buildTradingViewNativeMaSeries,
  SAR: buildTradingViewNativeSarSeries,
} satisfies Record<
  ITradingViewNativeIndicator,
  ITradingViewNativeIndicatorSeriesBuilder
>;

export function buildTradingViewNativeIndicatorSeries({
  activeIndicatorValues,
  points,
}: {
  activeIndicatorValues: ReadonlySet<string>;
  points: readonly IMarketTokenKLineDataPoint[];
}): ITradingViewNativeIndicatorSeries[] {
  const series: ITradingViewNativeIndicatorSeries[] = [];

  for (const indicator of TRADING_VIEW_NATIVE_INDICATORS) {
    if (activeIndicatorValues.has(indicator)) {
      series.push(...INDICATOR_SERIES_BUILDERS[indicator](points));
    }
  }

  return series;
}
