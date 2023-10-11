import { useState } from 'react';

import { XStack } from 'tamagui';

import { Icon, Stack, Text } from '@onekeyhq/components';
import type { ISelectItem } from '@onekeyhq/components/src/Select';
import { Select } from '@onekeyhq/components/src/Select';

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
      data={items}
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
      data={items}
      value={val}
      onValueChange={setVal}
      triggerProps={{
        width: '100%',
        padded: false,
        backgroundColor: '$bgActive',
      }}
      renderTrigger={(item) => (
        <XStack w="100%" justifyContent="space-between">
          <Text variant="$bodySm">Fruit</Text>
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

const SelectGallery = () => (
  <Layout
    description="对操作结果的反馈，无需用户操作即可自行消失"
    suggestions={[
      '使用 Toast 显示简约明确的信息反馈',
      '用户点击或触摸 Toast 内容时，浮层将会停留在页面上',
      'Toast 显示的文本应少于 20 字',
      '不建议使用 Toast 显示过长的报错信息',
    ]}
    boundaryConditions={[
      'Toast 永远拥有最高层级的浮层',
      'Toast 组件能显示的最长文本内容为三排，超出三排将会缩略',
      '界面中只会存在一个 Toast 示例，后触发的 Toast 信息会覆盖前一条 Toast 信息',
    ]}
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
        title: '自定义renderTrigger',
        element: (
          <Stack space="$1">
            <SelectCustomTriggerItem />
          </Stack>
        ),
      },
    ]}
  />
);

export default SelectGallery;
