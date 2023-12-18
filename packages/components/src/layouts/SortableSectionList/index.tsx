import { forwardRef, useMemo } from 'react';
import type { ForwardedRef, ReactNode } from 'react';

import { usePropsAndStyle, useStyle } from '@tamagui/core';
import {
  // eslint-disable-next-line spellcheck/spell-checker
  NestableDraggableFlatList,
  // eslint-disable-next-line spellcheck/spell-checker
  NestableScrollContainer,
  OpacityDecorator,
  ScaleDecorator,
  ShadowDecorator,
} from 'react-native-draggable-flatlist';
import { withStaticProperties } from 'tamagui';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { Stack } from '../../primitives';
import { SectionList } from '../SectionList';

import type { StackStyleProps } from '@tamagui/web/types/types';
import type { ScrollViewProps, StyleProp, ViewStyle } from 'react-native';
import type { ScrollView } from 'react-native-gesture-handler';

export type ISortableSectionItemInfo = (info: {
  item: any;
  index: number | undefined;
  section: any;
  getIndex: () => number | undefined;
  drag: () => void;
  isActive: boolean;
}) => ReactNode | null;

export type ISortableSectionRenderInfo = (info: {
  section: any;
  index: number;
}) => ReactNode | null;

export type ISortableSectionListRef = ScrollView;

type ISectionType = Array<{
  data: any[];
}>;

export type ISortableSectionListProps = Omit<
  ScrollViewProps,
  'contentContainerStyle'
> &
  StackStyleProps & {
    sections: ISectionType;
    renderItem?: (info: {
      item: any;
      index: number | undefined;
      section: any;
      getIndex: () => number | undefined;
      drag: () => void;
      isActive: boolean;
    }) => JSX.Element;
    keyExtractor: (item: any, index: number) => string;
    getItemLayout: (
      item: any,
      index: number,
    ) => { length: number; offset: number; index: number };
    onDragEnd: (info: { sections: ISectionType }) => void;
    contentContainerStyle?: StackStyleProps;
    ListHeaderComponent?: ReactNode;
    ListFooterComponent?: ReactNode;
    SectionSeparatorComponent?: ReactNode;
    ListHeaderComponentStyle?: StackStyleProps;
    ListFooterComponentStyle?: StackStyleProps;
    renderSectionHeader?: ISortableSectionRenderInfo;
    renderSectionFooter?: ISortableSectionRenderInfo;
    stickySectionHeadersEnabled?: boolean;
  };

function BaseSortableSectionList(
  {
    sections,
    keyExtractor,
    renderItem,
    getItemLayout,
    contentContainerStyle = {},
    ListHeaderComponent,
    ListFooterComponent,
    SectionSeparatorComponent = <Stack h="$5" />,
    ListHeaderComponentStyle = {},
    ListFooterComponentStyle = {},
    renderSectionHeader,
    renderSectionFooter,
    stickySectionHeadersEnabled = false,
    onDragEnd,
    ...props
  }: ISortableSectionListProps,
  ref: ForwardedRef<ISortableSectionListRef> | undefined,
) {
  const [restProps, style] = usePropsAndStyle(props, {
    resolveValues: 'auto',
  });
  const rawContentContainerStyle = useStyle(
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

  const reloadStickyHeaderIndices = useMemo(() => {
    if (!stickySectionHeadersEnabled) {
      return [];
    }
    return sections.map(
      (section, index) =>
        (2 +
          (SectionSeparatorComponent ? 1 : 0) +
          (renderSectionFooter ? 1 : 0)) *
          index +
        1,
    );
  }, [
    stickySectionHeadersEnabled,
    sections,
    SectionSeparatorComponent,
    renderSectionFooter,
  ]);

  const scrollChildList = useMemo(() => {
    const childList: [ReactNode] = [
      <Stack style={listHeaderStyle}>{ListHeaderComponent}</Stack>,
    ];
    sections.forEach((section, index) => {
      if (index !== 0 && SectionSeparatorComponent) {
        childList.push(SectionSeparatorComponent);
      }
      if (renderSectionHeader) {
        childList.push(
          renderSectionHeader?.({
            section,
            index,
          }),
        );
      }
      childList.push(
        <NestableDraggableFlatList
          keyExtractor={keyExtractor}
          data={section.data}
          activationDistance={100}
          onDragEnd={(result) => {
            sections[index].data = result.data;
            onDragEnd({ sections: [...sections] });
          }}
          getItemLayout={getItemLayout}
          renderItem={({ item, getIndex, drag, isActive }) =>
            renderItem?.({
              item,
              section,
              index: getIndex(),
              getIndex,
              drag,
              isActive,
            })
          }
          scrollEnabled={platformEnv.isWebTouchable}
          disableScrollViewPanResponder
        />,
      );
      if (renderSectionFooter) {
        childList.push(
          renderSectionFooter?.({
            section,
            index,
          }),
        );
      }
    });
    childList.push(
      <Stack style={listFooterStyle}>{ListFooterComponent}</Stack>,
    );
    return childList;
  }, [
    ListHeaderComponent,
    ListFooterComponent,
    SectionSeparatorComponent,
    renderSectionHeader,
    renderSectionFooter,
    keyExtractor,
    getItemLayout,
    sections,
    listHeaderStyle,
    listFooterStyle,
    onDragEnd,
    renderItem,
  ]);

  return (
    <NestableScrollContainer
      ref={ref}
      style={style as StyleProp<ViewStyle>}
      contentContainerStyle={rawContentContainerStyle}
      stickyHeaderIndices={reloadStickyHeaderIndices}
      {...restProps}
    >
      {scrollChildList}
    </NestableScrollContainer>
  );
}

export const SortableSectionList = withStaticProperties(
  forwardRef(BaseSortableSectionList) as typeof BaseSortableSectionList,
  {
    SectionHeader: SectionList.SectionHeader,
    OpacityDecorator,
    ScaleDecorator,
    ShadowDecorator,
  },
);
