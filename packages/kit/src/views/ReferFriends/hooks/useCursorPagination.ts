import { useCallback, useRef, useState } from 'react';

export interface ICursorPage {
  items: unknown[];
  cursor?: string | null;
}

interface IListState<TItem> {
  items: TItem[];
  cursor: string | undefined;
  // Query that produced the rows; a failed first page can leave older rows.
  queryKey: string | undefined;
  // See useScrollViewLoadMore's listVersion.
  version: number;
}

/**
 * Cursor list state for a referral reward page, wired to LoadMoreScrollView
 * through `scrollProps`.
 *
 * - Only the latest first-page request commits rows.
 * - A first-page request drops any in-flight append and holds paging until it
 *   settles.
 * - Rows are paged only while they belong to the active query.
 */
export function useCursorPagination<TPage extends ICursorPage>({
  queryKey,
  fetchPage,
}: {
  // Identifies the tab, filters and sort of the requested list.
  queryKey: string;
  fetchPage: (cursor: string | undefined) => Promise<TPage>;
}) {
  const [list, setList] = useState<IListState<TPage['items'][number]>>({
    items: [],
    cursor: undefined,
    queryKey: undefined,
    version: 0,
  });
  const [status, setStatus] = useState<'idle' | 'firstPage' | 'more'>('idle');
  const requestRef = useRef({ generation: 0, isAppending: false });

  const pageCursor = list.queryKey === queryKey ? list.cursor : undefined;

  // Resolves with the page once it is shown, or undefined if a newer request
  // replaced it. Rejects when the request fails.
  const loadFirstPage = useCallback(async (): Promise<TPage | undefined> => {
    const request = requestRef.current;
    request.generation += 1;
    const { generation } = request;
    const hasDroppedAppend = request.isAppending;
    request.isAppending = false;
    setStatus('firstPage');
    if (hasDroppedAppend) {
      // Re-arm the dropped page's cursor in case this request fails.
      setList((prev) => ({ ...prev, version: prev.version + 1 }));
    }
    try {
      const page = await fetchPage(undefined);
      if (generation !== requestRef.current.generation) {
        return undefined;
      }
      setList((prev) => ({
        items: page.items,
        cursor: page.cursor ?? undefined,
        queryKey,
        version: prev.version + 1,
      }));
      return page;
    } finally {
      if (generation === requestRef.current.generation) {
        setStatus('idle');
      }
    }
  }, [fetchPage, queryKey]);

  const loadMore = useCallback(async () => {
    if (!pageCursor || status !== 'idle') {
      return;
    }
    const request = requestRef.current;
    const { generation } = request;
    request.isAppending = true;
    setStatus('more');
    try {
      const page = await fetchPage(pageCursor);
      if (generation !== requestRef.current.generation) {
        return;
      }
      setList((prev) => ({
        ...prev,
        items: [...prev.items, ...page.items],
        cursor: page.cursor ?? undefined,
      }));
    } catch (error) {
      console.error('Failed to load more:', error);
    } finally {
      if (generation === requestRef.current.generation) {
        request.isAppending = false;
        setStatus('idle');
      }
    }
  }, [fetchPage, pageCursor, status]);

  return {
    items: list.items,
    isLoadingMore: status === 'more',
    loadFirstPage,
    scrollProps: {
      cursor: pageCursor,
      isLoading: status !== 'idle',
      itemCount: list.items.length,
      listVersion: list.version,
      onLoadMore: loadMore,
    },
  };
}
