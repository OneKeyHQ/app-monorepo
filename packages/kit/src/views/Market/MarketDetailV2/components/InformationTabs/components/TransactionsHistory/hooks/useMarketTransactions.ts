import { useCallback, useEffect, useRef, useState } from 'react';

import { useThrottledCallback } from 'use-debounce';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IMarketTokenTransaction } from '@onekeyhq/shared/types/marketV2';

import {
  MARKET_DETAIL_MAX_TRANSACTIONS,
  appendBufferedTransaction,
  mergeUniqueTransactions,
} from './transactionBufferUtils';

interface IUseMarketTransactionsProps {
  tokenAddress: string;
  networkId: string;
  normalMode: boolean;
  enableRealtimePause?: boolean;
}

const DEFAULT_PAGE_SIZE = 20;

function canLoadMoreWithinCacheLimit({
  cursor,
  transactions,
}: {
  cursor: string | undefined;
  transactions: IMarketTokenTransaction[];
}) {
  return (
    Boolean(cursor) && transactions.length < MARKET_DETAIL_MAX_TRANSACTIONS
  );
}

export function useMarketTransactions({
  tokenAddress,
  networkId,
  normalMode,
  enableRealtimePause = false,
}: IUseMarketTransactionsProps) {
  const [accumulatedTransactions, setAccumulatedTransactions] = useState<
    IMarketTokenTransaction[]
  >([]);
  const [isRealtimeHovering, setIsRealtimeHovering] = useState(false);
  const [bufferedTransactions, setBufferedTransactions] = useState<
    IMarketTokenTransaction[]
  >([]);
  const [hasBufferOverflow, setHasBufferOverflow] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadTimesRef = useRef(0);
  const accumulatedTransactionsRef = useRef(accumulatedTransactions);
  const bufferedTransactionsRef = useRef(bufferedTransactions);
  const isRealtimePausedRef = useRef(false);
  const enableRealtimePauseRef = useRef(enableRealtimePause);
  const realtimeHoverOutTimerRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);
  const cursorRef = useRef<string | undefined>(undefined);
  const getVisibleTransactions = useCallback(
    (transactions: IMarketTokenTransaction[]) =>
      transactions.slice(0, MARKET_DETAIL_MAX_TRANSACTIONS),
    [],
  );
  const updatePaginationState = useCallback(
    ({
      cursor,
      transactions,
    }: {
      cursor: string | undefined;
      transactions: IMarketTokenTransaction[];
    }) => {
      const nextHasMore = canLoadMoreWithinCacheLimit({
        cursor,
        transactions,
      });
      cursorRef.current = nextHasMore ? cursor : undefined;
      setHasMore(nextHasMore);
    },
    [],
  );
  const setAccumulatedTransactionsImmediately = useCallback(
    (transactions: IMarketTokenTransaction[]) => {
      const current = getVisibleTransactions(transactions);
      setAccumulatedTransactions(current);
      accumulatedTransactionsRef.current = current;
      updatePaginationState({
        cursor: cursorRef.current,
        transactions: current,
      });
    },
    [getVisibleTransactions, updatePaginationState],
  );
  const throttleSetAccumulatedTransactions = useThrottledCallback(
    setAccumulatedTransactionsImmediately,
    platformEnv.isNative ? 1500 : 50,
  );

  const clearRealtimeHoverOutTimer = useCallback(() => {
    if (realtimeHoverOutTimerRef.current) {
      clearTimeout(realtimeHoverOutTimerRef.current);
      realtimeHoverOutTimerRef.current = undefined;
    }
  }, []);

  const clearBufferedTransactions = useCallback(() => {
    bufferedTransactionsRef.current = [];
    setBufferedTransactions([]);
    setHasBufferOverflow(false);
  }, []);

  const flushBufferedTransactions = useCallback(() => {
    const buffered = bufferedTransactionsRef.current;
    if (buffered.length === 0) {
      return;
    }

    throttleSetAccumulatedTransactions.cancel();
    setAccumulatedTransactionsImmediately(
      mergeUniqueTransactions([
        ...buffered,
        ...accumulatedTransactionsRef.current,
      ]),
    );
    clearBufferedTransactions();
  }, [
    clearBufferedTransactions,
    setAccumulatedTransactionsImmediately,
    throttleSetAccumulatedTransactions,
  ]);

  const resetRealtimePause = useCallback(() => {
    clearRealtimeHoverOutTimer();
    isRealtimePausedRef.current = false;
    setIsRealtimeHovering(false);
    clearBufferedTransactions();
  }, [clearBufferedTransactions, clearRealtimeHoverOutTimer]);

  const disableRealtimePause = useCallback(() => {
    clearRealtimeHoverOutTimer();
    isRealtimePausedRef.current = false;
    setIsRealtimeHovering(false);

    if (bufferedTransactionsRef.current.length > 0) {
      flushBufferedTransactions();
      return;
    }

    clearBufferedTransactions();
  }, [
    clearBufferedTransactions,
    clearRealtimeHoverOutTimer,
    flushBufferedTransactions,
  ]);

  useEffect(() => {
    enableRealtimePauseRef.current = enableRealtimePause;
    if (!enableRealtimePause) {
      disableRealtimePause();
    }
  }, [disableRealtimePause, enableRealtimePause]);

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
          limit: DEFAULT_PAGE_SIZE,
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
    throttleSetAccumulatedTransactions.cancel();
    setAccumulatedTransactionsImmediately([]);
    setHasMore(true);
    cursorRef.current = undefined;
    loadTimesRef.current = 0;
    resetRealtimePause();
  }, [
    tokenAddress,
    networkId,
    setAccumulatedTransactionsImmediately,
    throttleSetAccumulatedTransactions,
    resetRealtimePause,
  ]);

  // Merge new and old data, add new data at the front, and deduplicate
  useEffect(() => {
    const newTransactions = transactionsData?.list;

    if (!newTransactions || newTransactions.length === 0) {
      cursorRef.current = undefined;
      throttleSetAccumulatedTransactions([]);
      setHasMore(false);
      return;
    }

    const prev = accumulatedTransactionsRef.current;
    const uniqueTransactions = mergeUniqueTransactions([
      ...newTransactions,
      ...prev,
    ]);
    const currentTransactions = getVisibleTransactions(uniqueTransactions);
    accumulatedTransactionsRef.current = currentTransactions;
    updatePaginationState({
      cursor: transactionsData?.cursor,
      transactions: currentTransactions,
    });

    throttleSetAccumulatedTransactions(currentTransactions);
  }, [
    getVisibleTransactions,
    throttleSetAccumulatedTransactions,
    transactionsData,
    updatePaginationState,
  ]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (platformEnv.isNative && loadTimesRef.current > 10) {
      return;
    }
    if (!hasMore || isLoadingMore || isRefreshing) {
      return;
    }

    if (
      accumulatedTransactionsRef.current.length >=
      MARKET_DETAIL_MAX_TRANSACTIONS
    ) {
      updatePaginationState({
        cursor: undefined,
        transactions: accumulatedTransactionsRef.current,
      });
      return;
    }

    const cursor = cursorRef.current;

    if (!cursor) {
      setHasMore(false);
      return;
    }

    setIsLoadingMore(true);
    try {
      const response =
        await backgroundApiProxy.serviceMarketV2.fetchMarketTokenTransactions({
          tokenAddress,
          networkId,
          cursor,
          limit: DEFAULT_PAGE_SIZE,
        });

      if (!response?.list || response.list.length === 0) {
        cursorRef.current = undefined;
        setHasMore(false);
        return;
      }

      loadTimesRef.current += 1;
      const prev = accumulatedTransactionsRef.current;
      const uniqueTransactions = mergeUniqueTransactions([
        ...prev,
        ...response.list,
      ]);
      const currentTransactions = getVisibleTransactions(uniqueTransactions);

      accumulatedTransactionsRef.current = currentTransactions;
      updatePaginationState({
        cursor: response.cursor,
        transactions: currentTransactions,
      });
      throttleSetAccumulatedTransactions(currentTransactions);
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
    getVisibleTransactions,
    throttleSetAccumulatedTransactions,
    updatePaginationState,
  ]);

  const onRefresh = useCallback(async () => {
    await fetchTransactions();
  }, [fetchTransactions]);

  const addNewTransactions = useCallback(
    (newTransactions: IMarketTokenTransaction[]) => {
      if (newTransactions.length === 0) {
        return;
      }

      const prev = accumulatedTransactionsRef.current;

      if (isRealtimePausedRef.current) {
        let nextBufferedTransactions = bufferedTransactionsRef.current;
        let isOverflow = false;

        newTransactions.forEach((transaction) => {
          const result = appendBufferedTransaction({
            bufferedTransactions: nextBufferedTransactions,
            currentTransactions: prev,
            transaction,
          });
          nextBufferedTransactions = result.bufferedTransactions;
          isOverflow = isOverflow || result.isOverflow;
        });

        bufferedTransactionsRef.current = nextBufferedTransactions;
        setBufferedTransactions(nextBufferedTransactions);
        if (isOverflow) {
          setHasBufferOverflow(true);
        }
        return;
      }

      const updatedTransactions = mergeUniqueTransactions([
        ...newTransactions,
        ...prev,
      ]);
      const currentTransactions = getVisibleTransactions(updatedTransactions);

      accumulatedTransactionsRef.current = currentTransactions;
      updatePaginationState({
        cursor: cursorRef.current,
        transactions: currentTransactions,
      });
      throttleSetAccumulatedTransactions(currentTransactions);
    },
    [
      getVisibleTransactions,
      throttleSetAccumulatedTransactions,
      updatePaginationState,
    ],
  );

  const hasTransactions = accumulatedTransactions.length > 0;
  const isRealtimePauseActive = enableRealtimePause && hasTransactions;
  const isRealtimePaused = isRealtimePauseActive && isRealtimeHovering;

  useEffect(() => {
    isRealtimePausedRef.current = isRealtimePaused;
  }, [isRealtimePaused]);

  useEffect(
    () => () => {
      clearRealtimeHoverOutTimer();
    },
    [clearRealtimeHoverOutTimer],
  );

  useEffect(() => {
    if (!hasTransactions) {
      resetRealtimePause();
    }
  }, [hasTransactions, resetRealtimePause]);

  const pauseRealtimeUpdates = useCallback(() => {
    if (
      !enableRealtimePauseRef.current ||
      accumulatedTransactionsRef.current.length === 0
    ) {
      return;
    }
    clearRealtimeHoverOutTimer();
    isRealtimePausedRef.current = true;
    setIsRealtimeHovering(true);
  }, [clearRealtimeHoverOutTimer]);

  const resumeRealtimeUpdates = useCallback(() => {
    if (!enableRealtimePauseRef.current) {
      return;
    }
    clearRealtimeHoverOutTimer();
    isRealtimePausedRef.current = false;
    setIsRealtimeHovering(false);
    flushBufferedTransactions();
  }, [clearRealtimeHoverOutTimer, flushBufferedTransactions]);

  const handleRealtimePauseHoverOut = useCallback(() => {
    if (!enableRealtimePauseRef.current) {
      return;
    }
    clearRealtimeHoverOutTimer();
    realtimeHoverOutTimerRef.current = setTimeout(() => {
      resumeRealtimeUpdates();
      realtimeHoverOutTimerRef.current = undefined;
    }, 200);
  }, [clearRealtimeHoverOutTimer, resumeRealtimeUpdates]);

  return {
    transactions: accumulatedTransactions,
    transactionsData,
    fetchTransactions,
    isRefreshing,
    isLoadingMore,
    hasMore,
    loadMore,
    onRefresh,
    addNewTransactions,
    bufferedTransactionsCount: bufferedTransactions.length,
    hasBufferOverflow,
    isRealtimePaused,
    isRealtimePauseActive,
    flushBufferedTransactions,
    resumeRealtimeUpdates,
    resetRealtimePause,
    handleRealtimePauseHoverIn: pauseRealtimeUpdates,
    handleRealtimePauseHoverOut,
    handleRealtimePauseTouchStart: pauseRealtimeUpdates,
    handleRealtimePauseTouchEnd: resumeRealtimeUpdates,
  };
}
