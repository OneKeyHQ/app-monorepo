import type { ForwardedRef, ReactNode } from 'react';
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';

import {
  OpacityDecorator,
  ScaleDecorator,
  ShadowDecorator,
} from 'react-native-draggable-flatlist';
import { withStaticProperties } from 'tamagui';

import { Stack } from '../../primitives';
import { SectionList } from '../SectionList';
import { SortableListView } from '../SortableListView';

import type {
  ISortableListViewProps,
  ISortableListViewRef,
} from '../SortableListView';
import type { RenderItem } from 'react-native-draggable-flatlist';

type ISectionRenderInfo = (info: {
  section: any;
  index: number;
}) => ReactNode | null;

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

export type ISortableSectionListProps<T> = Omit<
  ISortableListViewProps<T>,
  'data' | 'renderItem' | 'onDragEnd' | 'initialScrollIndex'
> & {
  sections: Array<{
    data?: any[];
  }>;
  renderItem?: (info: {
    item: any;
    section: any;
    index: number;
    drag: () => void;
    dragProps: Record<string, any> | undefined;
    isActive: boolean;
  }) => ReactNode | null;
  renderSectionHeader?: ISectionRenderInfo;
  renderSectionFooter?: ISectionRenderInfo;
  SectionSeparatorComponent?: ReactNode;
  stickySectionHeadersEnabled?: boolean;
  onDragEnd?: (result: {
    sections: Array<{
      data?: any[];
    }>;
    from?: { sectionIndex: number; itemIndex: number };
    to?: { sectionIndex: number; itemIndex: number };
  }) => void;
  initialScrollIndex?: { sectionIndex: number; itemIndex?: number };
  allowCrossSection?: boolean;
};

type IScrollToLocationParams = {
  animated?: boolean;
  itemIndex?: number;
  sectionIndex?: number;
  viewOffset?: number;
  viewPosition?: number;
};

export type ISortableSectionListRef<T> = ISortableListViewRef<T> & {
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
  sectionIndex: number;
};

function BaseSortableSectionList<T>(
  {
    sections,
    renderItem,
    renderSectionHeader,
    renderSectionFooter,
    ListHeaderComponent,
    SectionSeparatorComponent = <Stack h="$5" />,
    stickySectionHeadersEnabled = false,
    keyExtractor,
    onDragEnd,
    initialScrollIndex,
    allowCrossSection = false,
    ...restProps
  }: ISortableSectionListProps<T>,
  parentRef: ForwardedRef<ISortableListViewRef<T>>,
) {
  const reloadSections = useMemo(() => {
    const reloadSectionList: ISectionLayoutItem[] = [];
    sections?.forEach?.((section, sectionIndex) => {
      if (sectionIndex !== 0) {
        reloadSectionList.push({
          value: section,
          index: sectionIndex,
          sectionIndex,
          type: ESectionLayoutType.SectionSeparator,
        });
      }
      reloadSectionList.push({
        value: section,
        index: sectionIndex,
        sectionIndex,
        type: ESectionLayoutType.Header,
      });
      section?.data?.forEach?.((item, index) => {
        reloadSectionList.push({
          value: item,
          section,
          index,
          sectionIndex,
          type: ESectionLayoutType.Item,
        });
      });
      reloadSectionList.push({
        value: section,
        index: sectionIndex,
        sectionIndex,
        type: ESectionLayoutType.Footer,
      });
    });
    return reloadSectionList;
  }, [sections]);

  const reloadSectionHeaderIndex = useCallback(
    (index: number) => (ListHeaderComponent ? index + 1 : index),
    [ListHeaderComponent],
  );

  const reloadStickyHeaderIndices = useMemo(() => {
    if (!stickySectionHeadersEnabled) {
      return undefined;
    }
    return reloadSections
      .map((item, index) =>
        item.type === ESectionLayoutType.Header
          ? reloadSectionHeaderIndex(index)
          : null,
      )
      .filter((index) => index != null) as number[];
  }, [reloadSectionHeaderIndex, stickySectionHeadersEnabled, reloadSections]);

  const ref = useRef<ISortableListViewRef<T>>(null);
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
    ...ref?.current,
  }));
  const renderSectionAndItem = useCallback(
    ({
      item,
      drag,
      dragProps,
      isActive,
    }: {
      item: T;
      drag: () => void;
      dragProps?: Record<string, any>;
      isActive: boolean;
    }) => {
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
            drag,
            dragProps,
            isActive,
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
  const reloadKeyExtractor = useCallback(
    (item: T, index: number) => {
      const layoutItem = item as ISectionLayoutItem;
      if (layoutItem.type === ESectionLayoutType.Item && keyExtractor) {
        return `${layoutItem.type}_${layoutItem.sectionIndex}_${keyExtractor(
          layoutItem.value as T,
          index,
        )}`;
      }
      return `${layoutItem.type}_${layoutItem.sectionIndex}_${layoutItem.index}`;
    },
    [keyExtractor],
  );

  const reloadOnDragEnd = useCallback(
    (result: { data: T[]; from: number; to: number }) => {
      const dragSections = sections.map((section) => ({ ...section }));
      dragSections.forEach((section) => {
        section.data = [];
      });
      let fromIndex: { sectionIndex: number; itemIndex: number } | undefined;
      let toIndex: { sectionIndex: number; itemIndex: number } | undefined;
      let sectionIndex = -1;
      const firstHeaderIndex = result.data.findIndex(
        (item) =>
          (item as ISectionLayoutItem).type === ESectionLayoutType.Header,
      );
      const firstHeader = result.data?.[firstHeaderIndex];
      const reloadResultData = [...result.data];
      reloadResultData.splice(firstHeaderIndex, 1);
      reloadResultData.unshift(firstHeader);
      reloadResultData.forEach((item) => {
        const layoutItem = item as ISectionLayoutItem;
        if (layoutItem.type === ESectionLayoutType.Item) {
          sectionIndex = Math.max(
            0,
            Math.min(dragSections.length - 1, sectionIndex),
          );
          dragSections?.[
            allowCrossSection ? sectionIndex : layoutItem.sectionIndex
          ]?.data?.push?.(layoutItem.value);
        } else if (layoutItem.type === ESectionLayoutType.Header) {
          if (allowCrossSection) {
            sectionIndex += 1;
          }
        }
      });

      reloadSections.forEach((layoutItem, index) => {
        if (result.from === index) {
          fromIndex = {
            sectionIndex: layoutItem.sectionIndex,
            itemIndex: layoutItem.index,
          };
        }
        if (result.to === index && allowCrossSection) {
          toIndex = {
            sectionIndex: layoutItem.sectionIndex,
            itemIndex: layoutItem.index,
          };
        }
      });
      onDragEnd?.({ sections: dragSections, from: fromIndex, to: toIndex });
    },
    [onDragEnd, sections, reloadSections, allowCrossSection],
  );

  const reloadInitialScrollIndex = useMemo(() => {
    const index = reloadSections.findIndex((layoutItem) => {
      const sameSectionIndex =
        layoutItem.sectionIndex === initialScrollIndex?.sectionIndex;
      if (initialScrollIndex?.itemIndex === undefined) {
        return sameSectionIndex;
      }
      return (
        sameSectionIndex &&
        layoutItem.index === initialScrollIndex?.itemIndex &&
        layoutItem.type === ESectionLayoutType.Item
      );
    });
    if (index === -1) {
      return undefined;
    }
    return index;
  }, [
    reloadSections,
    initialScrollIndex?.sectionIndex,
    initialScrollIndex?.itemIndex,
  ]);

  return (
    <SortableListView
      // @ts-ignore
      ref={ref}
      data={reloadSections as T[]}
      renderItem={renderSectionAndItem as RenderItem<T>}
      ListHeaderComponent={ListHeaderComponent}
      stickyHeaderIndices={reloadStickyHeaderIndices}
      keyExtractor={reloadKeyExtractor}
      onDragEnd={reloadOnDragEnd}
      initialScrollIndex={reloadInitialScrollIndex}
      {...restProps}
    />
  );
}

export const SortableSectionList = withStaticProperties(
  forwardRef(BaseSortableSectionList),
  {
    SectionHeader: SectionList.SectionHeader,
    OpacityDecorator,
    ScaleDecorator,
    ShadowDecorator,
  },
);
