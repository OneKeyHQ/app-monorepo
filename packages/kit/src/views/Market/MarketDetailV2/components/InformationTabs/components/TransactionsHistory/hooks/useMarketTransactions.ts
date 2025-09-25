import { useCallback, useEffect, useRef, useState } from 'react';

import { useThrottledCallback } from 'use-debounce';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

interface IUseMarketTransactionsProps {
  tokenAddress: string;
  networkId: string;
  normalMode: boolean;
}

const DEFAULT_PAGE_SIZE = 20;

export function useMarketTransactions({
  tokenAddress,
  networkId,
  normalMode,
}: IUseMarketTransactionsProps) {
  const [accumulatedTransactions, setAccumulatedTransactions] = useState<
    IMarketTokenTransaction[]
  >([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadTimesRef = useRef(0);
  const accumulatedTransactionsRef = useRef(accumulatedTransactions);
  const throttleSetAccumulatedTransactions = useThrottledCallback(
    (transactions: IMarketTokenTransaction[]) => {
      const current = platformEnv.isNative
        ? transactions.slice(0, 30 + loadTimesRef.current * 30)
        : transactions;
      setAccumulatedTransactions(current);
      accumulatedTransactionsRef.current = current;
    },
    platformEnv.isNative ? 1500 : 50,
  );
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
    normalMode
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
    throttleSetAccumulatedTransactions([]);
    setHasMore(true);
  }, [tokenAddress, networkId, throttleSetAccumulatedTransactions]);

  // Merge new and old data, add new data at the front, and deduplicate
  useEffect(() => {
    const newTransactions = transactionsData?.list;

    if (!newTransactions) {
      return;
    }

    const prev = accumulatedTransactionsRef.current;
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

    throttleSetAccumulatedTransactions(uniqueTransactions);

    // Update hasMore based on response
    if (transactionsData?.hasMore !== undefined) {
      setHasMore(transactionsData.hasMore);
    }
  }, [throttleSetAccumulatedTransactions, transactionsData]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (platformEnv.isNative && loadTimesRef.current > 10) {
      return;
    }
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
        loadTimesRef.current += 1;
        const prev = accumulatedTransactionsRef.current;
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

        throttleSetAccumulatedTransactions(uniqueTransactions);

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
    hasMore,
    isLoadingMore,
    isRefreshing,
    tokenAddress,
    networkId,
    accumulatedTransactions.length,
    throttleSetAccumulatedTransactions,
  ]);

  const onRefresh = useCallback(async () => {
    await fetchTransactions();
  }, [fetchTransactions]);

  const addNewTransaction = useCallback(
    (newTransaction: IMarketTokenTransaction) => {
      const prev = accumulatedTransactionsRef.current;
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

      accumulatedTransactionsRef.current = platformEnv.isNative
        ? updatedTransactions.slice(0, 50 + loadTimesRef.current * 30)
        : updatedTransactions;
      throttleSetAccumulatedTransactions(updatedTransactions);
    },
    [throttleSetAccumulatedTransactions],
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
