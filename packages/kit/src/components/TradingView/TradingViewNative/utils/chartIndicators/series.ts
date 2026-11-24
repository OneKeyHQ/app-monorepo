// cspell:ignore SUPERTREND VWAP VWMA
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';
import type {
  ITradingViewNativeIndicatorSettingsItem,
  ITradingViewNativeMainIndicatorId,
} from '@onekeyhq/shared/types/tradingViewNative';

import { buildTradingViewNativeBollSeries } from './boll';
import { buildTradingViewNativeDonchianChannelSeries } from './donchian';
import { buildTradingViewNativeEmaSeries } from './ema';
import { buildTradingViewNativeEnvelopeSeries } from './envelope';
import { buildTradingViewNativeMaSeries } from './ma';
import { buildTradingViewNativeSarSeries } from './sar';
import { buildTradingViewNativeSuperTrendSeries } from './superTrend';
import { TRADING_VIEW_NATIVE_INDICATORS } from './types';
import { buildTradingViewNativeVwapSeries } from './vwap';
import { buildTradingViewNativeVwmaSeries } from './vwma';
import { buildTradingViewNativeWmaSeries } from './wma';

import type {
  ITradingViewNativeIndicator,
  ITradingViewNativeIndicatorSeries,
  ITradingViewNativeIndicatorSeriesBuilder,
} from './types';

const INDICATOR_SERIES_BUILDERS = {
  BOLL: buildTradingViewNativeBollSeries,
  DC: buildTradingViewNativeDonchianChannelSeries,
  EMA: buildTradingViewNativeEmaSeries,
  ENV: buildTradingViewNativeEnvelopeSeries,
  MA: buildTradingViewNativeMaSeries,
  SAR: buildTradingViewNativeSarSeries,
  SUPERTREND: buildTradingViewNativeSuperTrendSeries,
  VWAP: buildTradingViewNativeVwapSeries,
  VWMA: buildTradingViewNativeVwmaSeries,
  WMA: buildTradingViewNativeWmaSeries,
} satisfies Record<
  ITradingViewNativeIndicator,
  ITradingViewNativeIndicatorSeriesBuilder
>;

export function buildTradingViewNativeIndicatorSeries({
  activeIndicatorValues,
  indicatorSettings,
  points,
}: {
  activeIndicatorValues: ReadonlySet<string>;
  indicatorSettings?: Partial<
    Record<
      ITradingViewNativeMainIndicatorId,
      ITradingViewNativeIndicatorSettingsItem
    >
  >;
  points: readonly IMarketTokenKLineDataPoint[];
}): ITradingViewNativeIndicatorSeries[] {
  const series: ITradingViewNativeIndicatorSeries[] = [];

  for (const indicator of TRADING_VIEW_NATIVE_INDICATORS) {
    if (activeIndicatorValues.has(indicator)) {
      series.push(
        ...INDICATOR_SERIES_BUILDERS[indicator](
          points,
          indicatorSettings?.[indicator],
        ),
      );
    }
  }

  return series;
}
