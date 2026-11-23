import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import type { IElement, IScrollViewRef } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketHighlight } from '@onekeyhq/shared/types/marketV2';

import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

const TARGET_TOP_SPACING = 40;

export function useInitialHighlightScroll(
  items: IMarketHighlight[] | undefined,
  highlightId: string | undefined,
) {
  const scrollRef = useRef<IScrollViewRef | null>(null);
  const viewportRef = useRef<IElement | null>(null);
  const contentRef = useRef<IElement | null>(null);
  const targetRef = useRef<IElement | null>(null);
  const finishedRef = useRef(!highlightId);
  const expectedOffsetRef = useRef<number | undefined>(undefined);
  const measuredDescriptionsRef = useRef(new Set<string>());
  const [measuredCount, setMeasuredCount] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [targetTop, setTargetTop] = useState<number | undefined>();
  const [visible, setVisible] = useState(!highlightId);
  const [pageMounted, setPageMounted] = useState(false);
  const onPageMounted = useCallback(() => setPageMounted(true), []);

  const finish = useCallback(() => {
    finishedRef.current = true;
    setVisible(true);
  }, []);
  const onViewportLayout = useCallback((event: LayoutChangeEvent) => {
    if (!finishedRef.current)
      setViewportHeight(event.nativeEvent.layout.height);
  }, []);
  const onContentLayout = useCallback((event: LayoutChangeEvent) => {
    if (platformEnv.isNative && !finishedRef.current)
      setContentHeight(event.nativeEvent.layout.height);
  }, []);
  const onTargetLayout = useCallback((event: LayoutChangeEvent) => {
    if (platformEnv.isNative && !finishedRef.current)
      setTargetTop(event.nativeEvent.layout.y);
  }, []);
  const onDescriptionMeasured = useCallback((id: string) => {
    if (finishedRef.current || measuredDescriptionsRef.current.has(id)) return;
    measuredDescriptionsRef.current.add(id);
    setMeasuredCount((count) => count + 1);
  }, []);
  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const expected = expectedOffsetRef.current;
      if (
        !finishedRef.current &&
        expected !== undefined &&
        Math.abs(event.nativeEvent.contentOffset.y - expected) <= 1
      )
        finish();
    },
    [finish],
  );

  useLayoutEffect(() => {
    // Modal headers and size constraints settle after the first layout. Wait
    // for the page transition before accepting the initial scroll position.
    if (finishedRef.current || !pageMounted || !items?.length) return;
    const index = items.findIndex((item) => item.highlightId === highlightId);
    if (index < 0) {
      finish();
      return;
    }
    if (
      viewportHeight === 0 ||
      (platformEnv.isNative &&
        (contentHeight === 0 || targetTop === undefined)) ||
      !items.every((item) =>
        measuredDescriptionsRef.current.has(item.highlightId),
      )
    )
      return;
    const scroll = scrollRef.current;
    if (!scroll) return;
    let cancelled = false;
    const position = (targetY: number, listHeight: number, height: number) => {
      if (cancelled || finishedRef.current) return;
      const offset = Math.max(
        0,
        Math.min(
          index === 0 ? 0 : targetY - TARGET_TOP_SPACING,
          listHeight - height,
        ),
      );
      if (offset === 0) {
        finish();
        return;
      }
      expectedOffsetRef.current = offset;
      scroll.scrollTo({ y: offset, animated: false });
    };
    // Use unscaled layout coordinates while the modal is entering. Wait for
    // consecutive frames with the same metrics before revealing its content.
    let frame = 0;
    let previous: string | undefined;
    const measure = () => {
      if (cancelled || finishedRef.current) return;
      let top: number;
      let height: number;
      let measuredContentHeight: number;
      if (platformEnv.isNative) {
        top = targetTop ?? 0;
        height = viewportHeight;
        measuredContentHeight = contentHeight;
      } else {
        if (!targetRef.current || !contentRef.current || !viewportRef.current)
          return;
        top = (targetRef.current as HTMLElement).offsetTop;
        measuredContentHeight = (contentRef.current as HTMLElement)
          .offsetHeight;
        height = (viewportRef.current as HTMLElement).clientHeight;
      }
      const current = `${top}:${measuredContentHeight}:${height}`;
      if (current === previous) {
        position(top, measuredContentHeight, height);
      } else {
        previous = current;
        frame = requestAnimationFrame(measure);
      }
    };
    frame = requestAnimationFrame(measure);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [
    contentHeight,
    finish,
    highlightId,
    items,
    measuredCount,
    pageMounted,
    targetTop,
    viewportHeight,
  ]);

  return {
    scrollRef,
    viewportRef,
    contentRef,
    targetRef,
    visible,
    onPageMounted,
    finish,
    onViewportLayout,
    onContentLayout,
    onTargetLayout,
    onDescriptionMeasured,
    onScroll,
  };
}
