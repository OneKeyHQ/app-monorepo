import { ComponentProps, useCallback, useState } from 'react';

import { FlatList } from '@onekeyhq/components';

import { useGridListLayout } from '../../hooks/useGridListLayout';

import type { FlatListProps, ListRenderItemInfo } from 'react-native';

const DEFAULT_MAX_CARD_WIDTH = 112;
const DEFAULT_NUM_COLUMNS = 3;
const DEFAULT_MARGIN = 8;

function GridList<ItemT>({
  gridLayout,
  data,
  renderItem: renderItemProp,
  ...rest
}: {
  gridLayout?: {
    maxCardWidth?: number;
    numColumns?: number;
    margin?: number;
  };
  renderItem: (
    info: ListRenderItemInfo<ItemT> & { cardWidth: number },
  ) => React.ReactElement | null;
} & Omit<FlatListProps<ItemT>, 'renderItem'>) {
  const [pageWidth, setPageWidth] = useState<number>(0);
  const { cardWidth, numColumns } = useGridListLayout({
    maxCardWidth: gridLayout?.maxCardWidth ?? DEFAULT_MAX_CARD_WIDTH,
    numColumns: gridLayout?.numColumns ?? DEFAULT_NUM_COLUMNS,
    margin: gridLayout?.margin ?? DEFAULT_MARGIN,
    pageWidth,
  });

  const renderItem = useCallback<
    NonNullable<FlatListProps<ItemT>['renderItem']>
  >(
    (props) => renderItemProp({ ...props, cardWidth }),
    [cardWidth, renderItemProp],
  );

  return (
    <FlatList
      onLayout={(e) => {
        if (pageWidth !== e.nativeEvent.layout.width) {
          setPageWidth(e.nativeEvent.layout.width);
        }
      }}
      key={numColumns}
      numColumns={numColumns}
      data={data}
      renderItem={renderItem}
      showsVerticalScrollIndicator={false}
      padding={0}
      {...rest}
    />
  );
}

export { GridList };
