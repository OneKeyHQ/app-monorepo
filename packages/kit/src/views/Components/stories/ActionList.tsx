import { useState } from 'react';

import { ListItem } from 'tamagui';

import { Button, Stack, XStack } from '@onekeyhq/components';
import { ActionList } from '@onekeyhq/components/src/ActionList';

import { Layout } from './utils/Layout';

const ActionListDemo = () => (
  <ActionList
    actions={[
      {
        name: 'Action1',
        icon: 'PlaceholderOutline',
        onPress: () => console.log('action1'),
      },
      {
        name: 'Action2',
        icon: 'PlaceholderOutline',
        onPress: () => console.log('action2'),
      },
    ]}
    renderTrigger={() => (
      <XStack
        w="100%"
        justifyContent="space-between"
        padding="$4"
        borderColor="$borderColor"
        borderWidth="$px"
        borderRadius="$2"
        space
      >
        <XStack w="$5" h="$5" backgroundColor="$red10" />
        <XStack w="$5" h="$5" backgroundColor="$blue10" />
        <XStack w="$5" h="$5" backgroundColor="$yellow10" />
      </XStack>
    )}
  />
);

const ActionListWithButton = () => {
  const [open, onOpenChange] = useState(false);

  return (
    <ActionList
      open={open}
      onOpenChange={onOpenChange}
      actions={[
        {
          name: 'Action1',
          icon: 'PlaceholderOutline',
          onPress: () => console.log('action1'),
        },
        {
          name: 'Action2',
          icon: 'PlaceholderOutline',
          onPress: () => console.log('action2'),
        },
      ]}
      renderTrigger={() => (
        <Button
          w="100%"
          size="large"
          buttonVariant="primary"
          onPress={() => onOpenChange(true)}
        >
          <Button.Text>Button</Button.Text>
        </Button>
      )}
    />
  );
};

const ActionListGallery = () => (
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
        title: 'ActionList默认',
        element: (
          <Stack space="$1">
            <XStack w="50%">
              <ActionListDemo />
            </XStack>
          </Stack>
        ),
      },
      {
        title: 'ActionList with Button',
        element: (
          <Stack space="$1">
            <ActionListWithButton />
          </Stack>
        ),
      },
    ]}
  />
);

export default ActionListGallery;
