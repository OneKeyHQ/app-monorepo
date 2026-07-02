import { useCallback, useEffect, useRef, useState } from 'react';

import { unionBy } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { REQUEST_TIMEOUT } from '@onekeyhq/shared/src/request/requestConst';
import { isHistoryCursorAdvanced } from '@onekeyhq/shared/src/utils/historyUtils';
import type { IAddressBadge } from '@onekeyhq/shared/types/address';
import type { ICurrencyItem } from '@onekeyhq/shared/types/currency';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

const NATIVE_LOAD_MORE_HARD_LIMIT = 30;

// Sentinel resolved by the soft-timeout race when a single load-more attempt
// outlives LOAD_MORE_SOFT_TIMEOUT_MS. A unique symbol so it can never collide
// with a real backend response object.
const SOFT_TIMEOUT_SENTINEL = Symbol('historyLoadMoreSoftTimeout');

// Soft timeout for one load-more attempt. Deliberately ABOVE the axios
// REQUEST_TIMEOUT: that timeout only guards the HTTP leg inside the background
// context, but loadMore() awaits a proxy round-trip that can hang where the
// HTTP timeout can't see — the extension UI<->service-worker bridge (whose
// callback expiry defaults to 10 minutes, far longer than this UX tolerates),
// the native cross-thread transport, or a non-axios await inside
// ServiceHistory. Sitting above REQUEST_TIMEOUT means a
// slow-but-valid request is never preempted; the timer only wins on a genuine
// lower-layer hang, releasing the otherwise-stuck footer spinner so the user
// can retry by scrolling again.
const LOAD_MORE_SOFT_TIMEOUT_MS = REQUEST_TIMEOUT + 15 * 1000;

// Coerce whatever the backend hands back as the next-page cursor into a
// non-empty string. Some chains emit numeric offsets, but the request param
// is always sent as a string. null / undefined / empty string mean "no more".
function normalizeCursor(input: unknown): string | undefined {
  if (input === null || input === undefined) return undefined;
  const value = typeof input === 'string' ? input : String(input);
  return value.length > 0 ? value : undefined;
}

function getTxIdSet(txs: IAccountHistoryTx[]): Set<string> {
  return new Set(txs.map((tx) => tx.id));
}

// A local pending tx (just-broadcast, not yet on chain) that drops out of a
// refreshed first page was replaced (RBF / speed-up / cancel) or confirmed
// under a new id. `appendedTxs` holds on-chain pages, where a local pending
// never legitimately belongs, so such a row must NOT be carried forward as a
// displaced entry — otherwise the stale pending lingers forever beside its
// replacement. A still-valid pending keeps its id on the refreshed first page,
// stays in the overlap, and is filtered as an ordinary first-page row instead.
// Written with optional chaining so it is safe on partially-shaped txs.
function isLocalPendingTx(tx: IAccountHistoryTx): boolean {
  const status = tx.displayStatus ?? tx.decodedTx?.status;
  return !!tx.isLocalCreated && status === EDecodedTxStatus.Pending;
}

type IFirstPageResponseMeta = {
  txs: IAccountHistoryTx[];
  next?: string;
  hasMore?: boolean;
  isIndexer?: boolean;
};

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
  // Forwarded `addressMap` from each load-more response. The first-page
  // caller writes addressMap into the shared historyList context directly;
  // without this callback, load-more rows would render without server-side
  // address labels, contacts, or risk badges.
  onAddressMap?: (addressMap: Record<string, IAddressBadge>) => void;
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
    onAddressMap,
  } = params;

  const [appendedTxs, setAppendedTxs] = useState<IAccountHistoryTx[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const firstPageTxsRef = useRef<IAccountHistoryTx[]>([]);
  const firstPageIdsRef = useRef<Set<string>>(new Set());
  const appendedTxsRef = useRef<IAccountHistoryTx[]>([]);
  const initializedRef = useRef(false);
  const pageRef = useRef(1);
  const cursorRef = useRef<string | undefined>(undefined);
  // Stamped from the first-page response; consumed by `isHistoryCursorAdvanced`
  // to pick between timestamp and opaque-cursor advancement rules.
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

  // Begin a hard pagination generation: clear cursor-independent progress and
  // release loading flags. Identity/filter resets always use this path; a
  // first-page refresh only uses it while no loaded range needs preserving.
  const startNewPaginationGeneration = useCallback(() => {
    pageRef.current = 1;
    loadCountRef.current = 0;
    generationRef.current += 1;
    inFlightRef.current = false;
    appendedTxsRef.current = [];
    appendedIdsRef.current = new Set();
    setAppendedTxs([]);
    setIsLoadingMore(false);
  }, []);

  const reset = useCallback(() => {
    startNewPaginationGeneration();
    firstPageTxsRef.current = [];
    firstPageIdsRef.current = new Set();
    initializedRef.current = false;
    cursorRef.current = undefined;
    isIndexerCursorRef.current = false;
    pendingLoadMoreRef.current = false;
    setHasMore(false);
  }, [startNewPaginationGeneration]);

  const onFirstPageResponse = useCallback(
    (meta: IFirstPageResponseMeta) => {
      if (!enabled) {
        setHasMore(false);
        return;
      }

      const nextFirstPageTxs = meta.txs;
      const nextFirstPageIds = getTxIdSet(nextFirstPageTxs);
      // The displaced-rows bridge only stays gap-free while the refreshed first
      // page still overlaps the previous one (i.e. fewer than HISTORY_PAGE_SIZE
      // new txs arrived since the last first page). When the two first pages are
      // fully disjoint, an unknown number of txs sit between the new first page
      // and the loaded range, so preserving would render a hole in the middle
      // of history with no cursor that can ever backfill it. In that rare case
      // fall back to a hard reset: a one-time scroll-to-top is strictly safer
      // than silently dropping a contiguous slice of history.
      // Anchor overlap on a non-sticky row only. A long-lived local pending
      // (still unconfirmed across refreshes) sits on top of every first page,
      // so counting it as "overlap" would mask a fully-disjoint on-chain range
      // (HISTORY_PAGE_SIZE+ new txs since the last refresh) and let the bridge
      // render a hole in the middle of history — the exact case the disjoint
      // hard-reset below is meant to catch.
      const overlapsPreviousFirstPage = firstPageTxsRef.current.some(
        (tx) => !isLocalPendingTx(tx) && nextFirstPageIds.has(tx.id),
      );
      const shouldPreserveLoadedRange =
        (appendedTxsRef.current.length > 0 || inFlightRef.current) &&
        overlapsPreviousFirstPage;

      if (shouldPreserveLoadedRange) {
        // Polling refreshes only the first page. Keep the already-visible
        // loaded range stable by moving rows displaced from the previous first
        // page into appendedTxs instead of shrinking the list back to page 1.
        // Drop local pending rows that fell out of the new first page (see
        // isLocalPendingTx) so a replaced/confirmed pending can't linger.
        const nextAppendedTxs = unionBy(
          [...firstPageTxsRef.current, ...appendedTxsRef.current],
          (tx) => tx.id,
        ).filter((tx) => !nextFirstPageIds.has(tx.id) && !isLocalPendingTx(tx));

        appendedTxsRef.current = nextAppendedTxs;
        appendedIdsRef.current = getTxIdSet(nextAppendedTxs);
        setAppendedTxs(nextAppendedTxs);
      } else {
        startNewPaginationGeneration();
        cursorRef.current = normalizeCursor(meta.next);
        isIndexerCursorRef.current = !!meta.isIndexer;
      }

      firstPageTxsRef.current = nextFirstPageTxs;
      firstPageIdsRef.current = nextFirstPageIds;
      initializedRef.current = true;
      // Preserve any pending replay intent when there's still a next page:
      // if onEndReached fired before pagination was armed (short list / fast
      // scroll), RN's SectionList won't refire and the effect below is the
      // only thing that will kick off page 2. Only drop the flag when we
      // know there's nothing more to load.
      if (!meta.hasMore) {
        pendingLoadMoreRef.current = false;
      }
      setHasMore(!!meta.hasMore);
    },
    [enabled, startNewPaginationGeneration],
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
    let softTimeoutTimer: ReturnType<typeof setTimeout> | undefined;
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
      const fetchPromise = mergeDerive
        ? backgroundApiProxy.serviceHistory.fetchAccountHistoryForMergeDerive({
            ...commonParams,
            indexedAccountId: indexedAccountId ?? '',
          })
        : backgroundApiProxy.serviceHistory.fetchAccountHistory({
            ...commonParams,
            accountId,
          });
      // Race the proxy round-trip against a soft timeout (see
      // LOAD_MORE_SOFT_TIMEOUT_MS). If the timer wins, the underlying request is
      // abandoned — not cancelled, but Promise.race keeps a rejection handler on
      // it so any late settle is harmless and ignored — and the finally block
      // releases the loading flags. cursor / page / loadCount are left
      // untouched, so a later onEndReached retries cleanly from the same
      // boundary.
      const timeoutPromise = new Promise<typeof SOFT_TIMEOUT_SENTINEL>(
        (resolve) => {
          softTimeoutTimer = setTimeout(
            () => resolve(SOFT_TIMEOUT_SENTINEL),
            LOAD_MORE_SOFT_TIMEOUT_MS,
          );
        },
      );
      const r = await Promise.race([fetchPromise, timeoutPromise]);
      if (r === SOFT_TIMEOUT_SENTINEL) return;
      // reset() / onFirstPageResponse ran while we were awaiting — discard this
      // response, its data belongs to a stale generation and would clobber the
      // newly-mounted state.
      if (generation !== generationRef.current) return;
      pageRef.current = nextPage;
      const previousCursor = cursor;
      const nextCursor = normalizeCursor(r.next);
      cursorRef.current = nextCursor;
      if (typeof r.isIndexer === 'boolean') {
        isIndexerCursorRef.current = r.isIndexer;
      }
      loadCountRef.current += 1;
      // Surface load-more `addressMap` (labels / contacts / risk badges) to
      // the consumer; without this the appended rows would fall back to
      // plain-address rendering even when the backend returned metadata.
      if (onAddressMap && r.addressMap) {
        onAddressMap(r.addressMap);
      }
      const incomingTxs = r.txs ?? [];
      const newRows = incomingTxs.filter(
        (tx) =>
          !firstPageIdsRef.current.has(tx.id) &&
          !appendedIdsRef.current.has(tx.id),
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
        const nextAppendedTxs = unionBy(
          [...appendedTxsRef.current, ...newRows],
          (tx) => tx.id,
        );
        appendedTxsRef.current = nextAppendedTxs;
        appendedIdsRef.current = getTxIdSet(nextAppendedTxs);
        setAppendedTxs(nextAppendedTxs);
      }
    } catch (error) {
      console.error('History loadMore failed:', error);
    } finally {
      if (softTimeoutTimer) {
        clearTimeout(softTimeoutTimer);
      }
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
    onAddressMap,
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
