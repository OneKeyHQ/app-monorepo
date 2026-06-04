import { type RefObject, useCallback, useEffect, useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useInterval } from '@onekeyhq/kit/src/hooks/useInterval';
import {
  useTokenDetailActions,
  useTokenDetailAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';
import { MARKET_TOKEN_DETAIL_REALTIME_PRICE_SOURCE } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/constants';
import { buildMatchedRealtimeTokenDetail } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/priceUtils';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IWsCandle } from '@onekeyhq/shared/types/hyperliquid/sdk';
import { ESubscriptionType } from '@onekeyhq/shared/types/hyperliquid/types';

import {
  type IHyperLiquidCandleInterval,
  getHyperLiquidInterval,
} from './hyperLiquidTokenPriceUpdateUtils';

const HYPERLIQUID_SUBSCRIPTION_SYNC_INTERVAL = 1000;

type IHyperLiquidCandleSubscription = {
  coin: string;
  interval: IHyperLiquidCandleInterval;
  generation: number;
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

function buildSubscription(
  hyperLiquidSymbol: string,
  resolution?: string,
): Omit<IHyperLiquidCandleSubscription, 'generation'> {
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
  const subscriptionGenerationRef = useRef(0);

  if (!subscriberIdRef.current) {
    subscriberIdRef.current = buildSubscriberId();
  }

  tokenDetailRef.current = tokenDetail;

  const applyPrice = useCallback(
    (latestPrice: string) => {
      const latestTokenDetail = buildMatchedRealtimeTokenDetail({
        tokenDetail: tokenDetailRef.current,
        tokenAddress,
        networkId,
        realtimePrice: latestPrice,
        realtimePriceSource:
          MARKET_TOKEN_DETAIL_REALTIME_PRICE_SOURCE.hyperLiquid,
      });

      if (latestTokenDetail) {
        tokenDetailActions.current.setTokenDetail(latestTokenDetail);
      }
    },
    [networkId, tokenAddress, tokenDetailActions],
  );

  const unsubscribe = useCallback(() => {
    const subscriberId = subscriberIdRef.current;
    const currentSubscription = subscriptionRef.current;
    subscriptionRef.current = null;
    if (!subscriberId || !currentSubscription) {
      return;
    }

    void backgroundApiProxy.serviceHyperliquidSubscription
      .unsubscribeMarketCandle({
        subscriberId,
        generation: currentSubscription.generation,
      })
      .catch((error) => {
        defaultLogger.perp.hyperliquid.marketCandleUnsubscribeError({
          error,
        });
      });
  }, []);

  const syncSubscription = useCallback(() => {
    if (!enabled || !hyperLiquidSymbol) {
      return;
    }

    const nextSubscriptionParams = buildSubscription(
      hyperLiquidSymbol,
      kLineResolutionRef?.current,
    );
    const currentSubscription = subscriptionRef.current;
    if (
      currentSubscription?.coin === nextSubscriptionParams.coin &&
      currentSubscription?.interval === nextSubscriptionParams.interval
    ) {
      return;
    }

    const subscriberId = subscriberIdRef.current;
    if (!subscriberId) {
      return;
    }

    subscriptionGenerationRef.current += 1;
    const nextSubscription: IHyperLiquidCandleSubscription = {
      ...nextSubscriptionParams,
      generation: subscriptionGenerationRef.current,
    };
    subscriptionRef.current = nextSubscription;
    void backgroundApiProxy.serviceHyperliquidSubscription
      .subscribeMarketCandle({
        subscriberId,
        coin: nextSubscription.coin,
        interval: nextSubscription.interval,
        generation: nextSubscription.generation,
      })
      .catch((error) => {
        const current = subscriptionRef.current;
        if (
          current?.coin === nextSubscription.coin &&
          current?.interval === nextSubscription.interval &&
          current?.generation === nextSubscription.generation
        ) {
          subscriptionRef.current = null;
        }
        defaultLogger.perp.hyperliquid.marketCandleSubscribeError({
          error,
        });
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
