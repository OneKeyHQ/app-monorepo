import { useCallback, useMemo } from 'react';

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
      pollingInterval: timerUtils.getTimeDurationMs({ seconds: 5 }),
    },
  );

  const onRefresh = useCallback(async () => {
    await fetchTransactions();
  }, [fetchTransactions]);

  const sortedTransactions = useMemo(() => {
    if (!transactionsData?.list) return [];
    // Deduplicate transactions by their hash before sorting
    const seenHashes = new Set<string>();
    const uniqueTransactions = transactionsData.list.filter((tx) => {
      if (seenHashes.has(tx.hash)) {
        return false;
      }
      seenHashes.add(tx.hash);
      return true;
    });
    // Sort by timestamp in descending order (newest first)
    return uniqueTransactions.sort((a, b) => b.timestamp - a.timestamp);
  }, [transactionsData]);

  return {
    transactions: sortedTransactions,
    transactionsData,
    fetchTransactions,
    isRefreshing,
    onRefresh,
  };
}
