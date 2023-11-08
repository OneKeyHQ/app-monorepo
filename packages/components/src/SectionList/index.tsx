import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

import { usePropsAndStyle, useStyle } from '@tamagui/core';
import { SectionList as NativeSectionList } from 'react-native';

import type { StackProps } from '@tamagui/web/types';
import type {
  ISectionListProps as NativeSectionListProps,
  StyleProp,
  ViewStyle,
} from 'react-native';

export type ISectionListProps<T> = Omit<
  NativeSectionListProps<T>,
  | 'contentContainerStyle'
  | 'ListHeaderComponentStyle'
  | 'ListFooterComponentStyle'
> &
  StackProps & {
    contentContainerStyle?: StackProps;
    ListHeaderComponentStyle?: StackProps;
    ListFooterComponentStyle?: StackProps;
  };

export type ISectionListRef = NativeSectionList<any, any>;

function BaseSectionList<T>(
  {
    sections,
    renderItem,
    contentContainerStyle = {},
    ListHeaderComponentStyle = {},
    ListFooterComponentStyle = {},
    ...props
  }: ISectionListProps<T>,
  ref: ForwardedRef<ISectionListRef>,
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
    <NativeSectionList
      ref={ref}
      style={style as StyleProp<ViewStyle>}
      ListHeaderComponentStyle={listHeaderStyle}
      ListFooterComponentStyle={listFooterStyle}
      contentContainerStyle={contentStyle}
      sections={sections}
      renderItem={renderItem}
      {...restProps}
    />
  );
}

export const SectionList = forwardRef(BaseSectionList);
