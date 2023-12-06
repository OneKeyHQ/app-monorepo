import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import type { IListViewRef } from '@onekeyhq/components';
import { Button, Divider, ListView, Text, XStack } from '@onekeyhq/components';

import useAppNavigation from '../../../hooks/useAppNavigation';

import ListPerformance from './ListPerformance';
import { Layout } from './utils/Layout';

// read it before you use it.
// https://shopify.github.io/flash-list/docs/fundamentals/performant-components
const listData = new Array(100).fill(0).map((_, index) => index);
const ListViewDemo = () => {
  const ref = useRef<IListViewRef<any> | null>(null);
  return (
    <ListView
      h="$60"
      estimatedItemSize="$10"
      contentContainerStyle={{
        bg: '$borderLight',
        p: '$4',
      }}
      ListHeaderComponentStyle={{
        h: '$10',
        w: '100%',
        bg: 'blue',
      }}
      ListFooterComponentStyle={{
        h: '$10',
        w: '100%',
        bg: 'red',
      }}
      ref={ref}
      data={listData}
      ListHeaderComponent={XStack}
      ListFooterComponent={XStack}
      renderItem={({ item }) => (
        <XStack>
          <Text>{item}</Text>
          <Divider />
          <XStack space="$8">
            <Button
              onPress={() => {
                const scrollView = ref.current;
                scrollView?.scrollToIndex({ index: 0, animated: true });
              }}
            >
              Scroll to Top
            </Button>
          </XStack>
        </XStack>
      )}
    />
  );
};

const ListViewGallery = () => {
  const [showPerformanceList, setShowPerformanceList] = useState(false);
  const navigation = useAppNavigation();

  const headerRight = useCallback(
    () => (
      <Button
        onPress={() => {
          setShowPerformanceList(true);
        }}
      >
        ListView 性能测试
      </Button>
    ),
    [setShowPerformanceList],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight,
    });
  }, [navigation, headerRight]);

  return !showPerformanceList ? (
    <Layout
      elements={[
        {
          title: 'Styled ListView',
          element: <ListViewDemo />,
        },
      ]}
    />
  ) : (
    <ListPerformance />
  );
};

export default ListViewGallery;

// import React, { useState } from 'react';
// import { Text, View, StyleSheet, TouchableOpacity, Image } from 'react-native';
// import DraggableFlatList, {
//   ScaleDecorator,
//   OpacityDecorator,
// } from 'react-native-draggable-flatlist';

// const NUM_ITEMS = 10;
// function getColor(i: number) {
//   const multiplier = 255 / (NUM_ITEMS - 1);
//   const colorVal = i * multiplier;
//   return `rgb(${colorVal}, ${Math.abs(128 - colorVal)}, ${255 - colorVal})`;
// }

// type Item = {
//   key: string;
//   label: string;
//   height: number;
//   width: number;
//   backgroundColor: string;
// };

// const initialData: Item[] = [...Array(NUM_ITEMS)].map((d, index) => {
//   const backgroundColor = getColor(index);
//   return {
//     key: `item-${index}`,
//     label: String(index) + '',
//     height: 100,
//     width: 60 + Math.random() * 40,
//     backgroundColor,
//   };
// });

// const ITEMLIST = [require('../../../../assets/wallet/unboxing.png')];

// export default function App() {
//   const [data, setData] = useState(initialData);

//   const renderItem = ({ item, drag, isActive }: RenderItemParams<Item>) => {
//     return (
//       <ScaleDecorator>
//         <TouchableOpacity
//           onLongPress={drag}
//           disabled={isActive}
//           style={[
//             styles.rowItem,
//             { backgroundColor: isActive ? 'red' : item.backgroundColor },
//           ]}
//         >
//           <Text style={styles.text}>{item.label}</Text>
//         </TouchableOpacity>
//       </ScaleDecorator>
//     );
//   };

//   return (
//     <View flex={1}>
//       <Image
//         style={{ width: 100, height: 100 }}
//         resizeMode={'contain'}
//         source={ITEMLIST[0]}
//       />
//       <DraggableFlatList
//         data={data}
//         onDragEnd={({ data }) => setData(data)}
//         keyExtractor={(item) => item.key}
//         CellRendererComponent={ScaleDecorator}
//         renderItem={renderItem}
//       />
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   rowItem: {
//     height: 100,
//     width: '100%',
//     alignItems: 'center',
//     justifyContent: 'center',
//   },
//   text: {
//     color: 'white',
//     fontSize: 24,
//     fontWeight: 'bold',
//     textAlign: 'center',
//   },
// });
