import { useState } from 'react';

import { Radio } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const RadioExample = () => {
  const [radioValue, setRadioValue] = useState<string>();
  return (
    <Radio
      value={radioValue}
      onChange={setRadioValue}
      options={[
        { label: 'Option 1', value: '1' },
        { label: 'Option 2', value: '2' },
        { label: 'Option 3', value: '3' },
      ]}
    />
  );
};

const RadioGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Default',
        element: <RadioExample />,
      },
    ]}
  />
);

export default RadioGallery;
