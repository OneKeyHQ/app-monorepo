/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react/no-unstable-nested-components */
import { useState } from 'react';

import { Stack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';
import { SegmentSlider } from '@onekeyhq/components/src/composite/SegmentSlider';

const SegmentSliderDemo = () => {
  return (
    <Stack gap="$4" padding="$4">
      <SegmentSlider />
    </Stack>
  );
};

const SegmentSliderGallery = () => (
  <Layout
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="SegmentSlider"
    elements={[
      {
        title: 'Default SegmentSlider',
        element: <SegmentSliderDemo />,
      },
    ]}
  />
);

export default SegmentSliderGallery;
