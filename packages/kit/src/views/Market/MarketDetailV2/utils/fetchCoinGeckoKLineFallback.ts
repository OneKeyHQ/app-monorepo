import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  convertCoinGeckoChartToKLineResponse,
  getCoinGeckoChartDaysForInterval,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/data/providers/coinGecko/coinGeckoKLineUtils';
import {
  DEFAULT_TRADING_VIEW_NATIVE_KLINE_INTERVAL,
  getTradingViewNativeKLineInterval,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/data/tradingViewNativeIntervals';
import type { IMarketKLineDataFallback } from '@onekeyhq/kit/src/components/TradingView/utils/fetchMarketKLineData';

const DEFAULT_INTERVAL = getTradingViewNativeKLineInterval(
  DEFAULT_TRADING_VIEW_NATIVE_KLINE_INTERVAL,
);

export function buildCoinGeckoKLineFallback(
  coinGeckoId: string,
): IMarketKLineDataFallback {
  return async ({ interval, timeFrom, timeTo }) => {
    const intervalConfig =
      getTradingViewNativeKLineInterval(interval) ?? DEFAULT_INTERVAL;
    if (!intervalConfig) {
      return null;
    }
    const chartData = await backgroundApiProxy.serviceMarket.fetchTokenChart(
      coinGeckoId,
      getCoinGeckoChartDaysForInterval(intervalConfig),
      { requestCurrency: 'usd' },
    );
    return convertCoinGeckoChartToKLineResponse({
      chartData,
      intervalSeconds: intervalConfig.seconds,
      timeFrom,
      timeTo,
    });
  };
}
