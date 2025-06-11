import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

interface IUseMarketTransactionsProps {
  tokenAddress: string;
  networkId: string;
}

export function useMarketTransactions({
  tokenAddress,
  networkId,
}: IUseMarketTransactionsProps) {
  const {
    result: transactionsData,
    isLoading: isRefreshing,
    run: fetchTransactions,
  } = usePromiseResult(
    async () => {
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenTransactions({
          tokenAddress,
          networkId,
        });
      return response;
    },
    [tokenAddress, networkId],
    {
      watchLoading: true,
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 30 }),
    },
  );

  const onRefresh = useCallback(async () => {
    await fetchTransactions();
  }, [fetchTransactions]);

  return {
    transactions: transactionsData?.list || [],
    transactionsData,
    fetchTransactions,
    isRefreshing,
    onRefresh,
  };
}
