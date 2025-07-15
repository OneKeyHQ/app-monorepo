/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useAnimatedReaction } from 'react-native-reanimated';
import { AutoSizer, List as VirtualizedList } from 'react-virtualized';

import { useTabsContext, useTabsScrollContext } from './context';
import { useCurrentTabName } from './Tab';

import type { FlashListProps } from '@shopify/flash-list';

type IListProps<Item> = FlashListProps<Item>;

export function List<Item>({
  renderItem,
  data,
  ListHeaderComponent,
  ListFooterComponent,
  ListEmptyComponent,
  estimatedItemSize,
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
  return data?.length ? (
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
            rowCount={data?.length || 0}
            rowHeight={estimatedItemSize || 50}
            rowRenderer={rowRenderer}
          />
        </div>
      )}
    </AutoSizer>
  ) : (
    ListEmptyComponent
  );
}
