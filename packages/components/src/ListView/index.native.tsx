import type { ForwardedRef, MutableRefObject } from 'react';
import { forwardRef } from 'react';

import { FlashList } from '@shopify/flash-list';
import { usePropsAndStyle, useStyle } from '@tamagui/core';
import { getTokenValue } from 'tamagui';

import { View } from '../View';

import type { FlashListProps, ListRenderItem } from '@shopify/flash-list';
import type { StackStyleProps, Tokens } from '@tamagui/web/types/types';
import type { StyleProp, ViewStyle } from 'react-native';

type IListViewRef<T> = FlashList<T>;

type IListViewProps<T> = Omit<
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

function BaseListView<T>(
  {
    data,
    renderItem,
    contentContainerStyle = {},
    columnWrapperStyle,
    ListHeaderComponentStyle = {},
    ListFooterComponentStyle = {},
    estimatedItemSize,
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
  const itemSize =
    typeof estimatedItemSize === 'number'
      ? estimatedItemSize
      : getTokenValue(estimatedItemSize);
  return (
    <View style={style as StyleProp<ViewStyle>}>
      <FlashList<T>
        ref={ref}
        ListHeaderComponentStyle={listHeaderStyle}
        ListFooterComponentStyle={listFooterStyle}
        contentContainerStyle={contentStyle}
        data={data}
        renderItem={renderItem}
        estimatedItemSize={itemSize}
        {...restProps}
      />
    </View>
  );
}

// forwardRef cannot cast typescript generic
export const ListView = forwardRef(BaseListView) as typeof BaseListView;
