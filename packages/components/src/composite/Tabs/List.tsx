/* eslint-disable react/prop-types */
import { useCallback, useEffect, useRef } from 'react';

import { useAnimatedReaction } from 'react-native-reanimated';
import { AutoSizer, List as VirtualizedList } from 'react-virtualized';

import { useTabsContext, useTabsScrollContext } from './context';
import { useCurrentTabName } from './Tab';

import type { FlashListProps } from '@shopify/flash-list';

type IListProps<Item> = FlashListProps<Item>;

export function List<Item>({
  renderItem,
  data,
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
      return (
        <div key={key} style={style}>
          {renderItem && data
            ? renderItem({ item: data[index], index, target: 'Cell' })
            : null}
        </div>
      );
    },
    [renderItem, data],
  );
  return (
    <AutoSizer disableHeight>
      {({ width: autoSizerWidth }) => (
        <div ref={ref as React.RefObject<HTMLDivElement>}>
          <VirtualizedList
            autoHeight
            width={autoSizerWidth}
            data={data}
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
  );
}
