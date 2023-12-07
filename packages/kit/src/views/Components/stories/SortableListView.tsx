import { useState } from 'react';

import { Pressable } from 'react-native';

import { SortableListView, Text } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

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

const SortableListViewGallery = () => {
  const [data, setData] = useState(new Array(15).fill({}).map(mapIndexToData));
  return (
    <Layout
      scrollEnabled={false}
      elements={[
        {
          title: 'Styled ListView',
          element: (
            <SortableListView
              h={400}
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
                        height: 100,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text color="white">{item.index}</Text>
                    </Pressable>
                  </SortableListView.ScaleDecorator>
                </SortableListView.ShadowDecorator>
              )}
              onDragEnd={(result) => setData(result.data)}
            />
          ),
        },
      ]}
    />
  );
};

export default SortableListViewGallery;
