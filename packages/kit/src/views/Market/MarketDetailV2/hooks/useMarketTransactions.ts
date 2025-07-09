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

  // Merge new and old data, add new data at the front, and deduplicate
  useEffect(() => {
    const newTransactions = transactionsData?.list;

    if (!newTransactions) {
      return;
    }

    setAccumulatedTransactions((prev) => {
      // Merge new data at the front with existing data
      const mergedTransactions = [...newTransactions, ...prev].sort(
        (a, b) => b.timestamp - a.timestamp,
      );

      // Deduplicate by hash
      const seenHashes = new Set<string>();
      const uniqueTransactions = mergedTransactions.filter((tx) => {
        if (seenHashes.has(tx.hash)) {
          return false;
        }
        seenHashes.add(tx.hash);
        return true;
      });

      return uniqueTransactions;
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
