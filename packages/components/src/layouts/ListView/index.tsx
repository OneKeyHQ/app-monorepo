import type { ForwardedRef, MutableRefObject } from 'react';
import { forwardRef } from 'react';

import { usePropsAndStyle, useStyle } from '@tamagui/core';
import { FlatList } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { StackStyleProps, Tokens } from '@tamagui/web/types/types';
import type {
  FlatListProps,
  ListRenderItem,
  StyleProp,
  ViewStyle,
} from 'react-native';

export type IListViewRef<T> = FlatList<T>;

export type IListViewProps<T> = Omit<
  FlatListProps<T>,
  | 'contentContainerStyle'
  | 'columnWrapperStyle'
  | 'ListHeaderComponentStyle'
  | 'ListFooterComponentStyle'
  | 'data'
  | 'renderItem'
> &
  StackStyleProps & {
    contentContainerStyle?: StackStyleProps;
    columnWrapperStyle?: StackStyleProps;
    ListHeaderComponentStyle?: StackStyleProps;
    ListFooterComponentStyle?: StackStyleProps;
  } & {
    data: ArrayLike<T> | null | undefined;
    renderItem: ListRenderItem<T> | null | undefined;
    ref?: MutableRefObject<IListViewRef<any> | null>;

    /*
      Average height of your cell
      See https://shopify.github.io/flash-list/docs/estimated-item-size/#how-to-calculate
    */
    estimatedItemSize: number | `$${keyof Tokens['size']}`;
    getItemType?: (item: T) => string | undefined;
    onBlankArea?: (blankAreaEvent: {
      offsetStart: number;
      offsetEnd: number;
      blankArea: number;
    }) => void;
  };

function BaseListView<T>(
  {
    data,
    renderItem,
    contentContainerStyle = {},
    columnWrapperStyle,
    ListHeaderComponentStyle = {},
    ListFooterComponentStyle = {},
    refreshControl,
    ...props
  }: IListViewProps<T>,
  ref: ForwardedRef<IListViewRef<T>>,
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
    <FlatList<T>
      ref={ref}
      style={style as StyleProp<ViewStyle>}
      columnWrapperStyle={columnWrapperStyle ? columnStyle : undefined}
      ListHeaderComponentStyle={listHeaderStyle}
      ListFooterComponentStyle={listFooterStyle}
      contentContainerStyle={contentStyle}
      data={data}
      renderItem={renderItem}
      refreshControl={platformEnv.isNative ? refreshControl : undefined}
      {...restProps}
    />
  );
}

// forwardRef cannot cast typescript generic
export const ListView = forwardRef(BaseListView) as typeof BaseListView;
