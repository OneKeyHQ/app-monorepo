import type { ForwardedRef, MutableRefObject } from 'react';
import { forwardRef, useMemo } from 'react';

import { FlashList } from '@shopify/flash-list';
import { usePropsAndStyle, useStyle } from '@tamagui/core';
import { I18nManager, type StyleProp, type ViewStyle } from 'react-native';
import { getTokenValue } from 'tamagui';

import { OptimizationView } from '../../optimization';

import type { FlashListProps, ListRenderItem } from '@shopify/flash-list';
import type { StackStyle, Tokens } from '@tamagui/web/types/types';

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
  StackStyle & {
    contentContainerStyle?: StackStyle;
    columnWrapperStyle?: StackStyle;
    ListHeaderComponentStyle?: StackStyle;
    ListFooterComponentStyle?: StackStyle;
  } & {
    data: ReadonlyArray<T> | null | undefined;
    renderItem: ListRenderItem<T> | null | undefined;
    ref?: MutableRefObject<IListViewRef<any> | null>;

    /*
      Average height of your cell
      See https://shopify.github.io/flash-list/docs/estimated-item-size/#how-to-calculate
    */
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
  const itemSize = useMemo<number | undefined>(() => {
    if (typeof estimatedItemSize === 'undefined') {
      return undefined;
    }
    return typeof estimatedItemSize === 'number'
      ? estimatedItemSize
      : (getTokenValue(estimatedItemSize, 'size') as number);
  }, [estimatedItemSize]);
  return (
    // FlashList doesn't support the style, so we have to wrap it,
    // and we set default flex = 1 just like FlatList
    <OptimizationView
      style={[{ flex: 1, minHeight: 2 }, style as StyleProp<ViewStyle>]}
    >
      <FlashList<T>
        ref={ref}
        ListHeaderComponentStyle={listHeaderStyle}
        ListFooterComponentStyle={listFooterStyle}
        contentContainerStyle={contentStyle}
        data={data}
        renderItem={renderItem}
        estimatedItemSize={itemSize}
        disableAutoLayout={I18nManager.isRTL}
        {...restProps}
      />
    </OptimizationView>
  );
}

// forwardRef cannot cast typescript generic
export const ListView = forwardRef(BaseListView) as typeof BaseListView;
