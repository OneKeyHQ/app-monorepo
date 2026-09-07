import { useCallback } from 'react';

import type { ITradingViewNativePriceUpdateData } from '@onekeyhq/kit/src/components/TradingView/TradingViewNative';
import { useTokenDetailActions } from '@onekeyhq/kit/src/states/jotai/contexts/marketV2';

export function useMarketNativeChartPriceUpdate({
  networkId,
  tokenAddress,
  enabled = true,
}: {
  networkId: string;
  tokenAddress: string;
  enabled?: boolean;
}) {
  const actions = useTokenDetailActions();

  return useCallback(
    (data: ITradingViewNativePriceUpdateData) => {
      if (!enabled || !networkId || data.source !== 'realtime') {
        return;
      }

      actions.current.applyChartPriceUpdate({
        networkId,
        tokenAddress,
        price: String(data.price),
        lastUpdated: data.receivedAt,
      });
    },
    [actions, enabled, networkId, tokenAddress],
  );
}
