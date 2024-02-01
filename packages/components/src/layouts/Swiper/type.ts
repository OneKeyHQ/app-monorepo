import type { ComponentType, PropsWithChildren, ReactElement } from 'react';

import type { IListViewProps } from '../ListView';
import type { ListRenderItem } from 'react-native';

export type IScrollToIndexParams = { index: number; animated?: boolean }; // DUPLICATED
export type ISwiperRef = {
  getCurrentIndex: () => number;
  getPrevIndex: () => number;
  scrollToIndex: (item: IScrollToIndexParams) => void;
  goToLastIndex: () => void;
  goToFirstIndex: () => void;
};

export type IRenderPaginationParams = {
  currentIndex: number;
  goToNextIndex: () => void;
  gotToPrevIndex: () => void;
};
export type ISwiperProps<T> = Omit<
  IListViewProps<T>,
  'data' | 'renderItem' | 'estimatedItemSize' | 'height'
> &
  PropsWithChildren<{
    index?: number;
    height: IListViewProps<T>['height'];
    data: ArrayLike<T> | null | undefined;
    renderItem: ListRenderItem<T> | null | undefined;
    renderPagination?: (
      params: IRenderPaginationParams,
    ) => ReactElement | ComponentType;
    onChangeIndex?: (item: { index: number; prevIndex: number }) => void;
    disableGesture?: boolean;
    autoplayDelayMs?: number;
    autoplay?: boolean;
    autoplayLoop?: boolean;
    autoplayLoopKeepAnimation?: boolean;
  }>;
