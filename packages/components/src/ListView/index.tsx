import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

import { FlashList } from '@shopify/flash-list';
import { usePropsAndStyle, useStyle } from '@tamagui/core';
import { getTokens } from 'tamagui';

import { View } from '../View';

import type { IListViewProps, IListViewRef } from './type';
import type { StyleProp, ViewStyle } from 'react-native';

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
  const getSizeTokens = getTokens().size;
  const itemSize =
    typeof estimatedItemSize === 'number'
      ? estimatedItemSize
      : getSizeTokens[estimatedItemSize].val;
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

export * from './type';

// forwardRef cannot cast typescript generic
export const ListView = forwardRef(BaseListView) as typeof BaseListView;
