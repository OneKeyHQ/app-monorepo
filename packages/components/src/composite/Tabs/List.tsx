/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { type LayoutChangeEvent, View } from 'react-native';
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  Collection,
  List as VirtualizedList,
} from 'react-virtualized';

import { useTabsContext, useTabsScrollContext } from './context';
import { useTabNameContext } from './TabNameContext';
import { useConvertAnimatedToValue } from './useFocusedTab';

import type { ISectionListProps } from '../../layouts';
import type { FlashListProps } from '@shopify/flash-list';
import type { CollectionCellRendererParams } from 'react-virtualized';

type IListProps<Item> = FlashListProps<Item>;

type IListData<Item> =
  | {
      type: 'header';
    }
  | {
      type: 'footer';
    }
  | {
      type: 'item';
      data: Item;
    }
  | {
      type: 'section-header';
      data: {
        section: ISectionListProps<Item>['sections'][number];
        sectionIndex: number;
      };
    }
  | {
      type: 'section-footer';
      data: {
        section: ISectionListProps<Item>['sections'][number];
        sectionIndex: number;
      };
    }
  | {
      type: 'section-item';
      data: {
        item: Item;
        itemIndex: number;
        sectionIndex: number;
      };
    };

export function List<Item>({
  renderItem,
  data,
  sections,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
  estimatedItemSize,
  renderSectionHeader,
  renderSectionFooter,
  ListHeaderComponentStyle,
  ListFooterComponentStyle,
  numColumns = 1,
}: IListProps<Item> & ISectionListProps<Item>) {
  const {
    registerChild,
    height,
    width,
    isScrolling,
    onChildScroll,
    scrollTop,
  } = useTabsScrollContext();
  const currentTabName = useTabNameContext();
  const { focusedTab } = useTabsContext();

  const focusedTabValue = useConvertAnimatedToValue(focusedTab, '');

  const ref = useRef<Element>(null);

  const scrollTabElementsRef = useTabsContext().scrollTabElementsRef;

  const cache = useMemo(
    () =>
      new CellMeasurerCache({
        fixedWidth: true,
        defaultHeight: estimatedItemSize || 60,
      }),
    [estimatedItemSize],
  );

  const isVisible = useMemo(() => {
    return focusedTabValue === currentTabName;
  }, [focusedTabValue, currentTabName]);

  useEffect(() => {
    if (
      currentTabName &&
      !scrollTabElementsRef.current[currentTabName] &&
      ref.current
    ) {
      scrollTabElementsRef.current[currentTabName] = {
        element: ref.current as HTMLElement,
      };
    }
    if (focusedTabValue === currentTabName) {
      registerChild(ref.current);
    }
  }, [focusedTabValue, currentTabName, registerChild, scrollTabElementsRef]);

  const listData: IListData<Item>[] = useMemo(() => {
    const list: IListData<Item>[] = [];
    if (ListHeaderComponent) {
      list.push({ type: 'header' });
    }

    if (sections?.length) {
      sections.forEach((section, sectionIndex) => {
        if (renderSectionHeader) {
          list.push({
            data: {
              section,
              sectionIndex,
            },
            type: 'section-header',
          });
        }
        if (section.data?.length) {
          section.data.forEach((item, itemIndex) => {
            list.push({
              type: 'section-item',
              data: {
                item,
                itemIndex,
                sectionIndex,
              },
            });
          });
        }
        if (renderSectionFooter) {
          list.push({
            data: {
              section,
              sectionIndex,
            },
            type: 'section-footer',
          });
        }
      });
    } else if (data?.length) {
      data.forEach((item) => {
        list.push({
          data: item,
          type: 'item' as const,
        });
      });
    }
    if (ListFooterComponent) {
      list.push({ type: 'footer' });
    }
    return list;
  }, [
    ListFooterComponent,
    ListHeaderComponent,
    data,
    renderSectionFooter,
    renderSectionHeader,
    sections,
  ]);

  const listRef = useRef<typeof VirtualizedList>(null);

  const rowRenderer = useCallback(
    ({
      index,
      key,
      style,
    }: {
      index: number;
      key: string;
      style: React.CSSProperties;
    }) => {
      const parent = listRef.current;
      const item = listData[index];
      let element = null;
      if (item.type === 'header') {
        element = (
          <View style={ListHeaderComponentStyle as any}>
            {ListHeaderComponent as React.ReactNode}
          </View>
        );
      } else if (item.type === 'footer') {
        element = (
          <View style={ListFooterComponentStyle as any}>
            {ListFooterComponent as React.ReactNode}
          </View>
        );
      } else if (item.type === 'section-header') {
        element = renderSectionHeader?.({
          section: item.data.section,
          index: item.data.sectionIndex,
        });
      } else if (item.type === 'section-footer') {
        element = renderSectionFooter?.({
          section: item.data.section,
          index: item.data.sectionIndex,
        });
      } else if (item.type === 'section-item') {
        element = renderItem?.({
          item: item.data.item,
          index: item.data.itemIndex,
          target: 'Cell',
        });
      } else if (item.type === 'item') {
        element =
          renderItem && data
            ? renderItem({ item: item.data, index, target: 'Cell' })
            : null;
      }

      if (parent) {
        return (
          <CellMeasurer
            cache={cache}
            columnIndex={0}
            key={key}
            parent={parent as any}
            rowIndex={index}
          >
            <div key={key} style={style}>
              {element as React.ReactNode}
            </div>
          </CellMeasurer>
        );
      }

      return (
        <div key={key} style={style}>
          {element as React.ReactNode}
        </div>
      );
    },
    [
      listData,
      ListHeaderComponentStyle,
      ListHeaderComponent,
      ListFooterComponentStyle,
      ListFooterComponent,
      renderSectionHeader,
      renderSectionFooter,
      renderItem,
      data,
      cache,
    ],
  );

  const cellSizeAndPositionGetter = useCallback(
    ({ index }: { index: number }) => {
      const clientWidth = width / numColumns || 0;
      const clientHeight = clientWidth + 60;
      const row = Math.floor(index / numColumns);
      const col = index % numColumns;
      const x = col * clientWidth;
      const y = row * clientHeight;

      return {
        height: clientHeight,
        width: clientWidth,
        x,
        y,
      };
    },
    [numColumns, width],
  );

  const cellRenderer = useCallback(
    (params: CollectionCellRendererParams) => {
      const { index, key, style } = params;
      return rowRenderer({
        index,
        key: String(key),
        style,
      });
    },
    [rowRenderer],
  );

  if (!data?.length && !sections?.length) {
    return ListEmptyComponent;
  }

  if (numColumns > 1) {
    return (
      <AutoSizer disableHeight>
        {({ width: autoSizerWidth }) => {
          return (
            <div ref={ref as React.RefObject<HTMLDivElement>}>
              <Collection
                ref={listRef as any}
                autoHeight
                data={listData}
                isScrolling={isVisible ? isScrolling : false}
                scrollTop={isVisible ? scrollTop : 0}
                onScroll={isVisible ? onChildScroll : undefined}
                width={autoSizerWidth}
                height={height}
                cellCount={listData.length}
                cellSizeAndPositionGetter={cellSizeAndPositionGetter}
                cellRenderer={cellRenderer as any}
                overscanRowCount={30}
              />
            </div>
          );
        }}
      </AutoSizer>
    );
  }

  return (
    <AutoSizer disableHeight>
      {({ width: autoSizerWidth, height: autoSizerHeight }) => {
        return (
          <div ref={ref as React.RefObject<HTMLDivElement>}>
            <VirtualizedList
              ref={listRef as any}
              autoHeight
              width={autoSizerWidth}
              data={listData}
              height={autoSizerHeight || height || 400}
              isScrolling={isVisible ? isScrolling : false}
              onScroll={isVisible ? onChildScroll : undefined}
              overscanRowCount={30}
              scrollTop={isVisible ? scrollTop : 0}
              rowCount={listData.length}
              rowHeight={cache.rowHeight}
              rowRenderer={rowRenderer}
            />
          </div>
        );
      }}
    </AutoSizer>
  );
}
