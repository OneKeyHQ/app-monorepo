import { useState } from 'react';

import { SortableListView, Stack, Text } from '@onekeyhq/components';

export const mapIndexToData = (_d: any, index: number, array: any[]) => {
  const getColor = (i: number, numItems = 25) => {
    const multiplier = 255 / (numItems - 1);
    const colorVal = i * multiplier;
    return `rgb(${colorVal}, ${Math.abs(128 - colorVal)}, ${255 - colorVal})`;
  };
  const backgroundColor = getColor(index, array.length);
  return {
    index,
    backgroundColor,
  };
};

const CELL_HEIGHT = 100;

const SortableListViewGallery = () => {
  const [data, setData] = useState(new Array(15).fill({}).map(mapIndexToData));
  return (
    <SortableListView
      bg="$bgApp"
      data={data}
      keyExtractor={(item) => `${item.index}`}
      renderItem={({ item }) => (
        <Stack
          w="100%"
          h={CELL_HEIGHT}
          alignItems="center"
          justifyContent="center"
          bg={item.backgroundColor}
        >
          <Text color="white">{item.index}</Text>
        </Stack>
      )}
      getItemLayout={(_, index) => ({
        length: CELL_HEIGHT,
        offset: index * CELL_HEIGHT,
        index,
      })}
      onDragEnd={(result) => setData(result.data)}
    />
  );
};

export default SortableListViewGallery;
