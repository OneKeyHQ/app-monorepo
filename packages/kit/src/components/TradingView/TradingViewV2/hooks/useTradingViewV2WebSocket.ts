import { type RefObject, useEffect, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useTokenDetailActions,
  useTokenDetailAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
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
  enableOHLCV?: boolean;
  chartType?: string;
  currency?: string;
}

export function useTradingViewV2WebSocket({
  networkId,
  tokenAddress,
  webRef,
  enabled = true,
  enableOHLCV = true,
  chartType = '1m',
  currency = 'usd',
}: IUseTradingViewV2WebSocketProps) {
  const lastUpdateTime = useRef<number>(0);
  const tokenDetailActions = useTokenDetailActions();
  const [tokenDetail] = useTokenDetailAtom();
  // Initialize and manage WebSocket connection
  useEffect(() => {
    if (!enabled || !networkId || !tokenAddress) {
      return;
    }

    const initWebSocket = async () => {
      try {
        await backgroundApiProxy.serviceMarketWS.connect();

        // Subscribe to OHLCV data if enabled
        if (enableOHLCV) {
          await backgroundApiProxy.serviceMarketWS.subscribeOHLCV({
            networkId,
            tokenAddress,
            chartType,
            currency,
          });
        }
      } catch (error) {
        console.error('Failed to initialize market WebSocket:', error);
      }
    };

    void initWebSocket();

    return () => {
      // Clean up specific subscriptions instead of disconnecting everything
      const cleanup = async () => {
        try {
          if (enableOHLCV) {
            await backgroundApiProxy.serviceMarketWS.unsubscribeOHLCV({
              networkId,
              tokenAddress,
              chartType,
              currency,
            });
          }
        } catch (error) {
          console.error('Failed to unsubscribe from market data:', error);
        }
      };

      void cleanup();
    };
  }, [networkId, tokenAddress, enabled, enableOHLCV, chartType, currency]);

  // Listen for market data updates via the app event bus
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleMarketDataUpdate = (payload: {
      channel: string;
      networkId: string;
      tokenAddress: string;
      messageType?: string;
      data: any;
      originalData?: any;
    }) => {
      // Only process messages for our specific token and network
      if (
        payload.networkId === networkId &&
        payload.tokenAddress === tokenAddress
      ) {
        console.log('Processing market data for TradingView:', payload);

        if (payload.channel === 'ohlcv') {
          const now = Math.floor(Date.now() / 1000);

          // Skip if we just updated recently (avoid duplicate calls)
          if (now - lastUpdateTime.current < 4) {
            return;
          }

          if (webRef.current) {
            console.log('pushLatestKLineData1', payload.data);

            const receivedData = payload.data as Record<string, any>;
            console.log('kLineData validation:', {
              hasPoints: receivedData && Array.isArray(receivedData.points),
              pointsLength:
                receivedData && Array.isArray(receivedData.points)
                  ? receivedData.points.length
                  : 0,
              hasTokenDetail: !!tokenDetail,
              isSinglePoint:
                receivedData && 'c' in receivedData && 't' in receivedData,
              payload: receivedData,
            });
            // Follow useAutoKLineUpdate pattern
            // Convert single point to array format if needed
            const dataForWebView =
              receivedData && 'points' in receivedData
                ? receivedData
                : {
                    points: [
                      {
                        ...receivedData,
                        t: receivedData.unixTime || receivedData.t, // Convert timestamp to t
                      },
                    ],
                    total: 1,
                  };

            webRef.current.sendMessageViaInjectedScript({
              type: 'autoKLineUpdate',
              payload: {
                type: 'realtime',
                kLineData: dataForWebView,
                timestamp: now,
              },
            });

            // Update token detail price following useAutoKLineUpdate pattern
            const kLineData = payload.data as Record<string, any>;

            // Handle two data formats:
            // 1. Array format: { points: [{ o, h, l, c, v, t }], total: number }
            // 2. Single point format: { o, h, l, c, v, t, eventType, type, unixTime, symbol, address }
            let latestPoint: Record<string, any> | undefined;

            if (
              kLineData &&
              Array.isArray(kLineData.points) &&
              kLineData.points.length > 0
            ) {
              // Array format - sort and get latest
              const sortedPoints = [...kLineData.points].sort(
                (a: any, b: any) => {
                  const aPoint = a as Record<string, any>;
                  const bPoint = b as Record<string, any>;
                  const aTime =
                    aPoint &&
                    typeof aPoint === 'object' &&
                    typeof aPoint.t === 'number'
                      ? aPoint.t
                      : 0;
                  const bTime =
                    bPoint &&
                    typeof bPoint === 'object' &&
                    typeof bPoint.t === 'number'
                      ? bPoint.t
                      : 0;
                  return aTime - bTime;
                },
              );
              latestPoint = sortedPoints[sortedPoints.length - 1] as Record<
                string,
                any
              >;
            } else if (
              kLineData &&
              typeof kLineData.c === 'number' &&
              ('t' in kLineData || 'unixTime' in kLineData)
            ) {
              // Single point format - use directly
              latestPoint = kLineData;
            }

            // Update token detail if we have valid price data
            if (
              latestPoint &&
              typeof latestPoint.c === 'number' &&
              tokenDetail
            ) {
              const latestPrice = latestPoint.c.toString(); // close price

              // Only update if the price is different to avoid unnecessary updates
              if (tokenDetail.price !== latestPrice) {
                const updatedTokenDetail: typeof tokenDetail = {
                  ...tokenDetail,
                  price: latestPrice,
                  lastUpdated: now * 1000, // Convert to milliseconds for JavaScript Date
                };

                tokenDetailActions.current.setTokenDetail(updatedTokenDetail);
              }
            }

            lastUpdateTime.current = now;
          }
        }
      }
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
    networkId,
    tokenAddress,
    webRef,
    enabled,
    tokenDetail,
    tokenDetailActions,
  ]);
}
