import type { RefObject } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useDebouncedCallback } from 'use-debounce';

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

const CarouselContext = createContext<{
  pageIndex: number;
}>({
  pageIndex: 0,
});

const useCarouselContext = () => {
  const context = useContext(CarouselContext);
  return context;
};

export const useCarouselIndex = () => {
  const { pageIndex } = useCarouselContext();
  return pageIndex;
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
  marginRatio = 0,
  pageWidth: pageWidthProp,
  maxPageWidth,
  showPagination = true,
  renderPaginationItem = defaultRenderPaginationItem,
  disableAnimation = false,
  pagerProps,
  defaultIndex = 0,
}: ICarouselProps<T>) {
  const pagerRef = useRef<NativePagerView>(undefined);
  const [pageIndex, setPageIndex] = useState<number>(defaultIndex);
  const currentPage = useRef<number>(defaultIndex);
  currentPage.current = pageIndex;

  const debouncedSetPageIndex = useDebouncedCallback(setPageIndex, 50);

  const setPage = useCallback(
    (page: number) => {
      if (disableAnimation) {
        pagerRef.current?.setPageWithoutAnimation(page);
      } else {
        pagerRef.current?.setPage(page);
      }
    },
    [disableAnimation],
  );

  const scrollToPreviousPage = useCallback(() => {
    const previousPage =
      currentPage.current > 0 ? currentPage.current - 1 : data.length - 1;
    setPage(previousPage);
    currentPage.current = previousPage;
    debouncedSetPageIndex(previousPage);
  }, [data.length, debouncedSetPageIndex, setPage]);
  const scrollToNextPage = useCallback(() => {
    if (currentPage.current >= data.length - 1) {
      pagerRef.current?.setPageWithoutAnimation(0);
      currentPage.current = 0;
      debouncedSetPageIndex(0);
      return;
    }
    const nextPage = currentPage.current + 1;
    setPage(nextPage);
    currentPage.current = nextPage;
    debouncedSetPageIndex(nextPage);
  }, [data.length, debouncedSetPageIndex, setPage]);

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
        setPage(index);
        debouncedSetPageIndex(index);
      },
      setScrollEnabled: (scrollEnabled: boolean) => {
        pagerRef.current?.setScrollEnabled(scrollEnabled);
      },
    };
  });

  const onPressPagination = (index: number) => {
    setPage(index);
    debouncedSetPageIndex(index);
  };

  const onPageSelected = useCallback(
    (e: NativeSyntheticEvent<Readonly<{ position: number }>>) => {
      currentPage.current = e.nativeEvent.position;
      debouncedSetPageIndex(currentPage.current);
      onPageChanged?.(currentPage.current);
    },
    [debouncedSetPageIndex, onPageChanged],
  );
  const [layout, setLayout] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  const pageWidth = useMemo(() => {
    if (pageWidthProp) {
      return pageWidthProp;
    }
    if (platformEnv.isNative) {
      return layout.width;
    }
    const width = layout.width - marginRatio * layout.width;
    if (maxPageWidth) {
      return Math.min(width, maxPageWidth);
    }
    return width;
  }, [layout.width, marginRatio, maxPageWidth, pageWidthProp]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      if (pageWidthProp) {
        return;
      }
      setLayout(event.nativeEvent.layout);
    },
    [setLayout, pageWidthProp],
  );

  const handleHoverIn = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);
  const handleHoverOut = useCallback(() => {
    startAutoPlay();
  }, [startAutoPlay]);

  const value = useMemo(() => ({ pageIndex }), [pageIndex]);

  return (
    <CarouselContext.Provider value={value}>
      <YStack userSelect="none">
        <XStack
          {...(containerStyle as any)}
          onLayout={handleLayout}
          onHoverIn={handleHoverIn}
          onHoverOut={handleHoverOut}
          onPressIn={platformEnv.isNative ? handleHoverIn : undefined}
          onPressOut={platformEnv.isNative ? handleHoverOut : undefined}
        >
          {pageWidthProp || (layout.width > 0 && layout.height > 0) ? (
            <Stack
              style={{
                width: pageWidthProp || layout.width,
                height: pageWidthProp ? '100%' : layout.height,
              }}
              key={
                pageWidthProp ? undefined : `${layout.width}-${layout.height}`
              }
            >
              <PagerView
                ref={pagerRef as RefObject<NativePagerView>}
                style={{
                  width: (pageWidthProp || layout.width) as number,
                  height: pageWidthProp ? '100%' : layout.height,
                }}
                initialPage={defaultIndex}
                pageWidth={pageWidth}
                onPageSelected={onPageSelected}
                keyboardDismissMode="on-drag"
                disableAnimation={disableAnimation}
                {...pagerProps}
              >
                {data.map((item, index) => (
                  <Stack
                    key={index}
                    style={{
                      width: pageWidth,
                      height: '100%',
                    }}
                  >
                    {renderItem({ item, index })}
                  </Stack>
                ))}
              </PagerView>
            </Stack>
          ) : null}
        </XStack>
        {showPagination && data.length > 1 ? (
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
    </CarouselContext.Provider>
  );
}

export type * from './type';
