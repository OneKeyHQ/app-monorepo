import type { ReactElement } from 'react';

import type { IListViewProps } from '../../layouts';
import type { ISortableListViewProps } from '../../layouts/SortableListView';
import type { ISizableTextProps, IStackProps } from '../../primitives';

export enum ETableSortType {
  ASC = 'asc',
  DESC = 'desc',
}

export interface ITableColumn<T> {
  title: string;
  dataIndex: string;
  titleProps?: ISizableTextProps;
  columnProps?: Omit<IStackProps, 'onPress' | 'onLongPress'>;
  columnWidth?: IStackProps['width'];
  renderSkeleton?: () => ReactElement;
  render?: (text: any, record: T, index: number) => ReactElement;
  // The specify which way that column is aligned. default value is left
  align?: 'left' | 'right' | 'center';
}

export interface ITableProps<T> {
  useFlashList?: boolean;
  scrollEnabled?: boolean;
  showHeader?: boolean;
  showBackToTopButton?: boolean;
  showSkeleton?: boolean;
  skeletonCount?: number;
  dataSource: T[];
  columns: ITableColumn<T>[];
  contentContainerStyle?: IListViewProps<T>['contentContainerStyle'];
  renderScrollComponent?: IListViewProps<T>['renderScrollComponent'];
  TableHeaderComponent?: IListViewProps<T>['ListHeaderComponent'];
  TableFooterComponent?: IListViewProps<T>['ListFooterComponent'];
  TableEmptyComponent?: IListViewProps<T>['ListEmptyComponent'];
  extraData?: IListViewProps<T>['extraData'];
  stickyHeader?: boolean;
  stickyHeaderHiddenOnScroll?: IListViewProps<T>['stickyHeaderHiddenOnScroll'];
  estimatedListSize?: { width: number; height: number };
  estimatedItemSize?: IListViewProps<T>['estimatedItemSize'];
  rowProps?: Omit<IStackProps, 'onPress' | 'onLongPress'>;
  headerRowProps?: Omit<IStackProps, 'onPress' | 'onLongPress'>;
  // Whether the column can be dragged to reorder. default value is false
  draggable?: boolean;
  onDragBegin?: ISortableListViewProps<T>['onDragBegin'];
  onDragEnd?: ISortableListViewProps<T>['onDragEnd'];
  keyExtractor: (item: T, index: number) => string;
  onHeaderRow?: (
    column: ITableColumn<T>,
    index: number,
  ) =>
    | {
        onPress?: () => void;
        onSortTypeChange?: (sortOrder: 'asc' | 'desc' | undefined) => void;
        disableSort?: ETableSortType[];
      }
    | undefined;
  onRow?: (
    record: T,
    index: number,
  ) =>
    | {
        onPress?: () => void;
        onLongPress?: () => void;
      }
    | undefined;
  // Infinite scroll support
  onEndReached?: IListViewProps<T>['onEndReached'];
  onEndReachedThreshold?: IListViewProps<T>['onEndReachedThreshold'];
}
