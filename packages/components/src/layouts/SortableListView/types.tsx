import type { StackStyle } from '@tamagui/web/types/types';
import type {
  DragEndParams,
  DraggableFlatListProps,
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import type { FlatList } from 'react-native-gesture-handler';

export type IDragEndParams<T> = DragEndParams<T>;
export type IDragEndParamsWithItem<T> = IDragEndParams<T> & {
  dragItem: T;
  prevItem: T | undefined;
  nextItem: T | undefined;
};
export type ISortableListViewRef<T> = FlatList<T>;

export type IRenderItemParams<T> = RenderItemParams<T> & {
  dragProps: Record<string, any> | undefined;
  index: number;
};

export type ISortableListViewProps<T> = Omit<
  DraggableFlatListProps<T>,
  | 'data'
  | 'renderItem'
  | 'CellRendererComponent'
  | 'keyExtractor'
  | 'getItemLayout'
  | 'containerStyle'
  | 'contentContainerStyle'
  | 'columnWrapperStyle'
  | 'ListHeaderComponentStyle'
  | 'ListFooterComponentStyle'
  | 'onDragEnd'
> &
  StackStyle & {
    ref?: any;
    data: T[];
    keyExtractor: (item: T, index: number) => string;
    renderItem: (params: IRenderItemParams<T>) => React.ReactNode;
    getItemLayout: (
      item: ArrayLike<T> | undefined | null,
      index: number,
    ) => { length: number; offset: number; index: number };

    enabled?: boolean;
    containerStyle?: StackStyle;
    contentContainerStyle?: StackStyle;
    columnWrapperStyle?: StackStyle;
    ListHeaderComponentStyle?: StackStyle;
    ListFooterComponentStyle?: StackStyle;
    onDragEnd?: (params: IDragEndParamsWithItem<T>) => void;
  };
