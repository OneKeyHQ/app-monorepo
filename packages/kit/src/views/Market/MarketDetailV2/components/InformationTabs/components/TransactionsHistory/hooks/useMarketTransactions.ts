import { useCallback, useEffect, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useTokenDetail } from '@onekeyhq/kit/src/views/Market/MarketDetailV2/hooks';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

interface IUseMarketTransactionsProps {
  tokenAddress: string;
  networkId: string;
}

const DEFAULT_PAGE_SIZE = 20;

export function useMarketTransactions({
  tokenAddress,
  networkId,
}: IUseMarketTransactionsProps) {
  const [accumulatedTransactions, setAccumulatedTransactions] = useState<
    IMarketTokenTransaction[]
  >([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const { websocketConfig } = useTokenDetail();

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
    platformEnv.isNative || !websocketConfig?.txs
      ? {
          watchLoading: true,
          pollingInterval: timerUtils.getTimeDurationMs({ seconds: 5 }),
        }
      : {
          watchLoading: true,
        },
  );

  // Reset accumulated state when token address or network ID changes
  useEffect(() => {
    setAccumulatedTransactions([]);
    setHasMore(true);
  }, [tokenAddress, networkId]);

  const accumulatedTransactionsLengthRef = useRef(
    accumulatedTransactions.length,
  );
  accumulatedTransactionsLengthRef.current = accumulatedTransactions.length;

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

      if (
        platformEnv.isNativeAndroid &&
        accumulatedTransactionsLengthRef.current > 0
      ) {
        return uniqueTransactions.slice(
          0,
          accumulatedTransactionsLengthRef.current,
        );
      }

      return uniqueTransactions;
    });

    // Update hasMore based on response
    if (transactionsData?.hasMore !== undefined) {
      setHasMore(transactionsData.hasMore);
    }
  }, [transactionsData]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (!hasMore || isLoadingMore || isRefreshing) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenTransactions({
          tokenAddress,
          networkId,
          offset: accumulatedTransactions.length,
          limit: DEFAULT_PAGE_SIZE,
        });

      if (response?.list) {
        setAccumulatedTransactions((prev) => {
          // Append new data at the end
          const mergedTransactions = [...prev, ...response.list];

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

        // Update hasMore
        if (response.hasMore !== undefined) {
          setHasMore(response.hasMore);
        } else {
          // If no hasMore field, assume no more data if we got less than requested
          setHasMore(response.list.length >= DEFAULT_PAGE_SIZE);
        }
      }
    } catch (error) {
      console.error('Failed to load more transactions:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    tokenAddress,
    networkId,
    accumulatedTransactions.length,
    hasMore,
    isLoadingMore,
    isRefreshing,
  ]);

  const onRefresh = useCallback(async () => {
    await fetchTransactions();
  }, [fetchTransactions]);

  const addNewTransaction = useCallback(
    (newTransaction: IMarketTokenTransaction) => {
      setAccumulatedTransactions((prev) => {
        // Check if transaction already exists to avoid duplicates
        const existingIndex = prev.findIndex(
          (tx) => tx.hash === newTransaction.hash,
        );

        if (existingIndex !== -1) {
          return prev;
        }

        // Add new transaction at the beginning and sort by timestamp
        const updatedTransactions = [newTransaction, ...prev].sort(
          (a, b) => b.timestamp - a.timestamp,
        );

        return updatedTransactions;
      });
    },
    [],
  );

  return {
    transactions: accumulatedTransactions,
    transactionsData,
    fetchTransactions,
    isRefreshing,
    isLoadingMore,
    hasMore,
    loadMore,
    onRefresh,
    addNewTransaction,
  };
}
