import { type RefObject, useEffect, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  isMarketWsPriceData,
  normalizeMarketWsKLineInterval,
} from '@onekeyhq/kit/src/views/Market/hooks/marketWsUtils';
import { useMarketWSSubscriptionRecovery } from '@onekeyhq/kit/src/views/Market/hooks/useMarketWSSubscriptionRecovery';
import type { IWsPriceData } from '@onekeyhq/kit-bg/src/services/ServiceMarketWS/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IMarketTokenKLineResponse } from '@onekeyhq/shared/types/marketV2';

import { sendVolumeVisibilityUpdate } from '../messageHandlers/volumeVisibilityHandler';

import type { IWebViewRef } from '../../../WebView/types';
import type { ITradingViewPriceUpdateData } from '../types';

interface IUseTradingViewV2WebSocketProps {
  networkId: string;
  tokenAddress: string;
  webRef: RefObject<IWebViewRef | null>;
  enabled?: boolean;
  chartType?: string;
  currency?: string;
  symbol?: string;
  onPriceUpdate?: (data: ITradingViewPriceUpdateData) => void;
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
  onPriceUpdate,
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

      const receivedData = payload.data as
        | IWsPriceData
        | IMarketTokenKLineResponse;
      const isKLineResponse = isMarketTokenKLineResponse(receivedData);
      const isPriceData = isMarketWsPriceData(receivedData);
      if (!isKLineResponse && !isPriceData) {
        return;
      }

      if (
        isPriceData &&
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

      const dataForWebView: IMarketTokenKLineResponse = isKLineResponse
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
      if (isPriceData) {
        onPriceUpdate?.({
          symbol,
          tokenAddress,
          networkId,
          price: receivedData.c,
          timestamp: receivedData.unixTime,
          interval: receivedData.type,
          source: 'realtime',
        });
      }
      lastUpdateTime.current = now;
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
    onPriceUpdate,
  ]);
}
