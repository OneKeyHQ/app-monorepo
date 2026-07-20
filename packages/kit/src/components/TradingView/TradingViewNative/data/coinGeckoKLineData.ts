import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';
import type { IMarketTokenKLineResponse } from '@onekeyhq/shared/types/marketV2';

import {
  convertCoinGeckoChartToKLineResponse,
  getCoinGeckoChartDaysForInterval,
} from './coinGeckoKLineUtils';

import type { ITradingViewNativeHistoryRequest } from './tradingViewNativeDataProviderTypes';

export function createCoinGeckoKLineDataFetcher(coinGeckoId: string) {
  const chartDataRequests = new Map<string, Promise<IMarketTokenChart>>();

  return async ({
    interval,
    signal,
    timeFrom,
    timeTo,
  }: ITradingViewNativeHistoryRequest): Promise<IMarketTokenKLineResponse | null> => {
    if (signal.aborted) {
      return null;
    }

    const days = getCoinGeckoChartDaysForInterval(interval);
    let chartDataPromise = chartDataRequests.get(days);
    if (!chartDataPromise) {
      chartDataPromise = backgroundApiProxy.serviceMarket.fetchTokenChart(
        coinGeckoId,
        days,
        { requestCurrency: 'usd' },
      );
      chartDataRequests.set(days, chartDataPromise);
    }

    const chartData = await chartDataPromise.finally(() => {
      if (chartDataRequests.get(days) === chartDataPromise) {
        chartDataRequests.delete(days);
      }
    });
    if (signal.aborted) {
      return null;
    }

    return convertCoinGeckoChartToKLineResponse({
      chartData,
      intervalSeconds: interval.seconds,
      timeFrom,
      timeTo,
    });
  };
}
