import type { ForwardedRef } from 'react';
import { forwardRef, useCallback, useImperativeHandle } from 'react';

import { YStack } from 'tamagui';

import { Stack } from '../../primitives';
import { ListView } from '../ListView/list';

import {
  useScrollEnabled,
  useScrollEvent,
  useSharedContainerWidth,
  useSharedStyle,
} from './hooks';

import type { ISwiperProps, ISwiperRef } from './type';
import type { ListRenderItemInfo } from 'react-native';

function BaseSwiperFlatList<T>(
  {
    children,
    data = [],
    renderItem,
    index = 0,
    renderPagination,
    autoplayDelayMs = 3000,
    autoplay = false,
    autoplayLoop = false,
    autoplayLoopKeepAnimation = false,
    onChangeIndex,
    disableGesture = false,
    ...restProps
  }: ISwiperProps<T>,
  ref: ForwardedRef<ISwiperRef>,
) {
  const sharedStyle = useSharedStyle(restProps as any);
  const { containerWidth, onContainerLayout } = useSharedContainerWidth();
  const [scrollEnabled, setScrollEnabled] = useScrollEnabled(disableGesture);
  const handleRenderItem = useCallback(
    (info: ListRenderItemInfo<T>) => (
      <Stack width={containerWidth} {...sharedStyle}>
        {renderItem?.(info)}
      </Stack>
    ),
    [containerWidth, renderItem, sharedStyle],
  );

  // cannot scroll on web without getItemLayout.
  const getItemLayout = useCallback(
    (_: any, ItemIndex: number) => ({
      length: containerWidth,
      offset: containerWidth * ItemIndex,
      index: ItemIndex,
    }),
    [containerWidth],
  );

  const dataLength = data?.length || 0;
  const {
    currentIndex,
    prevIndex,
    ref: swiperRef,
    scrollToIndex,
    onScrollToIndexFailed,
    goToNextIndex,
    gotToPrevIndex,
    onViewableItemsChanged,
    viewabilityConfig,
    onScrollAnimationEnd,
    onScrollBeginDrag,
    onScrollEndDrag,
  } = useScrollEvent({
    initialIndex: index,
    autoplay,
    autoplayDelayMs,
    autoplayLoop,
    autoplayLoopKeepAnimation,
    dataLength,
  });

  useImperativeHandle(ref, () => ({
    scrollToIndex: (item: any) => {
      setScrollEnabled(true);
      scrollToIndex(item);
      setScrollEnabled(!disableGesture);
    },
    getCurrentIndex: () => currentIndex,
    getPrevIndex: () => prevIndex,
    goToLastIndex: () => {
      setScrollEnabled(true);
      scrollToIndex({ index: dataLength - 1 });
      setScrollEnabled(!disableGesture);
    },
    goToFirstIndex: () => {
      setScrollEnabled(true);
      scrollToIndex({ index: 0 });
      setScrollEnabled(!disableGesture);
    },
  }));

  return (
    <YStack
      position="relative"
      width="100%"
      onLayout={onContainerLayout}
      {...sharedStyle}
    >
      {containerWidth && data?.length ? (
        <>
          <ListView
            {...restProps}
            horizontal
            pagingEnabled
            ref={swiperRef}
            getItemLayout={getItemLayout}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            scrollEnabled={scrollEnabled}
            renderItem={handleRenderItem}
            data={data}
            extraData={data}
            initialNumToRender={1}
            initialScrollIndex={index}
            estimatedItemSize={sharedStyle.height}
            width={containerWidth}
            onScrollToIndexFailed={onScrollToIndexFailed}
            onScrollAnimationEnd={onScrollAnimationEnd}
            onScrollBeginDrag={onScrollBeginDrag}
            onScrollEndDrag={onScrollEndDrag}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
          />
          {renderPagination?.({
            goToNextIndex,
            gotToPrevIndex,
            currentIndex,
          })}
        </>
      ) : null}
    </YStack>
  );
}

export const Swiper = forwardRef(
  BaseSwiperFlatList,
) as typeof BaseSwiperFlatList;

export * from './type';
