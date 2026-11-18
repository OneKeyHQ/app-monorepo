import { useCallback } from 'react';

import type { ITradingViewNativePriceUpdateData } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';

import { useMarketChartPriceUpdate } from './useMarketChartPriceUpdate';

export function useMarketNativeChartPriceUpdate({
  networkId,
  tokenAddress,
  enabled = true,
}: {
  networkId: string;
  tokenAddress: string;
  enabled?: boolean;
}) {
  const acceptChartPrice = useMarketChartPriceUpdate({
    networkId,
    tokenAddress,
    enabled,
  });

  return useCallback(
    (data: ITradingViewNativePriceUpdateData) => {
      if (!Number.isFinite(data.price) || data.price <= 0) {
        return;
      }
      acceptChartPrice(String(data.price), data.source);
    },
    [acceptChartPrice],
  );
}
