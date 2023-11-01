import { useRef } from 'react';

import type { SectionListRef } from '@onekeyhq/components';
import {
  Button,
  Divider,
  SectionList,
  Stack,
  Text,
  XStack,
} from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const sectionListData = [
  {
    title: 'Main dishes',
    data: ['Pizza', 'Burger', 'Risotto'],
  },
  {
    title: 'Sides',
    data: ['French Fries', 'Onion Rings', 'Fried Shrimps'],
  },
  {
    title: 'Drinks',
    data: ['Water', 'Coke', 'Beer'],
  },
  {
    title: 'Desserts',
    data: ['Cheese Cake', 'Ice Cream'],
  },
];

const SectionListDemo = () => {
  const ref = useRef<SectionListRef | null>(null);
  return (
    <SectionList
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
      sections={sectionListData}
      renderSectionHeader={({ section: { title } }) => (
        <Stack bg="$bg">
          <Text variant="$headingXs">{title}</Text>
        </Stack>
      )}
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
                scrollView?.scrollToEnd({ animated: true });
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

const SectionListGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    scrollEnabled={false}
    elements={[
      {
        title: 'Styled SectionList',
        element: <SectionListDemo />,
      },
    ]}
  />
);

export default SectionListGallery;
