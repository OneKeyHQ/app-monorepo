import { useState } from 'react';

import { SpotlightTour } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const SliderGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Default',
        element: <SpotlightTour />,
      },
    ]}
  />
);

export default SliderGallery;
