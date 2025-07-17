import {
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';
import ReanimatedCarousel, {
  Pagination,
} from 'react-native-reanimated-carousel';
import { useStyle } from 'tamagui';

import { XStack, YStack } from '../../primitives';

import type { ICarouselProps } from './type';
import type { LayoutChangeEvent, ViewStyle } from 'react-native';
import type { ICarouselInstance } from 'react-native-reanimated-carousel';
import type { DotStyle } from 'react-native-reanimated-carousel/lib/typescript/components/Pagination/Basic/PaginationItem';

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
  const paginationProgress = useSharedValue<number>(0);
  const scrollOffsetValue = useSharedValue<number>(0);

  const ref = useRef<ICarouselInstance>(null);

  useImperativeHandle(instanceRef, () => ref.current as ICarouselInstance);

  const onPressPagination = (index: number) => {
    ref.current?.scrollTo({
      /**
       * Calculate the difference between the current index and the target index
       * to ensure that the carousel scrolls to the nearest index
       */
      count: index - paginationProgress.value,
      animated: true,
    });
  };

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

  return (
    <YStack gap="$4">
      <XStack {...(containerStyle as any)} onLayout={handleLayout}>
        {layout.width > 0 && layout.height > 0 ? (
          <View
            style={{ width: layout.width, height: layout.height }}
            key={`${layout.width}-${layout.height}`}
          >
            <ReanimatedCarousel
              loop={loop}
              autoPlay={autoPlay}
              width={layout.width}
              height={layout.height}
              ref={ref}
              data={data}
              snapEnabled={snapEnabled}
              pagingEnabled={pagingEnabled}
              autoPlayInterval={autoPlayInterval}
              defaultScrollOffsetValue={scrollOffsetValue}
              style={{ width: '100%' }}
              renderItem={renderItem}
              onProgressChange={paginationProgress}
              {...(props as any)}
            />
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
