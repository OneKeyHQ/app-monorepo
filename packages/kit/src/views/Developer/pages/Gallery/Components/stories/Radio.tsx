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
    filePath={__CURRENT_FILE_PATH__}
    componentName="Radio"
    elements={[
      {
        title: 'Default',
        element: <RadioExample />,
      },
    ]}
  />
);

export default RadioGallery;
