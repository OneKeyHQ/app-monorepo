import type { ForwardedRef, MutableRefObject } from 'react';
import { forwardRef } from 'react';

import { usePropsAndStyle, useStyle } from '@tamagui/core';
import {
  SectionList as RNSectionList,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { OptimizationView } from '../../optimization';

import type { FlashList } from '@shopify/flash-list';

type IListViewRef<T> = FlashList<T>;

function BaseSectionList<T>(
  {
    sections,
    renderItem,
    contentContainerStyle = {},
    ListHeaderComponentStyle = {},
    ListFooterComponentStyle = {},
    estimatedItemSize,
    ...props
  }: any,
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

  return (
    // FlashList doesn't support the style, so we have to wrap it,
    // and we set default flex = 1 just like FlatList
    <OptimizationView
      style={[{ flex: 1, minHeight: 2 }, style as StyleProp<ViewStyle>]}
    >
      <RNSectionList<T>
        ref={ref as any}
        ListHeaderComponentStyle={listHeaderStyle}
        ListFooterComponentStyle={listFooterStyle}
        contentContainerStyle={contentStyle}
        sections={sections}
        renderItem={renderItem}
        // estimatedItemSize={itemSize}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        {...restProps}
      />
    </OptimizationView>
  );
}

// forwardRef cannot cast typescript generic
export const SectionList = forwardRef(
  BaseSectionList,
) as typeof BaseSectionList;
