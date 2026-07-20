import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';
import type { IMarketTokenKLineResponse } from '@onekeyhq/shared/types/marketV2';

import {
  convertCoinGeckoChartToKLineResponse,
  getCoinGeckoChartDays,
} from './coinGeckoKLineUtils';

import type { ITradingViewNativeHistoryRequest } from './tradingViewNativeDataProviderTypes';

export function createCoinGeckoKLineDataFetcher(coinGeckoId: string) {
  const chartDataCache = new Map<string, Promise<IMarketTokenChart>>();

  return async ({
    signal,
    timeFrom,
    timeTo,
  }: ITradingViewNativeHistoryRequest): Promise<IMarketTokenKLineResponse | null> => {
    if (signal.aborted) {
      return null;
    }

    const days = getCoinGeckoChartDays({ timeFrom, timeTo });
    let chartDataPromise = chartDataCache.get(days);
    if (!chartDataPromise) {
      chartDataPromise = backgroundApiProxy.serviceMarket.fetchTokenChart(
        coinGeckoId,
        days,
        { requestCurrency: 'usd' },
      );
      chartDataCache.set(days, chartDataPromise);
    }

    const chartData = await chartDataPromise.catch((error) => {
      chartDataCache.delete(days);
      throw error;
    });
    if (signal.aborted) {
      return null;
    }

    return convertCoinGeckoChartToKLineResponse({
      chartData,
      timeFrom,
      timeTo,
    });
  };
}
