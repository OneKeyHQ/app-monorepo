import { useState } from 'react';

import { Button, Progress, Stack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

function ProgressDemo() {
  const [progress, setProgress] = useState(10);
  return (
    <Stack space="$2">
      <Progress value={progress} w="$36" />
      <Button
        onPress={() => {
          setProgress(progress + 10);
        }}
      >
        Increase
      </Button>
    </Stack>
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
    ]}
  />
);

export default ProgressGallery;
