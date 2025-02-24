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
            <Progress value={0} w={50} />
            <Progress value={10} w={50} />
            <Progress value={60} w={50} />
            <Progress value={90} w={50} />
            <Progress value={100} w={50} />
            <Progress value={0.1} />
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
