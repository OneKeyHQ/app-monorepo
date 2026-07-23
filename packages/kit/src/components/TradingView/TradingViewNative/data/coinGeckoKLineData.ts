import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';
import type { IMarketTokenKLineResponse } from '@onekeyhq/shared/types/marketV2';

import {
  convertCoinGeckoChartToKLineResponse,
  getCoinGeckoChartDaysForInterval,
} from './coinGeckoKLineUtils';

import type { ITradingViewNativeHistoryRequest } from './tradingViewNativeDataProviderTypes';

const COINGECKO_ID_CACHE_MAX_SIZE = 100;

const coinGeckoIdCache = new Map<string, string>();
const coinGeckoIdRequests = new Map<string, Promise<string | undefined>>();

function cacheCoinGeckoId(tokenKey: string, coinGeckoId: string) {
  coinGeckoIdCache.delete(tokenKey);
  coinGeckoIdCache.set(tokenKey, coinGeckoId);
  if (coinGeckoIdCache.size <= COINGECKO_ID_CACHE_MAX_SIZE) {
    return;
  }

  const oldestTokenKey = coinGeckoIdCache.keys().next().value;
  if (oldestTokenKey) {
    coinGeckoIdCache.delete(oldestTokenKey);
  }
}

async function resolveCoinGeckoId({
  networkId,
  tokenAddress,
  tokenKey,
}: {
  networkId: string;
  tokenAddress: string;
  tokenKey: string;
}) {
  const cachedCoinGeckoId = coinGeckoIdCache.get(tokenKey);
  if (cachedCoinGeckoId) {
    return cachedCoinGeckoId;
  }

  let tokenInfoRequest = coinGeckoIdRequests.get(tokenKey);
  if (!tokenInfoRequest) {
    tokenInfoRequest = backgroundApiProxy.serviceToken
      .fetchTokenInfoOnly({
        networkId,
        tokenAddress,
      })
      .then((tokenInfo) => {
        const coinGeckoId = tokenInfo?.info?.coingeckoId?.trim();
        if (coinGeckoId) {
          cacheCoinGeckoId(tokenKey, coinGeckoId);
        }
        return coinGeckoId;
      });
    coinGeckoIdRequests.set(tokenKey, tokenInfoRequest);
  }

  try {
    return await tokenInfoRequest;
  } finally {
    if (coinGeckoIdRequests.get(tokenKey) === tokenInfoRequest) {
      coinGeckoIdRequests.delete(tokenKey);
    }
  }
}

export function clearCoinGeckoKLineDataCache() {
  coinGeckoIdCache.clear();
  coinGeckoIdRequests.clear();
}

export function createCoinGeckoKLineDataFetcher({
  ...source
}:
  | {
      coinGeckoId: string;
    }
  | {
      networkId: string;
      tokenAddress: string;
      tokenKey: string;
    }) {
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

    const coinGeckoId =
      'coinGeckoId' in source
        ? source.coinGeckoId.trim()
        : await resolveCoinGeckoId(source);
    if (signal.aborted || !coinGeckoId) {
      return null;
    }

    const days = getCoinGeckoChartDaysForInterval(interval);
    const chartDataRequestKey = `${coinGeckoId}:${days}`;
    let chartDataPromise = chartDataRequests.get(chartDataRequestKey);
    if (!chartDataPromise) {
      chartDataPromise = backgroundApiProxy.serviceMarket.fetchTokenChart(
        coinGeckoId,
        days,
        { requestCurrency: 'usd' },
      );
      chartDataRequests.set(chartDataRequestKey, chartDataPromise);
    }

    const chartData = await chartDataPromise.finally(() => {
      if (chartDataRequests.get(chartDataRequestKey) === chartDataPromise) {
        chartDataRequests.delete(chartDataRequestKey);
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
