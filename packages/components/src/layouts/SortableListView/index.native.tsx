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

import type { ISortableListViewProps, ISortableListViewRef } from './types';
import type { StyleProp, ViewStyle } from 'react-native';
import type {
  DragEndParams,
  RenderItem,
} from 'react-native-draggable-flatlist';

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

  const reloadOnDragBegin = useCallback(
    (index: number) => {
      appEventBus.emit(EAppEventBusNames.onDragBeginInListView, undefined);
      onDragBegin?.(index);
    },
    [onDragBegin],
  );
  const reloadOnDragEnd = useCallback(
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
      onDragBegin={reloadOnDragBegin}
      onDragEnd={reloadOnDragEnd}
      activationDistance={enabled ? activeDistance : 100_000}
      containerStyle={[{ flex: 1 }, rawContainerStyle]}
      columnWrapperStyle={columnWrapperStyle ? columnStyle : undefined}
      ListHeaderComponentStyle={listHeaderStyle}
      ListFooterComponentStyle={listFooterStyle}
      contentContainerStyle={rawContentContainerStyle}
      data={data}
      keyExtractor={keyExtractor}
      renderItem={renderItem as RenderItem<T>}
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
