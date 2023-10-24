import { useState } from 'react';

import { Radio, SegmentControl } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const SegmentControlExample = () => {
  const [value, setValue] = useState(1);
  return (
    <SegmentControl
      value={value}
      onChange={(v) => {
        setValue(v as number);
      }}
      options={[
        { label: 'Option 1', value: 1 },
        { label: 'Option 2', value: 2 },
        { label: 'Option 3', value: 3 },
      ]}
    />
  );
};

const SegmentControlGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Default',
        element: <SegmentControlExample />,
      },
    ]}
  />
);

export default SegmentControlGallery;
