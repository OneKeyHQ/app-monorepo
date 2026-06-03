import { type RefObject, useCallback, useEffect, useRef } from 'react';

import BigNumber from 'bignumber.js';

import { useInterval } from '@onekeyhq/kit/src/hooks/useInterval';
import {
  useTokenDetailActions,
  useTokenDetailAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { MARKET_TOKEN_DETAIL_REALTIME_PRICE_SOURCE } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/constants';

const HYPERLIQUID_WS_URL = 'wss://api.hyperliquid.xyz/ws';
const HYPERLIQUID_RECONNECT_DELAY = 2000;
const HYPERLIQUID_SUBSCRIPTION_SYNC_INTERVAL = 1000;

const TRADINGVIEW_HL_NUMERIC_INTERVAL_MAP: Record<string, string> = {
  '1': '1m',
  '3': '3m',
  '5': '5m',
  '15': '15m',
  '30': '30m',
  '60': '1h',
  '120': '2h',
  '240': '4h',
  '480': '8h',
  '720': '12h',
};

const HYPERLIQUID_INTERVALS = new Set([
  '1m',
  '3m',
  '5m',
  '15m',
  '30m',
  '1h',
  '2h',
  '4h',
  '8h',
  '12h',
  '1d',
  '3d',
  '1w',
  '1M',
]);

type IHyperLiquidCandleSubscription = {
  type: 'candle';
  coin: string;
  interval: string;
};

type IUseHyperLiquidTokenPriceUpdateParams = {
  hyperLiquidSymbol?: string;
  kLineResolutionRef?: RefObject<string>;
  enabled?: boolean;
};

function normalizeSymbol(symbol?: string) {
  return symbol?.trim().toUpperCase() || '';
}

function getHyperLiquidInterval(resolution?: string) {
  const interval =
    TRADINGVIEW_HL_NUMERIC_INTERVAL_MAP[resolution || ''] ||
    resolution?.replace(/H$/, 'h').replace(/D$/, 'd').replace(/W$/, 'w');
  return interval && HYPERLIQUID_INTERVALS.has(interval) ? interval : '1m';
}

function parseCandleMessage(messageData: unknown) {
  if (typeof messageData !== 'string') {
    return undefined;
  }

  try {
    const message = JSON.parse(messageData) as {
      channel?: unknown;
      data?: Record<string, unknown>;
    };
    if (message?.channel !== 'candle') {
      return undefined;
    }

    const { s: symbol, i: interval, c: close } = message.data ?? {};
    if (
      typeof symbol === 'string' &&
      typeof interval === 'string' &&
      typeof close === 'string'
    ) {
      return { symbol, interval, close };
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function isValidPrice(price: string) {
  const numericPrice = Number(price);
  return Number.isFinite(numericPrice) && numericPrice > 0;
}

function getFiniteStringValue(value: BigNumber, fallback?: string) {
  return value.isFinite() ? value.toFixed() : fallback;
}

function getPriceConverted({
  currentPrice,
  currentPriceConverted,
  latestPrice,
}: {
  currentPrice?: string;
  currentPriceConverted?: string;
  latestPrice: string;
}) {
  return getFiniteStringValue(
    new BigNumber(currentPriceConverted ?? Number.NaN)
      .div(currentPrice ?? Number.NaN)
      .multipliedBy(latestPrice),
    currentPriceConverted,
  );
}

function getPriceChange24hPercent({
  currentPrice,
  currentPriceChange24hPercent,
  latestPrice,
}: {
  currentPrice?: string;
  currentPriceChange24hPercent?: string;
  latestPrice: string;
}) {
  const previous24hPrice = new BigNumber(currentPrice ?? Number.NaN).div(
    new BigNumber(currentPriceChange24hPercent ?? Number.NaN).div(100).plus(1),
  );
  return getFiniteStringValue(
    new BigNumber(latestPrice).div(previous24hPrice).minus(1).multipliedBy(100),
    currentPriceChange24hPercent,
  );
}

function buildSubscription(
  hyperLiquidSymbol: string,
  resolution?: string,
): IHyperLiquidCandleSubscription {
  return {
    type: 'candle',
    coin: hyperLiquidSymbol,
    interval: getHyperLiquidInterval(resolution),
  };
}

function sendSubscriptionMessage(
  ws: WebSocket,
  method: 'subscribe' | 'unsubscribe',
  subscription: IHyperLiquidCandleSubscription,
) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ method, subscription }));
  }
}

export function useHyperLiquidTokenPriceUpdate({
  hyperLiquidSymbol,
  kLineResolutionRef,
  enabled = true,
}: IUseHyperLiquidTokenPriceUpdateParams) {
  const [tokenDetail] = useTokenDetailAtom();
  const tokenDetailActions = useTokenDetailActions();
  const tokenDetailRef = useRef(tokenDetail);
  const wsRef = useRef<WebSocket | null>(null);
  const subscriptionRef = useRef<IHyperLiquidCandleSubscription | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  tokenDetailRef.current = tokenDetail;

  const applyPrice = useCallback(
    (latestPrice: string) => {
      const latestTokenDetail = tokenDetailRef.current;
      if (
        !latestTokenDetail ||
        !isValidPrice(latestPrice) ||
        latestTokenDetail.price === latestPrice
      ) {
        return;
      }

      tokenDetailActions.current.setTokenDetail({
        ...latestTokenDetail,
        price: latestPrice,
        priceConverted: getPriceConverted({
          currentPrice: latestTokenDetail.price,
          currentPriceConverted: latestTokenDetail.priceConverted,
          latestPrice,
        }),
        priceChange24hPercent: getPriceChange24hPercent({
          currentPrice: latestTokenDetail.price,
          currentPriceChange24hPercent: latestTokenDetail.priceChange24hPercent,
          latestPrice,
        }),
        lastUpdated: Date.now(),
        realtimePriceSource:
          MARKET_TOKEN_DETAIL_REALTIME_PRICE_SOURCE.hyperLiquid,
      });
    },
    [tokenDetailActions],
  );

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const subscribe = useCallback(
    (
      ws: WebSocket,
      previousSubscription?: IHyperLiquidCandleSubscription | null,
    ) => {
      if (!hyperLiquidSymbol) {
        return;
      }

      const nextSubscription = buildSubscription(
        hyperLiquidSymbol,
        kLineResolutionRef?.current,
      );
      if (
        previousSubscription?.coin === nextSubscription.coin &&
        previousSubscription?.interval === nextSubscription.interval
      ) {
        return;
      }

      if (previousSubscription) {
        sendSubscriptionMessage(ws, 'unsubscribe', previousSubscription);
      }

      sendSubscriptionMessage(ws, 'subscribe', nextSubscription);
      subscriptionRef.current = nextSubscription;
    },
    [hyperLiquidSymbol, kLineResolutionRef],
  );

  const closeWebSocket = useCallback(
    (clearReconnect = true) => {
      if (clearReconnect) {
        clearReconnectTimer();
      }

      const ws = wsRef.current;
      const subscription = subscriptionRef.current;
      if (ws && subscription) {
        sendSubscriptionMessage(ws, 'unsubscribe', subscription);
      }

      wsRef.current = null;
      subscriptionRef.current = null;

      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        ws.close();
      }
    },
    [clearReconnectTimer],
  );

  useEffect(() => {
    if (!enabled || !hyperLiquidSymbol) {
      closeWebSocket();
      return;
    }

    let disposed = false;

    const connect = () => {
      if (disposed) {
        return;
      }

      closeWebSocket(false);

      const ws = new WebSocket(HYPERLIQUID_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        subscribe(ws);
      };

      ws.onmessage = (event) => {
        const candle = parseCandleMessage(event.data);
        const subscription = subscriptionRef.current;
        if (
          !candle ||
          !subscription ||
          normalizeSymbol(candle.symbol) !==
            normalizeSymbol(hyperLiquidSymbol) ||
          candle.interval !== subscription.interval
        ) {
          return;
        }

        applyPrice(candle.close);
      };

      ws.onerror = () => {
        ws.close();
      };

      ws.onclose = () => {
        if (wsRef.current === ws) {
          wsRef.current = null;
          subscriptionRef.current = null;
        }

        if (!disposed) {
          reconnectTimerRef.current = setTimeout(
            connect,
            HYPERLIQUID_RECONNECT_DELAY,
          );
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      closeWebSocket();
    };
  }, [applyPrice, closeWebSocket, enabled, hyperLiquidSymbol, subscribe]);

  const syncSubscription = useCallback(() => {
    const ws = wsRef.current;
    if (!enabled || !hyperLiquidSymbol || !ws) {
      return;
    }

    subscribe(ws, subscriptionRef.current);
  }, [enabled, hyperLiquidSymbol, subscribe]);

  useInterval(
    syncSubscription,
    enabled && hyperLiquidSymbol
      ? HYPERLIQUID_SUBSCRIPTION_SYNC_INTERVAL
      : null,
  );
}
