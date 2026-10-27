import { useCallback, useEffect, useRef } from 'react';

import type { IScrollViewRef } from '@onekeyhq/components';

import type { IDustSweepState } from '../stateMachine';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

export function getDustSweepItemScrollOffset({
  top,
  height,
  offset,
  viewportHeight,
  bottomInset,
}: {
  top: number;
  height: number;
  offset: number;
  viewportHeight: number;
  bottomInset: number;
}) {
  if (top < offset) return Math.max(0, top);
  if (top + height > offset + viewportHeight - bottomInset)
    return Math.max(0, top + height - viewportHeight + bottomInset);
  return undefined;
}

export function useDustSweepActiveItemScroll({
  state,
  rowHeight,
  bottomInset,
}: {
  state: IDustSweepState;
  rowHeight: number;
  bottomInset: number;
}) {
  const scrollViewRef = useRef<IScrollViewRef>(null);
  const viewportHeight = useRef(0);
  const offset = useRef(0);
  const rowsLayout = useRef<{ y: number; height: number } | undefined>(
    undefined,
  );
  const revealed = useRef<{ sessionId: string; keys: Set<string> } | undefined>(
    undefined,
  );
  const activeIndex = ['running', 'paused', 'blocked'].includes(state.phase)
    ? state.items.findIndex((item) =>
        ['preparing', 'signing', 'broadcasted', 'unknown'].includes(
          item.status,
        ),
      )
    : -1;
  const activeKey = state.items[activeIndex]?.token.key;
  const sessionId = state.snapshot?.id;
  const revealActiveItem = useCallback(() => {
    if (!sessionId) {
      revealed.current = undefined;
      return;
    }
    if (revealed.current?.sessionId !== sessionId)
      revealed.current = { sessionId, keys: new Set() };
    if (!activeKey || revealed.current.keys.has(activeKey)) return;
    const layout = rowsLayout.current;
    // A tall mobile live sheet can cover most of the list; keep at least one
    // row of the viewport usable so the active row still lands in view.
    const inset = Math.min(
      bottomInset,
      Math.max(0, viewportHeight.current - rowHeight),
    );
    if (
      !scrollViewRef.current ||
      viewportHeight.current <= 0 ||
      !layout ||
      // RNW rounds layout measurements at fractional display scales.
      layout.height + 1 < (activeIndex + 1) * rowHeight
    )
      return;
    const y = getDustSweepItemScrollOffset({
      top: layout.y + activeIndex * rowHeight,
      height: rowHeight,
      offset: offset.current,
      viewportHeight: viewportHeight.current,
      bottomInset: inset,
    });
    // Check each token only once, including when it is already visible.
    // Status, pause/resume and layout changes must not reclaim user scrolling.
    revealed.current.keys.add(activeKey);
    if (y !== undefined) scrollViewRef.current.scrollTo({ y, animated: true });
  }, [sessionId, activeKey, activeIndex, rowHeight, bottomInset]);

  useEffect(revealActiveItem, [revealActiveItem]);
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      viewportHeight.current = event.nativeEvent.layout.height;
      revealActiveItem();
    },
    [revealActiveItem],
  );
  const onRowsLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { y, height } = event.nativeEvent.layout;
      rowsLayout.current = { y, height };
      revealActiveItem();
    },
    [revealActiveItem],
  );
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      offset.current = event.nativeEvent.contentOffset.y;
    },
    [],
  );
  return {
    scrollViewRef,
    onLayout,
    onRowsLayout,
    onScroll,
    onContentSizeChange: revealActiveItem,
  };
}
