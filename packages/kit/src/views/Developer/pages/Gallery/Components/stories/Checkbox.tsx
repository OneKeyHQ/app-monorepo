import { useState } from 'react';

import type { ICheckboxProps, ICheckedState } from '@onekeyhq/components';
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

function CheckboxGroupDemo() {
  const [val, setVal] = useState<ICheckedState[]>([false, true, false]);
  return (
    <Checkbox.Group
      label="All"
      listStyle={
        {
          // height: 200,
        }
      }
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
        description:
          'Checkbox Group 中展示的 Checkbox 数量越多，在数据更新时将会越影响性能。通过虚拟列表减少同屏展示的视图数量，可以缓解性能问题。',
        element: <CheckboxGroupDemo />,
      },
    ]}
  />
);

export default CheckboxGallery;
