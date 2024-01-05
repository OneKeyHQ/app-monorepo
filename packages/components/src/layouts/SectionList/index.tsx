import type { ForwardedRef, ReactNode } from 'react';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';

import { withStaticProperties } from 'tamagui';

import { Stack, Text, XStack } from '../../primitives';
import { ListView } from '../ListView';

import type { IListViewProps, IListViewRef } from '../ListView';
import type { ListRenderItem } from 'react-native';
import type { GetProps } from 'tamagui';

type ISectionRenderInfo = (info: {
  section: any;
  index: number;
}) => ReactNode | null;

export type ISectionListProps<T> = Omit<
  IListViewProps<T>,
  'data' | 'renderItem'
> & {
  sections: Array<{
    data?: any[];
  }>;
  renderItem?: (info: {
    item: any;
    section: any;
    index: number;
  }) => ReactNode | null;
  renderSectionHeader?: ISectionRenderInfo;
  renderSectionFooter?: ISectionRenderInfo;
  SectionSeparatorComponent?: ReactNode;
  stickySectionHeadersEnabled?: boolean;
};

type IScrollToLocationParams = {
  animated?: boolean;
  itemIndex?: number;
  sectionIndex?: number;
  viewOffset?: number;
  viewPosition?: number;
};

export type ISectionListRef<T> = IListViewRef<T> & {
  scrollToLocation: (info: IScrollToLocationParams) => void;
};

enum ESectionLayoutType {
  Header = 'sectionHeader',
  SectionSeparator = 'sectionSeparator',
  Item = 'item',
  Footer = 'sectionFooter',
}

type ISectionLayoutItem = {
  index: number;
  type: ESectionLayoutType;
  value: any;
  section?: any;
};

function BaseSectionList<T>(
  {
    sections,
    renderItem,
    renderSectionHeader,
    renderSectionFooter,
    SectionSeparatorComponent = <Stack h="$5" />,
    stickySectionHeadersEnabled = false,
    ...restProps
  }: ISectionListProps<T>,
  parentRef: ForwardedRef<IListViewRef<T>>,
) {
  const reloadSections = useMemo(() => {
    const reloadSectionList: ISectionLayoutItem[] = [];
    sections?.forEach?.((section, sectionIndex) => {
      if (sectionIndex !== 0) {
        reloadSectionList.push({
          value: section,
          index: sectionIndex,
          type: ESectionLayoutType.SectionSeparator,
        });
      }
      reloadSectionList.push({
        value: section,
        index: sectionIndex,
        type: ESectionLayoutType.Header,
      });
      section?.data?.forEach?.((item, index) => {
        reloadSectionList.push({
          value: item,
          section,
          index,
          type: ESectionLayoutType.Item,
        });
      });
      reloadSectionList.push({
        value: section,
        index: sectionIndex,
        type: ESectionLayoutType.Footer,
      });
    });
    return reloadSectionList;
  }, [sections]);

  const reloadStickyHeaderIndices = useMemo(() => {
    if (!stickySectionHeadersEnabled) {
      return undefined;
    }
    return reloadSections
      .map((item, index) =>
        item.type === ESectionLayoutType.Header ? index : null,
      )
      .filter((index) => index != null) as number[];
  }, [stickySectionHeadersEnabled, reloadSections]);

  const ref = useRef<IListViewRef<T>>(null);
  useImperativeHandle(parentRef as any, () => ({
    scrollToLocation: ({
      animated,
      itemIndex = 0,
      sectionIndex = 0,
      viewOffset,
      viewPosition,
    }: IScrollToLocationParams) => {
      ref?.current?.scrollToIndex?.({
        index:
          reloadSections.findIndex(
            (item) =>
              item.type === ESectionLayoutType.Header &&
              item.index === sectionIndex,
          ) + itemIndex,
        animated,
        viewOffset,
        viewPosition,
      });
    },
  }));
  const renderSectionAndItem = useCallback(
    ({ item }: { item: T }) => {
      const { type, value, section, index } = item as ISectionLayoutItem;
      switch (type) {
        case ESectionLayoutType.SectionSeparator: {
          return SectionSeparatorComponent;
        }
        case ESectionLayoutType.Header: {
          return renderSectionHeader?.({
            section: value,
            index,
          });
        }
        case ESectionLayoutType.Item: {
          return renderItem?.({
            item: value,
            section,
            index,
          });
        }
        case ESectionLayoutType.Footer: {
          return renderSectionFooter?.({
            section: value,
            index,
          });
        }
        default: {
          break;
        }
      }
    },
    [
      renderItem,
      renderSectionHeader,
      renderSectionFooter,
      SectionSeparatorComponent,
    ],
  );
  const getItemType = useCallback(
    (item: T) => (item as ISectionLayoutItem).type,
    [],
  );
  return (
    <ListView
      ref={ref}
      data={reloadSections as T[]}
      renderItem={renderSectionAndItem as ListRenderItem<T>}
      stickyHeaderIndices={reloadStickyHeaderIndices}
      getItemType={getItemType}
      {...restProps}
    />
  );
}

const SectionHeader = ({
  title,
  titleProps,
  children,
  ...restProps
}: GetProps<typeof XStack> & {
  title?: string;
  titleProps?: GetProps<typeof Text>;
}) => (
  <XStack h="$9" px="$5" alignItems="center" bg="$bgApp" {...restProps}>
    <Text
      numberOfLines={1}
      variant="$headingSm"
      color="$textSubdued"
      {...titleProps}
    >
      {title}
    </Text>
    {children}
  </XStack>
);

export const SectionList = withStaticProperties(forwardRef(BaseSectionList), {
  SectionHeader,
});
