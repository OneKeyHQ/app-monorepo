import {
  Children,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';

import { debounce } from 'lodash';
import { ScrollView } from 'react-native';

import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import type PagerViewType from 'react-native-pager-view';
import type { PagerViewProps } from 'react-native-pager-view';

export function PagerView({
  children,
  ref,
  style,
  onPageSelected,
  keyboardDismissMode,
  pageWidth: pageWidthProp,
  disableAnimation = false,
  initialPage = 0,
  ...props
}: Omit<PagerViewProps, 'ref'> & {
  ref: React.RefObject<PagerViewType>;
  pageWidth: number | string;
  disableAnimation?: boolean;
}) {
  const isWeb = typeof document !== 'undefined';
  const scrollViewRef = useRef<ScrollView>(null);
  const pageIndex = useRef<number>(initialPage);
  const timerId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragClickResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isMouseDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartScrollXRef = useRef(0);
  const hasMovedWhileDraggingRef = useRef(false);
  const shouldPreventNextClickRef = useRef(false);
  const pageSize = useMemo(() => {
    return Children.count(children);
  }, [children]);

  const getScrollableNode = useCallback((): HTMLElement | null => {
    const node = (
      scrollViewRef.current as unknown as {
        getScrollableNode?: () => HTMLElement;
      }
    )?.getScrollableNode?.();
    return node instanceof HTMLElement ? node : null;
  }, []);

  const getPageWidth = useCallback(() => {
    return typeof pageWidthProp === 'number'
      ? pageWidthProp
      : getScrollableNode()?.clientWidth || 0;
  }, [getScrollableNode, pageWidthProp]);

  const scrollToX = useCallback(
    ({ x, animated }: { x: number; animated: boolean }) => {
      scrollViewRef.current?.scrollTo({
        x,
        y: 0,
        animated,
      });
    },
    [],
  );

  /** Direct DOM scrollLeft for low-latency drag following */
  const setScrollLeft = useCallback(
    (left: number) => {
      const node = getScrollableNode();
      if (node) {
        node.scrollLeft = left;
      }
    },
    [getScrollableNode],
  );

  const isLockPageIndex = useRef(false);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (isLockPageIndex.current) {
        return;
      }
      const pageWidth = getPageWidth();
      const { contentOffset } = event.nativeEvent;
      const page =
        typeof pageWidth === 'number'
          ? Math.round(contentOffset.x / pageWidth)
          : 0;
      if (pageIndex.current !== page) {
        pageIndex.current = page;
        void onPageSelected?.({
          nativeEvent: {
            position: page,
          },
        } as any);
      }
    },
    [getPageWidth, onPageSelected],
  );

  const getSafePageIndex = useCallback(
    (page: number) => {
      return Math.max(0, Math.min(page, pageSize - 1));
    },
    [pageSize],
  );

  // Set initial page position when component mounts or when pageWidth changes
  useEffect(() => {
    const pageWidth = getPageWidth();
    if (pageWidth > 0 && initialPage > 0 && scrollViewRef.current) {
      const safeInitialPage = getSafePageIndex(initialPage);
      scrollToX({
        x: safeInitialPage * pageWidth,
        animated: false,
      });
      pageIndex.current = safeInitialPage;
      void onPageSelected?.({
        nativeEvent: {
          position: safeInitialPage,
        },
      } as any);
    }
  }, [initialPage, getSafePageIndex, onPageSelected, getPageWidth, scrollToX]);

  useEffect(() => {
    const debouncedSetPage = debounce(() => {
      pageIndex.current = 0;
      void onPageSelected?.({
        nativeEvent: {
          position: 0,
        },
      } as any);
    }, 250);
    globalThis.addEventListener('resize', debouncedSetPage);
    return () => {
      globalThis.removeEventListener('resize', debouncedSetPage);
    };
  }, [onPageSelected]);

  const lockScrollEvent = useCallback((page: number) => {
    if (timerId.current) {
      clearTimeout(timerId.current);
    }
    isLockPageIndex.current = true;
    timerId.current = setTimeout(() => {
      isLockPageIndex.current = false;
      pageIndex.current = page;
    }, 500);
  }, []);

  const handleMouseDown = useCallback(
    (event: MouseEvent) => {
      if (!isWeb || event.button !== 0) {
        return;
      }
      const pageWidth = getPageWidth();
      if (!pageWidth) {
        return;
      }
      const scrollNode = getScrollableNode();
      if (!scrollNode) {
        return;
      }

      isMouseDraggingRef.current = true;
      hasMovedWhileDraggingRef.current = false;
      shouldPreventNextClickRef.current = false;
      dragStartXRef.current = event.clientX;
      dragStartScrollXRef.current = scrollNode.scrollLeft || 0;
      event.preventDefault();
    },
    [getPageWidth, getScrollableNode, isWeb],
  );

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!isMouseDraggingRef.current) {
        return;
      }
      const scrollElement = scrollViewRef.current as unknown as
        | HTMLDivElement
        | undefined;
      if (!scrollElement) {
        return;
      }

      const deltaX = event.clientX - dragStartXRef.current;
      if (Math.abs(deltaX) > 2) {
        hasMovedWhileDraggingRef.current = true;
      }
      const targetScrollLeft = dragStartScrollXRef.current - deltaX;
      setScrollLeft(targetScrollLeft);
      event.preventDefault();
    },
    [setScrollLeft],
  );

  const handleMouseUp = useCallback(
    (event: MouseEvent) => {
      if (!isMouseDraggingRef.current) {
        return;
      }
      isMouseDraggingRef.current = false;

      const pageWidth = getPageWidth();
      if (!pageWidth) {
        return;
      }
      const deltaX = event.clientX - dragStartXRef.current;
      const currentPage = pageIndex.current;
      const threshold = pageWidth * 0.2;
      let targetPage = currentPage;

      if (Math.abs(deltaX) > threshold) {
        targetPage = getSafePageIndex(
          deltaX > 0 ? currentPage - 1 : currentPage + 1,
        );
      }

      lockScrollEvent(targetPage);
      scrollToX({
        x: targetPage * pageWidth,
        animated: !disableAnimation,
      });
      shouldPreventNextClickRef.current = hasMovedWhileDraggingRef.current;
      if (dragClickResetTimerRef.current) {
        clearTimeout(dragClickResetTimerRef.current);
      }
      dragClickResetTimerRef.current = setTimeout(() => {
        shouldPreventNextClickRef.current = false;
      }, 0);
      event.preventDefault();
    },
    [
      disableAnimation,
      getPageWidth,
      getSafePageIndex,
      lockScrollEvent,
      scrollToX,
    ],
  );

  useEffect(() => {
    if (!isWeb) {
      return;
    }

    const onMouseMove = (event: Event) => {
      handleMouseMove(event as MouseEvent);
    };
    const onMouseUp = (event: Event) => {
      handleMouseUp(event as MouseEvent);
    };

    globalThis.addEventListener('mousemove', onMouseMove);
    globalThis.addEventListener('mouseup', onMouseUp);
    return () => {
      globalThis.removeEventListener('mousemove', onMouseMove);
      globalThis.removeEventListener('mouseup', onMouseUp);
      if (dragClickResetTimerRef.current) {
        clearTimeout(dragClickResetTimerRef.current);
      }
    };
  }, [handleMouseMove, handleMouseUp, isWeb]);

  const mouseDragProps = isWeb
    ? {
        onMouseDown: (event: MouseEvent) => handleMouseDown(event),
        onClickCapture: (event: MouseEvent) => {
          if (shouldPreventNextClickRef.current) {
            event.preventDefault();
            event.stopPropagation();
            shouldPreventNextClickRef.current = false;
          }
        },
      }
    : {};

  useImperativeHandle(
    ref,
    () =>
      ({
        setPage: (page: number) => {
          lockScrollEvent(page);
          const pageWidth = getPageWidth();
          scrollToX({
            x: getSafePageIndex(page) * pageWidth,
            animated: !disableAnimation,
          });
        },
        setPageWithoutAnimation: (page: number) => {
          lockScrollEvent(page);
          const pageWidth = getPageWidth();
          scrollToX({
            x: getSafePageIndex(page) * pageWidth,
            animated: false,
          });
        },
      }) as PagerViewType,
    [
      lockScrollEvent,
      getPageWidth,
      getSafePageIndex,
      disableAnimation,
      scrollToX,
    ],
  );
  return (
    <ScrollView
      style={style}
      horizontal
      pagingEnabled
      // On web, keyboardDismissMode="on-drag" causes react-native-web's
      // dismissKeyboard() to blur the globally-tracked focused input on every
      // scroll event — even for inputs on other (background) tabs. Since web
      // has no virtual keyboard to dismiss, always use "none" here.
      keyboardDismissMode="none"
      ref={scrollViewRef}
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={150}
      onScroll={handleScroll}
      {...(mouseDragProps as any)}
      {...(props as any)}
    >
      {children}
    </ScrollView>
  );
}
