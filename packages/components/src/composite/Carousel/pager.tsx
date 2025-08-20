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
import { useDebouncedCallback } from 'use-debounce';

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
}: Omit<PagerViewProps, 'ref'> & {
  ref: React.RefObject<PagerViewType>;
  pageWidth: number | string;
  disableAnimation?: boolean;
}) {
  const scrollViewRef = useRef<ScrollView>(null);
  const pageIndex = useRef<number>(initialPage);
  const timerId = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageSize = useMemo(() => {
    return Children.count(children);
  }, [children]);

  const getPageWidth = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return typeof pageWidthProp === 'number'
      ? pageWidthProp
      : (scrollViewRef.current as unknown as HTMLDivElement)?.clientWidth || 0;
  }, [pageWidthProp]);

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
      scrollViewRef.current.scrollTo({
        x: safeInitialPage * pageWidth,
        y: 0,
        animated: false,
      });
      pageIndex.current = safeInitialPage;
      void onPageSelected?.({
        nativeEvent: {
          position: safeInitialPage,
        },
      } as any);
    }
  }, [initialPage, getSafePageIndex, onPageSelected, getPageWidth]);

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

  useImperativeHandle(
    ref,
    () =>
      ({
        setPage: (page: number) => {
          lockScrollEvent(page);
          const pageWidth = getPageWidth();
          scrollViewRef.current?.scrollTo({
            x: getSafePageIndex(page) * pageWidth,
            y: 0,
            animated: !disableAnimation,
          });
        },
        setPageWithoutAnimation: (page: number) => {
          lockScrollEvent(page);
          const pageWidth = getPageWidth();
          scrollViewRef.current?.scrollTo({
            x: getSafePageIndex(page) * pageWidth,
            y: 0,
            animated: false,
          });
        },
      } as PagerViewType),
    [lockScrollEvent, getPageWidth, getSafePageIndex, disableAnimation],
  );
  return (
    <ScrollView
      style={style}
      horizontal
      pagingEnabled
      keyboardDismissMode={keyboardDismissMode as any}
      ref={scrollViewRef}
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={150}
      onScroll={handleScroll}
    >
      {children}
    </ScrollView>
  );
}
