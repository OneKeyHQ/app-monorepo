import type { StackStyle } from '@tamagui/web/types/types';
import type {
  DraggableFlatListProps,
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import type { FlatList } from 'react-native-gesture-handler';

export type ISortableListViewRef<T> = FlatList<T>;

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
> &
  StackStyle & {
    data: T[];
    keyExtractor: (item: T, index: number) => string;
    renderItem: (
      params: RenderItemParams<T> & {
        dragProps: Record<string, any> | undefined;
      },
    ) => React.ReactNode;
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
  };
