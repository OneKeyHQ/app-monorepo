import { useEffect } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useMarketWSSubscriptionRecovery } from '@onekeyhq/kit/src/views/Market/hooks/useMarketWSSubscriptionRecovery';
import type { IWsPriceData } from '@onekeyhq/kit-bg/src/services/ServiceMarketWS/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import { logTradingViewNativeDataError } from './tradingViewNativeDataLogger';

const TRADING_VIEW_NATIVE_MARKET_WS_CURRENCY = 'usd';

function normalizeMarketWsKLineInterval(interval: string): string {
  switch (interval) {
    case '1':
    case '1m':
      return '1m';
    case '5':
    case '5m':
      return '5m';
    case '15':
    case '15m':
      return '15m';
    case '30':
    case '30m':
      return '30m';
    case '60':
    case '1h':
    case '1H':
      return '1h';
    case '240':
    case '4h':
    case '4H':
      return '4h';
    case '1d':
    case '1D':
      return '1d';
    case '1w':
    case '1W':
      return '1w';
    default:
      return interval;
  }
}

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

function isWsPriceData(data: unknown): data is IWsPriceData {
  if (!data || typeof data !== 'object') {
    return false;
  }

  const candidate = data as Partial<IWsPriceData>;
  return (
    typeof candidate.address === 'string' &&
    typeof candidate.symbol === 'string' &&
    typeof candidate.type === 'string' &&
    typeof candidate.unixTime === 'number' &&
    Number.isFinite(candidate.unixTime) &&
    typeof candidate.o === 'number' &&
    Number.isFinite(candidate.o) &&
    typeof candidate.h === 'number' &&
    Number.isFinite(candidate.h) &&
    typeof candidate.l === 'number' &&
    Number.isFinite(candidate.l) &&
    typeof candidate.c === 'number' &&
    Number.isFinite(candidate.c) &&
    typeof candidate.v === 'number' &&
    Number.isFinite(candidate.v) &&
    candidate.h >= candidate.l
  );
}

export function useTradingViewNativeMarketWebSocket({
  enabled,
  networkId,
  tokenAddress,
  symbol,
  chartType,
  onKLineUpdate,
}: {
  enabled: boolean;
  networkId: string;
  tokenAddress: string;
  symbol: string;
  chartType: string;
  onKLineUpdate: (point: IMarketTokenKLineDataPoint) => void;
}) {
  const wsChartType = normalizeMarketWsKLineInterval(chartType);
  const subscriptionEnabled = Boolean(
    enabled && networkId && (tokenAddress || symbol),
  );
  const { markSubscriptionActivity } = useMarketWSSubscriptionRecovery({
    enabled: subscriptionEnabled,
    networkId,
    tokenAddress,
    symbol,
    chartType: wsChartType,
    currency: TRADING_VIEW_NATIVE_MARKET_WS_CURRENCY,
    channel: 'ohlcv',
  });

  useEffect(() => {
    if (!subscriptionEnabled) {
      return;
    }

    let isCancelled = false;
    let didSubscribe = false;
    const subscription = {
      networkId,
      tokenAddress,
      symbol,
      chartType: wsChartType,
      currency: TRADING_VIEW_NATIVE_MARKET_WS_CURRENCY,
    };

    const unsubscribe = async () => {
      try {
        await backgroundApiProxy.serviceMarketWS.unsubscribeOHLCV(subscription);
      } catch (error) {
        logTradingViewNativeDataError(
          'Failed to unsubscribe from native TradingView market data',
          error,
        );
      }
    };

    const subscribe = async () => {
      try {
        await backgroundApiProxy.serviceMarketWS.connect();
        if (isCancelled) {
          return;
        }

        await backgroundApiProxy.serviceMarketWS.subscribeOHLCV(subscription);
        didSubscribe = true;
        if (isCancelled) {
          didSubscribe = false;
          await unsubscribe();
        }
      } catch (error) {
        if (!isCancelled) {
          logTradingViewNativeDataError(
            'Failed to subscribe to native TradingView market data',
            error,
          );
        }
      }
    };

    void subscribe();

    return () => {
      isCancelled = true;
      if (didSubscribe) {
        didSubscribe = false;
        void unsubscribe();
      }
    };
  }, [networkId, subscriptionEnabled, symbol, tokenAddress, wsChartType]);

  useEffect(() => {
    if (!subscriptionEnabled) {
      return;
    }

    const handleMarketDataUpdate = (
      payload: IAppEventBusPayload[EAppEventBusNames.MarketWSDataUpdate],
    ) => {
      if (
        payload.channel !== 'ohlcv' ||
        payload.tokenAddress !== tokenAddress ||
        (payload.networkId && payload.networkId !== networkId) ||
        (!payload.networkId && payload.isSubscriptionAmbiguous)
      ) {
        return;
      }

      const receivedData: unknown = payload.data;
      if (
        !isWsPriceData(receivedData) ||
        normalizeMarketWsKLineInterval(receivedData.type) !== wsChartType ||
        (!tokenAddress &&
          normalizeSymbol(receivedData.symbol) !== normalizeSymbol(symbol))
      ) {
        return;
      }

      markSubscriptionActivity();
      onKLineUpdate({
        o: receivedData.o,
        h: receivedData.h,
        l: receivedData.l,
        c: receivedData.c,
        v: receivedData.v,
        t: receivedData.unixTime,
      });

      void backgroundApiProxy.serviceMarketWS
        .clearDataCount({
          address: tokenAddress,
          type: 'ohlcv',
          networkId,
          chartType: wsChartType,
          currency: TRADING_VIEW_NATIVE_MARKET_WS_CURRENCY,
        })
        .catch((error: unknown) => {
          logTradingViewNativeDataError(
            'Failed to clear native TradingView market data count',
            error,
          );
        });
    };

    appEventBus.on(
      EAppEventBusNames.MarketWSDataUpdate,
      handleMarketDataUpdate,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.MarketWSDataUpdate,
        handleMarketDataUpdate,
      );
    };
  }, [
    markSubscriptionActivity,
    networkId,
    onKLineUpdate,
    subscriptionEnabled,
    symbol,
    tokenAddress,
    wsChartType,
  ]);
}
