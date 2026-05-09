import { useCallback, useEffect, useRef, useState } from 'react';

import { unionBy } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ICurrencyItem } from '@onekeyhq/shared/types/currency';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

const NATIVE_LOAD_MORE_HARD_LIMIT = 30;

// Coerce whatever the backend hands back as the next-page cursor into a
// non-empty string. Some chains emit numeric offsets, but the request param
// is always sent as a string. null / undefined / empty string mean "no more".
function normalizeCursor(input: unknown): string | undefined {
  if (input == null) return undefined;
  const value = typeof input === 'string' ? input : String(input);
  return value.length > 0 ? value : undefined;
}

export type IUseHistoryListLoadMoreParams = {
  enabled: boolean;
  accountId: string;
  networkId: string;
  tokenIdOnNetwork?: string;
  filterScam?: boolean;
  filterLowValue?: boolean;
  excludeTestNetwork?: boolean;
  sourceCurrency?: string;
  targetCurrency?: string;
  currencyMap?: Record<string, ICurrencyItem>;
  limit?: number;
};

export function useHistoryListLoadMore(params: IUseHistoryListLoadMoreParams) {
  const {
    enabled,
    accountId,
    networkId,
    tokenIdOnNetwork,
    filterScam,
    filterLowValue,
    excludeTestNetwork,
    sourceCurrency,
    targetCurrency,
    currencyMap,
    limit,
  } = params;

  const [appendedTxs, setAppendedTxs] = useState<IAccountHistoryTx[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const initializedRef = useRef(false);
  const pageRef = useRef(1);
  const cursorRef = useRef<string | undefined>(undefined);
  const loadCountRef = useRef(0);
  // Tracks an onEndReached call that arrived before pagination state was
  // ready (e.g. the user reached the bottom while the first page was still
  // loading, or the list was short enough that the threshold fired
  // immediately). RN's SectionList won't refire onEndReached until content
  // grows, so we replay the request once we're armed.
  const pendingLoadMoreRef = useRef(false);

  const reset = useCallback(() => {
    initializedRef.current = false;
    pageRef.current = 1;
    cursorRef.current = undefined;
    loadCountRef.current = 0;
    pendingLoadMoreRef.current = false;
    setAppendedTxs([]);
    setHasMore(false);
    setIsLoadingMore(false);
  }, []);

  const onFirstPageResponse = useCallback(
    (meta: { next?: string; hasMore?: boolean }) => {
      if (!enabled) {
        setHasMore(false);
        return;
      }
      if (initializedRef.current) {
        return;
      }
      initializedRef.current = true;
      pageRef.current = 1;
      // Cursor is opportunistic — indexer chains never produce one, non-indexer
      // chains use it for the next request body. Either way, hasMore is the
      // backend's word.
      cursorRef.current = normalizeCursor(meta.next);
      setHasMore(!!meta.hasMore);
    },
    [enabled],
  );

  const loadMore = useCallback(async () => {
    if (!enabled) {
      pendingLoadMoreRef.current = false;
      return;
    }
    if (isLoadingMore) return;
    if (!accountId || !networkId) return;
    if (
      platformEnv.isNative &&
      loadCountRef.current >= NATIVE_LOAD_MORE_HARD_LIMIT
    ) {
      pendingLoadMoreRef.current = false;
      return;
    }
    if (!hasMore || !initializedRef.current) {
      // Not ready yet — defer until the first page initialises pagination.
      pendingLoadMoreRef.current = true;
      return;
    }
    pendingLoadMoreRef.current = false;
    const cursor = cursorRef.current;
    const nextPage = pageRef.current + 1;
    setIsLoadingMore(true);
    try {
      const r = await backgroundApiProxy.serviceHistory.fetchAccountHistory({
        accountId,
        networkId,
        tokenIdOnNetwork,
        filterScam,
        filterLowValue,
        excludeTestNetwork,
        sourceCurrency,
        targetCurrency,
        currencyMap,
        limit,
        page: nextPage,
        ...(cursor ? { cursor } : {}),
      });
      pageRef.current = nextPage;
      cursorRef.current = normalizeCursor(r.next);
      loadCountRef.current += 1;
      // Belt-and-suspenders: empty result also means "no more", protects
      // against backend bugs where hasMore stays stuck on true.
      const gotItems = !!r.txs?.length;
      setHasMore(!!r.hasMoreOnChainHistory && gotItems);
      if (gotItems) {
        setAppendedTxs((prev) => unionBy([...prev, ...r.txs], (tx) => tx.id));
      }
    } catch (error) {
      console.error('History loadMore failed:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    enabled,
    isLoadingMore,
    hasMore,
    accountId,
    networkId,
    tokenIdOnNetwork,
    filterScam,
    filterLowValue,
    excludeTestNetwork,
    sourceCurrency,
    targetCurrency,
    currencyMap,
    limit,
  ]);

  // If onEndReached fired before we were ready (or while a request was in
  // flight) replay it now that the pagination state is armed and idle.
  useEffect(() => {
    if (
      enabled &&
      hasMore &&
      !isLoadingMore &&
      pendingLoadMoreRef.current
    ) {
      void loadMore();
    }
  }, [enabled, hasMore, isLoadingMore, loadMore]);

  return {
    appendedTxs,
    hasMore,
    isLoadingMore,
    loadMore,
    reset,
    onFirstPageResponse,
  };
}
