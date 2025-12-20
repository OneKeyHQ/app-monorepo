/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable react/no-unstable-nested-components */
import { useState } from 'react';

import { SegmentSlider, Stack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const SegmentSliderDemo = () => {
  const [value, setValue] = useState(0);
  return (
    <Stack gap="$4" padding="$4">
      <SegmentSlider value={value} onChange={setValue} segments={4} />
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
