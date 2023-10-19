import { Slider, Stack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const SliderGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Default',
        element: (
          <Stack space="$2">
            <Slider />
          </Stack>
        ),
      },
      {
        title: 'Disabled',
        element: (
          <Stack space="$2">
            <Slider disabled defaultValue={[50]} />
          </Stack>
        ),
      },
    ]}
  />
);

export default SliderGallery;
