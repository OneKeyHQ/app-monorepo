import type { RefObject } from 'react';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Stack, XStack, YStack } from '../../primitives';

import { PagerView } from './pager';
import { PaginationItem } from './PaginationItem';

import type { ICarouselProps, IPaginationItemProps } from './type';
import type { LayoutChangeEvent, NativeSyntheticEvent } from 'react-native';
import type NativePagerView from 'react-native-pager-view';

const defaultRenderPaginationItem = <T,>(
  { dotStyle, activeDotStyle, onPress }: IPaginationItemProps<T>,
  index: number,
) => {
  return (
    <PaginationItem
      key={index}
      index={index}
      dotStyle={dotStyle}
      activeDotStyle={activeDotStyle}
      onPress={onPress}
    />
  );
};

export function Carousel<T>({
  data = [],
  autoPlayInterval = 2500,
  loop = true,
  ref: instanceRef,
  renderItem,
  containerStyle,
  paginationContainerStyle,
  activeDotStyle,
  dotStyle,
  onPageChanged,
  renderPaginationItem = defaultRenderPaginationItem,
}: ICarouselProps<T>) {
  const pagerRef = useRef<NativePagerView>(undefined);
  const [pageIndex, setPageIndex] = useState<number>(0);
  const currentPage = useRef<number>(0);
  currentPage.current = pageIndex;

  const scrollToPreviousPage = useCallback(() => {
    const previousPage =
      currentPage.current > 0 ? currentPage.current - 1 : data.length - 1;
    pagerRef.current?.setPage(previousPage);
    currentPage.current = previousPage;
    setPageIndex(previousPage);
  }, [currentPage, data.length]);
  const scrollToNextPage = useCallback(() => {
    if (currentPage.current >= data.length - 1) {
      pagerRef.current?.setPageWithoutAnimation(0);
      currentPage.current = 0;
      setPageIndex(0);
      return;
    }
    const nextPage = currentPage.current + 1;
    pagerRef.current?.setPage(nextPage);
    currentPage.current = nextPage;
    setPageIndex(nextPage);
  }, [data.length, currentPage]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startAutoPlay = useCallback(() => {
    if (loop) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        scrollToNextPage();
        startAutoPlay();
      }, autoPlayInterval);
    }
  }, [loop, autoPlayInterval, scrollToNextPage]);

  useEffect(() => {
    startAutoPlay();
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [loop, autoPlayInterval, scrollToNextPage, startAutoPlay]);

  useImperativeHandle(instanceRef, () => {
    return {
      prev: scrollToPreviousPage,
      next: scrollToNextPage,
      getCurrentIndex: () => {
        return currentPage.current || 0;
      },
      scrollTo: ({ index }: { index: number }) => {
        pagerRef.current?.setPage(index);
        setPageIndex(index);
      },
    };
  });

  const onPressPagination = (index: number) => {
    pagerRef.current?.setPage(index);
    setPageIndex(index);
  };

  const onPageSelected = useCallback(
    (e: NativeSyntheticEvent<Readonly<{ position: number }>>) => {
      currentPage.current = e.nativeEvent.position;
      onPageChanged?.(currentPage.current);
    },
    [onPageChanged],
  );
  const [layout, setLayout] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      setLayout(event.nativeEvent.layout);
    },
    [setLayout],
  );

  const handleHoverIn = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);
  const handleHoverOut = useCallback(() => {
    startAutoPlay();
  }, [startAutoPlay]);

  return (
    <YStack gap="$2" userSelect="none">
      <XStack
        {...(containerStyle as any)}
        onLayout={handleLayout}
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
        onPressIn={platformEnv.isNative ? handleHoverIn : undefined}
        onPressOut={platformEnv.isNative ? handleHoverOut : undefined}
      >
        {layout.width > 0 && layout.height > 0 ? (
          <Stack
            style={{ width: layout.width, height: layout.height }}
            key={`${layout.width}-${layout.height}`}
          >
            <PagerView
              ref={pagerRef as RefObject<NativePagerView>}
              style={{ width: layout.width, height: layout.height }}
              initialPage={0}
              onPageSelected={onPageSelected}
              keyboardDismissMode="on-drag"
            >
              {data.map((item, index) => (
                <Stack
                  key={index}
                  style={{ width: layout.width, height: layout.height }}
                >
                  {renderItem({ item, index })}
                </Stack>
              ))}
            </PagerView>
          </Stack>
        ) : null}
      </XStack>
      {data.length > 1 ? (
        <XStack
          gap="$0.5"
          ai="center"
          jc="center"
          {...(paginationContainerStyle as any)}
        >
          {data.map((item, index) => {
            return renderPaginationItem?.(
              {
                data: item,
                dotStyle,
                activeDotStyle:
                  index === pageIndex
                    ? activeDotStyle || { bg: '$bgPrimary' }
                    : undefined,
                onPress: () => onPressPagination(index),
              },
              index,
            );
          })}
        </XStack>
      ) : (
        <XStack />
      )}
    </YStack>
  );
}

export type * from './type';
