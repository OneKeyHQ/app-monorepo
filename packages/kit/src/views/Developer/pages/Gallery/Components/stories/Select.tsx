import { useState } from 'react';

import type { ISelectItem, ISelectSection } from '@onekeyhq/components';
import { Icon, Select, Stack, Text, XStack } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const items: ISelectItem[] = [
  {
    label: 'Apple',
    value: 'Apple',
  },

  {
    label: 'Pear',
    value: 'Pear',
  },

  {
    label: 'Blackberry',
    value: 'Blackberry',
  },

  {
    label: 'Peach',
    value: 'Peach',
  },

  { label: 'Apricot', value: 'Apricot' },

  { label: 'Melon', value: 'Melon' },

  { label: 'Honeydew', value: 'Honeydew' },

  { label: 'Starfruit', value: 'Starfruit' },

  { label: 'Blueberry', value: 'Blueberry' },
];

const SelectDefaultItem = () => {
  const [val, setVal] = useState('Apple');

  return (
    <Select
      items={items}
      value={val}
      onValueChange={setVal}
      triggerProps={{ width: '100%' }}
      disablePreventBodyScroll
      title="Demo Title"
    />
  );
};

const SelectDefaultNativeItem = () => {
  const [val, setVal] = useState('Apple');

  return (
    <Select
      native
      items={items}
      value={val}
      onValueChange={setVal}
      triggerProps={{ width: '100%' }}
      disablePreventBodyScroll
      title="Demo Title"
    />
  );
};

const SelectCustomTriggerItem = () => {
  const [val, setVal] = useState('Apple');

  return (
    <Select
      items={items}
      value={val}
      onValueChange={setVal}
      triggerProps={{
        width: '100%',
        padded: false,
        backgroundColor: '$bgActive',
        overflow: 'hidden',
        borderRadius: '$2',
      }}
      renderTrigger={(item) => (
        <XStack w="100%" justifyContent="space-between">
          <Text variant="$bodyMd">Fruit</Text>
          <XStack space>
            {item?.leading}
            <Text variant="$bodySm">{item?.label ?? 'Fruit'}</Text>
          </XStack>
        </XStack>
      )}
      disablePreventBodyScroll
      title="Custom Trigger"
    />
  );
};

const sections: ISelectSection[] = [
  {
    title: 'emoji Section',
    items: [
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
    items: [
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
      onValueChange={setVal}
      triggerProps={{ width: '100%' }}
      disablePreventBodyScroll
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
        title: '默认状态 native prop',
        element: (
          <Stack space="$1">
            <SelectDefaultNativeItem />
          </Stack>
        ),
      },
      {
        title: '自定义renderTrigger',
        element: (
          <Stack space="$1">
            <SelectCustomTriggerItem />
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
