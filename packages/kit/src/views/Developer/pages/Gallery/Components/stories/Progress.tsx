import { useState } from 'react';

import { Button, Progress, XStack, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

function ProgressDemo() {
  const [progress, setProgress] = useState(0);
  return (
    <YStack gap="$2">
      <Progress value={progress} />
      <Button
        onPress={() => {
          setProgress(progress + 10);
        }}
      >
        Increase
      </Button>
    </YStack>
  );
}

const ProgressGallery = () => (
  <Layout
    componentName="Progress"
    elements={[
      {
        title: 'Default',
        element: <ProgressDemo />,
      },
      {
        title: '0',
        element: (
          <YStack gap="$2">
            <XStack w="$10">
              <Progress value={0} />
            </XStack>
            <XStack w="$20">
              <Progress value={0.1} />
            </XStack>
            <Progress value={60} />
            <Progress value={80} />
            <Progress value={100} />
          </YStack>
        ),
      },
    ]}
  />
);

export default ProgressGallery;
