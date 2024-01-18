import type { ForwardedRef } from 'react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Platform, useWindowDimensions } from 'react-native';
import { YStack } from 'tamagui';

import { Stack } from '../../primitives';
import { ListView } from '../ListView';

import type { IScrollToIndexParams, ISwiperProps, ISwiperRef } from './type';
import type { IListViewProps, IListViewRef } from '../ListView';
import type {
  FlatListProps,
  LayoutChangeEvent,
  ListRenderItemInfo,
} from 'react-native';

const FIRST_INDEX = 0;

function BaseSwiperFlatList<T>(
  {
    children,
    data = [],
    renderItem,
    index = FIRST_INDEX,
    renderPagination,
    autoplayDelayMs = 3000,
    autoplay = false,
    autoplayLoop = false,
    autoplayLoopKeepAnimation = false,
    onChangeIndex,
    onViewableItemsChanged,
    disableGesture = false,
    ...props
  }: ISwiperProps<T>,
  ref: ForwardedRef<ISwiperRef>,
) {
  const _data = data || [];

  const [containerWidth, setContainerWidth] = useState(0);
  const _renderItem = useCallback(
    (info: ListRenderItemInfo<T>) => (
      <Stack width={containerWidth}>{renderItem?.(info)}</Stack>
    ),
    [containerWidth, renderItem],
  );
  const size = _data.length;
  // Items to render in the initial batch.
  const _initialNumToRender = 1;
  const [currentIndexes, setCurrentIndexes] = useState({
    index,
    prevIndex: index,
  });

  const swiperRef = useRef<IListViewRef<T> | null>(null);
  const [scrollEnabled, setScrollEnabled] = useState(!disableGesture);

  useEffect(() => {
    setScrollEnabled(!disableGesture);
  }, [disableGesture]);

  const _onChangeIndex = useCallback(
    ({
      index: _index,
      prevIndex: _prevIndex,
    }: {
      index: number;
      prevIndex: number;
    }) => {
      if (_index !== _prevIndex) {
        onChangeIndex?.({ index: _index, prevIndex: _prevIndex });
      }
    },
    [onChangeIndex],
  );

  const _scrollToIndex = useCallback(
    (params: IScrollToIndexParams) => {
      const { index: indexToScroll, animated = true } = params;
      const newParams = { animated, index: indexToScroll };

      const next = {
        index: indexToScroll,
        prevIndex: currentIndexes.index,
      };
      if (
        currentIndexes.index !== next.index &&
        currentIndexes.prevIndex !== next.prevIndex
      ) {
        setCurrentIndexes({ index: next.index, prevIndex: next.prevIndex });
      } else if (currentIndexes.index !== next.index) {
        setCurrentIndexes((prevState) => ({
          ...prevState,
          index: next.index,
        }));
      } else if (currentIndexes.prevIndex !== next.prevIndex) {
        setCurrentIndexes((prevState) => ({
          ...prevState,
          prevIndex: next.prevIndex,
        }));
      }

      // When execute "scrollToIndex", we ignore the method "onMomentumScrollEnd"
      // because it not working on Android
      // https://github.com/facebook/react-native/issues/21718
      swiperRef?.current?.scrollToIndex(newParams);
    },
    [currentIndexes.index, currentIndexes.prevIndex],
  );

  // change the index when the user swipe the items
  useEffect(() => {
    _onChangeIndex({
      index: currentIndexes.index,
      prevIndex: currentIndexes.prevIndex,
    });
  }, [_onChangeIndex, currentIndexes.index, currentIndexes.prevIndex]);

  const goToNextIndex = useCallback(() => {
    _scrollToIndex({ index: currentIndexes.index + 1, animated: true });
  }, [_scrollToIndex, currentIndexes.index]);

  const gotToPrevIndex = useCallback(() => {
    _scrollToIndex({ index: currentIndexes.index - 1, animated: true });
  }, [_scrollToIndex, currentIndexes.index]);

  useImperativeHandle(ref, () => ({
    scrollToIndex: (item: any) => {
      setScrollEnabled(true);
      _scrollToIndex(item);
      setScrollEnabled(!disableGesture);
    },
    getCurrentIndex: () => currentIndexes.index,
    getPrevIndex: () => currentIndexes.prevIndex,
    goToLastIndex: () => {
      setScrollEnabled(true);
      _scrollToIndex({ index: size - 1 });
      setScrollEnabled(!disableGesture);
    },
    goToFirstIndex: () => {
      setScrollEnabled(true);
      _scrollToIndex({ index: FIRST_INDEX });
      setScrollEnabled(!disableGesture);
    },
  }));

  useEffect(() => {
    const isLastIndexEnd = currentIndexes.index === _data.length - 1;
    const shouldContinuousWithAutoplay = autoplay && !isLastIndexEnd;
    let autoplayTimer: ReturnType<typeof setTimeout>;
    if (shouldContinuousWithAutoplay || autoplayLoop) {
      autoplayTimer = setTimeout(() => {
        if (_data.length < 1) {
          // avoid nextIndex being set to NaN
          return;
        }

        if (!autoplay) {
          // disabled if autoplay is off
          return;
        }

        const nextIncrement = +1;

        const nextIndex = (currentIndexes.index + nextIncrement) % _data.length;
        // if (autoplayInvertDirection && nextIndex < FIRST_INDEX) {
        //   nextIndex = _data.length - 1;
        // }

        // Disable end loop animation unless `autoplayLoopKeepAnimation` prop configured
        const animate = !isLastIndexEnd || autoplayLoopKeepAnimation;

        _scrollToIndex({ index: nextIndex, animated: animate });
      }, autoplayDelayMs);
    }
    // https://upmostly.com/tutorials/settimeout-in-react-components-using-hooks
    return () => clearTimeout(autoplayTimer);
  }, [
    autoplay,
    currentIndexes.index,
    _data.length,
    autoplayLoop,
    autoplayDelayMs,
    autoplayLoopKeepAnimation,
    _scrollToIndex,
  ]);

  const _onViewableItemsChanged = useMemo<
    FlatListProps<unknown>['onViewableItemsChanged']
  >(
    () => (params) => {
      const { changed } = params;
      const newItem = changed?.[FIRST_INDEX];
      if (newItem !== undefined) {
        const nextIndex = newItem.index as number;
        if (newItem.isViewable) {
          setCurrentIndexes((prevState) => ({
            ...prevState,
            index: nextIndex,
          }));
        } else {
          setCurrentIndexes((prevState) => ({
            ...prevState,
            prevIndex: nextIndex,
          }));
        }
      }
      onViewableItemsChanged?.(params);
    },
    [onViewableItemsChanged],
  );

  const flatListProps: IListViewProps<T> = {
    scrollEnabled,
    ref: swiperRef,
    horizontal: true,
    showsHorizontalScrollIndicator: false,
    showsVerticalScrollIndicator: false,
    pagingEnabled: true,
    ...props,
    onScrollToIndexFailed: (info) =>
      setTimeout(() => _scrollToIndex({ index: info.index, animated: false })),
    data: _data,
    renderItem: _renderItem,
    initialNumToRender: _initialNumToRender,
    initialScrollIndex: index, // used with onScrollToIndexFailed
    onViewableItemsChanged: _onViewableItemsChanged,
  };

  const { height } = useWindowDimensions();
  if (props.getItemLayout === undefined) {
    const itemDimension = height;
    flatListProps.getItemLayout = (__data, ItemIndex: number) => ({
      length: itemDimension,
      offset: itemDimension * ItemIndex,
      index: ItemIndex,
    });
  }
  if (Platform.OS === 'web') {
    // TODO: do we need this anymore? check 3.1.0
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (flatListProps as any).dataSet = { 'paging-enabled-fix': true };
  }

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  return (
    <YStack position="relative" width="100%" onLayout={handleLayout}>
      <ListView {...flatListProps} width={containerWidth} />
      {renderPagination?.({
        goToNextIndex,
        gotToPrevIndex,
        currentIndex: currentIndexes.index,
      })}
    </YStack>
  );
}

export const Swiper = forwardRef(
  BaseSwiperFlatList,
) as typeof BaseSwiperFlatList;

export * from './type';
