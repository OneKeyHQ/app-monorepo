import { useCallback, useEffect, useRef } from 'react';

import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

const DEFAULT_THRESHOLD = 100;

/**
 * Cursor pagination for a ScrollView that holds a header plus a list.
 *
 * The end check runs on scroll, layout and content size changes, like
 * FlatList's onEndReached, so a first page shorter than the viewport keeps
 * loading until the content overflows or the cursor runs out.
 *
 * - Each cursor is requested once, so a failed page does not retry by itself.
 * - After a request, checks wait for the content to be measured with loading
 *   finished, so stale metrics cannot chain extra pages.
 * - Both guards reset when the user scrolls away from the end after loading,
 *   or `listVersion` changes.
 *
 * Metrics belong to one ScrollView instance; use LoadMoreScrollView when the
 * ScrollView can remount while the page stays mounted.
 */
export function useScrollViewLoadMore({
  cursor,
  isLoading,
  itemCount,
  listVersion,
  onLoadMore,
  threshold = DEFAULT_THRESHOLD,
}: {
  // Next page cursor; undefined when there are no more pages.
  cursor: string | undefined;
  // Any request that should hold pagination back, including load more.
  isLoading: boolean;
  // Rows currently rendered. A page that adds none leaves the layout as it
  // was, so its metrics need no new measurement.
  itemCount: number;
  // Changes whenever the page starts or commits a new first page, which also
  // re-arms a cursor whose in-flight page was dropped.
  listVersion: number;
  onLoadMore: () => unknown;
  threshold?: number;
}) {
  const metricsRef = useRef({ offset: 0, visible: 0, content: 0 });
  const requestedCursorRef = useRef<string | undefined>(undefined);
  const isAwaitingMeasureRef = useRef(false);
  const itemCountAtRequestRef = useRef(0);

  // Layout events can arrive before the next render, so read the latest
  // pagination state from a ref.
  const stateRef = useRef({
    cursor,
    isLoading,
    itemCount,
    onLoadMore,
    threshold,
  });
  stateRef.current = { cursor, isLoading, itemCount, onLoadMore, threshold };

  const resetGuards = useCallback(() => {
    requestedCursorRef.current = undefined;
    isAwaitingMeasureRef.current = false;
  }, []);

  const maybeLoadMore = useCallback(() => {
    const { offset, visible, content } = metricsRef.current;
    const state = stateRef.current;
    if (
      visible <= 0 ||
      content <= 0 ||
      content - visible - offset > state.threshold ||
      !state.cursor ||
      state.isLoading ||
      isAwaitingMeasureRef.current ||
      state.cursor === requestedCursorRef.current
    ) {
      return;
    }
    requestedCursorRef.current = state.cursor;
    isAwaitingMeasureRef.current = true;
    itemCountAtRequestRef.current = state.itemCount;
    void state.onLoadMore();
  }, []);

  useEffect(() => {
    resetGuards();
  }, [listVersion, resetGuards]);

  // A load can end without a layout change, e.g. a refresh returning rows of
  // the same height or an empty page, so check again once nothing is loading.
  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (itemCount === itemCountAtRequestRef.current) {
      isAwaitingMeasureRef.current = false;
    }
    maybeLoadMore();
  }, [isLoading, itemCount, listVersion, maybeLoadMore]);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      metricsRef.current = {
        offset: contentOffset.y,
        visible: layoutMeasurement.height,
        content: contentSize.height,
      };
      if (!stateRef.current.isLoading) {
        // A scroll event carries fresh metrics, even when the last page did
        // not change the content height.
        isAwaitingMeasureRef.current = false;
        // Only a scroll away from the end re-arms the cursor; size changes
        // such as a loading row appearing must not.
        if (
          contentSize.height - layoutMeasurement.height - contentOffset.y >
          stateRef.current.threshold
        ) {
          resetGuards();
        }
      }
      maybeLoadMore();
    },
    [maybeLoadMore, resetGuards],
  );

  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      metricsRef.current.visible = event.nativeEvent.layout.height;
      maybeLoadMore();
    },
    [maybeLoadMore],
  );

  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      metricsRef.current.content = height;
      if (!stateRef.current.isLoading) {
        isAwaitingMeasureRef.current = false;
      }
      maybeLoadMore();
    },
    [maybeLoadMore],
  );

  return { onScroll, onLayout, onContentSizeChange };
}
