import { forwardRef, useCallback } from 'react';
import type { ForwardedRef } from 'react';

import { usePropsAndStyle, useStyle } from '@tamagui/core';
import DraggableFlatList, {
  OpacityDecorator,
  ScaleDecorator,
  ShadowDecorator,
} from 'react-native-draggable-flatlist';
import { withStaticProperties } from 'tamagui';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { StackStyle } from '@tamagui/web/types/types';
import type { StyleProp, ViewStyle } from 'react-native';
import type {
  DragEndParams,
  DraggableFlatListProps,
  RenderItem,
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
    renderItem: RenderItem<T>;
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

function BaseSortableListView<T>(
  {
    data,
    keyExtractor,
    renderItem,
    enabled = true,
    containerStyle = {},
    contentContainerStyle = {},
    columnWrapperStyle,
    ListHeaderComponentStyle = {},
    ListFooterComponentStyle = {},
    onDragBegin,
    onDragEnd,
    ...props
  }: ISortableListViewProps<T>,
  ref: ForwardedRef<ISortableListViewRef<T>> | undefined,
) {
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });
  const rawContainerStyle = useStyle(
    containerStyle as Record<string, unknown>,
    {
      resolveValues: 'auto',
    },
  );
  const rawContentContainerStyle = useStyle(
    contentContainerStyle as Record<string, unknown>,
    {
      resolveValues: 'auto',
    },
  );

  const columnStyle = useStyle(
    (columnWrapperStyle || {}) as Record<string, unknown>,
    {
      resolveValues: 'auto',
    },
  );

  const listHeaderStyle = useStyle(
    ListHeaderComponentStyle as Record<string, unknown>,
    {
      resolveValues: 'auto',
    },
  );

  const listFooterStyle = useStyle(
    ListFooterComponentStyle as Record<string, unknown>,
    {
      resolveValues: 'auto',
    },
  );
  const activeDistance = platformEnv.isNative ? 10 : 1;

  const handleDragBegin = useCallback(
    (index: number) => {
      appEventBus.emit(EAppEventBusNames.onDragBeginInListView, undefined);
      onDragBegin?.(index);
    },
    [onDragBegin],
  );
  const handleDragEnd = useCallback(
    (params: DragEndParams<any>) => {
      onDragEnd?.(params);
      appEventBus.emit(EAppEventBusNames.onDragEndInListView, undefined);
    },
    [onDragEnd],
  );

  return (
    <DraggableFlatList<T>
      ref={ref}
      style={style as StyleProp<ViewStyle>}
      onDragBegin={handleDragBegin}
      onDragEnd={handleDragEnd}
      activationDistance={enabled ? activeDistance : 100_000}
      containerStyle={[{ flex: 1 }, rawContainerStyle]}
      columnWrapperStyle={columnWrapperStyle ? columnStyle : undefined}
      ListHeaderComponentStyle={listHeaderStyle}
      ListFooterComponentStyle={listFooterStyle}
      contentContainerStyle={rawContentContainerStyle}
      data={data}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      {...restProps}
    />
  );
}

export const SortableListView = withStaticProperties(
  forwardRef(BaseSortableListView) as typeof BaseSortableListView,
  {
    OpacityDecorator,
    ScaleDecorator,
    ShadowDecorator,
  },
);
