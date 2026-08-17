import { type RefObject, useEffect, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IWebViewRef } from '@onekeyhq/kit/src/components/WebView/types';
import { useMarketWSSubscriptionRecovery } from '@onekeyhq/kit/src/views/Market/hooks/useMarketWSSubscriptionRecovery';
import type { IWsPriceData } from '@onekeyhq/kit-bg/src/services/ServiceMarketWS/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IMarketTokenKLineResponse } from '@onekeyhq/shared/types/marketV2';

import { sendVolumeVisibilityUpdate } from '../messageHandlers/volumeVisibilityHandler';

interface IUseTradingViewV2WebSocketProps {
  networkId: string;
  tokenAddress: string;
  webRef: RefObject<IWebViewRef | null>;
  enabled?: boolean;
  chartType?: string;
  currency?: string;
  symbol?: string;
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
  const normalizedInterval = interval?.trim();
  switch (normalizedInterval) {
    case '1':
    case '1m':
      return '1m';
    case '3':
    case '3m':
      return '3m';
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
    case '120':
    case '2h':
    case '2H':
      return '2h';
    case '240':
    case '4h':
    case '4H':
      return '4h';
    case '480':
    case '8h':
    case '8H':
      return '8h';
    case '720':
    case '12h':
    case '12H':
      return '12h';
    case '1d':
    case '1D':
      return '1d';
    case '3d':
    case '3D':
      return '3d';
    case '1w':
    case '1W':
      return '1w';
    case '1M':
      return '1M';
    default:
      return normalizedInterval || '1m';
  }
}

function isMarketTokenKLineResponse(
  data: unknown,
): data is IMarketTokenKLineResponse {
  return (
    Boolean(data) &&
    typeof data === 'object' &&
    Array.isArray((data as { points?: unknown }).points)
  );
}

export function useTradingViewV2WebSocket({
  networkId,
  tokenAddress,
  webRef,
  enabled = true,
  chartType = '1m',
  currency = 'usd',
  symbol,
}: IUseTradingViewV2WebSocketProps): void {
  const lastUpdateTime = useRef<number>(0);
  const subscriptionOperationQueueRef = useRef<Promise<void>>(
    Promise.resolve(),
  );
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
    lastUpdateTime.current = 0;
  }, [currency, networkId, tokenAddress, wsChartType]);

  useEffect(() => {
    if (!networkId || !tokenAddress) {
      return;
    }

    let disposed = false;
    const enqueueSubscriptionOperation = (
      operation: () => Promise<void>,
    ): Promise<void> => {
      const queuedOperation = subscriptionOperationQueueRef.current
        .catch(() => undefined)
        .then(operation);
      subscriptionOperationQueueRef.current = queuedOperation;
      return queuedOperation;
    };

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

    async function initWebSocket(): Promise<void> {
      try {
        await backgroundApiProxy.serviceMarketWS.connect();
        if (disposed) {
          return;
        }
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
      void enqueueSubscriptionOperation(initWebSocket);
    }

    return () => {
      disposed = true;
      if (enabled) {
        void enqueueSubscriptionOperation(cleanup);
      }
    };
  }, [currency, enabled, networkId, tokenAddress, wsChartType]);

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

      const receivedData = payload.data as
        | IWsPriceData
        | IMarketTokenKLineResponse;
      if (
        receivedData &&
        !isMarketTokenKLineResponse(receivedData) &&
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

      const dataForWebView: IMarketTokenKLineResponse =
        isMarketTokenKLineResponse(receivedData)
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
          subscriptionIdentity: {
            networkId,
            tokenAddress,
            resolution: chartType,
          },
        },
      });
      sendVolumeVisibilityUpdate({
        allowHide: false,
        kLineData: dataForWebView,
        source: 'realtime',
        symbol,
        webRef,
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
    chartType,
    currency,
    webRef,
    enabled,
    wsChartType,
    symbol,
  ]);
}
