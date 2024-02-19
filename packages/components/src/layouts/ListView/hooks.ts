import type { MutableRefObject } from 'react';
import { useCallback, useMemo, useRef } from 'react';

import type { IListViewRef } from './list';
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
      console.log(
        'scrollIntoIndex: ListView not ready yet',
        listViewRef.current,
        isListViewVisible.current,
        retryTimes,
      );
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
