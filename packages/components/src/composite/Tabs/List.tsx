/* eslint-disable react/prop-types */
import { useCallback } from 'react';

import { List as VirtualizedList } from 'react-virtualized';

import type { FlashListProps } from '@shopify/flash-list';

type IListProps<Item> = FlashListProps<Item>;

export function List<Item>({
  renderItem,
  data,
  estimatedItemSize,
}: IListProps<Item>) {
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
    <VirtualizedList
      height={400}
      width={300}
      rowCount={data?.length || 0}
      rowHeight={estimatedItemSize || 50}
      rowRenderer={rowRenderer}
    />
  );
}
