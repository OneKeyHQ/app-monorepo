import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

interface IUseMarketHoldersProps {
  tokenAddress: string;
  networkId: string;
}

export function useMarketHolders({
  tokenAddress,
  networkId,
}: IUseMarketHoldersProps) {
  const {
    result: holdersData,
    isLoading: isRefreshing,
    run: fetchHolders,
  } = usePromiseResult(
    async () => {
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenHolders({
          tokenAddress,
          networkId,
        });
      return response;
    },
    [tokenAddress, networkId],
    {
      watchLoading: true,
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 5 }),
    },
  );

  const onRefresh = useCallback(async () => {
    await fetchHolders();
  }, [fetchHolders]);

  return {
    holders: holdersData?.list || [],
    holdersData,
    fetchHolders,
    isRefreshing,
    onRefresh,
  };
}
