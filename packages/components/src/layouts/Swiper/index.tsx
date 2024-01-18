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

import type { ISwiperFlatListProps, ISwiperFlatListRefProps } from './type';
import type { FlatListProps, LayoutChangeEvent } from 'react-native';

const MILLISECONDS = 1000;
const FIRST_INDEX = 0;
const ITEM_VISIBLE_PERCENT_THRESHOLD = 60;

// TODO: figure out how to use forwardRef with generics
type IT1 = any;
type IScrollToIndex = { index: number; animated?: boolean };

const Pagination = () => null;

// const SwiperFlatList = React.forwardRef<RefProps, ISwiperFlatListProps<SwiperType>>(

function BaseSwiperFlatList(
  // <IT1 extends any>(
  {
    vertical = false,
    children,
    data = [],
    renderItem,
    renderAll = false,
    index = FIRST_INDEX,
    useReactNativeGestureHandler = false,
    // Pagination
    showPagination = false,
    renderPagination,
    // PaginationComponent = Pagination,
    // paginationActiveColor,
    // paginationDefaultColor,
    // paginationStyle,
    // paginationStyleItem,
    // paginationStyleItemActive,
    // paginationStyleItemInactive,
    // onPaginationSelectedIndex,
    // paginationTapDisabled = false,
    // Autoplay
    autoplayDelay = 3,
    autoplay = false,
    autoplayLoop = false,
    autoplayLoopKeepAnimation = false,
    // Functions
    onChangeIndex,
    onMomentumScrollEnd,
    onViewableItemsChanged,
    viewabilityConfig = {},
    disableGesture = false,
    e2eID,
    ...props
  }: ISwiperFlatListProps<IT1>,
  ref: React.Ref<ISwiperFlatListRefProps>,
) {
  let _data: unknown[] = [];
  let _renderItem: FlatListProps<any>['renderItem'];

  const [containerWidth, setContainerWidth] = useState(0);
  const handleRenderItem = useCallback(
    (...params: any[]) => (
      <Stack width={containerWidth}>{renderItem?.(...params)}</Stack>
    ),
    [containerWidth, renderItem],
  );
  if (data) {
    _data = data;
    _renderItem = handleRenderItem;
  } else {
    console.error('Invalid props, `data` or `children` is required');
  }
  const size = _data.length;
  // Items to render in the initial batch.
  const _initialNumToRender = renderAll ? size : 1;
  const [currentIndexes, setCurrentIndexes] = useState({
    index,
    prevIndex: index,
  });
  const [ignoreOnMomentumScrollEnd, setIgnoreOnMomentumScrollEnd] =
    useState(false);
  const flatListElement = useRef<RNFlatList<unknown>>(null);
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
    (params: IScrollToIndex) => {
      const { index: indexToScroll, animated = true } = params;
      const newParams = { animated, index: indexToScroll };

      setIgnoreOnMomentumScrollEnd(true);

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
      flatListElement?.current?.scrollToIndex(newParams);
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
    const shouldContinuoWithAutoplay = autoplay && !isLastIndexEnd;
    let autoplayTimer: ReturnType<typeof setTimeout>;
    if (shouldContinuoWithAutoplay || autoplayLoop) {
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
      }, autoplayDelay * MILLISECONDS);
    }
    // https://upmostly.com/tutorials/settimeout-in-react-components-using-hooks
    return () => clearTimeout(autoplayTimer);
  }, [
    autoplay,
    currentIndexes.index,
    _data.length,
    autoplayLoop,
    autoplayDelay,
    autoplayLoopKeepAnimation,
    _scrollToIndex,
  ]);

  const _onMomentumScrollEnd: FlatListProps<unknown>['onMomentumScrollEnd'] = (
    event,
  ) => {
    // NOTE: Method not executed when call "flatListElement?.current?.scrollToIndex"
    if (ignoreOnMomentumScrollEnd) {
      setIgnoreOnMomentumScrollEnd(false);
      return;
    }

    onMomentumScrollEnd?.({ index: currentIndexes.index }, event);
  };

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

  const flatListProps: FlatListProps<unknown> & {
    ref: React.RefObject<typeof ListView<unknown>>;
  } = {
    scrollEnabled,
    ref: flatListElement,
    keyExtractor: (_item, _index) => {
      const item = _item as { key?: string; id?: string };
      const key = item?.key ?? item?.id ?? _index.toString();
      return key;
    },
    horizontal: !vertical,
    showsHorizontalScrollIndicator: false,
    showsVerticalScrollIndicator: false,
    pagingEnabled: true,
    ...props,
    onMomentumScrollEnd: _onMomentumScrollEnd,
    onScrollToIndexFailed: (info) =>
      setTimeout(() => _scrollToIndex({ index: info.index, animated: false })),
    data: _data,
    renderItem: _renderItem,
    initialNumToRender: _initialNumToRender,
    initialScrollIndex: index, // used with onScrollToIndexFailed
    viewabilityConfig: {
      // https://facebook.github.io/react-native/docs/flatlist#minimumviewtime
      minimumViewTime: 200,
      itemVisiblePercentThreshold: ITEM_VISIBLE_PERCENT_THRESHOLD,
      ...viewabilityConfig,
    },
    onViewableItemsChanged: _onViewableItemsChanged,
    // debug: true, // for debug
    testID: e2eID,
  };

  const { width, height } = useWindowDimensions();
  if (props.getItemLayout === undefined) {
    const itemDimension = vertical ? height : width;
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
    console.log(e.nativeEvent.layout, 'e.nativeEvent.layout');
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  // NOTE: quick fix for the new version of metro bundler
  // we should remove this console.warn in the next version (3.2.4)
  //   if (useReactNativeGestureHandler) {
  //     console.warn(
  //       'Please remove `useReactNativeGestureHandler` and import the library like:',
  //     );
  //     console.warn(
  //       "import { SwiperFlatListWithGestureHandler } from 'react-native-swiper-flatlist/WithGestureHandler';",
  //     );
  //   }

  return (
    <YStack position="relative" width="100%" onLayout={handleLayout}>
      <ListView {...flatListProps} width={containerWidth} />
      {renderPagination?.({
        goToNextIndex,
        gotToPrevIndex,
        currentIndex: currentIndexes.index,
      })}
      {/* {showPagination ? (
        <PaginationComponent
          size={size}
          paginationIndex={currentIndexes.index}
          scrollToIndex={(params: IScrollToIndex) => {
            _scrollToIndex(params);
          }}
          paginationActiveColor={paginationActiveColor}
          paginationDefaultColor={paginationDefaultColor}
          paginationStyle={paginationStyle}
          paginationStyleItem={paginationStyleItem}
          paginationStyleItemActive={paginationStyleItemActive}
          paginationStyleItemInactive={paginationStyleItemInactive}
          onPaginationSelectedIndex={onPaginationSelectedIndex}
          paginationTapDisabled={paginationTapDisabled}
          e2eID={e2eID}
        />
      ) : null} */}
    </YStack>
  );
}

export const Swiper = forwardRef(BaseSwiperFlatList);

// https://gist.github.com/Venryx/7cff24b17867da305fff12c6f8ef6f96
type IHandle<T> = T extends React.ForwardRefExoticComponent<
  React.RefAttributes<infer T2>
>
  ? T2
  : never;
export type ISwiper = IHandle<typeof Swiper>;
