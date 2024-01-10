import type { PropsWithChildren } from 'react';

import {
  BlurView,
  ListView,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const mockData = [...Array(20).keys()];
const colors = [
  'orangered',
  'gold',
  'purple',
  'turquoise',
  'salmon',
  'yellowgreen',
];
const getColor = () => colors[Math.floor(Math.random() * colors.length)];

function Background({ children }: PropsWithChildren<unknown>) {
  return (
    <YStack
      flex={1}
      h="$100"
      alignItems="center"
      justifyContent="center"
      position="relative"
    >
      <XStack
        flex={1}
        flexWrap="wrap"
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
      >
        {mockData.map((i) => (
          <Stack w="25%" h="$20" key={`box-${i}`} bc={getColor()} />
        ))}
      </XStack>
      {children}
    </YStack>
  );
}

function BasicDemo() {
  return (
    <Background>
      <BlurView w="90%" h="$20" intensity={70} />
      <BlurView w="80%" h="$20" margin="$4" borderRadius="$4" intensity={70} />
      <BlurView contentStyle={{ p: '$4' }} borderRadius="$4" intensity={70}>
        <SizableText>999</SizableText>
      </BlurView>
    </Background>
  );
}

function ListDemo() {
  return (
    <Background>
      <BlurView w="100%" h="$20" intensity={70}>
        <ListView
          p="$2"
          horizontal
          data={mockData}
          showsHorizontalScrollIndicator={false}
          estimatedItemSize="$10"
          renderItem={({ item }) => (
            <BlurView m="$2" borderRadius="$2" contentStyle={{ p: '$2' }}>
              <SizableText>{item}</SizableText>
            </BlurView>
          )}
        />
      </BlurView>
    </Background>
  );
}

const BlurViewGallery = () => (
  <Layout
    description="****"
    suggestions={['****']}
    boundaryConditions={['****']}
    elements={[
      {
        title: 'Default',
        element: <BasicDemo />,
      },
      {
        title: 'List',
        element: <ListDemo />,
      },
    ]}
  />
);

export default BlurViewGallery;
