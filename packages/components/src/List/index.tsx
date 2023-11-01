import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

import { usePropsAndStyle, useStyle } from '@tamagui/core';
import { FlatList } from 'react-native';

import type { StackProps } from '@tamagui/web/types';
import type { FlatListProps, StyleProp, ViewStyle } from 'react-native';

export type ListProps<T> = Omit<FlatListProps<T>, 'contentContainerStyle'> &
  StackProps & {
    contentContainerStyle: StackProps;
  };

export type FlatListRef = FlatList;

function BaseList<T>(
  { children, data, renderItem, contentContainerStyle, ...props }: ListProps<T>,
  ref: ForwardedRef<FlatListRef>,
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
  return (
    <FlatList
      ref={ref}
      style={style as StyleProp<ViewStyle>}
      contentContainerStyle={contentStyle}
      data={data}
      renderItem={renderItem}
      {...restProps}
    />
  );
}

export const List = forwardRef(BaseList);
