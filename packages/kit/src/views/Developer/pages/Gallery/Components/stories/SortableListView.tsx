import { useState } from 'react';

import { Pressable } from 'react-native';

import { SortableListView, Text } from '@onekeyhq/components';

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
      renderItem={({ item, drag, isActive }) => (
        // Don't use `Stack.onLongPress` as it will only be called after `onPressOut`
        <SortableListView.ShadowDecorator>
          <SortableListView.ScaleDecorator activeScale={0.9}>
            <Pressable
              onLongPress={drag}
              disabled={isActive}
              style={{
                backgroundColor: item.backgroundColor,
                width: '100%',
                height: CELL_HEIGHT,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text color="white">{item.index}</Text>
            </Pressable>
          </SortableListView.ScaleDecorator>
        </SortableListView.ShadowDecorator>
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
