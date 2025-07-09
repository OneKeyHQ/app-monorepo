import { useCallback, useEffect, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

interface IUseMarketTransactionsProps {
  tokenAddress: string;
  networkId: string;
}

export function useMarketTransactions({
  tokenAddress,
  networkId,
}: IUseMarketTransactionsProps) {
  const [accumulatedTransactions, setAccumulatedTransactions] = useState<
    IMarketTokenTransaction[]
  >([]);

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

  // Reset accumulated state when token address or network ID changes
  useEffect(() => {
    setAccumulatedTransactions([]);
  }, [tokenAddress, networkId]);

  console.log('accumulatedTransactions', accumulatedTransactions);

  // Merge new and old data, add new data at the front, and deduplicate
  useEffect(() => {
    const newTransactions = transactionsData?.list;

    if (!newTransactions) {
      return;
    }

    setAccumulatedTransactions((prev) => {
      // Get existing transaction hashes
      const existingHashes = new Set(prev.map((tx) => tx.hash));
      // Filter out new transactions (not in existing hashes)
      const uniqueNewTransactions = newTransactions.filter(
        (tx) => !existingHashes.has(tx.hash),
      );
      // Add new data at the front
      const mergedTransactions = [...uniqueNewTransactions, ...prev];
      // Sort by timestamp (newest first)
      return mergedTransactions.sort((a, b) => b.timestamp - a.timestamp);
    });
  }, [transactionsData]);

  const onRefresh = useCallback(async () => {
    await fetchTransactions();
  }, [fetchTransactions]);

  return {
    transactions: accumulatedTransactions,
    transactionsData,
    fetchTransactions,
    isRefreshing,
    onRefresh,
  };
}
