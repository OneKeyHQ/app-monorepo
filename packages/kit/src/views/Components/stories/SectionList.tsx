import { useRef } from 'react';

import type { ISectionListRef } from '@onekeyhq/components';
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
  const ref = useRef<ISectionListRef | null>(null);
  return (
    <SectionList
      h="$60"
      bg="$backgroundPress"
      contentContainerStyle={{
        bg: '$borderLight',
      }}
      ListHeaderComponentStyle={{
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
                const sectionList = ref.current;
                sectionList?.scrollToLocation({
                  sectionIndex: 1,
                  itemIndex: 0,
                  animated: true,
                });
              }}
            >
              Scroll to `SIDES` section
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
