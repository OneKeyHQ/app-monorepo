import { useState } from 'react';

import type { CheckboxProps, CheckedState } from '@onekeyhq/components';
import { Checkbox, Stack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

function CheckboxDemo({ ...props }: CheckboxProps) {
  const [val, setVal] = useState(false);

  return (
    <Checkbox
      value={val}
      onChange={() => {
        setVal(!val);
      }}
      {...props}
    />
  );
}

function CheckboxGroupDemo() {
  const [val, setVal] = useState([false, true, false] as CheckedState[]);
  return (
    <Checkbox.Group
      label="All"
      options={[
        { label: 'Apple' },
        { label: 'Banana' },
        { label: 'Orange' },
        { label: 'Watermelon' },
        { label: 'Apple' },
        { label: 'Banana' },
        { label: 'Orange' },
        { label: 'Watermelon' },
        { label: 'Apple' },
        { label: 'Banana' },
        { label: 'Orange' },
        { label: 'Watermelon' },
        { label: 'Apple' },
        { label: 'Banana' },
        { label: 'Orange' },
        { label: 'Watermelon' },
        { label: 'Apple' },
        { label: 'Banana' },
        { label: 'Orange' },
        { label: 'Watermelon' },
        { label: 'Apple' },
        { label: 'Banana' },
        { label: 'Orange' },
        { label: 'Watermelon' },
        { label: 'Apple' },
        { label: 'Banana' },
        { label: 'Orange' },
        { label: 'Watermelon' },
        { label: 'Apple' },
        { label: 'Banana' },
        { label: 'Orange' },
        { label: 'Watermelon' },
        { label: 'Apple' },
        { label: 'Banana' },
        { label: 'Orange' },
        { label: 'Watermelon' },
        { label: 'Apple' },
        { label: 'Banana' },
        { label: 'Orange' },
        { label: 'Watermelon' },
      ]}
      value={val}
      onChange={(value) => {
        setVal(value);
      }}
    />
  );
}

const CheckboxGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Default',
        element: (
          <Stack>
            <CheckboxDemo />
            <CheckboxDemo label="With label" />
            <CheckboxDemo
              label="Unchecked and disabled"
              disabled
              value={false}
            />
            <CheckboxDemo label="Checked and disabled" disabled value />
          </Stack>
        ),
      },
      {
        title: 'Checkbox Group',
        element: <CheckboxGroupDemo />,
      },
    ]}
  />
);

export default CheckboxGallery;
