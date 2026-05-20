import { useCallback, useEffect, useRef, useState } from 'react';

import { unionBy } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { isHistoryCursorAdvanced } from '@onekeyhq/shared/src/utils/historyUtils';
import type { ICurrencyItem } from '@onekeyhq/shared/types/currency';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

const NATIVE_LOAD_MORE_HARD_LIMIT = 30;

// Coerce whatever the backend hands back as the next-page cursor into a
// non-empty string. Some chains emit numeric offsets, but the request param
// is always sent as a string. null / undefined / empty string mean "no more".
function normalizeCursor(input: unknown): string | undefined {
  if (input === null || input === undefined) return undefined;
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
  // When true, load-more routes through the merge-derive aggregator
  // (BTC/LTC etc.) and uses `indexedAccountId` instead of `accountId`.
  mergeDerive?: boolean;
  indexedAccountId?: string;
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
    mergeDerive,
    indexedAccountId,
  } = params;

  const [appendedTxs, setAppendedTxs] = useState<IAccountHistoryTx[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const initializedRef = useRef(false);
  const pageRef = useRef(1);
  const cursorRef = useRef<string | undefined>(undefined);
  // Indexer chains feed `next` back as `maxTimestampMs` (a strictly
  // decreasing ms timestamp); non-indexer chains treat `next` as opaque (and
  // some emit monotonically increasing offsets). Stamped on first-page
  // response so the cursor-advancement check can pick the right rule below.
  const isIndexerCursorRef = useRef(false);
  const loadCountRef = useRef(0);
  // Tracks an onEndReached call that arrived before pagination state was
  // ready (e.g. the user reached the bottom while the first page was still
  // loading, or the list was short enough that the threshold fired
  // immediately). RN's SectionList won't refire onEndReached until content
  // grows, so we replay the request once we're armed.
  const pendingLoadMoreRef = useRef(false);
  // Synchronous in-flight lock. `isLoadingMore` (React state) only updates
  // on the next render, so two `loadMore()` calls scheduled in the same tick
  // (e.g. onEndReached firing twice during a fast scroll on web) would both
  // see `isLoadingMore === false` and issue duplicate fetches.
  const inFlightRef = useRef(false);
  // Bumped on every reset so an in-flight response from a prior identity
  // can detect it has been superseded and skip its state writes.
  const generationRef = useRef(0);
  // Mirror of appendedTxs ids so loadMore can detect "no progress" responses
  // (duplicate-emit / chain reorg) without taking a stale state closure.
  const appendedIdsRef = useRef<Set<string>>(new Set());

  const reset = useCallback(() => {
    initializedRef.current = false;
    pageRef.current = 1;
    cursorRef.current = undefined;
    isIndexerCursorRef.current = false;
    loadCountRef.current = 0;
    pendingLoadMoreRef.current = false;
    inFlightRef.current = false;
    generationRef.current += 1;
    appendedIdsRef.current = new Set();
    setAppendedTxs([]);
    setHasMore(false);
    setIsLoadingMore(false);
  }, []);

  const onFirstPageResponse = useCallback(
    (meta: { next?: string; hasMore?: boolean; isIndexer?: boolean }) => {
      if (!enabled) {
        setHasMore(false);
        return;
      }
      if (initializedRef.current) {
        return;
      }
      initializedRef.current = true;
      pageRef.current = 1;
      // Cursor is opportunistic — indexer chains feed it back as
      // `maxTimestampMs`; non-indexer chains pass it as opaque `cursor`.
      // Either way, hasMore is the backend's word.
      cursorRef.current = normalizeCursor(meta.next);
      isIndexerCursorRef.current = !!meta.isIndexer;
      setHasMore(!!meta.hasMore);
    },
    [enabled],
  );

  const loadMore = useCallback(async () => {
    if (!enabled) {
      pendingLoadMoreRef.current = false;
      return;
    }
    if (inFlightRef.current) {
      // A request is already in flight on this same tick — record the intent
      // so the post-fetch effect can replay once we're idle again.
      pendingLoadMoreRef.current = true;
      return;
    }
    if (!networkId) return;
    if (mergeDerive ? !indexedAccountId : !accountId) return;
    if (
      platformEnv.isNative &&
      loadCountRef.current >= NATIVE_LOAD_MORE_HARD_LIMIT
    ) {
      pendingLoadMoreRef.current = false;
      return;
    }
    if (!hasMore || !initializedRef.current) {
      // Not ready yet — defer until the first page initializes pagination.
      pendingLoadMoreRef.current = true;
      return;
    }
    pendingLoadMoreRef.current = false;
    const cursor = cursorRef.current;
    const nextPage = pageRef.current + 1;
    const generation = generationRef.current;
    inFlightRef.current = true;
    setIsLoadingMore(true);
    try {
      // BTC/LTC merge-derive consolidates per-deriveType cursors into one
      // opaque token managed by ServiceHistory — call the aggregator instead
      // of the per-account endpoint when the consumer opted in.
      const commonParams = {
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
      };
      const r = mergeDerive
        ? await backgroundApiProxy.serviceHistory.fetchAccountHistoryForMergeDerive(
            { ...commonParams, indexedAccountId: indexedAccountId ?? '' },
          )
        : await backgroundApiProxy.serviceHistory.fetchAccountHistory({
            ...commonParams,
            accountId,
          });
      // reset() ran while we were awaiting — discard this response, its data
      // belongs to a stale identity (account/network) and would clobber the
      // newly-mounted state.
      if (generation !== generationRef.current) return;
      pageRef.current = nextPage;
      const previousCursor = cursor;
      const nextCursor = normalizeCursor(r.next);
      cursorRef.current = nextCursor;
      // Keep the indexer flag in sync defensively — the network shouldn't
      // switch mid-pagination, but if the service ever resolves it later
      // than the first page we still want to pick the right rule.
      if (typeof r.isIndexer === 'boolean') {
        isIndexerCursorRef.current = r.isIndexer;
      }
      loadCountRef.current += 1;
      const incomingTxs = r.txs ?? [];
      const newRows = incomingTxs.filter(
        (tx) => !appendedIdsRef.current.has(tx.id),
      );
      // Stop conditions (any one of these terminates pagination):
      //   - backend says no more
      //   - response was empty
      //   - no fresh ids merged in (duplicate-emit / reorg)
      //   - cursor didn't advance (would otherwise spin onEndReached → loadMore
      //     forever on web/desktop; native has NATIVE_LOAD_MORE_HARD_LIMIT)
      const cursorAdvanced = isHistoryCursorAdvanced(
        previousCursor,
        nextCursor,
        { indexerTimestampCursor: isIndexerCursorRef.current },
      );
      const gotItems = incomingTxs.length > 0;
      const addedNewRows = newRows.length > 0;
      setHasMore(
        !!r.hasMoreOnChainHistory && gotItems && addedNewRows && cursorAdvanced,
      );
      if (addedNewRows) {
        for (const tx of newRows) appendedIdsRef.current.add(tx.id);
        setAppendedTxs((prev) => unionBy([...prev, ...newRows], (tx) => tx.id));
      }
    } catch (error) {
      console.error('History loadMore failed:', error);
    } finally {
      if (generation === generationRef.current) {
        inFlightRef.current = false;
        setIsLoadingMore(false);
      }
    }
  }, [
    enabled,
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
    mergeDerive,
    indexedAccountId,
  ]);

  // If onEndReached fired before we were ready (or while a request was in
  // flight) replay it now that the pagination state is armed and idle.
  useEffect(() => {
    if (enabled && hasMore && !isLoadingMore && pendingLoadMoreRef.current) {
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
