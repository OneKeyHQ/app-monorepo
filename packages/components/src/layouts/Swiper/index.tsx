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

import {
  InteractionManager,
  Platform,
  useWindowDimensions,
} from 'react-native';
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
const ITEM_VISIBLE_PERCENT_THRESHOLD = 60;

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
    disableGesture = false,
    ...props
  }: ISwiperProps<T>,
  ref: ForwardedRef<ISwiperRef>,
) {
  const _data = data || [];

  const [containerWidth, setContainerWidth] = useState(0);
  const _renderItem = useCallback(
    (info: ListRenderItemInfo<T>) => (
      <Stack
        width={containerWidth}
        height={props.height}
        $md={props.$md}
        $gtMd={props.$gtMd}
        $lg={props.$lg}
        $gtLg={props.$gtLg}
      >
        {renderItem?.(info)}
      </Stack>
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

  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
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
      void InteractionManager.runAfterInteractions(() => {
        swiperRef?.current?.scrollToIndex(newParams);
      });
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

  const clearTimer = useCallback(() => {
    clearTimeout(timeoutRef.current);
  }, []);

  const goToNextIndex = useCallback(() => {
    clearTimer();
    void InteractionManager.runAfterInteractions(() => {
      _scrollToIndex({ index: currentIndexes.index + 1, animated: true });
    });
  }, [_scrollToIndex, clearTimer, currentIndexes.index]);

  const gotToPrevIndex = useCallback(() => {
    clearTimer();
    void InteractionManager.runAfterInteractions(() => {
      _scrollToIndex({ index: currentIndexes.index - 1, animated: true });
    });
  }, [_scrollToIndex, clearTimer, currentIndexes.index]);

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

  const startTimer = useCallback(() => {
    clearTimer();
    const isLastIndexEnd = currentIndexes.index === _data.length - 1;
    const shouldContinuousWithAutoplay = autoplay && !isLastIndexEnd;
    if (shouldContinuousWithAutoplay || autoplayLoop) {
      timeoutRef.current = setTimeout(() => {
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
  }, [
    _data.length,
    _scrollToIndex,
    autoplay,
    autoplayDelayMs,
    autoplayLoop,
    autoplayLoopKeepAnimation,
    clearTimer,
    currentIndexes.index,
  ]);

  useEffect(() => {
    startTimer();
  });

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
    },
    [],
  );

  const handleScrollToIndexFailed = useCallback(
    (info: IListViewProps<T>['onScrollToIndexFailed']) => {
      setTimeout(() => {
        _scrollToIndex({ index: info?.index || 0, animated: false });
      }, 0);
    },
    [_scrollToIndex],
  );

  const flatListProps: IListViewProps<T> = {
    scrollEnabled,
    ref: swiperRef,
    horizontal: true,
    showsHorizontalScrollIndicator: false,
    showsVerticalScrollIndicator: false,
    pagingEnabled: true,
    ...props,
    onScrollToIndexFailed: handleScrollToIndexFailed,
    data: _data,
    renderItem: _renderItem,
    initialNumToRender: _initialNumToRender,
    initialScrollIndex: index, // used with onScrollToIndexFailed
    onViewableItemsChanged: _onViewableItemsChanged,
    viewabilityConfig: {
      // https://facebook.github.io/react-native/docs/flatlist#minimumviewtime
      minimumViewTime: 200,
      itemVisiblePercentThreshold: ITEM_VISIBLE_PERCENT_THRESHOLD,
    },
  };

  const { width } = useWindowDimensions();
  if (props.getItemLayout === undefined) {
    const itemDimension = width;
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
  const handleScrollBeginDrag = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const handleScrollEnd = useCallback(() => {
    setTimeout(() => {
      startTimer();
    }, 0);
  }, [startTimer]);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  return (
    <YStack
      position="relative"
      width="100%"
      height={flatListProps.height}
      $md={flatListProps.$md}
      $gtMd={flatListProps.$gtMd}
      $lg={flatListProps.$lg}
      $gtLg={flatListProps.$gtLg}
      onLayout={handleLayout}
    >
      {containerWidth ? (
        <>
          <ListView
            {...flatListProps}
            width={containerWidth}
            onScrollAnimationEnd={handleScrollEnd}
            onScrollBeginDrag={handleScrollBeginDrag}
            onScrollEndDrag={handleScrollEnd}
          />
          {renderPagination?.({
            goToNextIndex,
            gotToPrevIndex,
            currentIndex: currentIndexes.index,
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
