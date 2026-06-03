import { type RefObject, useCallback, useEffect, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useInterval } from '@onekeyhq/kit/src/hooks/useInterval';
import {
  useTokenDetailActions,
  useTokenDetailAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { MARKET_TOKEN_DETAIL_REALTIME_PRICE_SOURCE } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/constants';
import {
  buildRealtimeTokenDetail,
  isMarketTokenDetailMatched,
  isValidRealtimePrice,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/priceUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type {
  IEventCandleParameters,
  IWsCandle,
} from '@onekeyhq/shared/types/hyperliquid/sdk';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

const HYPERLIQUID_SUBSCRIPTION_SYNC_INTERVAL = 1000;

type IHyperLiquidCandleInterval = IEventCandleParameters['interval'];

const TRADINGVIEW_HL_NUMERIC_INTERVAL_MAP: Record<
  string,
  IHyperLiquidCandleInterval
> = {
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

const HYPERLIQUID_INTERVALS = new Set<IHyperLiquidCandleInterval>([
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
  coin: string;
  interval: IHyperLiquidCandleInterval;
};

type IUseHyperLiquidTokenPriceUpdateParams = {
  hyperLiquidSymbol?: string;
  tokenAddress?: string;
  networkId?: string;
  kLineResolutionRef?: RefObject<string>;
  enabled?: boolean;
};

function buildSubscriberId() {
  return `market-hl-candle-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2, 8)}`;
}

function normalizeSymbol(symbol?: string) {
  return symbol?.trim().toUpperCase() || '';
}

function isHyperLiquidInterval(
  interval?: string,
): interval is IHyperLiquidCandleInterval {
  return HYPERLIQUID_INTERVALS.has(interval as IHyperLiquidCandleInterval);
}

function getHyperLiquidInterval(
  resolution?: string,
): IHyperLiquidCandleInterval {
  const interval =
    TRADINGVIEW_HL_NUMERIC_INTERVAL_MAP[resolution || ''] ||
    resolution?.replace(/H$/, 'h').replace(/D$/, 'd').replace(/W$/, 'w');
  return isHyperLiquidInterval(interval) ? interval : '1m';
}

function buildSubscription(
  hyperLiquidSymbol: string,
  resolution?: string,
): IHyperLiquidCandleSubscription {
  return {
    coin: hyperLiquidSymbol,
    interval: getHyperLiquidInterval(resolution),
  };
}

export function useHyperLiquidTokenPriceUpdate({
  hyperLiquidSymbol,
  tokenAddress,
  networkId,
  kLineResolutionRef,
  enabled = true,
}: IUseHyperLiquidTokenPriceUpdateParams) {
  const [tokenDetail] = useTokenDetailAtom();
  const tokenDetailActions = useTokenDetailActions();
  const tokenDetailRef = useRef(tokenDetail);
  const subscriptionRef = useRef<IHyperLiquidCandleSubscription | null>(null);
  const subscriberIdRef = useRef<string | null>(null);

  if (!subscriberIdRef.current) {
    subscriberIdRef.current = buildSubscriberId();
  }

  tokenDetailRef.current = tokenDetail;

  const applyPrice = useCallback(
    (latestPrice: string) => {
      const latestTokenDetail = tokenDetailRef.current;
      if (
        !latestTokenDetail ||
        !isValidRealtimePrice(latestPrice) ||
        !isMarketTokenDetailMatched({
          tokenDetail: latestTokenDetail,
          tokenAddress,
          networkId,
        })
      ) {
        return;
      }

      tokenDetailActions.current.setTokenDetail(
        buildRealtimeTokenDetail({
          tokenDetail: latestTokenDetail,
          realtimePrice: latestPrice,
          realtimePriceSource:
            MARKET_TOKEN_DETAIL_REALTIME_PRICE_SOURCE.hyperLiquid,
        }),
      );
    },
    [networkId, tokenAddress, tokenDetailActions],
  );

  const unsubscribe = useCallback(() => {
    const subscriberId = subscriberIdRef.current;
    const hasSubscription = Boolean(subscriptionRef.current);
    subscriptionRef.current = null;
    if (!subscriberId || !hasSubscription) {
      return;
    }

    void backgroundApiProxy.serviceHyperliquidSubscription
      .unsubscribeMarketCandle({ subscriberId })
      .catch((error) => {
        console.error('Failed to unsubscribe HyperLiquid candle:', error);
      });
  }, []);

  const syncSubscription = useCallback(() => {
    if (!enabled || !hyperLiquidSymbol) {
      return;
    }

    const nextSubscription = buildSubscription(
      hyperLiquidSymbol,
      kLineResolutionRef?.current,
    );
    const currentSubscription = subscriptionRef.current;
    if (
      currentSubscription?.coin === nextSubscription.coin &&
      currentSubscription?.interval === nextSubscription.interval
    ) {
      return;
    }

    const subscriberId = subscriberIdRef.current;
    if (!subscriberId) {
      return;
    }

    subscriptionRef.current = nextSubscription;
    void backgroundApiProxy.serviceHyperliquidSubscription
      .subscribeMarketCandle({
        subscriberId,
        coin: nextSubscription.coin,
        interval: nextSubscription.interval,
      })
      .catch((error) => {
        const current = subscriptionRef.current;
        if (
          current?.coin === nextSubscription.coin &&
          current?.interval === nextSubscription.interval
        ) {
          subscriptionRef.current = null;
        }
        console.error('Failed to subscribe HyperLiquid candle:', error);
      });
  }, [enabled, hyperLiquidSymbol, kLineResolutionRef]);

  useEffect(() => {
    if (!enabled || !hyperLiquidSymbol) {
      unsubscribe();
      return;
    }

    syncSubscription();
    return unsubscribe;
  }, [enabled, hyperLiquidSymbol, syncSubscription, unsubscribe]);

  useEffect(() => {
    if (!enabled || !hyperLiquidSymbol) {
      return;
    }

    function handleHyperLiquidDataUpdate(payload: {
      subType: ESubscriptionType;
      data: unknown;
    }) {
      if (payload.subType !== ESubscriptionType.CANDLE) {
        return;
      }

      const candle = payload.data as IWsCandle | undefined;
      const subscription = subscriptionRef.current;
      if (
        !candle ||
        !subscription ||
        normalizeSymbol(candle.s) !== normalizeSymbol(hyperLiquidSymbol) ||
        candle.i !== subscription.interval
      ) {
        return;
      }

      applyPrice(candle.c);
    }

    appEventBus.on(
      EAppEventBusNames.HyperliquidDataUpdate,
      handleHyperLiquidDataUpdate,
    );

    return () => {
      appEventBus.off(
        EAppEventBusNames.HyperliquidDataUpdate,
        handleHyperLiquidDataUpdate,
      );
    };
  }, [applyPrice, enabled, hyperLiquidSymbol]);

  useInterval(
    syncSubscription,
    enabled && hyperLiquidSymbol
      ? HYPERLIQUID_SUBSCRIPTION_SYNC_INTERVAL
      : null,
  );
}
