import { useState } from 'react';

import type { ISelectItem, ISelectSection } from '@onekeyhq/components';
import { Icon, Select, Stack, Text } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const items: ISelectItem[] = [
  {
    label: 'Apple',
    value: 'apple',
  },

  {
    label: 'Pear',
    value: 'pear',
  },

  {
    label: 'Blackberry',
    value: 'blackberry',
  },

  {
    label: 'Peach',
    value: 'peach',
  },

  { label: 'Apricot', value: 'apricot' },

  { label: 'Melon', value: 'melon' },

  { label: 'Honeydew', value: 'honeydew' },

  { label: 'Starfruit', value: 'starfruit' },

  { label: 'Blueberry', value: 'blueberry' },
  { label: 'Banana', value: 'banana' },
];

const SelectDefaultItem = () => {
  const [val, setVal] = useState(items[1].value);

  return (
    <Select items={items} value={val} onChange={setVal} title="Demo Title" />
  );
};

const SelectLongListItem = () => {
  const [val, setVal] = useState('Apple');

  return (
    <Select
      items={new Array(1000).fill(undefined).map((_, index) => ({
        label: String(index),
        value: String(index),
      }))}
      sheetProps={{
        snapPointsMode: 'percent',
        snapPoints: [80],
      }}
      value={val}
      onChange={setVal}
      title="Demo Title"
    />
  );
};

const SelectDisabledItem = () => {
  const [val, setVal] = useState('Apple');

  return (
    <Select
      disabled
      items={items}
      value={val}
      onChange={setVal}
      title="Demo Title"
    />
  );
};

const SelectCustomItem = () => {
  const [val, setVal] = useState('');

  return (
    <Select
      placeholder="please select one"
      renderTrigger={({ value, placeholder }) => (
        <Text>{value || placeholder}</Text>
      )}
      items={items}
      value={val}
      onChange={setVal}
      title="Demo Title"
    />
  );
};

const sections: ISelectSection[] = [
  {
    title: 'emoji Section',
    data: [
      {
        label: 'Apple',
        value: 'Apple',
        leading: <Text variant="$bodyMdMedium">😀</Text>,
      },

      {
        label: 'Pear',
        value: 'Pear',
        leading: <Text variant="$bodyMdMedium">🚅</Text>,
      },

      {
        label: 'Blackberry',
        value: 'Blackberry',
        leading: <Text variant="$bodyMdMedium">🚆</Text>,
      },

      {
        label: 'Peach',
        value: 'Peach',
        leading: <Icon name="AccessibilityEyeOutline" size="$5" />,
      },
    ],
  },
  {
    title: 'plain Section',
    data: [
      { label: 'Apricot', value: 'Apricot' },

      { label: 'Melon', value: 'Melon' },

      { label: 'Honeydew', value: 'Honeydew' },

      { label: 'Starfruit', value: 'Starfruit' },

      { label: 'Blueberry', value: 'Blueberry' },
    ],
  },
];

const SelectSectionsItemDemo = () => {
  const [val, setVal] = useState('Apple');
  return (
    <Select
      sections={sections}
      value={val}
      onChange={setVal}
      title="Demo Title"
    />
  );
};

const SelectGallery = () => (
  <Layout
    description="****"
    suggestions={['****']}
    boundaryConditions={['****']}
    elements={[
      {
        title: '默认状态',
        element: (
          <Stack space="$1">
            <SelectDefaultItem />
          </Stack>
        ),
      },
      {
        title: 'Long List',
        element: (
          <Stack space="$1">
            <SelectLongListItem />
          </Stack>
        ),
      },
      {
        title: 'Disabled',
        element: (
          <Stack space="$1">
            <SelectDisabledItem />
          </Stack>
        ),
      },
      {
        title: 'Custom Trigger',
        element: (
          <Stack space="$1">
            <SelectCustomItem />
          </Stack>
        ),
      },
      {
        title: 'Select Sections',
        element: (
          <Stack space="$1">
            <SelectSectionsItemDemo />
          </Stack>
        ),
      },
    ]}
  />
);

export default SelectGallery;
