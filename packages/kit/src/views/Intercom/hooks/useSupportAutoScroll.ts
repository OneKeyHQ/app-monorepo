import { useCallback, useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import type {
  FlatList,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

export function useSupportAutoScroll(
  list: RefObject<Pick<FlatList<unknown>, 'scrollToEnd'> | null>,
  enabled: boolean,
) {
  const following = useRef(true);
  const viewportReady = useRef(false);
  const contentReady = useRef(false);
  const previousOffset = useRef(0);
  const frame = useRef<number | undefined>(undefined);
  const cancelScroll = useCallback(() => {
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    frame.current = undefined;
  }, []);
  const scrollToLatest = useCallback(() => {
    cancelScroll();
    if (
      !enabled ||
      !following.current ||
      !viewportReady.current ||
      !contentReady.current
    )
      return;
    // Content can arrive before the viewport or image/list measurements settle.
    frame.current = requestAnimationFrame(() => {
      frame.current = undefined;
      if (following.current) list.current?.scrollToEnd({ animated: false });
    });
  }, [cancelScroll, enabled, list]);
  useEffect(() => {
    scrollToLatest();
    return cancelScroll;
  }, [cancelScroll, scrollToLatest]);
  const onLayout = useCallback(
    (event: LayoutChangeEvent) => {
      viewportReady.current = event.nativeEvent.layout.height > 0;
      scrollToLatest();
    },
    [scrollToLatest],
  );
  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      contentReady.current = height > 0;
      scrollToLatest();
    },
    [scrollToLatest],
  );
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, contentSize, layoutMeasurement } =
        event.nativeEvent;
      const offset = Math.max(0, contentOffset.y);
      const distance = contentSize.height - layoutMeasurement.height - offset;
      if (distance < 80) following.current = true;
      // Loading more content is not a user scroll. In particular, the initial
      // offset-zero event must not cancel the first scroll to the latest message.
      else if (offset < previousOffset.current - 1) following.current = false;
      previousOffset.current = offset;
    },
    [],
  );
  const onScrollBeginDrag = useCallback(() => {
    following.current = false;
    cancelScroll();
  }, [cancelScroll]);
  const followLatest = useCallback(() => {
    following.current = true;
    scrollToLatest();
  }, [scrollToLatest]);
  return {
    followLatest,
    scrollProps: {
      onLayout,
      onContentSizeChange,
      onScroll,
      onScrollBeginDrag,
      scrollEventThrottle: 16,
    },
  };
}
