import { useRef } from 'react';

import type { IScrollViewRef } from '@onekeyhq/components';
import { Button, ScrollView, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const BasicScrollViewDemo = () => <ScrollView h="$10" bg="red" />;

const ScrollViewDemo = () => {
  const ref = useRef<IScrollViewRef | null>(null);
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
            if (ref.current) {
              ref.current.scrollToEnd();
            }
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
    elements={[
      {
        title: 'Basic',
        element: <BasicScrollViewDemo />,
      },
      {
        title: 'Styled ScrollView',
        element: <ScrollViewDemo />,
      },
    ]}
  />
);

export default ScrollViewGallery;
