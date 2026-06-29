import { useEffect, useMemo, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { buildRealtimePriceChange24hPercent } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2/realtimePriceUtils';
import {
  isMarketWsPriceData,
  normalizeMarketWsKLineInterval,
} from '@onekeyhq/kit/src/views/Market/hooks/marketWsUtils';
import { useMarketWSSubscriptionRecovery } from '@onekeyhq/kit/src/views/Market/hooks/useMarketWSSubscriptionRecovery';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { IMarketTokenChart } from '@onekeyhq/shared/types/market';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

const SWAP_STOCK_MARKET_WS_CHART_TYPE = '1m';
const SWAP_STOCK_MARKET_WS_CURRENCY = 'usd';

type IMarketWSDataUpdatePayload = {
  channel: string;
  tokenAddress: string;
  networkId?: string;
  isSubscriptionAmbiguous?: boolean;
  data: unknown;
};

type IStockMarketWsSubscription = {
  networkId: string;
  tokenAddress: string;
  chartType: string;
  currency: string;
};

export type ISwapStockRealtimePrice = {
  tokenKey: string;
  price: string;
  chartPoint: IMarketTokenChart[number];
  lastUpdated: number;
  chartPriceUpdatedAt: number;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getNormalizedStockWsAddress({
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
  const normalizedAddress = getNormalizedStockWsAddress({
    address: tokenAddress,
    networkId,
  });
  if (!networkId || !normalizedAddress) {
    return '';
  }
  return `${networkId}:${normalizedAddress}`;
}

function getPositivePrice(value: number) {
  return Number.isFinite(value) && value > 0 ? String(value) : undefined;
}

async function unsubscribeStockMarketWebSocket({
  chartType,
  currency,
  networkId,
  tokenAddress,
}: IStockMarketWsSubscription): Promise<void> {
  await backgroundApiProxy.serviceMarketWS.unsubscribeOHLCV({
    networkId,
    tokenAddress,
    chartType,
    currency,
  });
}

export function buildRealtimeStockTokenDetail({
  realtimePrice,
  tokenDetail,
}: {
  realtimePrice?: ISwapStockRealtimePrice;
  tokenDetail?: IMarketTokenDetail;
}) {
  if (!tokenDetail || !realtimePrice) {
    return tokenDetail;
  }

  const priceChange24hPercent = buildRealtimePriceChange24hPercent({
    currentPrice: tokenDetail.price,
    currentPriceChange24hPercent: tokenDetail.priceChange24hPercent,
    realtimePrice: realtimePrice.price,
  });

  return {
    ...tokenDetail,
    price: realtimePrice.price,
    lastUpdated: realtimePrice.lastUpdated,
    chartPriceUpdatedAt: realtimePrice.chartPriceUpdatedAt,
    ...(priceChange24hPercent !== undefined ? { priceChange24hPercent } : {}),
  };
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
  const wsChartType = normalizeMarketWsKLineInterval(
    SWAP_STOCK_MARKET_WS_CHART_TYPE,
  );
  const tokenKey = useMemo(
    () =>
      getStockWsTokenKey({
        networkId,
        tokenAddress,
      }),
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
    chartType: wsChartType,
    currency: SWAP_STOCK_MARKET_WS_CURRENCY,
    channel: 'ohlcv',
  });

  useEffect(() => {
    if (!subscriptionEnabled) {
      return;
    }

    let isCancelled = false;
    let didSubscribe = false;
    const subscription: IStockMarketWsSubscription = {
      networkId,
      tokenAddress,
      chartType: wsChartType,
      currency: SWAP_STOCK_MARKET_WS_CURRENCY,
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
          await unsubscribeStockMarketWebSocket(subscription);
        }
      } catch (error) {
        defaultLogger.networkDoctor.log.error({
          info: `Failed to subscribe stock market websocket: ${getErrorMessage(
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
      void unsubscribeStockMarketWebSocket(subscription).catch((error) => {
        defaultLogger.networkDoctor.log.error({
          info: `Failed to unsubscribe stock market websocket: ${getErrorMessage(
            error,
          )}`,
        });
      });
    };
  }, [networkId, subscriptionEnabled, tokenAddress, wsChartType]);

  useEffect(() => {
    if (!subscriptionEnabled) {
      return;
    }

    const normalizedSubscriptionAddress = getNormalizedStockWsAddress({
      address: tokenAddress,
      networkId,
    });

    const handleMarketDataUpdate = (payload: IMarketWSDataUpdatePayload) => {
      if (payload.channel !== 'ohlcv' || !isMarketWsPriceData(payload.data)) {
        return;
      }
      if (payload.networkId && payload.networkId !== networkId) {
        return;
      }
      if (!payload.networkId && payload.isSubscriptionAmbiguous) {
        return;
      }
      if (
        payload.data.type &&
        normalizeMarketWsKLineInterval(payload.data.type) !== wsChartType
      ) {
        return;
      }

      const payloadAddress = payload.tokenAddress || payload.data.address;
      const normalizedPayloadAddress = getNormalizedStockWsAddress({
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
        chartType: wsChartType,
        currency: SWAP_STOCK_MARKET_WS_CURRENCY,
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
    wsChartType,
  ]);

  useEffect(() => {
    setRealtimePriceState((prev) =>
      prev?.tokenKey === tokenKey ? prev : undefined,
    );
  }, [tokenKey]);

  const realtimePrice =
    realtimePriceState?.tokenKey === tokenKey ? realtimePriceState : undefined;
  const realtimeTokenDetail = useMemo(
    () =>
      buildRealtimeStockTokenDetail({
        realtimePrice,
        tokenDetail,
      }),
    [realtimePrice, tokenDetail],
  );

  return {
    realtimeChartPoint: realtimePrice?.chartPoint,
    realtimePrice,
    realtimeTokenDetail,
  };
}
