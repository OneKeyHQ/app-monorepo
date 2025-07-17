import type { RefObject } from 'react';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import { Pagination } from 'react-native-reanimated-carousel';
import { useStyle } from 'tamagui';

import { XStack, YStack } from '../../primitives';

import { PagerView } from './pager';

import type { ICarouselProps } from './type';
import type { LayoutChangeEvent, NativeSyntheticEvent } from 'react-native';
import type NativePagerView from 'react-native-pager-view';
import type { DotStyle } from 'react-native-reanimated-carousel/lib/typescript/components/Pagination/Basic/PaginationItem';
import type { TCarouselActionOptions } from 'react-native-reanimated-carousel/lib/typescript/types';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function Carousel({
  data = [],
  autoPlayInterval = 2500,
  snapEnabled = true,
  pagingEnabled = true,
  loop = true,
  autoPlay = true,
  ref: instanceRef,
  renderItem,
  containerStyle,
  paginationContainerStyle,
  activeDotStyle,
  dotStyle,
  ...props
}: ICarouselProps) {
  const pagerRef = useRef<NativePagerView>(undefined);
  const currentPage = useRef<number>(0);

  const scrollToPreviousPage = useCallback(() => {
    const previousPage =
      currentPage.current > 0 ? currentPage.current - 1 : data.length - 1;
    pagerRef.current?.setPage(previousPage);
    currentPage.current = previousPage;
  }, [currentPage, data.length]);
  const scrollToNextPage = useCallback(() => {
    console.log('scrollToNextPage', currentPage.current);
    const nextPage =
      currentPage.current < data.length ? currentPage.current + 1 : 0;
    pagerRef.current?.setPage(nextPage);
    currentPage.current = nextPage;
  }, [data.length, currentPage]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startAutoPlay = useCallback(() => {
    if (autoPlay) {
      timerRef.current = setTimeout(() => {
        scrollToNextPage();
        startAutoPlay();
      }, autoPlayInterval);
    }
  }, [autoPlay, autoPlayInterval, scrollToNextPage]);

  useEffect(() => {
    startAutoPlay();
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [autoPlay, autoPlayInterval, scrollToNextPage, startAutoPlay]);

  useImperativeHandle(instanceRef, () => {
    return {
      prev: scrollToPreviousPage,
      next: scrollToNextPage,
      getCurrentIndex: () => {
        return currentPage.current || 0;
      },
      scrollTo: (params: TCarouselActionOptions | undefined) => {
        pagerRef.current?.setPage(params?.index || 0);
      },
    };
  });

  const paginationProgress = useSharedValue<number>(0);

  const onPressPagination = (index: number) => {
    pagerRef.current?.setPage(index);
    paginationProgress.value = index;
  };

  const onPageSelected = useCallback(
    (e: NativeSyntheticEvent<Readonly<{ position: number }>>) => {
      currentPage.current = e.nativeEvent.position;
      paginationProgress.value = currentPage.current;
    },
    [paginationProgress],
  );
  const [layout, setLayout] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      console.log('event', event.nativeEvent.layout);
      setLayout(event.nativeEvent.layout);
    },
    [setLayout],
  );

  const resolvedPaginationContainerStyle = useStyle(
    (paginationContainerStyle || {}) as Record<string, unknown>,
    {
      resolveValues: 'auto',
    },
  );
  const mergedPaginationContainerStyle = useMemo(() => {
    return {
      gap: 8,
      marginBottom: 10,
      ...resolvedPaginationContainerStyle,
    };
  }, [resolvedPaginationContainerStyle]);

  const resolvedActiveDotStyle = useStyle(
    (activeDotStyle || {}) as Record<string, unknown>,
    {
      resolveValues: 'auto',
    },
  );
  const mergedActiveDotStyle = useMemo(() => {
    return {
      borderRadius: 100,
      overflow: 'hidden',
      backgroundColor: 'rgba(0, 0, 0, 0.88)',
      ...resolvedActiveDotStyle,
    } as DotStyle;
  }, [resolvedActiveDotStyle]);

  const resolvedDotStyle = useStyle(
    (dotStyle || {}) as Record<string, unknown>,
    {
      resolveValues: 'auto',
    },
  );
  const mergedDotStyle = useMemo(() => {
    return {
      borderRadius: 100,
      backgroundColor: 'rgba(0, 0, 0, 0.11)',
      ...resolvedDotStyle,
    } as DotStyle;
  }, [resolvedDotStyle]);

  const handleHoverIn = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);
  const handleHoverOut = useCallback(() => {
    startAutoPlay();
  }, [startAutoPlay]);

  return (
    <YStack gap="$4">
      <XStack
        {...(containerStyle as any)}
        onLayout={handleLayout}
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
        onPressIn={platformEnv.isNative ? handleHoverIn : undefined}
        onPressOut={platformEnv.isNative ? handleHoverOut : undefined}
      >
        {layout.width > 0 && layout.height > 0 ? (
          <View
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
                <View
                  key={index}
                  style={{ width: layout.width, height: layout.height }}
                >
                  {renderItem({ item, index } as any)}
                </View>
              ))}
            </PagerView>
          </View>
        ) : null}
      </XStack>
      <Pagination.Basic
        horizontal
        progress={paginationProgress}
        data={data}
        size={6}
        dotStyle={mergedDotStyle}
        activeDotStyle={mergedActiveDotStyle}
        containerStyle={mergedPaginationContainerStyle}
        onPress={onPressPagination}
      />
    </YStack>
  );
}

export type * from './type';
