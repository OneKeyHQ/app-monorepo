import { useRef } from 'react';

import type { ListViewRef } from '@onekeyhq/components';
import { Button, Divider, ListView, Text, XStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const listData = new Array(100).fill(0).map((_, index) => index);
const ListViewDemo = () => {
  const ref = useRef<ListViewRef | null>(null);
  return (
    <ListView
      h="$60"
      bg="$backgroundPress"
      contentContainerStyle={{
        bg: '$borderLight',
        m: '$4',
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
                if (scrollView) {
                  scrollView.scrollToEnd({ animated: true });
                }
              }}
            >
              Scroll to Bottom
            </Button>
          </XStack>
        </XStack>
      )}
    />
  );
};

const ListViewGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    scrollEnabled={false}
    elements={[
      {
        title: 'Styled List',
        element: <ListViewDemo />,
      },
    ]}
  />
);

export default ListViewGallery;
