import { useState } from 'react';

import type { ICheckboxProps } from '@onekeyhq/components';
import { Checkbox, Stack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

function CheckboxDemo({ ...props }: ICheckboxProps) {
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
    getFilePath={() => __CURRENT_FILE_PATH__}
    componentName="Checkbox"
    elements={[
      {
        title: 'Default',
        element: (
          <Stack>
            <CheckboxDemo />
            <CheckboxDemo label="With label" />
            <CheckboxDemo label="With label" description="With description" />
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
