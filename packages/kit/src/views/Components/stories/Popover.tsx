import { Stack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const PopoverGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Default',
        element: <Stack space="$2">...</Stack>,
      },
    ]}
  />
);

export default PopoverGallery;
