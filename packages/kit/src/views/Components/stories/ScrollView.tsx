import { useRef } from 'react';

import type { ScrollViewRef } from '@onekeyhq/components';
import { Button, ScrollView, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const ScrollViewDemo = () => {
  const ref = useRef<ScrollViewRef | null>(null);
  return (
    <ScrollView
      h="$60"
      bg="$backgroundPress"
      contentContainerStyle={{
        bg: '$borderLight',
        m: '$4',
      }}
      ref={ref}
    >
      <YStack h="$96" padding="$8" justifyContent="space-around">
        <Button
          onPress={() => {
            ref.current?.scrollToEnd();
          }}
        >
          Scroll to Bottom
        </Button>
        <Button
          onPress={() => {
            ref.current?.scrollTo({
              x: 0,
              y: 0,
              animated: true,
            });
          }}
        >
          Scroll to Top
        </Button>
      </YStack>
    </ScrollView>
  );
};

const ScrollViewGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    scrollEnabled={false}
    elements={[
      {
        title: 'Styled Scroll',
        element: <ScrollViewDemo />,
      },
    ]}
  />
);

export default ScrollViewGallery;
