import { useState } from 'react';

import { Button, Progress, YStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

function ProgressDemo() {
  const [progress, setProgress] = useState(10);
  return (
    <YStack gap="$2">
      <Progress value={progress} w="$36" />
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
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Default',
        element: <ProgressDemo />,
      },
      {
        title: '0',
        element: (
          <YStack gap="$2">
            <Progress value={0} w="$36" />
            <Progress value={0.1} w="$36" />
            <Progress value={60} w="$36" />
            <Progress value={80} w="$36" />
            <Progress value={100} w="$36" />
          </YStack>
        ),
      },
    ]}
  />
);

export default ProgressGallery;
