import { useCallback, useRef, useState } from 'react';

import { unionBy } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { ICurrencyItem } from '@onekeyhq/shared/types/currency';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

const NATIVE_LOAD_MORE_HARD_LIMIT = 30;

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

  const reset = useCallback(() => {
    initializedRef.current = false;
    pageRef.current = 1;
    cursorRef.current = undefined;
    loadCountRef.current = 0;
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
      cursorRef.current = meta.next;
      setHasMore(!!meta.hasMore && !!meta.next);
    },
    [enabled],
  );

  const loadMore = useCallback(async () => {
    if (!enabled) return;
    if (isLoadingMore) return;
    if (!hasMore) return;
    if (!accountId || !networkId) return;
    if (
      platformEnv.isNative &&
      loadCountRef.current >= NATIVE_LOAD_MORE_HARD_LIMIT
    ) {
      return;
    }
    const cursor = cursorRef.current;
    if (!cursor) {
      setHasMore(false);
      return;
    }
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
        cursor,
      });
      pageRef.current = nextPage;
      cursorRef.current = r.next;
      loadCountRef.current += 1;
      setHasMore(!!r.hasMoreOnChainHistory && !!r.next);
      if (r.txs?.length) {
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

  return {
    appendedTxs,
    hasMore,
    isLoadingMore,
    loadMore,
    reset,
    onFirstPageResponse,
  };
}
