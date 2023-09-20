import { useState } from 'react';

import { XStack, YStack } from 'tamagui';

import { Button, Dialog, Text } from '@onekeyhq/components';

import { Layout } from './utils/Layout';

const ControlledDialogByText = () => {
  const [isOpen, changeIsOpen] = useState(false);
  return (
      <Dialog
        open={isOpen}
        onOpen={() => {
          changeIsOpen(true);
        }}
        renderTrigger={(
            <Text>Open Modal By Text</Text>
        )}
        onClose={() => {
          changeIsOpen(false);
        }}
      />
  );
};

const ControlledDialogByButton = () => {
  const [isOpen, changeIsOpen] = useState(false);
  return (
    <>
      <Button onPress={() => changeIsOpen(true)}>
        <Button.Text>Open Modal By Button</Button.Text>
      </Button>
      <Dialog
        open={isOpen}
        onClose={() => {
          changeIsOpen(false);
        }}
      />
    </>
  );
};

const DialogGallery = () => (
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
        title: 'open Modal by renderTrigger',
        element: <ControlledDialogByText />,
      },
      {
        title: 'open Modal by Button',
        element: <ControlledDialogByButton />,
      },
    ]}
  />
);

export default DialogGallery;
