import { useEffect, useState } from 'react';

import { SubscriptionClient, WebSocketTransport } from '@nktkas/hyperliquid';

import {
  getCurrentVisibilityState,
  onVisibilityStateChange,
} from '@onekeyhq/components/src/hooks/useVisibilityChange';
import type {
  ICandle,
  IPerpsSubscription,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import type { IMarketTokenKLineDataPoint } from '@onekeyhq/shared/types/marketV2';

import {
  getHyperliquidCandleInterval,
  normalizeHyperliquidCandle,
} from './hyperliquidCandleUtils';
import { logTradingViewNativeDataError } from './tradingViewNativeDataLogger';

export function useTradingViewNativeHyperliquidWebSocket({
  enabled,
  coin,
  chartInterval,
  onKLineUpdate,
}: {
  enabled: boolean;
  coin: string;
  chartInterval: string;
  onKLineUpdate: (point: IMarketTokenKLineDataPoint) => void;
}) {
  const [isVisible, setIsVisible] = useState(() => getCurrentVisibilityState());

  useEffect(() => {
    setIsVisible(getCurrentVisibilityState());
    return onVisibilityStateChange((visible) => setIsVisible(visible));
  }, []);

  useEffect(() => {
    if (!enabled || !coin || !isVisible) {
      return;
    }

    let isCancelled = false;
    let subscription: IPerpsSubscription | undefined;
    const interval = getHyperliquidCandleInterval(chartInterval);
    const transport = new WebSocketTransport({
      reconnect: {
        connectionTimeout: 5000,
        maxRetries: 999,
        reconnectionDelay: (attempt: number) =>
          Math.min(2 ** attempt * 150, 8000),
      },
      resubscribe: true,
    });
    const client = new SubscriptionClient({ transport });

    const close = async () => {
      try {
        await subscription?.unsubscribe();
      } catch (error) {
        logTradingViewNativeDataError(
          'Failed to unsubscribe from native TradingView Hyperliquid candles',
          error,
        );
      }
      try {
        await transport.close();
      } catch (error) {
        logTradingViewNativeDataError(
          'Failed to close native TradingView Hyperliquid WebSocket',
          error,
        );
      }
    };

    void client
      .candle({ coin, interval }, (candle: ICandle) => {
        if (isCancelled || candle.s !== coin || candle.i !== interval) {
          return;
        }
        const point = normalizeHyperliquidCandle(candle);
        if (point) {
          onKLineUpdate(point);
        }
      })
      .then((nextSubscription) => {
        if (isCancelled) {
          void nextSubscription.unsubscribe().catch((error: unknown) => {
            logTradingViewNativeDataError(
              'Failed to unsubscribe from cancelled native TradingView Hyperliquid candles',
              error,
            );
          });
          return;
        }
        subscription = nextSubscription;
      })
      .catch((error) => {
        if (!isCancelled) {
          logTradingViewNativeDataError(
            'Failed to subscribe to native TradingView Hyperliquid candles',
            error,
          );
        }
      });

    return () => {
      isCancelled = true;
      void close();
    };
  }, [chartInterval, coin, enabled, isVisible, onKLineUpdate]);
}
