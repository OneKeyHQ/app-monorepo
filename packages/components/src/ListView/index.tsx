import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

import { usePropsAndStyle, useStyle } from '@tamagui/core';
import { FlatList } from 'react-native';

import type { StackProps } from '@tamagui/web/types';
import type { FlatListProps, StyleProp, ViewStyle } from 'react-native';

export type ListViewProps<T> = Omit<
  FlatListProps<T>,
  | 'contentContainerStyle'
  | 'columnWrapperStyle'
  | 'ListHeaderComponentStyle'
  | 'ListFooterComponentStyle'
> &
  StackProps & {
    contentContainerStyle?: StackProps;
    columnWrapperStyle?: StackProps;
    ListHeaderComponentStyle?: StackProps;
    ListFooterComponentStyle?: StackProps;
  };

export type ListViewRef = FlatList<any>;

function BaseListView<T>(
  {
    data,
    renderItem,
    contentContainerStyle = {},
    columnWrapperStyle,
    ListHeaderComponentStyle = {},
    ListFooterComponentStyle = {},
    ...props
  }: ListViewProps<T>,
  ref: ForwardedRef<ListViewRef>,
) {
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });
  const contentStyle = useStyle(
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
  return (
    <FlatList
      ref={ref}
      style={style as StyleProp<ViewStyle>}
      columnWrapperStyle={columnWrapperStyle ? columnStyle : undefined}
      ListHeaderComponentStyle={listHeaderStyle}
      ListFooterComponentStyle={listFooterStyle}
      contentContainerStyle={contentStyle}
      data={data}
      renderItem={renderItem}
      {...restProps}
    />
  );
}

export const ListView = forwardRef(BaseListView);
