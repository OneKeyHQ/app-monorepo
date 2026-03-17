import type { ForwardedRef } from 'react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';

import { YStack } from '@onekeyhq/components/src/shared/tamagui';

import { Stack } from '../../primitives';
import { ListView } from '../ListView/list';

import {
  useScrollEnabled,
  useScrollEvent,
  useSharedContainerWidth,
  useSharedStyle,
} from './hooks';

import type { ISwiperProps, ISwiperRef } from './type';
import type { IYStackProps } from '../../primitives';
import type { ListRenderItemInfo } from 'react-native';

function BaseSwiperFlatList<T>(
  {
    data = [],
    renderItem,
    index = 0,
    renderPagination,
    autoplayDelayMs = 3000,
    autoplay = false,
    autoplayLoop = false,
    autoplayLoopKeepAnimation = false,
    disableGesture = false,
    initialNumToRender = 1,
    onChangeIndex,
    ...restProps
  }: ISwiperProps<T>,
  ref: ForwardedRef<ISwiperRef>,
) {
  const isWeb = typeof document !== 'undefined';
  const sharedStyle = useSharedStyle(restProps as any) as IYStackProps;
  const { containerWidth, onContainerLayout } = useSharedContainerWidth();
  const [scrollEnabled, setScrollEnabled] = useScrollEnabled(disableGesture);
  const isMouseDraggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const hasMovedWhileDraggingRef = useRef(false);
  const shouldPreventNextClickRef = useRef(false);
  const dragClickResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
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
    onChangeIndex,
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

  const extraData = useMemo(() => {
    return [renderItem, data];
  }, [data, renderItem]);

  const getPointerX = useCallback(
    (event: {
      clientX?: number;
      nativeEvent?: { pageX?: number; locationX?: number; x?: number };
    }) => {
      if (typeof event?.clientX === 'number') {
        return event.clientX;
      }
      if (typeof event?.nativeEvent?.pageX === 'number') {
        return event.nativeEvent.pageX;
      }
      return null;
    },
    [],
  );

  const scrollToIndexWithFallback = useCallback(
    ({
      index: targetIndex,
      animated = true,
    }: {
      index: number;
      animated?: boolean;
    }) => {
      scrollToIndex({ index: targetIndex, animated });

      if (!isWeb || !containerWidth) {
        return;
      }

      const listRef = swiperRef.current as
        | {
            scrollToOffset?: (params: {
              offset: number;
              animated?: boolean;
            }) => void;
          }
        | undefined
        | null;
      listRef?.scrollToOffset?.({
        offset: containerWidth * targetIndex,
        animated,
      });
    },
    [containerWidth, isWeb, scrollToIndex, swiperRef],
  );

  const goToIndex = useCallback(
    (targetIndex: number) => {
      if (targetIndex < 0 || targetIndex >= dataLength) {
        return;
      }

      setScrollEnabled(true);
      scrollToIndexWithFallback({ index: targetIndex, animated: true });
      setScrollEnabled(!disableGesture);
    },
    [dataLength, disableGesture, scrollToIndexWithFallback, setScrollEnabled],
  );

  const goToPrevIndex = useCallback(() => {
    goToIndex(currentIndex - 1);
  }, [currentIndex, goToIndex]);

  const goToNextIndex = useCallback(() => {
    goToIndex(currentIndex + 1);
  }, [currentIndex, goToIndex]);

  const finishMouseDrag = useCallback(
    (clientX: number | null) => {
      if (!isMouseDraggingRef.current) {
        return;
      }
      isMouseDraggingRef.current = false;
      if (typeof clientX !== 'number') {
        return;
      }

      const deltaX = clientX - dragStartXRef.current;
      const threshold = Math.max(containerWidth * 0.15, 24);

      if (Math.abs(deltaX) > threshold) {
        if (deltaX > 0) {
          goToPrevIndex();
        } else {
          goToNextIndex();
        }
      }

      shouldPreventNextClickRef.current = hasMovedWhileDraggingRef.current;
      if (dragClickResetTimerRef.current) {
        clearTimeout(dragClickResetTimerRef.current);
      }
      dragClickResetTimerRef.current = setTimeout(() => {
        shouldPreventNextClickRef.current = false;
      }, 0);
    },
    [containerWidth, goToNextIndex, goToPrevIndex],
  );

  const handleMouseDown = useCallback(
    (event: MouseEvent) => {
      if (
        !isWeb ||
        (typeof event.button === 'number' && event.button !== 0) ||
        disableGesture ||
        dataLength <= 1 ||
        !containerWidth
      ) {
        return;
      }
      const pointerX = getPointerX(event);
      if (typeof pointerX !== 'number') {
        return;
      }
      isMouseDraggingRef.current = true;
      dragStartXRef.current = pointerX;
      hasMovedWhileDraggingRef.current = false;
      shouldPreventNextClickRef.current = false;
      event.preventDefault();
    },
    [containerWidth, dataLength, disableGesture, getPointerX, isWeb],
  );

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isMouseDraggingRef.current) {
      return;
    }
    const deltaX = event.clientX - dragStartXRef.current;
    if (Math.abs(deltaX) > 2) {
      hasMovedWhileDraggingRef.current = true;
    }
    event.preventDefault();
  }, []);

  useEffect(() => {
    if (!isWeb) {
      return;
    }

    const onMouseMove = (event: Event) => {
      handleMouseMove(event as MouseEvent);
    };
    const onMouseUp = (event: Event) => {
      finishMouseDrag(getPointerX(event as MouseEvent));
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
  }, [finishMouseDrag, getPointerX, handleMouseMove, isWeb]);

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
        onClick: (event: MouseEvent) => {
          if (shouldPreventNextClickRef.current) {
            event.preventDefault();
            event.stopPropagation();
            shouldPreventNextClickRef.current = false;
          }
        },
      }
    : {};

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
            useFlashList={!isWeb}
            horizontal
            pagingEnabled
            ref={swiperRef}
            getItemLayout={getItemLayout}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            scrollEnabled={scrollEnabled}
            renderItem={handleRenderItem}
            data={data}
            extraData={extraData}
            initialNumToRender={initialNumToRender}
            initialScrollIndex={index}
            estimatedItemSize={containerWidth}
            width={containerWidth}
            onScrollToIndexFailed={onScrollToIndexFailed}
            onScrollAnimationEnd={onScrollAnimationEnd}
            onScrollBeginDrag={onScrollBeginDrag}
            onScrollEndDrag={onScrollEndDrag}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            {...(mouseDragProps as any)}
          />
          {renderPagination?.({
            goToNextIndex,
            gotToPrevIndex: goToPrevIndex,
            goToIndex,
            currentIndex,
          })}
        </>
      ) : null}
    </YStack>
  );
}

export const Swiper = forwardRef(BaseSwiperFlatList) as <T>(
  props: ISwiperProps<T> & { ref?: React.Ref<ISwiperRef> },
) => React.ReactElement | null;

export * from './type';
