import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import type { IListViewRef } from '@onekeyhq/components';
import { Button, Divider, ListView, Text, XStack } from '@onekeyhq/components';

import useAppNavigation from '../../../../../../hooks/useAppNavigation';

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
