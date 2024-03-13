import type { MutableRefObject } from 'react';
import { useCallback, useMemo, useRef } from 'react';

import type { IListViewRef } from './list';
import type { ISectionListRef } from '../SectionList';
import type { LayoutChangeEvent } from 'react-native';

export const useSafelyScrollIntoIndex = (
  listViewRef: MutableRefObject<IListViewRef<any> | null>,
  onLayout?: (e: LayoutChangeEvent) => void,
) => {
  const isListViewVisible = useRef(false);
  const scrollIntoIndex = useCallback(
    (
      params: {
        animated?: boolean | null | undefined;
        index: number;
        viewOffset?: number | undefined;
        viewPosition?: number | undefined;
      },
      retryTimes = 0,
    ) => {
      if (retryTimes > 20) {
        return;
      }
      if (!listViewRef.current || !isListViewVisible.current) {
        setTimeout(() => {
          scrollIntoIndex(params, retryTimes + 1);
        }, 30);
        return;
      }
      listViewRef.current?.scrollToIndex(params);
    },
    [listViewRef],
  );

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { height } = e.nativeEvent.layout;
      if (height) {
        isListViewVisible.current = true;
      }
      onLayout?.(e);
    },
    [onLayout],
  );

  return useMemo(
    () => ({ scrollIntoIndex, onLayout: handleLayout }),
    [handleLayout, scrollIntoIndex],
  );
};

export const useSafelyScrollToLocation = (
  sectionListRef: MutableRefObject<ISectionListRef<any> | null>,
  onLayout?: (e: LayoutChangeEvent) => void,
) => {
  const isSectionListViewVisible = useRef(false);
  const scrollToLocation = useCallback(
    (
      params: {
        animated?: boolean;
        itemIndex?: number;
        sectionIndex?: number;
        viewOffset?: number;
        viewPosition?: number;
      },
      retryTimes = 0,
    ) => {
      if (retryTimes > 20) {
        return;
      }
      if (!sectionListRef.current || !isSectionListViewVisible.current) {
        setTimeout(() => {
          scrollToLocation(params, retryTimes + 1);
        }, 30);
        return;
      }
      sectionListRef.current?.scrollToLocation(params);
    },
    [sectionListRef],
  );

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { height } = e.nativeEvent.layout;
      if (height) {
        isSectionListViewVisible.current = true;
      }
      onLayout?.(e);
    },
    [onLayout],
  );

  return useMemo(
    () => ({ scrollToLocation, onLayout: handleLayout }),
    [handleLayout, scrollToLocation],
  );
};
