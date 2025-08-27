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

const HorizontalRadioExample = () => {
  const [radioValue, setRadioValue] = useState<string>('medium');
  const options = [
    { label: 'Small', value: 'small' },
    { label: 'Medium', value: 'medium' },
    { label: 'Large', value: 'large' },
    { label: 'Extra Large', value: 'xl' },
  ];

  return (
    <Radio
      value={radioValue}
      onChange={setRadioValue}
      orientation="horizontal"
      gap="$6"
      options={options}
    />
  );
};

const RadioItemDisabledExample = () => {
  const [radioValue, setRadioValue] = useState<string>();
  const options = [
    { label: 'Option 4', value: '4' },
    { label: 'Option 5', value: '5' },
    { label: 'Option 6', value: '6', disabled: true },
  ];
  return (
    <Radio value={radioValue} onChange={setRadioValue} options={options} />
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
      {
        title: 'Horizontal Layout',
        element: <HorizontalRadioExample />,
      },
      {
        title: 'Radio Item Disabled',
        element: <RadioItemDisabledExample />,
      },
    ]}
  />
);

export default RadioGallery;
