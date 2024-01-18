import type { ComponentType, PropsWithChildren, ReactElement } from 'react';

import type { IListViewProps } from '../ListView';

export type IScrollToIndexParams = { index: number; animated?: boolean }; // DUPLICATED
export type ISwiperRef = {
  getCurrentIndex: () => number;
  getPrevIndex: () => number;
  scrollToIndex: (item: IScrollToIndexParams) => void;
  goToLastIndex: () => void;
  goToFirstIndex: () => void;
};

export type ISwiperProps<T> = IListViewProps<T> &
  PropsWithChildren<{
    index?: number;
    renderPagination?: (params: {
      currentIndex: number;
      goToNextIndex: () => void;
      gotToPrevIndex: () => void;
    }) => ReactElement | ComponentType;
    onChangeIndex?: (item: { index: number; prevIndex: number }) => void;
    disableGesture?: boolean;
    autoplayDelayMs?: number;
    autoplay?: boolean;
    autoplayLoop?: boolean;
    autoplayLoopKeepAnimation?: boolean;
  }>;
