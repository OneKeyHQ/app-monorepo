import { Progress, Stack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const ProgressGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Default',
        element: (
          <Stack space="$2">
            <Progress value={50} w="$36" />
          </Stack>
        ),
      },
    ]}
  />
);

export default ProgressGallery;
