/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useAnimatedReaction } from 'react-native-reanimated';
import {
  AutoSizer,
  Collection,
  List as VirtualizedList,
} from 'react-virtualized';

import { useTabsContext, useTabsScrollContext } from './context';
import { useCurrentTabName } from './Tab';

import type { FlashListProps } from '@shopify/flash-list';
import type { CollectionCellRendererParams } from 'react-virtualized';

type IListProps<Item> = FlashListProps<Item>;

export function List<Item>({
  renderItem,
  data,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
  estimatedItemSize,
  numColumns = 1,
}: IListProps<Item>) {
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
  console.log('currentTabName', currentTabName, focusedTab.value);
  //   useAnimatedReaction(
  //     () => focusedTab.value,
  //     (focusedTabValue) => {
  //       console.log('registerChild', ref.current);
  //       if (focusedTabValue === currentTabName) {
  //         registerChild(ref.current);
  //       }
  //     },
  //     [currentTabName],
  //   );

  useEffect(() => {
    if (focusedTab.value === currentTabName) {
      registerChild(ref.current);
    }
  }, [focusedTab.value, currentTabName, registerChild]);

  const listData: {
    data: Item | null;
    type: 'header' | 'footer' | 'item';
  }[] = useMemo(() => {
    const list: {
      data: Item | null;
      type: 'header' | 'footer' | 'item';
    }[] = [];
    if (ListHeaderComponent) {
      list.push({ data: null, type: 'header' });
    }
    if (data?.length) {
      list.push(...data.map((item) => ({ data: item, type: 'item' as const })));
    }
    if (ListFooterComponent) {
      list.push({ data: null, type: 'footer' });
    }
    return list;
  }, [ListFooterComponent, ListHeaderComponent, data]);

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
      if (!item.data) {
        return null;
      }
      return (
        <div key={key} style={style}>
          {renderItem && data
            ? renderItem({ item: item.data, index, target: 'Cell' })
            : null}
        </div>
      );
    },
    [listData, renderItem, data, ListHeaderComponent, ListFooterComponent],
  );

  const cellSizeAndPositionGetter = useCallback(
    ({ index }: { index: number }) => {
      const clientWidth = width / numColumns || 0;
      const clientHeight = clientWidth + 40 + 20;
      console.log('clientWidth', clientWidth, width, numColumns);
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

  if (!data?.length) {
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
              />
            </div>
          );
        }}
      </AutoSizer>
    );
  }

  return (
    <AutoSizer disableHeight>
      {({ width: autoSizerWidth }) => (
        <div ref={ref as React.RefObject<HTMLDivElement>}>
          <VirtualizedList
            autoHeight
            width={autoSizerWidth}
            data={listData}
            height={height || 400}
            isScrolling={isScrolling}
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
