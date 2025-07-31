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
import type { NativeProps } from 'react-native-pager-view/lib/typescript/PagerViewNativeComponent';

export function PagerView({
  children,
  ref,
  style,
  onPageSelected,
  keyboardDismissMode,
  pageWidth,
}: Omit<NativeProps, 'ref'> & {
  ref: React.RefObject<PagerViewType>;
  pageWidth: number;
}) {
  const scrollViewRef = useRef<ScrollView>(null);
  const pageIndex = useRef<number>(0);
  const pageSize = useMemo(() => {
    return Children.count(children);
  }, [children]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset } = event.nativeEvent;
    const page = pageWidth ? Math.round(contentOffset.x / pageWidth) : 0;
    pageIndex.current = page;
    void onPageSelected?.({
      nativeEvent: {
        position: page,
      },
    } as any);
  };

  const getSafePageIndex = useCallback(
    (page: number) => {
      return Math.max(0, Math.min(page, pageSize - 1));
    },
    [pageSize],
  );

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
          scrollViewRef.current?.scrollTo({
            x: getSafePageIndex(page) * pageWidth,
            y: 0,
            animated: true,
          });
        },
        setPageWithoutAnimation: (page: number) => {
          scrollViewRef.current?.scrollTo({
            x: getSafePageIndex(page) * pageWidth,
            y: 0,
            animated: false,
          });
        },
      } as PagerViewType),
  );
  return (
    <ScrollView
      style={style}
      horizontal
      pagingEnabled
      keyboardDismissMode={keyboardDismissMode as any}
      ref={scrollViewRef}
      showsHorizontalScrollIndicator={false}
      onScroll={handleScroll}
    >
      {children}
    </ScrollView>
  );
}
