import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { InteractionManager, type LayoutChangeEvent } from 'react-native';
import { useDebouncedCallback } from 'use-debounce';

import type { IScrollToIndexParams, ISwiperProps } from './type';
import type { IListViewRef } from '../ListView';

export const useSharedStyle = (props: ISwiperProps<any>) =>
  useMemo(() => {
    const { height, $md, $gtMd, $lg, $gtLg } = props;
    return {
      height,
      $md,
      $gtMd,
      $lg,
      $gtLg,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

export const useSharedContainerWidth = () => {
  const [containerWidth, setContainerWidth] = useState(0);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);
  return {
    containerWidth,
    onContainerLayout: handleLayout,
  };
};

export const useScrollEnabled = (disableGesture: boolean) => {
  const [scrollEnabled, setScrollEnabled] = useState(!disableGesture);

  useEffect(() => {
    setScrollEnabled(!disableGesture);
  }, [disableGesture]);
  return [scrollEnabled, setScrollEnabled] as [
    boolean,
    Dispatch<SetStateAction<boolean>>,
  ];
};

export const useScrollEvent = ({
  initialIndex,
  autoplay,
  autoplayDelayMs,
  autoplayLoop,
  autoplayLoopKeepAnimation,
  dataLength,
}: {
  initialIndex: number;
  autoplay: ISwiperProps<any>['autoplay'];
  autoplayDelayMs: ISwiperProps<any>['autoplayDelayMs'];
  autoplayLoop: ISwiperProps<any>['autoplayLoop'];
  autoplayLoopKeepAnimation: ISwiperProps<any>['autoplayLoopKeepAnimation'];
  dataLength: number;
}) => {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const clearTimer = useCallback(() => {
    clearTimeout(timeoutRef.current);
  }, []);

  const swiperRef = useRef<IListViewRef<any> | null>(null);

  const [currentIndexes, setCurrentIndexes] = useState({
    index: initialIndex,
    prevIndex: initialIndex,
  });
  const scrollToIndex = useCallback(
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

  const goToNextIndex = useDebouncedCallback(() => {
    clearTimer();
    void InteractionManager.runAfterInteractions(() => {
      scrollToIndex({ index: currentIndexes.index + 1, animated: true });
    });
  }, 100);

  const gotToPrevIndex = useDebouncedCallback(() => {
    clearTimer();
    void InteractionManager.runAfterInteractions(() => {
      scrollToIndex({ index: currentIndexes.index - 1, animated: true });
    });
  }, 100);

  const startTimer = useCallback(() => {
    clearTimer();
    const isLastIndexEnd = currentIndexes.index === dataLength - 1;
    const shouldContinuousWithAutoplay = autoplay && !isLastIndexEnd;
    if (shouldContinuousWithAutoplay || autoplayLoop) {
      timeoutRef.current = setTimeout(() => {
        if (dataLength < 1) {
          // avoid nextIndex being set to NaN
          return;
        }

        if (!autoplay) {
          // disabled if autoplay is off
          return;
        }

        const nextIncrement = +1;

        const nextIndex = (currentIndexes.index + nextIncrement) % dataLength;
        // if (autoplayInvertDirection && nextIndex < FIRST_INDEX) {
        //   nextIndex = data.length - 1;
        // }

        // Disable end loop animation unless `autoplayLoopKeepAnimation` prop configured
        const animate = !isLastIndexEnd || autoplayLoopKeepAnimation;

        scrollToIndex({ index: nextIndex, animated: animate });
      }, autoplayDelayMs);
    }
  }, [
    dataLength,
    scrollToIndex,
    autoplay,
    autoplayDelayMs,
    autoplayLoop,
    autoplayLoopKeepAnimation,
    clearTimer,
    currentIndexes.index,
  ]);

  useEffect(() => {
    startTimer();
  }, []);

  const handleScrollToIndexFailed = useCallback(
    (info: {
      index: number;
      highestMeasuredFrameIndex: number;
      averageItemLength: number;
    }) => {
      setTimeout(() => {
        scrollToIndex({ index: info.index || 0, animated: false });
        setTimeout(() => {
          startTimer();
        }, 0);
      }, 0);
    },
    [scrollToIndex, startTimer],
  );

  const onViewableItemsChanged = useMemo<
    ISwiperProps<any>['onViewableItemsChanged']
  >(
    () => (params) => {
      const { changed } = params;
      const newItem = changed?.[0];
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

  const viewabilityConfig = useMemo(
    () => ({
      minimumViewTime: 200,
      itemVisiblePercentThreshold: 60,
    }),
    [],
  );

  const handleScrollBeginDrag = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const handleScrollEnd = useCallback(() => {
    setTimeout(() => {
      startTimer();
    }, 0);
  }, [startTimer]);

  return {
    currentIndex: currentIndexes.index,
    prevIndex: currentIndexes.prevIndex,
    ref: swiperRef,
    scrollToIndex,
    onScrollToIndexFailed: handleScrollToIndexFailed,
    onViewableItemsChanged,
    viewabilityConfig,
    onScrollAnimationEnd: handleScrollEnd,
    onScrollBeginDrag: handleScrollBeginDrag,
    onScrollEndDrag: handleScrollEnd,
    goToNextIndex,
    gotToPrevIndex,
  };
};
