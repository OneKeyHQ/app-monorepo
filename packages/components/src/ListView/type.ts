import type { MutableRefObject } from 'react';

import type {
  FlashList,
  FlashListProps,
  ListRenderItem,
} from '@shopify/flash-list';
import type { StackStyleProps, Tokens } from '@tamagui/web/types/types';

export type IListViewRef<T> = FlashList<T>;

export type IListViewProps<T> = Omit<
  FlashListProps<T>,
  | 'contentContainerStyle'
  | 'columnWrapperStyle'
  | 'ListHeaderComponentStyle'
  | 'ListFooterComponentStyle'
  | 'data'
  | 'renderItem'
  | 'estimatedItemSize'
> &
  StackStyleProps & {
    contentContainerStyle?: StackStyleProps;
    columnWrapperStyle?: StackStyleProps;
    ListHeaderComponentStyle?: StackStyleProps;
    ListFooterComponentStyle?: StackStyleProps;
  } & {
    data: ReadonlyArray<T> | null | undefined;
    renderItem: ListRenderItem<T> | null | undefined;
    ref?: MutableRefObject<IListViewRef<any> | null>;
    estimatedItemSize: number | `$${keyof Tokens['size']}`;
  };
