import { useCallback, useEffect, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

interface IUseMarketTransactionsProps {
  tokenAddress: string;
  networkId: string;
}

interface IUseMarketTransactionsReturn {
  transactions: IMarketTokenTransaction[];
  transactionsData: { list: IMarketTokenTransaction[] } | undefined;
  fetchTransactions: () => Promise<void>;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onRefresh: () => Promise<void>;
  loadMore: () => Promise<void>;
}

const PAGE_SIZE = 50;
const MAX_PAGES = 10;
const MAX_ITEMS = PAGE_SIZE * MAX_PAGES;
const POLLING_INTERVAL_SECONDS = 5;

export function useMarketTransactions({
  tokenAddress,
  networkId,
}: IUseMarketTransactionsProps): IUseMarketTransactionsReturn {
  const [accumulatedTransactions, setAccumulatedTransactions] = useState<
    IMarketTokenTransaction[]
  >([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Common fetch function for both initial load and pagination
  const fetchTransactionsWithOffset = useCallback(
    async (offset: number) => {
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenTransactions({
          tokenAddress,
          networkId,
          limit: PAGE_SIZE,
          offset,
        });
      return response;
    },
    [tokenAddress, networkId],
  );

  // Merge and deduplicate transactions efficiently
  const mergeAndDeduplicateTransactions = useCallback(
    (
      existingTxs: IMarketTokenTransaction[],
      newTxs: IMarketTokenTransaction[],
      shouldSort = true,
    ) => {
      // Create a Map for O(1) lookup
      const txMap = new Map<string, IMarketTokenTransaction>();

      // Add all transactions to the map (newer ones will override older ones)
      [...existingTxs, ...newTxs].forEach((tx) => {
        txMap.set(tx.hash, tx);
      });

      // Convert back to array
      const uniqueTxs = Array.from(txMap.values());

      // Sort by timestamp if needed
      if (shouldSort) {
        uniqueTxs.sort((a, b) => b.timestamp - a.timestamp);
      }

      return uniqueTxs;
    },
    [],
  );

  const {
    result: transactionsData,
    isLoading: isRefreshing,
    run: fetchTransactions,
  } = usePromiseResult(
    () => fetchTransactionsWithOffset(0), // Always fetch from beginning for refresh
    [fetchTransactionsWithOffset],
    {
      watchLoading: true,
      pollingInterval: timerUtils.getTimeDurationMs({
        seconds: POLLING_INTERVAL_SECONDS,
      }),
    },
  );

  // Reset accumulated state when token address or network ID changes
  useEffect(() => {
    setAccumulatedTransactions([]);
    setHasMore(true);
  }, [tokenAddress, networkId]);

  // Merge new and old data, add new data at the front, and deduplicate
  useEffect(() => {
    const newTransactions = transactionsData?.list;

    if (!newTransactions || newTransactions.length === 0) {
      return;
    }

    setAccumulatedTransactions((prev) => {
      // Skip update if we already have all these transactions
      const newHashes = new Set(newTransactions.map((tx) => tx.hash));
      const hasNewData =
        prev.some((tx) => !newHashes.has(tx.hash)) ||
        newTransactions.some((tx) => !prev.find((p) => p.hash === tx.hash));

      if (!hasNewData && prev.length === newTransactions.length) {
        return prev;
      }

      return mergeAndDeduplicateTransactions(prev, newTransactions);
    });
  }, [transactionsData, mergeAndDeduplicateTransactions]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) {
      return;
    }

    // Check if we've reached the maximum number of items
    if (accumulatedTransactions.length >= MAX_ITEMS) {
      setHasMore(false);
      return;
    }

    setIsLoadingMore(true);
    try {
      const response = await fetchTransactionsWithOffset(
        accumulatedTransactions.length,
      );

      if (response?.list && response.list.length > 0) {
        setAccumulatedTransactions((prev) => {
          const merged = mergeAndDeduplicateTransactions(prev, response.list);
          // Limit to MAX_ITEMS
          return merged.slice(0, MAX_ITEMS);
        });

        // Check if we've reached the maximum items or received less than PAGE_SIZE items
        if (
          response.list.length < PAGE_SIZE ||
          accumulatedTransactions.length + response.list.length >= MAX_ITEMS
        ) {
          setHasMore(false);
        }
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('Failed to load more transactions:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    hasMore,
    isLoadingMore,
    accumulatedTransactions.length,
    fetchTransactionsWithOffset,
    mergeAndDeduplicateTransactions,
  ]);

  const onRefresh = useCallback(async () => {
    setHasMore(true);
    await fetchTransactions();
  }, [fetchTransactions]);

  return {
    transactions: accumulatedTransactions,
    transactionsData,
    fetchTransactions,
    isRefreshing: isRefreshing ?? false,
    isLoadingMore,
    hasMore,
    onRefresh,
    loadMore,
  };
}
