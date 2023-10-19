import { useState } from 'react';

import type { CheckboxProps } from '@onekeyhq/components';
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
    ]}
  />
);

export default CheckboxGallery;
