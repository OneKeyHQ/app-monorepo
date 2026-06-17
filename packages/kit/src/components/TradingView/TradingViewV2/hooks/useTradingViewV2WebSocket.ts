import { type RefObject, useEffect, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useMarketWSSubscriptionRecovery } from '@onekeyhq/kit/src/views/Market/hooks/useMarketWSSubscriptionRecovery';
import type { IWsPriceData } from '@onekeyhq/kit-bg/src/services/ServiceMarketWS/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import type { IWebViewRef } from '../../../WebView/types';

interface IUseTradingViewV2WebSocketProps {
  networkId: string;
  tokenAddress: string;
  webRef: RefObject<IWebViewRef | null>;
  enabled?: boolean;
  chartType?: string;
  currency?: string;
}

interface IMarketPriceUpdatePayload {
  channel: string;
  tokenAddress: string;
  networkId?: string;
  isSubscriptionAmbiguous?: boolean;
  messageType?: string;
  data: unknown;
  originalData?: unknown;
}

function normalizeMarketWsKLineInterval(interval: string | undefined): string {
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
      return interval || '1m';
  }
}

export function useTradingViewV2WebSocket({
  networkId,
  tokenAddress,
  webRef,
  enabled = true,
  chartType = '1m',
  currency = 'usd',
}: IUseTradingViewV2WebSocketProps): void {
  const lastUpdateTime = useRef<number>(0);
  const wsChartType = normalizeMarketWsKLineInterval(chartType);
  const { markSubscriptionActivity } = useMarketWSSubscriptionRecovery({
    enabled,
    networkId,
    tokenAddress,
    chartType: wsChartType,
    currency,
    channel: 'ohlcv',
  });
  useEffect(() => {
    if (!networkId || !tokenAddress) {
      return;
    }

    async function initWebSocket(): Promise<void> {
      try {
        await backgroundApiProxy.serviceMarketWS.connect();
        await backgroundApiProxy.serviceMarketWS.subscribeOHLCV({
          networkId,
          tokenAddress,
          chartType: wsChartType,
          currency,
        });
      } catch (error) {
        console.error('Failed to initialize market WebSocket:', error);
      }
    }

    if (enabled) {
      void initWebSocket();
    }

    return () => {
      async function cleanup(): Promise<void> {
        try {
          await backgroundApiProxy.serviceMarketWS.unsubscribeOHLCV({
            networkId,
            tokenAddress,
            chartType: wsChartType,
            currency,
          });
        } catch (error) {
          console.error('Failed to unsubscribe from market data:', error);
        }
      }

      void cleanup();
    };
  }, [networkId, tokenAddress, enabled, wsChartType, currency]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleMarketDataUpdate(payload: IMarketPriceUpdatePayload): void {
      if (
        payload.tokenAddress !== tokenAddress ||
        payload.channel !== 'ohlcv'
      ) {
        return;
      }

      if (payload.networkId && payload.networkId !== networkId) {
        return;
      }

      if (!payload.networkId && payload.isSubscriptionAmbiguous) {
        return;
      }

      const receivedData = payload.data as IWsPriceData;
      if (
        receivedData &&
        !('points' in receivedData) &&
        receivedData.type &&
        normalizeMarketWsKLineInterval(receivedData.type) !== wsChartType
      ) {
        return;
      }

      markSubscriptionActivity();

      const now = Math.floor(Date.now() / 1000);
      if (now - lastUpdateTime.current < 4) {
        return;
      }

      const webView = webRef.current;
      if (!webView) {
        return;
      }

      const dataForWebView =
        receivedData && 'points' in receivedData
          ? receivedData
          : {
              points: [
                {
                  ...receivedData,

                  // oxlint-disable-next-line @cspell/spellchecker
                  t: receivedData.unixTime,
                },
              ],
              total: 1,
            };

      webView.sendMessageViaInjectedScript({
        type: 'autoKLineUpdate',
        payload: {
          type: 'realtime',
          kLineData: dataForWebView,
          timestamp: now,
        },
      });

      void backgroundApiProxy.serviceMarketWS.clearDataCount({
        address: tokenAddress,
        type: 'ohlcv',
        networkId,
        chartType: wsChartType,
        currency,
      });

      lastUpdateTime.current = now;
    }

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
    tokenAddress,
    currency,
    webRef,
    enabled,
    wsChartType,
  ]);
}
