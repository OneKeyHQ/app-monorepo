import { useEffect, useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useMarketWSSubscriptionRecovery } from '@onekeyhq/kit/src/views/Market/hooks/useMarketWSSubscriptionRecovery';
import type { IWsPriceData } from '@onekeyhq/kit-bg/src/services/ServiceMarketWS/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

const STOCK_WS_CHART_TYPE = '1m';
const STOCK_WS_CURRENCY = 'usd';

type IMarketWSDataUpdatePayload = {
  channel: string;
  tokenAddress: string;
  networkId?: string;
  isSubscriptionAmbiguous?: boolean;
  data: unknown;
};

type ISwapStockRealtimePrice = {
  tokenKey: string;
  price: string;
  chartPoint: IMarketTokenChart[number];
  lastUpdated: number;
  chartPriceUpdatedAt: number;
};

function getLogMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isStockWsChartType(type?: string) {
  return !type || type === '1' || type === STOCK_WS_CHART_TYPE;
}

function isWsPriceData(data: unknown): data is IWsPriceData {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const candidate = data as Partial<IWsPriceData>;
  return (
    typeof candidate.address === 'string' &&
    typeof candidate.c === 'number' &&
    typeof candidate.unixTime === 'number'
  );
}

function normalizeStockWsAddress({
  address,
  networkId,
}: {
  address?: string;
  networkId?: string;
}) {
  if (!address || !networkId) {
    return '';
  }
  return (
    normalizeTokenContractAddress({
      networkId,
      contractAddress: address.trim(),
    }) ?? ''
  );
}

function getStockWsTokenKey({
  networkId,
  tokenAddress,
}: {
  networkId?: string;
  tokenAddress?: string;
}) {
  const normalizedAddress = normalizeStockWsAddress({
    address: tokenAddress,
    networkId,
  });
  return networkId && normalizedAddress
    ? `${networkId}:${normalizedAddress}`
    : '';
}

function getPositivePrice(value: number) {
  return Number.isFinite(value) && value > 0 ? String(value) : undefined;
}

export function useSwapStockMarketWebSocket({
  currentStockToken,
  enabled = true,
  tokenDetail,
}: {
  currentStockToken?: ISwapToken;
  enabled?: boolean;
  tokenDetail?: IMarketTokenDetail;
}) {
  const networkId =
    tokenDetail?.networkId || currentStockToken?.networkId || '';
  const tokenAddress =
    tokenDetail?.address || currentStockToken?.contractAddress || '';
  const tokenKey = useMemo(
    () => getStockWsTokenKey({ networkId, tokenAddress }),
    [networkId, tokenAddress],
  );
  const [realtimePriceState, setRealtimePriceState] = useState<
    ISwapStockRealtimePrice | undefined
  >(undefined);
  const subscriptionEnabled = enabled && !!tokenKey;

  const { markSubscriptionActivity } = useMarketWSSubscriptionRecovery({
    enabled: subscriptionEnabled,
    networkId,
    tokenAddress,
    chartType: STOCK_WS_CHART_TYPE,
    currency: STOCK_WS_CURRENCY,
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
      chartType: STOCK_WS_CHART_TYPE,
      currency: STOCK_WS_CURRENCY,
    };

    async function initWebSocket(): Promise<void> {
      try {
        await backgroundApiProxy.serviceMarketWS.connect();
        if (isCancelled) {
          return;
        }
        await backgroundApiProxy.serviceMarketWS.subscribeOHLCV(subscription);
        didSubscribe = true;
        if (isCancelled) {
          didSubscribe = false;
          await backgroundApiProxy.serviceMarketWS.unsubscribeOHLCV(
            subscription,
          );
        }
      } catch (error) {
        defaultLogger.networkDoctor.log.error({
          info: `Failed to subscribe stock market websocket: ${getLogMessage(
            error,
          )}`,
        });
      }
    }

    void initWebSocket();

    return () => {
      isCancelled = true;
      if (!didSubscribe) {
        return;
      }
      void backgroundApiProxy.serviceMarketWS
        .unsubscribeOHLCV(subscription)
        .catch((error) => {
          defaultLogger.networkDoctor.log.error({
            info: `Failed to unsubscribe stock market websocket: ${getLogMessage(
              error,
            )}`,
          });
        });
    };
  }, [networkId, subscriptionEnabled, tokenAddress]);

  useEffect(() => {
    if (!subscriptionEnabled) {
      return;
    }

    const normalizedSubscriptionAddress = normalizeStockWsAddress({
      address: tokenAddress,
      networkId,
    });

    const handleMarketDataUpdate = (payload: IMarketWSDataUpdatePayload) => {
      if (payload.channel !== 'ohlcv' || !isWsPriceData(payload.data)) {
        return;
      }
      if (payload.networkId && payload.networkId !== networkId) {
        return;
      }
      if (!payload.networkId && payload.isSubscriptionAmbiguous) {
        return;
      }
      if (!isStockWsChartType(payload.data.type)) {
        return;
      }

      const payloadAddress = payload.tokenAddress || payload.data.address;
      const normalizedPayloadAddress = normalizeStockWsAddress({
        address: payloadAddress,
        networkId,
      });
      if (
        !normalizedPayloadAddress ||
        normalizedPayloadAddress !== normalizedSubscriptionAddress
      ) {
        return;
      }

      const price = getPositivePrice(payload.data.c);
      if (!price) {
        return;
      }

      markSubscriptionActivity();

      const chartPriceUpdatedAt = Date.now();
      const nextRealtimePrice: ISwapStockRealtimePrice = {
        tokenKey,
        price,
        chartPoint: [payload.data.unixTime, payload.data.c],
        lastUpdated: payload.data.unixTime,
        chartPriceUpdatedAt,
      };
      setRealtimePriceState((prev) => {
        if (
          prev?.tokenKey === nextRealtimePrice.tokenKey &&
          prev.price === nextRealtimePrice.price &&
          prev.lastUpdated === nextRealtimePrice.lastUpdated
        ) {
          return prev;
        }
        return nextRealtimePrice;
      });

      void backgroundApiProxy.serviceMarketWS.clearDataCount({
        address: tokenAddress,
        type: 'ohlcv',
        networkId,
        chartType: STOCK_WS_CHART_TYPE,
        currency: STOCK_WS_CURRENCY,
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
    subscriptionEnabled,
    tokenAddress,
    tokenKey,
  ]);

  useEffect(() => {
    setRealtimePriceState((prev) =>
      subscriptionEnabled && prev?.tokenKey === tokenKey ? prev : undefined,
    );
  }, [subscriptionEnabled, tokenKey]);

  const realtimePrice =
    realtimePriceState?.tokenKey === tokenKey ? realtimePriceState : undefined;
  const realtimeTokenDetail = useMemo(() => {
    if (!tokenDetail || !realtimePrice) {
      return tokenDetail;
    }
    return {
      ...tokenDetail,
      price: realtimePrice.price,
      lastUpdated: realtimePrice.lastUpdated,
      chartPriceUpdatedAt: realtimePrice.chartPriceUpdatedAt,
    };
  }, [realtimePrice, tokenDetail]);

  return {
    realtimeChartPoint: realtimePrice?.chartPoint,
    realtimeTokenDetail,
  };
}
