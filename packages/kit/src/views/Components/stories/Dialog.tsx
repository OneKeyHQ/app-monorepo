import { useState } from 'react';

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
      renderTrigger={<Text>Open Modal by Text</Text>}
      renderContent={<Text>Overlay Content by Text Trigger</Text>}
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
        renderContent={<Text>Overlay Content by Button Trigger</Text>}
      />
    </>
  );
};

const DialogGallery = () => (
  <Layout
    description="需要用户处理事务，又不希望跳转路由以致打断工作流程时，可以使用 Dialog 组件"
    suggestions={[
      'Dialog 的呈现层级高于页面，但低于 Toast',
      '需要避免在 Dialog 显示需要滚动操作的内容',
    ]}
    boundaryConditions={['禁止将 Dialog 作为路由页面使用']}
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
