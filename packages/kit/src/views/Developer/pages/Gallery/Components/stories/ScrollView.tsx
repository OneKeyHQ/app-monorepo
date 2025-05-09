import { useRef } from 'react';

import type { IScrollViewRef } from '@onekeyhq/components';
import {
  Button,
  ScrollView,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const BasicScrollViewDemo = () => (
  <ScrollView h="$40" bg="$green2">
    <XStack gap="$2">
      {Array.from({ length: 20 }).map((_, index) => (
        <Stack key={index} bg="$red5" height="$16" width="$16" />
      ))}
    </XStack>
    <YStack gap="$2" mt="$2">
      {Array.from({ length: 20 }).map((_, index) => (
        <Stack key={index} bg="$yellow5" height="$16" width="$16" />
      ))}
    </YStack>
  </ScrollView>
);

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
    filePath={__CURRENT_FILE_PATH__}
    componentName="ScrollView"
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
