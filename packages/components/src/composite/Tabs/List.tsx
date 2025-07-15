/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  AutoSizer,
  Collection,
  List as VirtualizedList,
} from 'react-virtualized';

import { useTabsContext, useTabsScrollContext } from './context';
import { useCurrentTabName } from './Tab';

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
  const currentTabName = useCurrentTabName();
  const { focusedTab } = useTabsContext();

  const ref = useRef<Element>(null);

  useEffect(() => {
    if (focusedTab.value === currentTabName) {
      registerChild(ref.current);
    }
  }, [focusedTab.value, currentTabName, registerChild]);

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
      const item = listData[index];
      if (item.type === 'header') {
        return ListHeaderComponent;
      }
      if (item.type === 'footer') {
        return ListFooterComponent;
      }
      if (item.type === 'section-header') {
        return renderSectionHeader?.({
          section: item.data.section,
          index: item.data.sectionIndex,
        });
      }
      if (item.type === 'section-footer') {
        return renderSectionFooter?.({
          section: item.data.section,
          index: item.data.sectionIndex,
        });
      }
      if (item.type === 'section-item') {
        return renderItem?.({
          item: item.data.item,
          index: item.data.itemIndex,
          target: 'Cell',
        });
      }

      if (!item.data) {
        return null;
      }
      return (
        <div key={key} style={style}>
          {renderItem && data
            ? renderItem({ item: item.data as Item, index, target: 'Cell' })
            : null}
        </div>
      );
    },
    [
      listData,
      renderItem,
      data,
      ListHeaderComponent,
      ListFooterComponent,
      renderSectionHeader,
      renderSectionFooter,
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
                autoHeight
                data={listData}
                isScrolling={isScrolling}
                scrollTop={scrollTop}
                width={autoSizerWidth}
                height={height}
                onScroll={onChildScroll}
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
      {({ width: autoSizerWidth, height: autoSizerHeight }) => (
        <div ref={ref as React.RefObject<HTMLDivElement>}>
          <VirtualizedList
            autoHeight
            width={autoSizerWidth}
            data={listData}
            height={autoSizerHeight || height || 400}
            isScrolling={isScrolling}
            overscanRowCount={30}
            onScroll={onChildScroll}
            scrollTop={scrollTop}
            rowCount={listData.length}
            rowHeight={estimatedItemSize || 50}
            rowRenderer={rowRenderer as any}
          />
        </div>
      )}
    </AutoSizer>
  );
}
