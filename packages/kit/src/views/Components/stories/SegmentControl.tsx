import { useState } from 'react';

import { SegmentControl } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const SegmentControlExample1 = () => {
  const [value, setValue] = useState(1);
  return (
    <SegmentControl
      value={value}
      onChange={(v) => {
        setValue(v as number);
      }}
      options={[
        { label: 'Label 1', value: 1 },
        { label: 'Label 2', value: 2 },
        { label: 'Label 3', value: 3 },
      ]}
    />
  );
};

const SegmentControlExample2 = () => {
  const [value, setValue] = useState(1);
  return (
    <SegmentControl
      fullWidth
      value={value}
      onChange={(v) => {
        setValue(v as number);
      }}
      options={[
        { label: 'Label 1', value: 1 },
        { label: 'Label 2', value: 2 },
        { label: 'Label 3', value: 3 },
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
        element: <SegmentControlExample1 />,
      },
      {
        title: 'Full Width',
        element: <SegmentControlExample2 />,
      },
    ]}
  />
);

export default SegmentControlGallery;
