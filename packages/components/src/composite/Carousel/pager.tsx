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
  pageWidth,
  disableAnimation = false,
  initialPage = 0,
}: Omit<PagerViewProps, 'ref'> & {
  ref: React.RefObject<PagerViewType>;
  pageWidth: number | string;
  disableAnimation?: boolean;
}) {
  const scrollViewRef = useRef<ScrollView>(null);
  const pageIndex = useRef<number>(initialPage);
  const pageSize = useMemo(() => {
    return Children.count(children);
  }, [children]);

  const handleScroll = useDebouncedCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset } = event.nativeEvent;
      const page =
        typeof pageWidth === 'number'
          ? Math.round(contentOffset.x / pageWidth)
          : 0;
      pageIndex.current = page;
      void onPageSelected?.({
        nativeEvent: {
          position: page,
        },
      } as any);
    },
    50,
  );

  const getSafePageIndex = useCallback(
    (page: number) => {
      return Math.max(0, Math.min(page, pageSize - 1));
    },
    [pageSize],
  );

  // Set initial page position when component mounts or when pageWidth changes
  useEffect(() => {
    if (
      typeof pageWidth === 'number' &&
      pageWidth > 0 &&
      initialPage > 0 &&
      scrollViewRef.current
    ) {
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
  }, [pageWidth, initialPage, getSafePageIndex, onPageSelected]);

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

  useImperativeHandle(
    ref,
    () =>
      ({
        setPage: (page: number) => {
          if (typeof pageWidth === 'number') {
            scrollViewRef.current?.scrollTo({
              x: getSafePageIndex(page) * pageWidth,
              y: 0,
              animated: !disableAnimation,
            });
          }
        },
        setPageWithoutAnimation: (page: number) => {
          if (typeof pageWidth === 'number') {
            scrollViewRef.current?.scrollTo({
              x: getSafePageIndex(page) * pageWidth,
              y: 0,
              animated: false,
            });
          }
        },
      } as PagerViewType),
    [getSafePageIndex, pageWidth, disableAnimation],
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
