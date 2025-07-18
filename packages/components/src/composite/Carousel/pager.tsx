import { Children, useImperativeHandle, useMemo, useRef } from 'react';

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
}: Omit<NativeProps, 'ref'> & {
  ref: React.RefObject<PagerViewType>;
}) {
  const scrollViewRef = useRef<ScrollView>(null);
  const width = (style as { width: number })?.width || 0;
  const pageIndex = useRef<number>(0);
  const pageSize = useMemo(() => {
    return Children.count(children);
  }, [children]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset } = event.nativeEvent;
    const page = width ? Math.round(contentOffset.x / width) : 0;
    pageIndex.current = page;
    void onPageSelected?.({
      nativeEvent: {
        position: page,
      },
    } as any);
  };

  useImperativeHandle(
    ref,
    () =>
      ({
        setPage: (page: number) => {
          scrollViewRef.current?.scrollTo({
            x: (page >= pageSize ? 0 : page) * width,
            y: 0,
            animated: true,
          });
        },
        setPageWithoutAnimation: (page: number) => {
          scrollViewRef.current?.scrollTo({
            x: page * width,
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
