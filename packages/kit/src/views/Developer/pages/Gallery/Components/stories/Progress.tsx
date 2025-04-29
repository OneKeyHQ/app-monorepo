import { useState } from 'react';

import { Button, Progress, YStack } from '@onekeyhq/components';

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
    filePath={__CURRENT_FILE_PATH__}
    componentName="Progress"
    elements={[
      {
        title: 'Interactive Progress Bar',
        element: <ProgressDemo />,
      },
      {
        title: 'Progress Bar Variations',
        element: (
          <YStack gap="$2">
            <Progress animated value={0} w={50} />
            <Progress animated value={10} w={50} />
            <Progress animated value={60} w={50} />
            <Progress animated value={90} w={50} />
            <Progress animated value={100} w={50} />
            <Progress animated value={0.1} />
            <Progress value={60} />
            <Progress value={80} />
            <Progress value={100} />
          </YStack>
        ),
      },
      {
        title: 'Progress Bar Colors',
        element: (
          <YStack gap="$5">
            <Progress progressColor="$textSuccess" value={60} h={20} />
            <Progress indicatorColor="$textSuccess" value={60} h={10} />
          </YStack>
        ),
      },
    ]}
  />
);

export default ProgressGallery;
